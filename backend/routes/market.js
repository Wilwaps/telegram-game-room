const express = require('express');
const router = express.Router();
const store = require('../services/memoryStore');
const { preferSessionUserId } = require('../middleware/sessionUser');
const https = require('https');
const { URL } = require('url');

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

// POST /api/market/redeem-100-fire
router.post('/redeem-100-fire', async (req,res)=>{
  try{
    const userId = preferSessionUserId(req, req.body && req.body.userId);
    if (!userId) return res.status(400).json({ success:false, error:'invalid_user' });
    const u = store.getUser(userId) || store.ensureUser(userId);
    const fires = Math.max(0, Number(u && u.fires || 0));
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
        `Usuario: ${userId} ${u && u.userName ? '('+u.userName+')' : ''}`,
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

    // No debitamos aún; el admin confirmará manualmente y hará el pago.
    // Dejamos una transacción de referencia en el log para trazabilidad.
    try{ store.pushTx({ type:'market_redeem_request', userId, amount:100, unit:'fires', cedula, telefono, bankCode, bankName }); }catch(_){ }

    return res.json({ success:true });
  }catch(err){ return res.status(500).json({ success:false, error:'redeem_error' }); }
});

module.exports = router;
