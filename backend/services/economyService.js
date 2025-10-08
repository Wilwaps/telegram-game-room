/**
 * ============================================
 * SERVICIO DE ECONOMÍA - FUEGOS
 * ============================================
 */
const redisService = require('./redisService');
const { constants } = require('../config/config');
const logger = require('../config/logger');

const currencyKey = (userId) => `${constants.REDIS_PREFIXES.USER}${userId}:currency`;
const historyKey = (userId) => `${constants.REDIS_PREFIXES.USER}${userId}:fires:history`;

module.exports = {
  /** Obtener saldo de fuegos del usuario */
  async getFires(userId) {
    const key = currencyKey(userId);
    const data = await redisService.client.hget(key, 'fires');
    const fires = parseInt(data || '0', 10);
    return { fires };
  },

  /** Establecer saldo absoluto (solo usos internos controlados) */
  async setFires(userId, amount) {
    const key = currencyKey(userId);
    await redisService.client.hset(key, 'fires', Math.max(0, parseInt(amount, 10)));
    return this.getFires(userId);
  },

  /** Incrementar saldo (puede ser negativo) con protección de no-negativos */
  async incrFires(userId, delta) {
    const key = currencyKey(userId);
    // WATCH para evitar condición de carrera simple (MVP)
    const client = redisService.client;
    await client.watch(key);
    const current = parseInt((await client.hget(key, 'fires')) || '0', 10);
    const next = current + parseInt(delta, 10);
    if (next < 0) {
      await client.unwatch();
      throw new Error('Saldo insuficiente');
    }
    const multi = client.multi();
    multi.hset(key, 'fires', next);
    const res = await multi.exec();
    if (!res) {
      logger.warn('Conflicto de transacción en incrFires, reintentar');
      // Reintento simple
      return this.incrFires(userId, delta);
    }
    return { fires: next };
  },

  /** Ganar 1 fuego (o amount) */
  async earn(userId, amount = 1, meta = {}) {
    const result = await this.incrFires(userId, amount);
    const entry = await this.recordTransaction(userId, {
      type: 'earn',
      amount: Math.abs(amount),
      balance: result.fires,
      reason: meta?.reason || 'earn',
      meta,
      ts: Date.now()
    });
    logger.info(`🔥 Earn +${amount} para ${userId}`, meta);
    return { ...result, tx: entry };
  },

  /** Gastar fuegos (amount > 0) */
  async spend(userId, amount, meta = {}) {
    if (amount <= 0) throw new Error('Cantidad inválida');
    const result = await this.incrFires(userId, -Math.abs(amount));
    const entry = await this.recordTransaction(userId, {
      type: 'spend',
      amount: Math.abs(amount),
      balance: result.fires,
      reason: meta?.reason || 'spend',
      meta,
      ts: Date.now()
    });
    logger.info(`🔥 Spend -${amount} de ${userId}`, meta);
    return { ...result, tx: entry };
  },

  /** Transferir fuegos (admin) */
  async grantToUser(userId, amount, meta = {}) {
    if (amount <= 0) throw new Error('Cantidad inválida');
    const result = await this.incrFires(userId, Math.abs(amount));
    const entry = await this.recordTransaction(userId, {
      type: 'grant',
      amount: Math.abs(amount),
      balance: result.fires,
      reason: meta?.reason || 'grant',
      meta,
      ts: Date.now()
    });
    logger.info(`🔥 Grant +${amount} a ${userId}`, meta);
    return { ...result, tx: entry };
  },

  /** Registrar transacción en historial */
  async recordTransaction(userId, entry) {
    try {
      const key = historyKey(userId);
      const data = JSON.stringify(entry);
      await redisService.client.lpush(key, data);
      // Mantener solo las últimas 200 transacciones
      await redisService.client.ltrim(key, 0, 199);
      return entry;
    } catch (err) {
      logger.error('Error registrando transacción de fuegos:', err);
      return entry;
    }
  },

  /** Obtener historial de transacciones */
  async getHistory(userId, limit = 50, offset = 0) {
    const key = historyKey(userId);
    const start = offset;
    const end = offset + limit - 1;
    const items = await redisService.client.lrange(key, start, end);
    return items.map(i => {
      try { return JSON.parse(i); } catch { return null; }
    }).filter(Boolean);
  }
};

/**
 * Transferir fuegos entre usuarios de forma atómica
 * @param {string} fromUserId
 * @param {string} toUserId
 * @param {number} amount
 * @param {object} meta
 */
module.exports.transfer = async function transfer(fromUserId, toUserId, amount, meta = {}) {
  if (!fromUserId || !toUserId) throw new Error('Usuarios inválidos');
  if (fromUserId === toUserId) throw new Error('No puedes transferir a ti mismo');
  const amt = Math.abs(parseInt(amount, 10));
  if (!amt || amt <= 0) throw new Error('Cantidad inválida');

  const keyA = currencyKey(fromUserId);
  const keyB = currencyKey(toUserId);
  // Orden canónico para WATCH para evitar deadlocks
  const [k1, k2] = keyA < keyB ? [keyA, keyB] : [keyB, keyA];
  while (true) {
    await redisService.client.watch(k1, k2);
    const [fromBalRaw, toBalRaw] = await Promise.all([
      redisService.client.hget(keyA, 'fires'),
      redisService.client.hget(keyB, 'fires')
    ]);
    const fromBal = parseInt(fromBalRaw || '0', 10);
    const toBal = parseInt(toBalRaw || '0', 10);
    if (fromBal < amt) { await redisService.client.unwatch(); throw new Error('Saldo insuficiente'); }
    const multi = redisService.client.multi();
    multi.hset(keyA, 'fires', fromBal - amt);
    multi.hset(keyB, 'fires', toBal + amt);
    // Historial dual
    const outTx = {
      type: 'transfer_out', amount: amt, balance: fromBal - amt,
      reason: meta.reason || 'transfer', meta: { ...meta, to: toUserId }, ts: Date.now()
    };
    const inTx = {
      type: 'transfer_in', amount: amt, balance: toBal + amt,
      reason: meta.reason || 'transfer', meta: { ...meta, from: fromUserId }, ts: Date.now()
    };
    multi.lpush(historyKey(fromUserId), JSON.stringify(outTx));
    multi.ltrim(historyKey(fromUserId), 0, 199);
    multi.lpush(historyKey(toUserId), JSON.stringify(inTx));
    multi.ltrim(historyKey(toUserId), 0, 199);
    const ok = await multi.exec();
    if (!ok) {
      logger.warn('Conflicto de transacción en transfer, reintentar');
      continue;
    }
    logger.info(`🔥 Transfer ${amt} de ${fromUserId} -> ${toUserId}`);
    return { from: { userId: fromUserId, fires: fromBal - amt, tx: outTx }, to: { userId: toUserId, fires: toBal + amt, tx: inTx } };
  }
};
