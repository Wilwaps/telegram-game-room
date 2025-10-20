const express = require('express');
const router = express.Router();
const store = require('../services/memoryStore');
const inbox = require('../services/messageStore');
const { preferSessionUserId } = require('../middleware/sessionUser');
let welcomeRepo = null; try { welcomeRepo = require('../repos/welcomeRepo'); } catch(_) { welcomeRepo = null; }
let userRepo = null; try { userRepo = require('../repos/userRepo'); } catch(_) { userRepo = null; }

router.get('/:userId', async (req, res) => {
  try {
    const userId = String(req.params.userId || '').trim();
    if (!userId) return res.status(400).json({ success: false, error: 'invalid_user' });
    const effId = preferSessionUserId(req, userId);
    let u = store.getUser(effId) || store.ensureUser(effId);
    try{
      if (userRepo && /^tg:/i.test(effId)){
        const tg = effId.slice(3);
        try { await userRepo.upsertTelegramUser({ tgId: tg }); } catch(_){ }
      }
    }catch(_){ }
    // Premio bienvenida con Postgres (solo TG/db) y persistente
    try {
      if (welcomeRepo) {
        const award = await welcomeRepo.awardIfEligible(effId);
        if (award && award.awarded) {
          try {
            const ev = await welcomeRepo.getEvent();
            const baseMsg = String(ev.message || '').trim();
            const fallback = `🎉 Bienvenido/a. Has recibido ${award.coinsAwarded} monedas y ${award.firesAwarded} 🔥 de regalo.`;
            const tail = award.until ? `Válido hasta ${new Date(award.until).toLocaleString()}.` : '';
            const text = [baseMsg || fallback, tail].filter(Boolean).join(' ');
            inbox.send({ toUserId: effId, text });
          } catch (_) {}
        }
      }
    } catch(_) { /* ignore */ }
    // Superponer balance real desde DB si existe wallet
    let firesDb = null, coinsDb = null;
    try{
      if (welcomeRepo) {
        const bal = await welcomeRepo.getWalletExtBalances(effId);
        if (bal){ firesDb = Number(bal.fires||0); coinsDb = Number(bal.coins||0); }
      }
    }catch(_){ }
    // Ganancias en coins (historial mem)
    let earned = 0;
    let stats = null;
    try {
      const hist = store.getUserHistory(userId, { limit: 200, offset: 0 });
      for (const tx of hist.items) if (tx && tx.type === 'coin') earned += Number(tx.amount || 0);
    } catch (_) {}
    try { stats = store.getUserStats(userId); } catch(_) { stats = { wins:0, losses:0, draws:0, games:0, byGame:{} }; }
    const fires = (firesDb!==null) ? firesDb : (u.fires || 0);
    const coins = (coinsDb!==null) ? coinsDb : (u.coins || 0);
    return res.json({ success: true, user: { userId: u.userId, userName: u.userName, fires, coins, earnedCoins: earned, stats } });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'profile_error' });
  }
});

module.exports = router;

// Actualizar datos de perfil (display name)
router.post('/update', (req, res) => {
  try {
    const { userId, displayName } = req.body || {};
    const id = preferSessionUserId(req, userId);
    if (!id) return res.status(400).json({ success:false, error:'invalid_user' });
    const u = store.ensureUser(id);
    if (typeof displayName === 'string') {
      const dn = displayName.trim();
      if (dn) u.userName = dn;
    }
    store.users.set(u.userId, u);
    return res.json({ success:true, user: { userId: u.userId, userName: u.userName } });
  } catch (err) {
    return res.status(500).json({ success:false, error:'profile_update_error' });
  }
});
