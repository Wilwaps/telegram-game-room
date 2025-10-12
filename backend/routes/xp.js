const express = require('express');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();

// Config XP en memoria (MVP)
const xpConfig = {
  thresholds: {
    // nivel: puntos acumulados requeridos
    "1": 0,
    "2": 100,
    "3": 300,
    "4": 600
  },
  updatedAt: Date.now()
};

function isValidThresholds(obj) {
  if (!obj || typeof obj !== 'object') return false;
  const keys = Object.keys(obj);
  if (!keys.length) return false;
  for (const k of keys) {
    const v = obj[k];
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return false;
  }
  return true;
}

// GET /api/xp/config
router.get('/config', (req, res) => {
  res.json({ success: true, config: xpConfig });
});

// POST /api/xp/config { thresholds: { "2": 120, ... } }
router.post('/config', adminAuth, (req, res) => {
  try {
    const { thresholds } = req.body || {};
    if (!isValidThresholds(thresholds)) {
      return res.status(400).json({ success: false, error: 'invalid_thresholds' });
    }
    xpConfig.thresholds = Object.fromEntries(
      Object.entries(thresholds).map(([k, v]) => [String(k), Number(v)])
    );
    xpConfig.updatedAt = Date.now();
    res.json({ success: true, config: xpConfig });
  } catch (err) {
    res.status(500).json({ success: false, error: 'xp_update_error' });
  }
});

module.exports = router;
