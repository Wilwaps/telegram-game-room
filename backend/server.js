const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { PORT, security } = require('./config/config');
const logger = require('./config/logger');
const economyRoutes = require('./routes/economy');
const xpRoutes = require('./routes/xp');
const economyExtRoutes = require('./routes/economy_ext');
const telegramRoutes = require('./routes/telegram');
const profileRoutes = require('./routes/profile');

const app = express();
app.set('trust proxy', true);
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'", "https://cdn.tailwindcss.com", "https://telegram.org", "'unsafe-inline'"],
      "style-src": ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
      "img-src": ["'self'", "data:", "https:", "blob:"],
      "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
      "connect-src": ["'self'"],
      "frame-ancestors": ["'self'", "https://*.telegram.org", "https://web.telegram.org"],
      "upgrade-insecure-requests": []
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors());
app.use(express.json());
app.use(express.static(path.resolve(__dirname, '../public')));

// Rate limit con bypass endurecido (requiere header + env)
const limiter = rateLimit({
  windowMs: security.rateLimit.windowMs,
  max: security.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    try {
      // Excluir webhook de Telegram del rate-limit
      if (req.path && req.path.startsWith('/telegram/webhook')) return true;
      const ua = String(req.headers['user-agent'] || '');
      const hx = String(req.headers['x-test-runner'] || '');
      const allowEnv = process.env.ALLOW_TEST_RUNNER === 'true' || (process.env.NODE_ENV !== 'production');
      const isTestUA = /testsprite|chrome-devtools|chrome devtools/i.test(ua);
      const isTestHX = /testsprite/i.test(hx);
      return allowEnv && (isTestUA || isTestHX);
    } catch (_) {
      return false;
    }
  }
});
app.use(limiter);

// Rutas API
app.use('/api/economy', economyRoutes);
app.use('/api/xp', xpRoutes);
app.use('/api/economy', economyExtRoutes);
app.use('/telegram', telegramRoutes);
app.use('/api/profile', profileRoutes);

// Rutas Frontend
app.get('/supply', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/supply.html'));
});
app.get('/profile', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/profile.html'));
});

// Healthcheck
app.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok', time: Date.now() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'not_found' });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', err);
  res.status(500).json({ success: false, error: 'server_error' });
});

app.listen(PORT, () => {
  logger.info(`Server listening on port ${PORT}`);
});
