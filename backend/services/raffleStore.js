const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const store = require('./memoryStore');
const messages = require('./messageStore');

const SPONSOR_ID = 'tg:1417856820';

class RaffleStore extends EventEmitter {
  constructor(){
    super();
    this.raffles = []; // newest first
  }

  genId(){ return 'rf_' + Date.now() + '_' + Math.random().toString(36).slice(2,6); }
  genCode(){ return 'R' + Math.random().toString(36).slice(2,7).toUpperCase(); }

  sizeFromRange(range){ return (range === '000-999') ? 1000 : 100; }

  potUserId(id){ return 'pot:' + String(id); }

  cleanupExpired(raffle){
    const now = Date.now();
    if (!raffle || !Array.isArray(raffle.numbers)) return;
    for (let i=0;i<raffle.numbers.length;i++){
      const n = raffle.numbers[i];
      if (n && n.state === 1 && n.reservedUntil && n.reservedUntil < now){
        raffle.numbers[i] = { idx: i, state: 0 };
      }
    }
  }

  listPublic({ limit=20, offset=0 }){
    const arr = this.raffles.filter(r => r.visibility === 'public' && r.status === 'active');
    const l = Math.max(1, Math.min(50, Number(limit)||20));
    const o = Math.max(0, Number(offset)||0);
    return { items: arr.slice(o, o+l), total: arr.length, limit: l, offset: o };
  }

  listByHost(hostId, { limit=20, offset=0 }={}){
    const id = String(hostId||'').trim();
    const arr = this.raffles.filter(r => r.hostId === id);
    const l = Math.max(1, Math.min(50, Number(limit)||20));
    const o = Math.max(0, Number(offset)||0);
    return { items: arr.slice(o, o+l), total: arr.length, limit: l, offset: o };
  }

  listParticipating(userId, { limit=20, offset=0 }={}){
    const id = String(userId||'').trim();
    const arr = this.raffles.filter(r => (r.participants||[]).some(p => p.userId === id));
    const l = Math.max(1, Math.min(50, Number(limit)||20));
    const o = Math.max(0, Number(offset)||0);
    return { items: arr.slice(o, o+l), total: arr.length, limit: l, offset: o };
  }

  findById(id){ return this.raffles.find(r => r.id === String(id||'').trim()) || null; }
  findByCode(code){ return this.raffles.find(r => r.code === String(code||'').trim().toUpperCase()) || null; }

  create({ hostId, hostName, mode='fire', entryPrice=10, visibility='public', range='00-99', time='winner', name, hostMeta, prizeMeta }){
    const hid = String(hostId||'').trim();
    if (!hid) throw new Error('invalid_host');
    const ep = Math.max(0, Math.floor(Number(entryPrice)||0));
    const rng = (range === '000-999') ? '000-999' : '00-99';
    const size = this.sizeFromRange(rng);
    const vis = (visibility === 'private') ? 'private' : 'public';
    const tm = (time === '1d' || time === '1w') ? time : 'winner';

    if (mode === 'fire'){
      if (ep < 10) throw new Error('min_entry_10');
      // Depósito del anfitrión: mismo monto que entryPrice hacia sponsor
      const dep = store.transferFires({ fromUserId: hid, toUserId: SPONSOR_ID, amount: ep, reason: 'raffle_fire_deposit' });
      if (!dep.ok) throw new Error(dep.error || 'deposit_failed');
    } else if (mode === 'prize'){
      // Depósito fijo de 200 🔥 al sponsor
      const dep = store.transferFires({ fromUserId: hid, toUserId: SPONSOR_ID, amount: 200, reason: 'raffle_prize_deposit' });
      if (!dep.ok) throw new Error(dep.error || 'deposit_failed');
    } else {
      throw new Error('invalid_mode');
    }

    const id = this.genId();
    const code = this.genCode();
    const endsAt = tm === '1d' ? (Date.now() + 24*3600*1000) : tm === '1w' ? (Date.now() + 7*24*3600*1000) : null;
    const numbers = Array.from({length:size}, (_,i)=>({ idx:i, state:0 }));

    // Asegurar cuenta del pot
    store.ensureUser(this.potUserId(id));

    const rec = {
      id, code,
      hostId: hid,
      hostName: hostName || hid,
      name: String(name||'').trim() || code,
      mode, entryPrice: ep,
      visibility: vis,
      range: rng, size,
      time: tm, createdAt: Date.now(), endsAt,
      numbers,
      participants: [],
      status: 'active',
      winner: null,
      hostMeta: hostMeta || {},
      prizeMeta: prizeMeta || {},
      documents: []
    };
    this.raffles.unshift(rec);
    return rec;
  }

