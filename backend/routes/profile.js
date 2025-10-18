const express = require('express');
const router = express.Router();
const store = require('../services/memoryStore');
const inbox = require('../services/messageStore');
const { preferSessionUserId } = require('../middleware/sessionUser');

router.get('/:userId', (req, res) => {
  try {
    const userId = String(req.params.userId || '').trim();
    if (!userId) return res.status(400).json({ success: false, error: 'invalid_user' });
    // Asegurar existencia de usuario
    let u = store.getUser(userId) || store.ensureUser(userId);
    // Intentar otorgar bono de bienvenida si aplica
    const award = store.awardWelcomeIfEligible(userId);
    if (award && award.awarded) {
      try {
        const ev = store.getWelcomeEvent();
        const baseMsg = String(ev.message || '').trim();
        const fallback = `🎉 Bienvenido/a. Has recibido ${award.coinsAwarded} monedas y ${award.firesAwarded} 🔥 de regalo.`;
        const tail = `Válido hasta ${new Date(award.until).toLocaleString()}.`;
        const text = [baseMsg || fallback, tail].filter(Boolean).join(' ');
        inbox.send({ toUserId: userId, text });
      } catch (_) {}
      // refrescar snapshot del usuario tras el premio
      u = store.getUser(userId) || { userId, userName: '', fires: 0, coins: 0 };
    }
    let earned = 0;
    let stats = null;
    try {
      const hist = store.getUserHistory(userId, { limit: 200, offset: 0 });
      for (const tx of hist.items) if (tx && tx.type === 'coin') earned += Number(tx.amount || 0);
    } catch (_) {}
    try { stats = store.getUserStats(userId); } catch(_) { stats = { wins:0, losses:0, draws:0, games:0, byGame:{} }; }
    return res.json({ success: true, user: { userId: u.userId, userName: u.userName, fires: u.fires || 0, coins: u.coins || 0, earnedCoins: earned, stats } });
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
