// -------- Auditoría supply (DB) --------
// GET /api/economy/supply/txs-db
router.get('/supply/txs-db', async (req, res) => {
  try {
    const { type, user_ext, event_id, from, to, limit, offset, order } = req.query || {};
    const out = await supplyRepo.listSupplyTxs({ type, user_ext, event_id, from, to, limit, offset, order });
    res.json({ success: true, ...out });
  } catch (err) {
    res.status(500).json({ success: false, error: 'supply_txs_list_error' });
  }
});

// GET /api/economy/supply/txs-db/:id
router.get('/supply/txs-db/:id', async (req, res) => {
  try {
    const row = await supplyRepo.getSupplyTx(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'not_found' });
    res.json({ success: true, tx: row });
  } catch (err) {
    res.status(500).json({ success: false, error: 'supply_tx_get_error' });
  }
});

// GET /api/economy/supply/txs-db/export.csv
router.get('/supply/txs-db/export.csv', async (req, res) => {
  try {
    const { type, user_ext, event_id, from, to, limit, offset, order } = req.query || {};
    const csv = await supplyRepo.exportSupplyTxsCsv({ type, user_ext, event_id, from, to, limit, offset, order });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="supply_txs_export.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, error: 'supply_txs_export_error' });
  }
});
const express = require('express');
const router = express.Router();
const store = require('../services/memoryStore');
const adminAuth = require('../middleware/adminAuth');
const supplyRepo = require('../repos/supplyRepo');

// GET /api/economy/supply
router.get('/supply', async (req, res) => {
  try {
    const snap = await supplyRepo.getDashboardSnapshot();
    res.json({ success: true, supply: snap });
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
router.get('/supply/stream', async (req, res) => {
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

  // initial snapshot desde DB
  try { const snap = await supplyRepo.getDashboardSnapshot(); sendEvent('supply', { value: snap, ts: Date.now() }); } catch(_){}

  // heartbeat + polling
  const hb = setInterval(() => { try { res.write(': ping\n\n'); } catch (_) {} }, 15000);
  const poll = setInterval(async () => {
    try { const snap = await supplyRepo.getDashboardSnapshot(); sendEvent('supply', { value: snap, ts: Date.now() }); } catch(_){}
  }, 5000);

  req.on('close', () => {
    clearInterval(hb);
    clearInterval(poll);
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
