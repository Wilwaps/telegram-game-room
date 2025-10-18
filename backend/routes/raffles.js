const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const store = require('../services/memoryStore');
const useSql = String(process.env.RAFFLES_BACKEND||'').toLowerCase()==='sql';
const raffles = useSql ? require('../services/raffleStoreSql') : require('../services/raffleStore');
const { preferSessionUserId, requireSessionUser, UserIdError } = require('../middleware/sessionUser');
const messages = require('../services/messageStore');
const https = require('https');
const { URL } = require('url');

function postJSON(urlStr, data) {
  return new Promise((resolve) => {
    try {
      const u = new URL(urlStr);
      const body = Buffer.from(JSON.stringify(data));
      const opts = { method: 'POST', hostname: u.hostname, path: u.pathname + (u.search||''), headers: { 'Content-Type':'application/json', 'Content-Length': body.length } };
      const rq = https.request(opts, r => { r.on('data',()=>{}); r.on('end', resolve); });
      rq.on('error', () => resolve()); rq.write(body); rq.end();
    } catch(_) { resolve(); }
  });
}

async function notifyAdminNewRaffle(req, rec){
  try{
    const token = process.env.TELEGRAM_BOT_TOKEN || '';
    const adminTgId = String(process.env.FIRE_REQUEST_ADMIN_TG_ID || '1417856820');
    if (!token || !adminTgId) return;
    const hostUrl = `${req.protocol}://${req.get('host')}`;
    const text = `Nueva rifa creada\nHost: ${rec.hostId}\nModo: ${rec.mode}\nEntry: ${rec.entryPrice}\nCode: ${rec.code}\n${hostUrl}/raffles/room?code=${rec.code}`;
    const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`;
    await postJSON(apiUrl, { chat_id: adminTgId, text });
  }catch(_){}
}

router.get('/public', (req,res)=>{
  const { limit, offset } = req.query||{};
  const out = raffles.listPublic({ limit, offset });
  res.json({ success:true, ...out, items: out.items.map(r=>raffles.getPublicInfo(r)) });
});

router.get('/by-host/:userId', (req,res)=>{
  const { userId } = req.params; const { limit, offset } = req.query||{};
  const out = raffles.listByHost(userId, { limit, offset });
  res.json({ success:true, ...out, items: out.items.map(r=>raffles.getPublicInfo(r)) });
});

router.get('/by-user/:userId', (req,res)=>{
  const { userId } = req.params; const { limit, offset } = req.query||{};
  const out = raffles.listParticipating(userId, { limit, offset });
  res.json({ success:true, ...out, items: out.items.map(r=>raffles.getPublicInfo(r)) });
});

router.get('/id/:id', (req,res)=>{
  const r = raffles.details(req.params.id);
  if (!r) return res.status(404).json({ success:false, error:'raffle_not_found' });
  res.json({ success:true, raffle:r });
});

router.get('/code/:code', (req,res)=>{
  const r = raffles.findByCode(req.params.code);
  if (!r) return res.status(404).json({ success:false, error:'raffle_not_found' });
  res.json({ success:true, raffle: raffles.details(r.id) });
});

router.post('/create', (req,res)=>{
  try{
    const { hostId, hostName, mode, entryPrice, visibility, range, time, name, hostMeta, prizeMeta } = req.body||{};
    const realHostId = preferSessionUserId(req, hostId);
    const rec = raffles.create({ hostId: realHostId, hostName, mode, entryPrice, visibility, range, time: (time==='Ganador'?'winner': time==='1 día'?'1d': time==='1 semana'?'1w': time), name, hostMeta, prizeMeta });
    // notificar admin
    notifyAdminNewRaffle(req, rec);
    try{
      const dep = (rec.mode==='fire') ? Number(rec.entryPrice||0) : (rec.mode==='prize'?200:0);
      messages.send({ toUserId: 'tg:1417856820', text: `Sala de rifa iniciada ${dep} 🔥 (host: ${rec.hostId}, code: ${rec.code})` });
    }catch(_){ }
    res.json({ success:true, raffle: raffles.getPublicInfo(rec) });
  }catch(err){
    if (err instanceof UserIdError) return res.status(err.status || 400).json({ success:false, error: err.message });
    res.status(400).json({ success:false, error: (err&&err.message)||'create_error' }); }
});

router.post('/:id/reserve', (req,res)=>{
  try{
    const { userId, number } = req.body||{};
    const realUserId = preferSessionUserId(req, userId);
    const out = raffles.reserve({ id: req.params.id, userId: realUserId, number });
    res.json({ success:true, ...out });
  }catch(err){
    if (err instanceof UserIdError) return res.status(err.status || 400).json({ success:false, error: err.message });
    res.status(400).json({ success:false, error:(err&&err.message)||'reserve_error' }); }
});

router.post('/:id/release', (req,res)=>{
  try{
    const { userId, number } = req.body||{};
    const realUserId = preferSessionUserId(req, userId);
    const out = raffles.release({ id: req.params.id, userId: realUserId, number });
    res.json({ success:true, ...out });
  }catch(err){
    if (err instanceof UserIdError) return res.status(err.status || 400).json({ success:false, error: err.message });
    res.status(400).json({ success:false, error:(err&&err.message)||'release_error' }); }
});

router.post('/:id/confirm', (req,res)=>{
  try{
    const { userId, number, reference } = req.body||{};
    const realUserId = preferSessionUserId(req, userId);
    const r = raffles.findById(req.params.id);
    if (!r) return res.status(404).json({ success:false, error:'raffle_not_found' });
    if (r.mode === 'fire' || r.mode === 'free'){
      const out = raffles.confirm({ id: r.id, userId: realUserId, number, reference });
      // mensaje al usuario
      messages.send({ toUserId: realUserId, text: `Te has unido a la rifa ${r.code} con el número ${String(number).padStart(2,'0')}. Te notificaremos al finalizar.` });
      return res.json({ success:true, ...out });
    } else {
      // modo premio: generar solicitud pendiente (simplemente reservar más tiempo y añadir a participants como pending)
      const idx = Math.max(0, Math.min(r.size-1, Number(number)||0));
      const cur = r.numbers[idx];
      if (!(cur.state===0 || (cur.state===1 && cur.reservedBy===String(realUserId)))) throw new Error('not_available');
      r.numbers[idx] = { idx, state:1, reservedBy:String(realUserId), reservedUntil: Date.now()+5*60*1000 };
      r.pending.push({ idx, userId:String(realUserId), reference:String(reference||''), ts: Date.now() });
      messages.send({ toUserId: realUserId, text: `Te has unido a la rifa ${r.code} con el número ${String(number).padStart(2,'0')}. Te notificaremos al finalizar.` });
      return res.json({ success:true, pending:true });
    }
  }catch(err){
    if (err instanceof UserIdError) return res.status(err.status || 400).json({ success:false, error: err.message });
    res.status(400).json({ success:false, error:(err&&err.message)||'confirm_error' }); }
});

router.get('/:id/pending', (req,res)=>{
  const r = raffles.findById(req.params.id);
  if (!r) return res.status(404).json({ success:false, error:'raffle_not_found' });
  res.json({ success:true, items: r.pending||[] });
});

router.post('/:id/approve', (req,res)=>{
  try{
    const r = raffles.findById(req.params.id);
    if (!r) return res.status(404).json({ success:false, error:'raffle_not_found' });
    const hostId = requireSessionUser(req);
    if (hostId !== r.hostId) throw new UserIdError('not_host', 403);
    const { number, approve } = req.body||{};
    const idx = Math.max(0, Math.min(r.size-1, Number(number)||0));
    const pidx = (r.pending||[]).findIndex(x=>x.idx===idx);
    if (pidx<0) throw new Error('pending_not_found');
    const p = r.pending[pidx];
    if (approve){
      r.numbers[idx] = { idx, state:2, buyer: p.userId, ref: p.reference };
      let pr = r.participants.find(x=>x.userId===p.userId); if (!pr) { pr={ userId:p.userId, numbers:[], refs:[], ts:Date.now() }; r.participants.push(pr); }
      pr.numbers.push(idx); pr.refs.push(p.reference);
      messages.send({ toUserId: p.userId, text: `Tu compra del número ${String(idx).padStart(2,'0')} en la rifa ${r.code} fue aprobada.` });
    } else {
      r.numbers[idx] = { idx, state:0 };
      messages.send({ toUserId: p.userId, text: `Tu solicitud del número ${String(idx).padStart(2,'0')} en la rifa ${r.code} fue rechazada.` });
    }
    r.pending.splice(pidx,1);
    // cierre por llenado/tiempo
    const soldCount = r.numbers.filter(n=>n.state===2).length;
    if (soldCount>=r.size || (r.endsAt && r.endsAt<=Date.now())){ raffles.closeAndPayout(r); }
    res.json({ success:true });
  }catch(err){
    if (err instanceof UserIdError) return res.status(err.status || 400).json({ success:false, error: err.message });
    res.status(400).json({ success:false, error:(err&&err.message)||'approve_error' }); }
});

// GET /api/raffles/:id/stream (SSE)
router.get('/:id/stream', (req, res) => {
  try{
    const id = String(req.params.id||'').trim();
    const r0 = raffles.findById(id);
    if (!r0) return res.status(404).end();
    res.set({ 'Content-Type':'text/event-stream', 'Cache-Control':'no-cache', Connection:'keep-alive' });
    res.flushHeaders && res.flushHeaders();

    const send = (name, payload)=>{ try{ res.write(`event: ${name}\n`); res.write(`data: ${JSON.stringify(payload)}\n\n`); }catch(_){ } };

    // snapshot inicial
    send('snapshot', { raffle: raffles.details(id), ts: Date.now() });

    // heartbeat
    const hb = setInterval(()=>{ try{ res.write(': ping\n\n'); }catch(_){ } }, 15000);

    const onUpd = (ev)=>{ if (!ev || ev.id!==id) return; send('update', { delta: { idx: ev.idx, action: ev.action }, raffle: raffles.details(id), ts: Date.now() }); };
    raffles.on('raffle_updated', onUpd);

    req.on('close', ()=>{ clearInterval(hb); raffles.off('raffle_updated', onUpd); });
  }catch(_){ try{ res.status(500).end(); }catch(__){} }
});

// Documentos
router.get('/:id/documents', (req,res)=>{
  const r = raffles.findById(req.params.id);
  if (!r) return res.status(404).json({ success:false, error:'raffle_not_found' });
  const items = (r.documents||[]).map(d=>({ id:d.id, name:d.name, type:d.type, createdAt:d.createdAt, sizeBytes:d.sizeBytes||0 }));
  res.json({ success:true, items });
});

router.get('/:id/documents/:docId/download', (req,res)=>{
  try{
    const r = raffles.findById(req.params.id);
    if (!r) return res.status(404).json({ success:false, error:'raffle_not_found' });
    const d = (r.documents||[]).find(x=>x.id===req.params.docId);
    if (!d || !d.path) return res.status(404).json({ success:false, error:'document_not_found' });
    const base = path.resolve(__dirname, '../../storage/raffles');
    const full = path.resolve(d.path);
    if (!full.startsWith(base)) return res.status(403).json({ success:false, error:'forbidden' });
    if (!fs.existsSync(full)) return res.status(404).json({ success:false, error:'file_missing' });
    res.download(full, d.name);
  }catch(err){ res.status(500).json({ success:false, error:'download_error' }); }
});

module.exports = router;
