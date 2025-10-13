const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const store = require('../services/memoryStore');

// GET /api/admin/welcome/status (admin)
router.get('/status', adminAuth, (req, res) => {
  try {
    const ev = store.getWelcomeEvent();
    res.json({ success: true, event: ev, now: Date.now() });
  } catch (err) {
    res.status(500).json({ success: false, error: 'welcome_admin_status_error' });
  }
});

// POST /api/admin/welcome/activate (admin)
// body: { coins, fires, durationHours, startsAt?, message? }
router.post('/activate', adminAuth, (req, res) => {
  try {
    const { coins, fires, durationHours, startsAt, message } = req.body || {};
    const ev = store.setWelcomeEventActive({ coins, fires, durationHours, startsAt, message });
    res.json({ success: true, event: ev });
  } catch (err) {
    res.status(400).json({ success: false, error: (err && err.message) || 'welcome_activate_error' });
  }
});

// POST /api/admin/welcome/disable (admin)
router.post('/disable', adminAuth, (req, res) => {
  try {
    store.disableWelcomeEvent();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'welcome_disable_error' });
  }
});

module.exports = router;
