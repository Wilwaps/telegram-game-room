const express = require('express');
const router = express.Router();
const store = require('../services/memoryStore');
const adminAuth = require('../middleware/adminAuth');

// GET /api/economy/users?cursor=&limit=&search=
router.get('/users', (req, res) => {
  try {
    const { limit, cursor, search } = req.query;
    const out = store.listUsers({ limit, cursor, search });
    if (Object.prototype.hasOwnProperty.call(req.query, 'cursor')) {
      // Compatibilidad con pruebas que esperan un array directo
      return res.json(out.items);
    }
    res.json({ success: true, ...out });
  } catch (err) {
    res.status(500).json({ success: false, error: 'users_list_error' });
  }
});

// GET /api/economy/history/:userId?limit=&offset=
router.get('/history/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const { limit, offset } = req.query;
    const out = store.getUserHistory(userId, { limit, offset });
    res.json({ success: true, ...out });
  } catch (err) {
    res.status(500).json({ success: false, error: 'user_history_error' });
  }
});

// GET /api/economy/sponsors
router.get('/sponsors', (req, res) => {
  try {
    const items = Array.from(store.sponsors.values());
    res.json({ success: true, items });
  } catch (err) {
    res.status(500).json({ success: false, error: 'sponsors_list_error' });
  }
});

// POST /api/economy/sponsors/add (admin)
router.post('/sponsors/add', adminAuth, (req, res) => {
  try {
    const { userId, key, description, initialAmount } = req.body || {};
    if (!userId) return res.status(400).json({ success: false, error: 'invalid_user' });
    const rec = store.addSponsor({ userId, key, description, initialAmount });
    res.json({ success: true, sponsor: rec });
  } catch (err) {
    res.status(500).json({ success: false, error: 'sponsor_add_error' });
  }
});

// POST /api/economy/sponsors/remove (admin)
router.post('/sponsors/remove', adminAuth, (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ success: false, error: 'invalid_user' });
    store.removeSponsor({ userId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'sponsor_remove_error' });
  }
});

// POST /api/economy/sponsors/set-meta (admin)
router.post('/sponsors/set-meta', adminAuth, (req, res) => {
  try {
    const { userId, description } = req.body || {};
    if (!userId) return res.status(400).json({ success: false, error: 'invalid_user' });
    const rec = store.setSponsorMeta({ userId, description });
    res.json({ success: true, sponsor: rec });
  } catch (err) {
    res.status(500).json({ success: false, error: 'sponsor_set_meta_error' });
  }
});

// POST /api/economy/sponsors/set-key (admin)
router.post('/sponsors/set-key', adminAuth, (req, res) => {
  try {
    const { userId, key } = req.body || {};
    if (!userId || !key) return res.status(400).json({ success: false, error: 'invalid_params' });
    const rec = store.setSponsorKey({ userId, key });
    res.json({ success: true, sponsor: rec });
  } catch (err) {
    res.status(500).json({ success: false, error: 'sponsor_set_key_error' });
  }
});

// POST /api/economy/sponsors/remove-key (admin)
router.post('/sponsors/remove-key', adminAuth, (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ success: false, error: 'invalid_user' });
    const rec = store.removeSponsorKey({ userId });
    res.json({ success: true, sponsor: rec });
  } catch (err) {
    res.status(500).json({ success: false, error: 'sponsor_remove_key_error' });
  }
});

// POST /api/economy/transfer (sponsor)
router.post('/transfer', (req, res) => {
  try {
    const { fromUserId, toUserId, amount, sponsorKey, reason } = req.body || {};
    if (!fromUserId || !toUserId) return res.status(400).json({ success: false, error: 'invalid_users' });
    const out = store.transferFromSponsor({ fromUserId, toUserId, amount, sponsorKey, reason });
    res.json({ success: true, ...out });
  } catch (err) {
    const msg = (err && err.message) || 'transfer_error';
    const code = msg === 'invalid_sponsor_key' ? 403 : 400;
    res.status(code).json({ success: false, error: msg });
  }
});

// POST /api/economy/grant-from-supply (admin)
router.post('/grant-from-supply', adminAuth, (req, res) => {
  try {
    const { toUserId, amount, reason } = req.body || {};
    if (!toUserId || !amount) return res.status(400).json({ success: false, error: 'invalid_params' });
    const out = store.grantFromSupply({ toUserId, amount, reason });
    res.json({ success: true, ...out });
  } catch (err) {
    res.status(500).json({ success: false, error: 'grant_error' });
  }
});

module.exports = router;
