const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const supplyService = require('../services/supplyService');
const economyService = require('../services/economyService');
const redisService = require('../services/redisService');
const logger = require('../config/logger');

// GET /api/economy/supply
router.get('/supply', async (req, res) => {
  try {
    const summary = await supplyService.getSummary();
    const [_, keys] = await redisService.client.scan('0', 'MATCH', 'user:*:currency', 'COUNT', 10000);
    const usersCount = (keys && keys.length) || 0;
    res.json({ success: true, summary: { ...summary, usersCount } });
  } catch (err) {
    logger.error('GET /economy/supply error:', err);
    res.status(500).json({ success: false, error: 'No se pudo obtener el resumen de supply' });
  }
});

// =============== PATROCINADORES ===============
// POST /api/economy/sponsors/add { userId }
router.post('/sponsors/add', adminAuth, async (req, res) => {
  try {
    const userId = String(req.body?.userId || '').trim();
    if (!userId) return res.status(400).json({ success: false, error: 'userId requerido' });
    await supplyService.addSponsor(userId);
    const list = await supplyService.listSponsorsWithFires();
    res.json({ success: true, sponsors: list.items });
  } catch (err) {
    logger.error('POST /economy/sponsors/add error:', err);
    res.status(400).json({ success: false, error: err.message || 'No se pudo agregar patrocinador' });
  }
});

// POST /api/economy/sponsors/remove { userId }
router.post('/sponsors/remove', adminAuth, async (req, res) => {
  try {
    const userId = String(req.body?.userId || '').trim();
    if (!userId) return res.status(400).json({ success: false, error: 'userId requerido' });
    await supplyService.removeSponsor(userId);
    const list = await supplyService.listSponsorsWithFires();
    res.json({ success: true, sponsors: list.items });
  } catch (err) {
    logger.error('POST /economy/sponsors/remove error:', err);
    res.status(400).json({ success: false, error: err.message || 'No se pudo quitar patrocinador' });
  }
});

// GET /api/economy/sponsors
router.get('/sponsors', async (req, res) => {
  try {
    const list = await supplyService.listSponsorsWithFires();
    res.json({ success: true, sponsors: list.items });
  } catch (err) {
    logger.error('GET /economy/sponsors error:', err);
    res.status(500).json({ success: false, error: 'No se pudo obtener patrocinadores' });
  }
});

// POST /api/economy/transfer { fromUserId, toUserId, amount, reason }
// Requiere que fromUserId sea patrocinador
router.post('/transfer', async (req, res) => {
  try {
    const fromUserId = String(req.body?.fromUserId || '').trim();
    const toUserId = String(req.body?.toUserId || '').trim();
    const amount = Math.abs(parseInt(req.body?.amount || '0', 10));
    const reason = String(req.body?.reason || 'transfer');
    if (!fromUserId || !toUserId || !amount) return res.status(400).json({ success: false, error: 'Datos inválidos' });
    const isSponsor = (await redisService.client.sismember('economy:sponsors', fromUserId)) === 1;
    if (!isSponsor) return res.status(403).json({ success: false, error: 'Solo patrocinadores pueden transferir' });
    const result = await economyService.transfer(fromUserId, toUserId, amount, { reason });
    res.json({ success: true, result });
  } catch (err) {
    logger.error('POST /economy/transfer error:', err);
    res.status(400).json({ success: false, error: err.message || 'No se pudo transferir' });
  }
});

// GET /api/economy/supply/stream (SSE)
router.get('/supply/stream', async (req, res) => {
  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    let closed = false;
    req.on('close', () => {
      closed = true;
      clearInterval(interval);
    });

    const send = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Primer payload inmediato
    const firstSummary = await supplyService.getSummary();
    const firstTxs = await supplyService.getSupplyTxs(20);
    send({ type: 'init', summary: firstSummary, items: firstTxs });

    // Heartbeat cada 20s para mantener conexión
    const hb = setInterval(() => { if (!closed) res.write(': ping\n\n'); }, 20000);

    // Poll ligero cada 2s
    const interval = setInterval(async () => {
      try {
        const summary = await supplyService.getSummary();
        const items = await supplyService.getSupplyTxs(20);
        send({ type: 'update', summary, items });
      } catch (err) {
        logger.error('SSE /supply/stream error:', err);
      }
    }, 2000);

    // Limpiar heartbeat al cerrar
    req.on('close', () => clearInterval(hb));
  } catch (err) {
    logger.error('GET /economy/supply/stream error:', err);
    res.status(500).end();
  }
});

// GET /api/economy/supply/txs?limit=100
router.get('/supply/txs', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(1000, parseInt(req.query.limit || '100', 10)));
    const items = await supplyService.getSupplyTxs(limit);
    res.json({ success: true, items });
  } catch (err) {
    logger.error('GET /economy/supply/txs error:', err);
    res.status(500).json({ success: false, error: 'No se pudo obtener auditoría de supply' });
  }
});

// GET /api/economy/users?cursor=0&limit=50&search=
router.get('/users', async (req, res) => {
  try {
    const cursor = String(req.query.cursor || '0');
    const limit = Math.max(1, Math.min(200, parseInt(req.query.limit || '50', 10)));
    const search = String(req.query.search || '');
    const { cursor: next, items } = await supplyService.listUsersWithFires({ cursor, limit, search });
    res.json({ success: true, cursor: next, items });
  } catch (err) {
    logger.error('GET /economy/users error:', err);
    res.status(500).json({ success: false, error: 'No se pudo obtener usuarios' });
  }
});

// GET /api/economy/history/:userId
router.get('/history/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const limit = Math.max(1, Math.min(200, parseInt(req.query.limit || '50', 10)));
    const offset = Math.max(0, parseInt(req.query.offset || '0', 10));
    const items = await economyService.getHistory(userId, limit, offset);
    res.json({ success: true, items, limit, offset });
  } catch (err) {
    logger.error('GET /economy/history error:', err);
    res.status(500).json({ success: false, error: 'No se pudo obtener historial' });
  }
});

// POST /api/economy/grant-from-supply
// body: { adminUsername, adminCode, toUserId, amount, reason }
router.post('/grant-from-supply', adminAuth, async (req, res) => {
  try {
    const toUserId = String(req.body?.toUserId || '').trim();
    const amount = Math.abs(parseInt(req.body?.amount || '0', 10));
    const reason = String(req.body?.reason || 'admin_grant');
    if (!toUserId || !amount) return res.status(400).json({ success: false, error: 'Datos inválidos' });
    const out = await supplyService.allocateAndGrant(toUserId, amount, { reason, by: req.admin?.userName || 'admin' });
    const summary = await supplyService.getSummary();
    res.json({ success: true, result: out, summary });
  } catch (err) {
    logger.error('POST /economy/grant-from-supply error:', err);
    res.status(400).json({ success: false, error: err.message || 'No se pudo asignar desde reserva' });
  }
});

module.exports = router;
