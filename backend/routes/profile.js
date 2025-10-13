const express = require('express');
const router = express.Router();
const store = require('../services/memoryStore');

router.get('/:userId', (req, res) => {
  try {
    const userId = String(req.params.userId || '').trim();
    if (!userId) return res.status(400).json({ success: false, error: 'invalid_user' });
    const u = store.getUser(userId);
    if (!u) {
      return res.json({ success: true, user: { userId, userName: '', fires: 0, coins: 0, earnedCoins: 0 } });
    }
    let earned = 0;
    try {
      const hist = store.getUserHistory(userId, { limit: 200, offset: 0 });
      for (const tx of hist.items) if (tx && tx.type === 'coin') earned += Number(tx.amount || 0);
    } catch (_) {}
    return res.json({ success: true, user: { userId: u.userId, userName: u.userName, fires: u.fires || 0, coins: u.coins || 0, earnedCoins: earned } });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'profile_error' });
  }
});

module.exports = router;
