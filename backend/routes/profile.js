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
      if (userRepo && req.sessionUserId && req.sessionUserId === effId && /^tg:/i.test(effId)){
        const tg = effId.slice(3);
        try { await userRepo.upsertTelegramUser({ tgId: tg }); } catch(_){ }
      }
    }catch(_){ }
    // Oferta de bienvenida: enviar a inbox si es elegible (se reclama explícitamente)
    try {
      if (welcomeRepo && typeof welcomeRepo.isEligibleForWelcome === 'function') {
        const elig = await welcomeRepo.isEligibleForWelcome(effId);
        if (elig && elig.eligible && elig.event && elig.event.id){
          // Evitar duplicados: si ya existe mensaje de oferta para este evento
          try {
            const existing = inbox.inboxList(effId, { onlyUnread:false, limit:50, offset:0 }).items || [];
            const hasOffer = existing.some(m => m && m.meta && m.meta.type === 'welcome_offer' && Number(m.meta.eventId||0) === Number(elig.event.id));
            if (!hasOffer){
              const baseMsg = String(elig.event.message || '').trim() || '🎁 Bono de bienvenida disponible';
              const tail = elig.event.endsAt ? `Válido hasta ${new Date(elig.event.endsAt).toLocaleString()}.` : '';
              const text = [baseMsg, tail].filter(Boolean).join(' ');
              inbox.send({ toUserId: effId, text, meta: { type: 'welcome_offer', eventId: elig.event.id, coins: elig.event.coins||0, fires: elig.event.fires||0 } });
            }
          } catch(_) { /* ignore */ }
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
