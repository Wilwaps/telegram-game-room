const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
let welcomeRepo = null; try { welcomeRepo = require('../repos/welcomeRepo'); } catch(_) { welcomeRepo = null; }

// GET /api/admin/welcome/status (admin)
router.get('/status', adminAuth, async (req, res) => {
  try {
    if (!welcomeRepo) return res.status(503).json({ success:false, error:'repo_unavailable' });
    const ev = await welcomeRepo.getEvent();
    res.json({ success: true, event: ev, now: Date.now() });
  } catch (err) {
    res.status(500).json({ success: false, error: 'welcome_admin_status_error' });
  }
});

// POST /api/admin/welcome/activate (admin)
// body: { coins, fires, durationHours, startsAt?, message? }
router.post('/activate', adminAuth, async (req, res) => {
  try {
    if (!welcomeRepo) return res.status(503).json({ success:false, error:'repo_unavailable' });
    const { coins=100, fires=10, durationHours=720, startsAt, message } = req.body || {};
    const ev = await welcomeRepo.setEvent({ active:true, coins, fires, durationHours, startsAt, message });
    res.json({ success: true, event: ev });
  } catch (err) {
    res.status(400).json({ success: false, error: (err && err.message) || 'welcome_activate_error' });
  }
});

// POST /api/admin/welcome/disable (admin)
router.post('/disable', adminAuth, async (req, res) => {
  try {
    if (!welcomeRepo) return res.status(503).json({ success:false, error:'repo_unavailable' });
    await welcomeRepo.disableEvent();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'welcome_disable_error' });
  }
});

module.exports = router;
