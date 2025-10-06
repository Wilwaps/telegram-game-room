/**
 * ============================================
 * SERVICIO DE TOKENOMICS DE 🔥 (supply/metrics)
 * ============================================
 */
const redisService = require('./redisService');
const logger = require('../config/logger');

const SUPPLY_CAP_KEY = 'global:fire:supply_cap';
const MINTED_KEY = 'global:fire:minted';
const BURNED_KEY = 'global:fire:burned';

const DEFAULT_SUPPLY_CAP = 1000000000; // 1e9 por defecto

module.exports = {
  async getSupplyCap() {
    const raw = await redisService.client.get(SUPPLY_CAP_KEY);
    return parseInt(raw || `${DEFAULT_SUPPLY_CAP}`, 10);
  },

  async setSupplyCap(value) {
    const cap = Math.max(0, parseInt(value, 10) || DEFAULT_SUPPLY_CAP);
    await redisService.client.set(SUPPLY_CAP_KEY, cap);
    return cap;
  },

  async getMetrics() {
    const [cap, minted, burned] = await Promise.all([
      this.getSupplyCap(),
      redisService.client.get(MINTED_KEY),
      redisService.client.get(BURNED_KEY)
    ]);
    const mintedNum = parseInt(minted || '0', 10);
    const burnedNum = parseInt(burned || '0', 10);
    const circulation = Math.max(0, mintedNum - burnedNum);
    return { supplyCap: cap, minted: mintedNum, burned: burnedNum, circulation };
  },

  // Registrar mint (no exceder cap) si enforce = true
  async mint(amount, { enforce = false } = {}) {
    const delta = Math.max(0, parseInt(amount, 10) || 0);
    if (delta === 0) return await this.getMetrics();

    if (enforce) {
      const cap = await this.getSupplyCap();
      const minted = parseInt((await redisService.client.get(MINTED_KEY)) || '0', 10);
      if (minted + delta > cap) {
        throw new Error('Supply cap excedido');
      }
    }
    await redisService.client.incrby(MINTED_KEY, delta);
    return await this.getMetrics();
  },

  async burn(amount) {
    const delta = Math.max(0, parseInt(amount, 10) || 0);
    if (delta === 0) return await this.getMetrics();
    await redisService.client.incrby(BURNED_KEY, delta);
    return await this.getMetrics();
  }
};
