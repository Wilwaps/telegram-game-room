const express = require('express');
const router = express.Router();
const store = require('../services/memoryStore');

router.get('/status', (req, res) => {
  try {
    const ev = store.getWelcomeEvent();
    res.json({ success: true, event: ev, now: Date.now() });
  } catch (err) {
    res.status(500).json({ success: false, error: 'welcome_status_error' });
  }
});

module.exports = router;
