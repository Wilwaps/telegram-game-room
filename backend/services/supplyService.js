/**
 * ============================================
 * SERVICIO DE SUPPLY - FUEGOS (VNC)
 * ============================================
 * - Controla el supply máximo y la circulación
 * - Todas las emisiones desde la reserva deben pasar por aquí
 */
const redisService = require('./redisService');
const economyService = require('./economyService');
const logger = require('../config/logger');

const SUPPLY_KEYS = {
  MAX: 'supply:max',
  RESERVE: 'supply:reserveRemaining',
  CIRC: 'supply:circulating',
  MINT: 'supply:mintTotal',
  BURN: 'supply:burnTotal',
  INIT: 'supply:initialized',
  TXS: 'supply:txs'
};

const DEFAULTS = {
  MAX_SUPPLY: parseInt(process.env.SUPPLY_MAX, 10) || 1_000_000_000,
};

async function scanUserCurrencyKeys(cursor = '0', pattern = 'user:*:currency', count = 500) {
  return await redisService.client.scan(cursor, 'MATCH', pattern, 'COUNT', count);
}

async function getCirculatingFromRedis() {
  let cursor = '0';
  let sum = 0;
  do {
    const [next, keys] = await scanUserCurrencyKeys(cursor);
    cursor = next;
    if (keys && keys.length) {
      const pipeline = redisService.client.pipeline();
      keys.forEach(k => pipeline.hget(k, 'fires'));
      const res = await pipeline.exec();
      for (const [err, val] of res) {
        if (!err) sum += parseInt(val || '0', 10);
      }
    }
  } while (cursor !== '0');
  return sum;
}

async function recordSupplyTx(entry) {
  try {
    const data = JSON.stringify({ ...entry, ts: Date.now() });
    await redisService.client.lpush(SUPPLY_KEYS.TXS, data);
    await redisService.client.ltrim(SUPPLY_KEYS.TXS, 0, 999); // últimas 1000
  } catch (err) {
    logger.error('Error registrando supply tx:', err);
  }
}

module.exports = {
  /** Inicialización/migración idempotente del supply */
  async initIfNeeded() {
    const inited = await redisService.client.get(SUPPLY_KEYS.INIT);
    if (inited) return true;

    const max = DEFAULTS.MAX_SUPPLY;
    const circulating = await getCirculatingFromRedis();
    const reserve = Math.max(0, max - circulating);

    const multi = redisService.client.multi();
    multi.set(SUPPLY_KEYS.MAX, String(max));
    multi.set(SUPPLY_KEYS.CIRC, String(circulating));
    multi.set(SUPPLY_KEYS.RESERVE, String(reserve));
    multi.set(SUPPLY_KEYS.MINT, String(max - reserve));
    multi.setnx(SUPPLY_KEYS.BURN, '0');
    multi.set(SUPPLY_KEYS.INIT, '1');
    await multi.exec();
    await recordSupplyTx({ type: 'init', max, circulating, reserve });
    logger.info(`✅ Supply inicializado: max=${max}, circ=${circulating}, reserve=${reserve}`);
    return true;
  },

  async getSummary() {
    await this.initIfNeeded();
    const pipeline = redisService.client.pipeline();
    pipeline.get(SUPPLY_KEYS.MAX);
    pipeline.get(SUPPLY_KEYS.CIRC);
    pipeline.get(SUPPLY_KEYS.RESERVE);
    pipeline.get(SUPPLY_KEYS.MINT);
    pipeline.get(SUPPLY_KEYS.BURN);
    const res = await pipeline.exec();
    const [max, circ, reserve, mint, burn] = res.map(([, v]) => parseInt(v || '0', 10));
    return { max, circulating: circ, reserveRemaining: reserve, mintTotal: mint, burnTotal: burn };
  },

  /**
   * Reserva -> emisión controlada
   * Garantiza que no se exceda la reserva. Usa WATCH para evitar condiciones de carrera.
   */
  async allocateFromReserve(amount, meta = {}) {
    if (amount <= 0) throw new Error('Cantidad inválida');
    const client = redisService.client;

    while (true) {
      await client.watch(SUPPLY_KEYS.RESERVE);
      const curReserve = parseInt((await client.get(SUPPLY_KEYS.RESERVE)) || '0', 10);
      if (curReserve < amount) {
        await client.unwatch();
        throw new Error('Reserva insuficiente');
      }
      const multi = client.multi();
      multi.decrby(SUPPLY_KEYS.RESERVE, amount);
      multi.incrby(SUPPLY_KEYS.MINT, amount);
      multi.incrby(SUPPLY_KEYS.CIRC, amount);
      // Registrar tx de supply
      multi.lpush(SUPPLY_KEYS.TXS, JSON.stringify({ type: 'mint', amount, by: meta.by || 'admin', reason: meta.reason || 'grant', ts: Date.now() }));
      multi.ltrim(SUPPLY_KEYS.TXS, 0, 999);
      const ok = await multi.exec();
      if (ok) {
        logger.info(`🔥 Supply allocate -${amount} de reserva (by=${meta.by || 'admin'})`);
        return true;
      }
      logger.warn('Conflicto allocateFromReserve, reintentando...');
    }
  },

  /**
   * Emite desde reserva y acredita al usuario. Si falla la segunda parte, compensa.
   */
  async allocateAndGrant(userId, amount, meta = {}) {
    await this.allocateFromReserve(amount, meta);
    try {
      const res = await economyService.grantToUser(userId, amount, { reason: meta.reason || 'grant_from_supply', ...meta });
      return res;
    } catch (err) {
      logger.error('Error grant post-allocate, intentando compensar...', err);
      // Compensación: revertir movimientos de supply
      const multi = redisService.client.multi();
      multi.incrby(SUPPLY_KEYS.RESERVE, amount);
      multi.decrby(SUPPLY_KEYS.MINT, amount);
      multi.decrby(SUPPLY_KEYS.CIRC, amount);
      multi.lpush(SUPPLY_KEYS.TXS, JSON.stringify({ type: 'revert', amount, reason: 'grant_failed', ts: Date.now() }));
      multi.ltrim(SUPPLY_KEYS.TXS, 0, 999);
      await multi.exec();
      throw err;
    }
  },

  /** Listado de usuarios y saldos (SCAN paginado) */
  async listUsersWithFires({ cursor = '0', limit = 50, search = '' } = {}) {
    const [next, keys] = await redisService.client.scan(cursor, 'MATCH', 'user:*:currency', 'COUNT', Math.max(10, Math.min(1000, limit)));
    const items = [];
    if (keys && keys.length) {
      const pipeline = redisService.client.pipeline();
      keys.forEach(k => pipeline.hget(k, 'fires'));
      const res = await pipeline.exec();
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const userId = k.split(':')[1];
        const fires = parseInt((res[i] && res[i][1]) || '0', 10);
        // Buscar nombre si existe user:<id>
        let userName = null;
        try {
          const udata = await redisService.client.get(`user:${userId}`);
          if (udata) { const u = JSON.parse(udata); userName = u.userName || null; }
        } catch(_) {}
        items.push({ userId, userName, fires });
      }
    }
    // Filtro de búsqueda (simple por userName incluye)
    const filtered = search ? items.filter(i => (i.userName || '').toLowerCase().includes(String(search).toLowerCase())) : items;
    return { cursor: next, items: filtered.slice(0, limit) };
  },

  /** Obtener últimas N tx de supply */
  async getSupplyTxs(limit = 100) {
    const arr = await redisService.client.lrange(SUPPLY_KEYS.TXS, 0, Math.max(0, limit - 1));
    return arr.map(x => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean);
  }
};