  getPublicInfo(raffle){
    // No exponer quién reservó cada número para privacidad
    const sold = raffle.numbers.filter(n => n.state===2).length;
    const reserved = raffle.numbers.filter(n => n.state===1).length;
    const available = raffle.size - sold - reserved;
    return {
      id: raffle.id,
      code: raffle.code,
      name: raffle.name || raffle.code,
      hostId: raffle.hostId,
      hostName: raffle.hostName,
      mode: raffle.mode,
      entryPrice: raffle.entryPrice,
      visibility: raffle.visibility,
      range: raffle.range,
      size: raffle.size,
      createdAt: raffle.createdAt,
      endsAt: raffle.endsAt,
      status: raffle.status,
      sold, reserved, available,
      potFires: (store.getUser(this.potUserId(raffle.id))?.fires)||0,
      prize: raffle.prizeMeta?.prize || undefined
    };
  }

  details(id){
    const r = this.findById(id);
    if (!r) return null;
    this.cleanupExpired(r);
    const mapNumbers = r.numbers.map(n => ({ idx:n.idx, state:n.state }));
    const docs = (r.documents||[]).map(d=>({ id:d.id, name:d.name, type:d.type, createdAt:d.createdAt, sizeBytes:d.sizeBytes||0 }));
    return { ...this.getPublicInfo(r), numbers: mapNumbers, participants: r.participants, winner: r.winner, documents: docs };
  }

  reserve({ id, userId, number }){
    const r = this.findById(id); if (!r || r.status!=='active') throw new Error('raffle_not_active');
    this.cleanupExpired(r);
    const idx = Math.max(0, Math.min(r.size-1, Number(number)||0));
    const cur = r.numbers[idx];
    if (cur.state !== 0) throw new Error('not_available');
    const uid = String(userId||'').trim(); if (!uid) throw new Error('invalid_user');
    r.numbers[idx] = { idx, state:1, reservedBy: uid, reservedUntil: Date.now()+45*1000 };
    return { ok:true, idx };
  }

  release({ id, userId, number }){
    const r = this.findById(id); if (!r || r.status!=='active') throw new Error('raffle_not_active');
    const idx = Math.max(0, Math.min(r.size-1, Number(number)||0));
    const cur = r.numbers[idx];
    const uid = String(userId||'').trim(); if (!uid) throw new Error('invalid_user');
    if (cur.state === 1 && cur.reservedBy === uid){ r.numbers[idx] = { idx, state:0 }; return { ok:true }; }
    return { ok:false };
  }

  confirm({ id, userId, number, reference }){
    const r = this.findById(id); if (!r || r.status!=='active') throw new Error('raffle_not_active');
    this.cleanupExpired(r);
    const idx = Math.max(0, Math.min(r.size-1, Number(number)||0));
    const cur = r.numbers[idx];
    const uid = String(userId||'').trim(); if (!uid) throw new Error('invalid_user');
    if (!(cur.state===0 || (cur.state===1 && cur.reservedBy===uid))) throw new Error('not_available');

    // Cobro: transferir del usuario al pot de la rifa
    const potId = this.potUserId(r.id);
    const tr = store.transferFires({ fromUserId: uid, toUserId: potId, amount: r.entryPrice, reason: 'raffle_buy' });
    if (!tr.ok) throw new Error(tr.error || 'payment_failed');

    r.numbers[idx] = { idx, state:2, buyer: uid, ref: String(reference||'').trim() };
    let p = r.participants.find(x => x.userId===uid);
    if (!p) { p = { userId: uid, numbers: [], refs: [], ts: Date.now() }; r.participants.push(p); }
    p.numbers.push(idx);
    p.refs.push(String(reference||''));

    // Cierre por llenado
    const soldCount = r.numbers.filter(n=>n.state===2).length;
    if (soldCount >= r.size) { this.closeAndPayout(r); }

    // Cierre por tiempo
    if (r.endsAt && r.endsAt <= Date.now()) { this.closeAndPayout(r); }

    return { ok:true };
  }

  pickWinner(r){
    const soldIdxs = r.numbers.filter(n=>n.state===2).map(n=>n.idx);
    if (soldIdxs.length===0) return null;
    const pick = soldIdxs[Math.floor(Math.random()*soldIdxs.length)];
    const buyer = r.numbers[pick]?.buyer || null;
    return { number: pick, userId: buyer };
  }

  closeAndPayout(r){
    if (!r || r.status!=='active') return;
    r.status = 'closed';
    // Ganador
    const win = this.pickWinner(r);
    r.winner = win;

    // Payout (solo para modo fuego); modo premio no hay pot payout
    if (r.mode === 'fire' && win && win.userId){
      const potId = this.potUserId(r.id);
      const potBal = (store.getUser(potId)?.fires)||0;
      if (potBal>0){
        const g = Math.floor(potBal * 0.70);
        const h = Math.floor(potBal * 0.20);
        const s = Math.max(0, potBal - g - h); // 10%
        try{ store.transferFires({ fromUserId: potId, toUserId: win.userId, amount: g, reason: 'raffle_payout_winner' }); }catch(_){ }
        try{ store.transferFires({ fromUserId: potId, toUserId: r.hostId, amount: h, reason: 'raffle_payout_host' }); }catch(_){ }
        try{ store.transferFires({ fromUserId: potId, toUserId: SPONSOR_ID, amount: s, reason: 'raffle_payout_sponsor' }); }catch(_){ }
      }
    }

    r.status = 'completed';
    try { this.generateClosurePDF(r); } catch(_) { }
    try{
      // Notificar a participantes
      const parts = (r.participants||[]).map(p=>p.userId);
      const uniq = Array.from(new Set(parts));
      for (const uid of uniq){
        messages.send({ toUserId: uid, text: `La rifa ${r.code} ha finalizado. ${win&&win.userId===uid? '¡Eres el ganador!':'Gracias por participar.'}` });
      }
      if (win && win.userId){ messages.send({ toUserId: win.userId, text: `¡Felicitaciones! Ganaste la rifa ${r.code}.` }); }
      messages.send({ toUserId: r.hostId, text: `Tu rifa ${r.code} ha finalizado. ${win?('Ganador: '+win.userId):'Sin ganador'}.` });
    }catch(_){ }
    this.emit('raffle_completed', { id: r.id, winner: r.winner });
  }

