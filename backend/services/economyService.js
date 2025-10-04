/**
 * ============================================
 * SERVICIO DE ECONOMÍA - FUEGOS
 * ============================================
 */
const redisService = require('./redisService');
const { constants } = require('../config/config');
const logger = require('../config/logger');

const currencyKey = (userId) => `${constants.REDIS_PREFIXES.USER}${userId}:currency`;

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
    logger.info(`🔥 Earn +${amount} para ${userId}`, meta);
    return result;
  },

  /** Gastar fuegos (amount > 0) */
  async spend(userId, amount, meta = {}) {
    if (amount <= 0) throw new Error('Cantidad inválida');
    const result = await this.incrFires(userId, -Math.abs(amount));
    logger.info(`🔥 Spend -${amount} de ${userId}`, meta);
    return result;
  },

  /** Transferir fuegos (admin) */
  async grantToUser(userId, amount, meta = {}) {
    if (amount <= 0) throw new Error('Cantidad inválida');
    const result = await this.incrFires(userId, Math.abs(amount));
    logger.info(`🔥 Grant +${amount} a ${userId}`, meta);
    return result;
  }
};
