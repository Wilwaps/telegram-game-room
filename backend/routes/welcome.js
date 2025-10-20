const express = require('express');
const router = express.Router();
let welcomeRepo = null; try { welcomeRepo = require('../repos/welcomeRepo'); } catch(_) { welcomeRepo = null; }

router.get('/status', async (req, res) => {
  try {
    if (!welcomeRepo) return res.json({ success:true, event: { active:false, startsAt:0, endsAt:0, coins:0, fires:0, message:'' }, now: Date.now() });
    const ev = await welcomeRepo.getEvent();
    res.json({ success: true, event: ev, now: Date.now() });
  } catch (err) {
    res.status(500).json({ success: false, error: 'welcome_status_error' });
  }
});

router.get('/current', async (req, res) => {
  try {
    if (!welcomeRepo) return res.json({ success:true, event: { active:false, startsAt:0, endsAt:0, coins:0, fires:0, message:'' }, now: Date.now() });
    const ev = await welcomeRepo.getCurrentEvent();
    res.json({ success: true, event: ev, now: Date.now() });
  } catch (_) {
    res.status(500).json({ success: false, error: 'welcome_current_error' });
  }
});

module.exports = router;
