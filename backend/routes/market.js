const express = require('express');
const router = express.Router();
let walletRepo = null; try { walletRepo = require('../repos/walletRepo'); } catch(_) { walletRepo = null; }
let marketRepo = null; try { marketRepo = require('../repos/marketRepo'); } catch(_) { marketRepo = null; }
const { preferSessionUserId } = require('../middleware/sessionUser');
const https = require('https');
const { URL } = require('url');
let roles = null; try { roles = require('../services/roles'); } catch(_) { roles = { getRoles: ()=>[] }; }
const adminAuth = require('../middleware/adminAuth');
const auth = require('../services/authStore');

function postJSON(urlStr, data){
  return new Promise((resolve)=>{
    try{
      const u = new URL(urlStr);
      const body = Buffer.from(JSON.stringify(data));
      const opts = { method:'POST', hostname: u.hostname, path: u.pathname + (u.search||''), headers: { 'Content-Type':'application/json', 'Content-Length': body.length } };
      const rq = https.request(opts, r => { r.on('data',()=>{}); r.on('end', resolve); });
      rq.on('error', ()=>resolve()); rq.write(body); rq.end();
    }catch(_){ resolve(); }
  });
}

function getSessUserId(req){
  try{
    const raw = String(req.headers.cookie || '');
    let sid='';
    for(const part of raw.split(/;\s*/)){ const [k,v]=part.split('='); if(k==='sid'){ sid=v; break; } }
    const sess = sid ? auth.getSession(sid) : null;
    return (sess && sess.userId) ? String(sess.userId) : '';
  }catch(_){ return ''; }
}
function rolesAllow(req){
  try{
    const uid = getSessUserId(req);
    if (!uid) return false;
    const rs = (roles && typeof roles.getRoles==='function') ? roles.getRoles(uid) : [];
    const ok = rs.includes('tote') || rs.includes('admin');
    if (ok) { req.admin = { userName: uid }; }
    return ok;
  }catch(_){ return false; }
}
function toteOrAdmin(req,res,next){ try{ if (rolesAllow(req)) return next(); return adminAuth(req,res,next); }catch(_){ return res.status(500).json({ success:false, error:'auth_error' }); } }

// POST /api/market/redeem-100-fire
router.post('/redeem-100-fire', async (req,res)=>{
  try{
    const userId = preferSessionUserId(req, req.body && req.body.userId);
    if (!userId) return res.status(400).json({ success:false, error:'invalid_user' });
    if (!walletRepo || !marketRepo) return res.status(503).json({ success:false, error:'repo_unavailable' });
    const bal = await walletRepo.getBalancesByExt(userId);
    const fires = bal ? Number(bal.fires||0) : 0;
    if (fires < 100) return res.status(400).json({ success:false, error:'insufficient_fires' });

    const cedula = String(req.body && req.body.cedula || '').replace(/[^0-9]/g,'').slice(0,12);
    const telefono = String(req.body && req.body.telefono || '').replace(/[^0-9+]/g,'').slice(0,16);
    const bankCode = String(req.body && req.body.bankCode || '').slice(0,8);
    const bankName = String(req.body && req.body.bankName || '').slice(0,64);
    if (!cedula || !telefono || !bankCode) return res.status(400).json({ success:false, error:'invalid_params' });

    // Notificación a admin por Telegram
    const token = process.env.TELEGRAM_BOT_TOKEN || '';
    const adminTgId = String(process.env.FIRE_REQUEST_ADMIN_TG_ID || '1417856820');
    if (token && adminTgId){
      const hostUrl = `${req.protocol}://${req.get('host')}`;
      const text = [
        'Nueva solicitud de canje (Mercado del Fuego)',
        `Usuario: ${userId}`,
        `Saldo actual: ${fires} 🔥`,
        'Canje: 100 🔥 → 100 Bs',
        `Cédula: ${cedula}`,
        `Teléfono: ${telefono}`,
        `Banco: ${bankCode}${bankName?(' - '+bankName):''}`,
        hostUrl+'/market'
      ].join('\n');
      try{
        await postJSON(`https://api.telegram.org/bot${token}/sendMessage`, { chat_id: adminTgId, text });
      }catch(_){ }
    }

    // Registrar solicitud en DB, sin debitar aún
    try{ await marketRepo.createRedeem({ userExt: userId, amount: 100, cedula, telefono, bankCode, bankName, meta: {} }); }catch(_){ }

    return res.json({ success:true });
  }catch(err){ return res.status(500).json({ success:false, error:'redeem_error' }); }
});

// Admin: listar redenciones
router.get('/redeems/pending', toteOrAdmin, async (req,res)=>{
  try{ if (!marketRepo) return res.status(503).json({ success:false, error:'repo_unavailable' });
    const { limit, offset } = req.query||{}; const out = await marketRepo.listAll({ status:'pending', limit, offset }); return res.json({ success:true, ...out });
  }catch(_){ return res.status(500).json({ success:false, error:'list_error' }); }
});
router.get('/redeems/list', toteOrAdmin, async (req,res)=>{
  try{ if (!marketRepo) return res.status(503).json({ success:false, error:'repo_unavailable' });
    const { status, limit, offset } = req.query||{}; const out = await marketRepo.listAll({ status, limit, offset }); return res.json({ success:true, ...out });
  }catch(_){ return res.status(500).json({ success:false, error:'list_error' }); }
});
router.post('/redeems/:id/accept', toteOrAdmin, async (req,res)=>{
  try{ if (!marketRepo) return res.status(503).json({ success:false, error:'repo_unavailable' });
    const r = await marketRepo.accept({ id: req.params.id, adminUserName: req.admin?.userName || 'admin' }); return res.json({ success:true, ...r });
  }catch(err){ const msg = (err&&err.message)||'accept_error'; const code = (msg==='redeem_not_found'||msg==='redeem_not_pending'||msg==='user_not_mapped'||msg==='wallet_missing'||msg==='insufficient_fires')?400:500; return res.status(code).json({ success:false, error: msg }); }
});
router.post('/redeems/:id/reject', toteOrAdmin, async (req,res)=>{
  try{ if (!marketRepo) return res.status(503).json({ success:false, error:'repo_unavailable' });
    const r = await marketRepo.reject({ id: req.params.id, adminUserName: req.admin?.userName || 'admin' }); return res.json({ success:true, ...r });
  }catch(err){ const msg = (err&&err.message)||'reject_error'; const code = (msg==='redeem_not_found'||msg==='redeem_not_pending')?400:500; return res.status(code).json({ success:false, error: msg }); }
});

module.exports = router;
