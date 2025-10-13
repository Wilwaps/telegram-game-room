const express = require('express');
const router = express.Router();

// Esqueleto inicial: endpoints mínimos (WIP)
router.get('/health', (req, res) => {
  res.json({ success: true, service: 'bingo', status: 'ok' });
});

// TODO: implementar CRUD de salas, SSE, unirse por código, opciones, listo, iniciar, draw, cantar, distribución, etc.

module.exports = router;
