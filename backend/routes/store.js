const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const redisService = require('../services/redisService');
const economyService = require('../services/economyService');

// Catálogo inicial del "Mercado del fuego"
// type: cosmetic|ticket|boost|utility
const CATALOG = [
  { id: 'ticket_bingo_1', name: 'Ticket Bingo x1', price: 1, type: 'ticket', desc: 'Un ticket para un cartón de Bingo' },
  { id: 'ttt_skin_neon', name: 'Skin Neon Tic‑Tac‑Toe', price: 5, type: 'cosmetic', desc: 'Tablero con efectos neón' },
  { id: 'profile_avatar_glow', name: 'Marco Avatar Glow', price: 3, type: 'cosmetic', desc: 'Marco luminoso para tu avatar' },
  { id: 'raffle_ticket_1', name: 'Boleto de Rifa', price: 2, type: 'utility', desc: 'Participa en sorteos semanales' }
];

function getItem(itemId){
  return CATALOG.find(i => i.id === String(itemId));
}

// GET /api/store/catalog
router.get('/catalog', async (req, res) => {
  try {
    return res.json({ success: true, catalog: CATALOG });
  } catch (err) {
    logger.error('Error GET /store/catalog:', err);
    return res.status(500).json({ success: false, error: 'Error obteniendo catálogo' });
  }
});

// POST /api/store/redeem
// Body: { userId, itemId, requestId }
router.post('/redeem', async (req, res) => {
  try {
    const { userId, itemId, requestId } = req.body || {};
    if (!userId || !itemId) {
      return res.status(400).json({ success: false, error: 'userId y itemId son requeridos' });
    }

    const item = getItem(itemId);
    if (!item) {
      return res.status(400).json({ success: false, error: 'Artículo no encontrado' });
    }

    // Idempotencia: requestId opcional pero recomendado
    const rid = String(requestId || `${userId}:${itemId}:${Date.now()}`);
    const lockKey = `store:redeem:${userId}:${rid}`;

    // SET NX con expiración (24h)
    // Si retorna null, ya existe -> idempotente
    const setRes = await redisService.client.set(lockKey, '1', 'NX', 'EX', 24 * 3600);
    if (setRes === null) {
      return res.json({ success: true, idempotent: true, message: 'Operación ya procesada' });
    }

    // Cobrar fuegos
    const spendRes = await economyService.spend(userId, item.price, { reason: 'store_redeem', itemId, requestId: rid });

    // Registrar en ledger del usuario
    const ledgerKey = `user:${userId}:store:ledger`;
    const entry = {
      ts: Date.now(),
      userId,
      itemId,
      price: item.price,
      requestId: rid,
      balance: spendRes?.fires,
      tx: spendRes?.tx || null
    };
    try {
      await redisService.client.lpush(ledgerKey, JSON.stringify(entry));
      await redisService.client.ltrim(ledgerKey, 0, 199);
    } catch (e) {
      logger.warn('No se pudo registrar en ledger de store:', e?.message);
    }

    logger.info(`🛒 Redeem OK user=${userId} item=${itemId} price=${item.price}`);

    return res.json({
      success: true,
      item,
      balance: spendRes?.fires,
      tx: spendRes?.tx || null,
      requestId: rid
    });
  } catch (err) {
    logger.error('Error POST /store/redeem:', err);
    return res.status(500).json({ success: false, error: err.message || 'Error al canjear' });
  }
});

module.exports = router;
