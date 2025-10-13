const express = require('express');
const router = express.Router();
const store = require('../services/memoryStore');

// GET /api/admin/users/list?search=&limit=&cursor=&onlineOnly=true
router.get('/list', (req, res) => {
  try {
    const search = String(req.query.search || '');
    const limit = Math.max(1, Math.min(200, parseInt(req.query.limit || '50', 10) || 50));
    const cursor = Math.max(0, parseInt(req.query.cursor || '0', 10) || 0);
    const onlineOnly = String(req.query.onlineOnly || '').toLowerCase() === 'true';
    const now = Date.now();
    const ONLINE_WINDOW_MS = Math.max(15_000, Math.min(10 * 60_000, parseInt(process.env.ONLINE_WINDOW_MS || '120000', 10) || 120_000)); // 2m por defecto

    let { items, nextCursor, total } = store.listUsersDetailed({ search, limit, cursor });
    if (onlineOnly) {
      items = items.filter(u => Number(u.lastSeenAt || 0) > now - ONLINE_WINDOW_MS);
    }
    const mapped = items.map(u => {
      const expectedId = u.telegramId ? ('tg:' + String(u.telegramId)) : (u.email ? ('em:' + String(u.email).toLowerCase()) : null);
      const isOnline = Number(u.lastSeenAt || 0) > now - ONLINE_WINDOW_MS;
      return { ...u, isOnline, expectedId, idMatch: expectedId ? (expectedId === u.userId) : true };
    });
    res.json({ success: true, items: mapped, nextCursor, total, now, onlineWindowMs: ONLINE_WINDOW_MS });
  } catch (err) {
    res.status(500).json({ success: false, error: 'list_error' });
  }
});

// POST /api/admin/users/set-contact { userId, email, phone, telegramId }
router.post('/set-contact', (req, res) => {
  try {
    const { userId, email, phone, telegramId } = req.body || {};
    if (!userId) return res.status(400).json({ success: false, error: 'invalid_user' });
    const u = store.setUserContact({ userId, email, phone, telegramId });
    res.json({ success: true, user: u });
  } catch (err) {
    res.status(500).json({ success: false, error: 'contact_error' });
  }
});

// GET /api/admin/users/stats
router.get('/stats', (req, res) => {
  try {
    const now = Date.now();
    const ONLINE_WINDOW_MS = Math.max(15_000, Math.min(10 * 60_000, parseInt(process.env.ONLINE_WINDOW_MS || '120000', 10) || 120_000));
    const { items, total } = store.listUsersDetailed({ limit: 200, cursor: 0 });
    const online = items.filter(u => Number(u.lastSeenAt || 0) > now - ONLINE_WINDOW_MS).length;
    res.json({ success: true, total, online, now, onlineWindowMs: ONLINE_WINDOW_MS });
  } catch (err) {
    res.status(500).json({ success: false, error: 'stats_error' });
  }
});

// POST /api/admin/users/merge { primaryId, secondaryId }
router.post('/merge', (req, res) => {
  try {
    const { primaryId, secondaryId } = req.body || {};
    if (!primaryId || !secondaryId || primaryId === secondaryId) return res.status(400).json({ success:false, error:'invalid_params' });
    const out = store.mergeUsers({ primaryId, secondaryId });
    res.json({ success: true, ...out });
  } catch (err) {
    res.status(500).json({ success: false, error: 'merge_error' });
  }
});

module.exports = router;
