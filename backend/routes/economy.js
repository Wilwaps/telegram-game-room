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
