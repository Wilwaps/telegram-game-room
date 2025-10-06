/**
 * ============================================
 * SERVICIO DE EXPERIENCIA (XP)
 * ============================================
 */
const redisService = require('./redisService');
const { constants } = require('../config/config');
const logger = require('../config/logger');

const xpKey = (userId) => `${constants.REDIS_PREFIXES.XP}${userId}`; // hash: { xp }
const xpHistoryKey = (userId) => `${constants.REDIS_PREFIXES.XP}${userId}:history`;
const xpCfgKey = `${constants.REDIS_PREFIXES.XP_CFG}thresholds`;

// Umbrales por defecto (nivel -> XP total necesaria para llegar a ese nivel)
// Nivel 1 = 0 XP
const DEFAULT_THRESHOLDS = {
  2: 100,
  3: 250,
  4: 500,
  5: 1000,
  6: 2000,
  7: 4000,
  8: 7500,
  9: 12500,
  10: 20000,
  // Propuestos (ajustables desde dashboard)
  11: 30000,
  12: 45000,
  13: 65000,
  14: 90000,
  15: 120000,
  16: 155000,
  17: 195000,
  18: 240000,
  19: 290000,
  20: 345000
};

module.exports = {
  /** Obtener configuración de umbrales */
  async getThresholds() {
    try {
      const raw = await redisService.client.get(xpCfgKey);
      if (!raw) return { ...DEFAULT_THRESHOLDS };
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_THRESHOLDS, ...parsed };
    } catch (err) {
      logger.error('Error leyendo configuración de XP:', err);
      return { ...DEFAULT_THRESHOLDS };
    }
  },

  /** Establecer umbrales (reemplaza los existentes) */
  async setThresholds(thresholdsObj) {
    try {
      const sanitized = {};
      Object.keys(thresholdsObj || {}).forEach(k => {
        const level = parseInt(k, 10);
        const val = parseInt(thresholdsObj[k], 10);
        if (!Number.isNaN(level) && level > 1 && !Number.isNaN(val) && val >= 0) {
          sanitized[level] = val;
        }
      });
      await redisService.client.set(xpCfgKey, JSON.stringify(sanitized));
      return this.getThresholds();
    } catch (err) {
      logger.error('Error guardando configuración de XP:', err);
      throw err;
    }
  },

  /** Nivel a partir de XP total */
  async getLevelForXp(xpTotal) {
    const thresholds = await this.getThresholds();
    const levels = Object.keys(thresholds).map(n => parseInt(n, 10)).sort((a, b) => a - b);
    let level = 1;
    for (const lv of levels) {
      if (xpTotal >= thresholds[lv]) {
        level = lv;
      } else break;
    }
    return level;
  },

  /** Info de XP y nivel */
  async getXp(userId) {
    const key = xpKey(userId);
    const raw = await redisService.client.hget(key, 'xp');
    const xp = parseInt(raw || '0', 10);
    const level = await this.getLevelForXp(xp);
    const thresholds = await this.getThresholds();
    const nextLevel = Math.min(...Object.keys(thresholds).map(n => parseInt(n,10)).filter(n => n > level)) || null;
    const nextLevelXp = nextLevel ? thresholds[nextLevel] : null;
    return { xp, level, nextLevelXp };
  },

  /** Incrementar (o decrementar) XP, con tope inferior 0 */
  async incrXp(userId, delta, meta = {}) {
    const key = xpKey(userId);
    const client = redisService.client;
    await client.watch(key);
    const current = parseInt((await client.hget(key, 'xp')) || '0', 10);
    const next = Math.max(0, current + parseInt(delta, 10));
    const multi = client.multi();
    multi.hset(key, 'xp', next);
    const execRes = await multi.exec();
    if (!execRes) {
      logger.warn('Conflicto de transacción en incrXp, reintentar');
      return this.incrXp(userId, delta, meta);
    }

    const info = await this.getXp(userId);
    await this.recordTransaction(userId, {
      type: delta >= 0 ? 'earn' : 'lose',
      amount: Math.abs(delta),
      balance: info.xp,
      reason: meta?.reason || (delta >= 0 ? 'earn_xp' : 'lose_xp'),
      meta,
      ts: Date.now()
    });
    return info;
  },

  /** Registrar transacción en historial de XP */
  async recordTransaction(userId, entry) {
    try {
      const key = xpHistoryKey(userId);
      await redisService.client.lpush(key, JSON.stringify(entry));
      await redisService.client.ltrim(key, 0, 199);
      return entry;
    } catch (err) {
      logger.error('Error registrando transacción de XP:', err);
      return entry;
    }
  },

  /** Obtener historial de XP */
  async getHistory(userId, limit = 50, offset = 0) {
    const key = xpHistoryKey(userId);
    const items = await redisService.client.lrange(key, offset, offset + limit - 1);
    return items.map(i => { try { return JSON.parse(i); } catch { return null; } }).filter(Boolean);
  },

  /** Cooldown de penalización (20s) */
  async setPenaltyCooldown(userId, seconds = 20) {
    const key = `${constants.REDIS_PREFIXES.USER}${userId}:xp:penalty_cooldown`;
    await redisService.client.setex(key, seconds, '1');
  },

  async isPenaltyCooldownActive(userId) {
    const key = `${constants.REDIS_PREFIXES.USER}${userId}:xp:penalty_cooldown`;
    const exists = await redisService.client.exists(key);
    return exists === 1;
  },

  /** Intentar aplicar penalización por abandono (idempotente por sala) */
  async tryApplyAbandonPenalty(userId, roomCode) {
    try {
      const onceKey = `${constants.REDIS_PREFIXES.CACHE}xp:penalty:abandon:${roomCode}:${userId}`;
      const set = await redisService.client.set(onceKey, '1', 'NX', 'EX', 30);
      if (set !== 'OK') return false; // ya aplicada recientemente

      const active = await this.isPenaltyCooldownActive(userId);
      if (active) return false;

      await this.incrXp(userId, -10, { reason: 'abandon' });
      await this.setPenaltyCooldown(userId, 20);
      return true;
    } catch (err) {
      logger.error('Error aplicando penalización por abandono:', err);
      return false;
    }
  }
};
