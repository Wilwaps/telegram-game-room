const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
let welcomeRepo = null; try { welcomeRepo = require('../repos/welcomeRepo'); } catch(_) { welcomeRepo = null; }

// --------- Nuevo API basado en Postgres ---------
// GET /api/admin/welcome/events
router.get('/events', adminAuth, async (req, res) => {
  try {
    if (!welcomeRepo) return res.status(503).json({ success:false, error:'repo_unavailable' });
    const includeInactive = String(req.query.includeInactive||'true').toLowerCase() !== 'false';
    const items = await welcomeRepo.listEvents({ includeInactive });
    res.json({ success:true, items });
  } catch (err) {
    res.status(500).json({ success:false, error:'welcome_events_list_error' });
  }
});

// POST /api/admin/welcome/events
router.post('/events', adminAuth, async (req, res) => {
  try {
    if (!welcomeRepo) return res.status(503).json({ success:false, error:'repo_unavailable' });
    const { name, message, coins=0, fires=0, durationHours=24 } = req.body||{};
    const actor = (req.admin && req.admin.userName) || 'admin';
    const ev = await welcomeRepo.createEvent({ name, message, coins, fires, durationHours }, actor);
    res.json({ success:true, event: ev });
  } catch (err) {
    res.status(400).json({ success:false, error: (err && err.message) || 'welcome_events_create_error' });
  }
});

// PATCH /api/admin/welcome/events/:id
router.patch('/events/:id', adminAuth, async (req, res) => {
  try {
    if (!welcomeRepo) return res.status(503).json({ success:false, error:'repo_unavailable' });
    const id = req.params.id;
    const { name, message, coins, fires, durationHours } = req.body||{};
    const actor = (req.admin && req.admin.userName) || 'admin';
    const out = await welcomeRepo.updateEvent(id, { name, message, coins, fires, durationHours }, actor);
    res.json({ success:true, result: out });
  } catch (err) {
    res.status(400).json({ success:false, error: (err && err.message) || 'welcome_events_update_error' });
  }
});

// POST /api/admin/welcome/events/:id/activate
router.post('/events/:id/activate', adminAuth, async (req, res) => {
  try {
    if (!welcomeRepo) return res.status(503).json({ success:false, error:'repo_unavailable' });
    const id = req.params.id;
    const { startsAt } = req.body||{};
    const actor = (req.admin && req.admin.userName) || 'admin';
    const out = await welcomeRepo.activateEvent({ eventId: id, startsAt, actor });
    res.json({ success:true, result: out });
  } catch (err) {
    res.status(400).json({ success:false, error: (err && err.message) || 'welcome_events_activate_error' });
  }
});

// POST /api/admin/welcome/events/:id/deactivate
router.post('/events/:id/deactivate', adminAuth, async (req, res) => {
  try {
    if (!welcomeRepo) return res.status(503).json({ success:false, error:'repo_unavailable' });
    const id = req.params.id;
    const actor = (req.admin && req.admin.userName) || 'admin';
    const out = await welcomeRepo.deactivateEvent({ eventId: id, actor });
    res.json({ success:true, result: out });
  } catch (err) {
    res.status(400).json({ success:false, error: (err && err.message) || 'welcome_events_deactivate_error' });
  }
});

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
