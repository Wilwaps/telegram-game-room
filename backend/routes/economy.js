const express = require('express');
const router = express.Router();
const store = require('../services/memoryStore');
const adminAuth = require('../middleware/adminAuth');

// GET /api/economy/supply
router.get('/supply', (req, res) => {
  try {
    const supply = store.getSupplySummary();
    res.json({ success: true, supply });
  } catch (err) {
    res.status(500).json({ success: false, error: 'supply_error' });
  }
});

// GET /api/economy/reconcile
router.get('/reconcile', (req, res) => {
  try {
    const snap = store.getSupplySummary();
    const sumBalances = Array.from(store.users.values()).reduce((acc, u) => acc + Math.max(0, Number(u.fires || 0)), 0);
    const diff = Number(snap.circulating || 0) - sumBalances;
    res.json({ success: true, total: snap.total, burned: snap.burned, circulating: snap.circulating, sumBalances, reserve: snap.reserve, diff });
  } catch (err) {
    res.status(500).json({ success: false, error: 'reconcile_error' });
  }
});

// GET /api/economy/circulation/status
router.get('/circulation/status', (req, res) => {
  try {
    const s = store.getInitialCirculationStatus();
    res.json({ success: true, status: s });
  } catch (err) {
    res.status(500).json({ success: false, error: 'circulation_status_error' });
  }
});

// POST /api/economy/circulation/assign-initial (admin)
router.post('/circulation/assign-initial', adminAuth, (req, res) => {
  try {
    const { toUserId, amount } = req.body || {};
    const to = String(toUserId || 'tg:1417856820');
    const amt = Math.max(0, Math.floor(Number(amount || 0)));
    if (!to || amt <= 0) return res.status(400).json({ success: false, error: 'invalid_params' });
    const out = store.assignInitialCirculation({ toUserId: to, amount: amt });
    res.json({ success: true, ...out, supply: store.getSupplySummary() });
  } catch (err) {
    const msg = (err && err.message) || 'assign_error';
    const code = (msg === 'already_assigned' || msg === 'invalid_params') ? 400 : 500;
    res.status(code).json({ success: false, error: msg });
  }
});

// GET /api/economy/supply/txs?limit=&offset=
router.get('/supply/txs', (req, res) => {
  try {
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || '20', 10) || 20));
    const offset = Math.max(0, parseInt(req.query.offset || '0', 10) || 0);
    const items = store.txs.slice(offset, offset + limit);
    res.json({ success: true, items, limit, offset });
  } catch (err) {
    res.status(500).json({ success: false, error: 'tx_list_error' });
  }
});

// GET /api/economy/supply/stream (SSE)
router.get('/supply/stream', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.flushHeaders && res.flushHeaders();

  const sendEvent = (name, payload) => {
    try {
      res.write(`event: ${name}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (_) {}
  };

  // initial snapshot
  sendEvent('supply', { value: store.getSupplySummary(), ts: Date.now() });

  // heartbeat
  const hb = setInterval(() => {
    try { res.write(': ping\n\n'); } catch (_) {}
  }, 15000);

  const onSupply = (snap) => sendEvent('supply', { value: snap, ts: Date.now() });
  store.on('supply_changed', onSupply);

  req.on('close', () => {
    clearInterval(hb);
    store.off('supply_changed', onSupply);
  });
});

// POST /api/economy/supply/burn { amount }
router.post('/supply/burn', adminAuth, (req, res) => {
  try {
    const amount = parseInt(req.body?.amount || '0', 10) || 0;
    if (amount <= 0) return res.status(400).json({ success: false, error: 'invalid_amount' });
    const burned = store.addBurn(amount);
    if (burned <= 0) return res.status(400).json({ success: false, error: 'insufficient_circulating' });
    const tx = store.pushTx({ type: 'burn', amount: burned });
    res.json({ success: true, tx, burned, supply: store.getSupplySummary() });
  } catch (err) {
    res.status(500).json({ success: false, error: 'burn_error' });
  }
});

module.exports = router;
