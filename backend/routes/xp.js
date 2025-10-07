const express = require('express');
const router = express.Router();
const xpService = require('../services/xpService');
const logger = require('../config/logger');

// GET /api/xp/config
router.get('/config', async (req, res) => {
  try {
    const thresholds = await xpService.getThresholds();
    res.json({ success: true, thresholds });
  } catch (err) {
    logger.error('GET /xp/config error:', err);
    res.status(500).json({ success: false, error: 'No se pudo obtener la configuración de XP' });
  }
});

// POST /api/xp/config
router.post('/config', async (req, res) => {
  try {
    const thresholds = await xpService.setThresholds(req.body?.thresholds || {});
    res.json({ success: true, thresholds });
  } catch (err) {
    logger.error('POST /xp/config error:', err);
    res.status(400).json({ success: false, error: 'No se pudo guardar la configuración de XP' });
  }
});

module.exports = router;
