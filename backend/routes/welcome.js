const express = require('express');
const router = express.Router();
let welcomeRepo = null; try { welcomeRepo = require('../repos/welcomeRepo'); } catch(_) { welcomeRepo = null; }
const { preferSessionUserId } = require('../middleware/sessionUser');
const inbox = require('../services/messageStore');

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

// Aceptar bono de bienvenida (requiere elegibilidad vigente)
router.post('/accept', async (req, res) => {
  try {
    if (!welcomeRepo) return res.status(503).json({ success:false, error:'repo_unavailable' });
    const { userId, eventId } = req.body || {};
    const uid = preferSessionUserId(req, userId);
    if (!uid) return res.status(400).json({ success:false, error:'invalid_user' });
    // Elegibilidad
    const el = (typeof welcomeRepo.isEligibleForWelcome === 'function') ? await welcomeRepo.isEligibleForWelcome(uid) : { eligible:false };
    if (!el.eligible) return res.status(400).json({ success:false, error:'not_eligible' });
    if (eventId && el.event && Number(eventId) !== Number(el.event.id)) {
      return res.status(409).json({ success:false, error:'event_mismatch' });
    }
    const award = await welcomeRepo.awardIfEligible(uid);
    if (!award || !award.awarded) return res.status(400).json({ success:false, error:'award_failed' });
    try {
      const msg = `✅ Bono activado: +${award.coinsAwarded||0} monedas y +${award.firesAwarded||0} 🔥.`;
      inbox.send({ toUserId: uid, text: msg, meta: { type:'welcome_claimed', eventId: el.event?.id||null, coins: award.coinsAwarded||0, fires: award.firesAwarded||0 } });
    } catch(_){ }
    return res.json({ success:true, awarded:true, ...award });
  } catch (err) {
    return res.status(500).json({ success:false, error:'welcome_accept_error' });
  }
});