  generateClosurePDF(r){
    try{
      const base = path.resolve(__dirname, '../../storage/raffles');
      fs.mkdirSync(base, { recursive: true });
      const fileId = 'doc_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
      const filename = `Acta_${r.code}_${new Date().toISOString().slice(0,10)}.pdf`;
      const fullPath = path.join(base, filename);
      let ok=false, size=0;
      try{
        // Carga condicional de pdfkit para evitar crashear si no está instalado localmente
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const stream = fs.createWriteStream(fullPath);
        doc.pipe(stream);
        doc.fontSize(18).text('Acta de Cierre de Rifa', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Código: ${r.code}`);
        doc.text(`Nombre: ${r.name||r.code}`);
        doc.text(`Anfitrión: ${r.hostName||r.hostId}`);
        doc.text(`Modo: ${r.mode}`);
        if (r.mode==='fire') doc.text(`Costo/Número: ${r.entryPrice} 🔥`);
        if (r.prizeMeta && r.prizeMeta.prize) doc.text(`Premio: ${r.prizeMeta.prize}`);
        doc.text(`Rango: ${r.range} (total ${r.size})`);
        doc.text(`Creada: ${new Date(r.createdAt).toLocaleString()}`);
        if (r.endsAt) doc.text(`Cierre: ${new Date(r.endsAt).toLocaleString()}`);
        doc.moveDown();
        const potId = this.potUserId(r.id);
        const potBal = (store.getUser(potId)?.fires)||0;
        doc.text(`Pozo final: ${potBal} 🔥`);
        if (r.winner){
          doc.text(`Ganador: ${r.winner.userId || '-'} con número ${typeof r.winner.number==='number'? String(r.winner.number).padStart(r.range==='000-999'?3:2,'0') : '-'}`);
        } else {
          doc.text('Ganador: -');
        }
        doc.moveDown();
        const parts = (r.participants||[]);
        doc.text(`Participantes: ${parts.length}`);
        doc.moveDown();
        doc.text('Resumen de números vendidos:', { underline: true });
        const sold = r.numbers.filter(n=>n.state===2);
        for (const n of sold){ doc.text(`• ${String(n.idx).padStart(r.range==='000-999'?3:2,'0')} → ${n.buyer||'-'}`); }
        doc.end();
        size = fs.statSync(fullPath).size; ok=true;
      } catch(e){
        // Fallback: TXT si falta pdfkit
        const txt = [
          'Acta de Cierre de Rifa',
          `Código: ${r.code}`,
          `Nombre: ${r.name||r.code}`,
          `Anfitrión: ${r.hostName||r.hostId}`,
          `Modo: ${r.mode}`,
          r.mode==='fire'?`Costo/Número: ${r.entryPrice} 🔥`:'' ,
          r.prizeMeta&&r.prizeMeta.prize?`Premio: ${r.prizeMeta.prize}`:'',
          `Rango: ${r.range} (total ${r.size})`,
          `Creada: ${new Date(r.createdAt).toLocaleString()}`,
          r.endsAt?`Cierre: ${new Date(r.endsAt).toLocaleString()}`:'',
          `Pozo final: ${(store.getUser(this.potUserId(r.id))?.fires)||0} 🔥`,
          r.winner?`Ganador: ${r.winner.userId} #${String(r.winner.number).padStart(r.range==='000-999'?3:2,'0')}`:'Ganador: -'
        ].filter(Boolean).join('\n');
        const txtName = `Acta_${r.code}_${new Date().toISOString().slice(0,10)}.txt`;
        const txtPath = path.join(base, txtName);
        fs.writeFileSync(txtPath, txt);
        const stat = fs.statSync(txtPath);
        size = stat.size;
        r.documents = r.documents || [];
        r.documents.push({ id: fileId, name: txtName, type: 'txt', path: txtPath, createdAt: Date.now(), sizeBytes: size });
        return;
      }
      if (ok){
        r.documents = r.documents || [];
        r.documents.push({ id: fileId, name: filename, type: 'pdf', path: fullPath, createdAt: Date.now(), sizeBytes: size });
      }
    }catch(_){ }
  }
}

module.exports = new RaffleStore();
