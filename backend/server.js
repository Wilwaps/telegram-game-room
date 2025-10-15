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
const tttRoutes = require('./routes/tictactoe');
const tttStore = require('./services/tictactoeStore');
const bingoRoutes = require('./routes/bingo');
const fireRequestsRoutes = require('./routes/fire_requests');
const rafflesRoutes = require('./routes/raffles');
const messagesRoutes = require('./routes/messages');
const musicRoutes = require('./routes/music');
const store = require('./services/memoryStore');
const welcomeRoutes = require('./routes/welcome');
const adminWelcomeRoutes = require('./routes/admin_welcome');

const app = express();
// Configurar trust proxy con hops numéricos (evita ValidationError de express-rate-limit)
app.set('trust proxy', parseInt(process.env.TRUST_PROXY_HOPS || '1', 10));
// Bloquear cualquier intento de establecer X-Frame-Options en respuestas
app.use((req, res, next) => {
  try {
    const original = res.setHeader;
    res.setHeader = function(name, value) {
      if (String(name || '').toLowerCase() === 'x-frame-options') { return; }
      return original.call(this, name, value);
    };
  } catch (_) {}
  next();
});
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'", "https://cdn.tailwindcss.com", "https://telegram.org", "https://cdn.jsdelivr.net", "'unsafe-inline'"],
      "style-src": ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
      "img-src": ["'self'", "data:", "https:", "blob:"],
      "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
      "connect-src": ["'self'", "https:", "wss:", "https://api.telegram.org", "https://*.telegram.org"],
      "media-src": ["'self'", "https://www.soundhelix.com", "https://api.telegram.org", "https://*.telegram.org"],
      "frame-ancestors": ["'self'", "https://*.telegram.org", "https://web.telegram.org", "https://t.me", "https://*.t.me"],
      "upgrade-insecure-requests": []
    }
  },
  frameguard: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors());
app.use(express.json());
// Forzar eliminación del header X-Frame-Options para permitir embed en Telegram WebApp
app.use((req, res, next) => {
  try { res.removeHeader('X-Frame-Options'); res.removeHeader('x-frame-options'); } catch (_) {}
  next();
});
// Identidad anónima para métricas: UID persistente y captura de dispositivo (UA)
app.use((req, res, next) => {
  try {
    const raw = String(req.headers.cookie || '');
    let uid = '';
    for (const part of raw.split(/;\s*/)) {
      const [k, v] = part.split('=');
      if (k === 'uid' || k === 'uidp') { uid = v; break; }
    }
    if (!uid) {
      uid = (Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 24);
      const maxAge = 365 * 24 * 3600;
      res.setHeader('Set-Cookie', [
        `uid=${uid}; Path=/; SameSite=None; Secure; Max-Age=${maxAge}`,
        `uidp=${uid}; Path=/; SameSite=None; Secure; Partitioned; Max-Age=${maxAge}`
      ]);
    }
    const ua = String(req.headers['user-agent'] || '');
    try { store.touchUser('anon:' + uid, { ua }); } catch (_) {}
  } catch (_) {}
  next();
});
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
      // Omitir rate limit para clientes Telegram WebApp y rutas de login (QA)
      const isTelegramUA = /Telegram/i.test(ua);
      if (isTelegramUA) return true;
      if (req.path && (req.path === '/login' || req.path === '/games' || req.path.startsWith('/games'))) return true;
      const allowEnv = process.env.ALLOW_TEST_RUNNER === 'true' || (process.env.NODE_ENV !== 'production');
      const isTestUA = /testsprite|chrome-devtools|chrome devtools/i.test(ua);
      const isTestHX = /testsprite/i.test(hx);
      return allowEnv && (isTestUA || isTestHX);
    } catch (_) {
      return false;
    }
  }
});
app.use('/api', limiter);

// Rutas API
app.use('/api/economy', economyRoutes);
app.use('/api/xp', xpRoutes);
app.use('/api/economy', economyExtRoutes);
app.use('/api/economy', fireRequestsRoutes);
app.use('/api/raffles', rafflesRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/welcome', welcomeRoutes);
app.use('/api/admin/welcome', adminWelcomeRoutes);
app.use('/telegram', telegramRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/games/tictactoe', tttRoutes);
app.use('/api/games/bingo', bingoRoutes);
app.use('/api/admin/users', require('./routes/admin_users'));
try { app.use('/api/roles', require('./routes/roles')); } catch(_) {}

// Rutas Frontend
app.get('/supply', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/supply.html'));
});
app.get('/profile', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/profile.html'));
});

app.get('/games', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/games.html'));
});
app.get('/games/tictactoe', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/tictactoe.html'));
});
app.get('/games/bingo', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/bingo.html'));
});
app.get('/raffles', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/raffles.html'));
});
app.get('/raffles/create', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/raffle-create.html'));
});
app.get('/raffles/room', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/raffle-room.html'));
});
app.get('/fire-requests', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/fire-requests.html'));
});

app.get('/admin/dashboard', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/admin/dashboard.html'));
});

app.get('/login', (req, res) => {
  return res.redirect(302, '/games');
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
  try {
    const ev = store.getWelcomeEvent();
    if (!(ev && ev.active && Date.now() < Number(ev.endsAt || 0))) {
      store.setWelcomeEventActive({ coins: 100, fires: 10, durationHours: 72 });
      logger.info('Welcome event activated');
    } else {
      logger.info('Welcome event already active, skip activation');
    }
  } catch (_) {}
  try {
    const interval = Math.max(500, parseInt(process.env.TTT_TICK_INTERVAL_MS || '1000', 10) || 1000);
    setInterval(() => {
      try { tttStore.tick(); } catch (err) { logger.error('TTT tick error', err); }
    }, interval);
    logger.info(`TTT tick loop started (interval ${interval} ms)`);
  } catch (err) {
    logger.error('Failed to start TTT tick loop', err);
  }
  try {
    if (authService && typeof authService.getUserByEmail === 'function' && typeof authService.createEmailUser === 'function') {
      const email = 'pruebatote@example.com';
      const exist = authService.getUserByEmail(email);
      if (!exist) {
        const rec = authService.createEmailUser({ name: 'pruebatote', email, password: 'pruebatote' });
        rec.verified = true;
        try { store.setUserContact({ userId: rec.internalId, email }); } catch (_) {}
        logger.info('Seed QA user created: pruebatote@example.com / pruebatote');
      } else if (!exist.verified) {
        exist.verified = true;
        try { store.setUserContact({ userId: exist.internalId, email }); } catch (_) {}
        logger.info('Seed QA user verified: pruebatote@example.com');
      }
    }
  } catch (e) { logger.warn('Seed QA user failed', e); }
  // Seed roles de Tote/Admin desde env si están presentes
  try {
    const roles = require('./services/roles');
    const parse = (s)=> String(s||'').split(/[;,\s]+/).map(x=>x.trim()).filter(Boolean);
    const addAll = (ids, role)=>{ for(const id of ids){ try{ roles.grant(id, role);}catch(_){} } };
    addAll(parse(process.env.ROLE_TOTE_USER_IDS || process.env.TOTE_ID), 'tote');
    addAll(parse(process.env.ROLE_ADMIN_USER_IDS), 'admin');
  } catch(_) {}
});

// Ticker para TicTacToe: rota turno por timeout y emite SSE
setInterval(() => {
  try { tttStore.tick(); } catch (_) {}
}, Math.max(500, Math.min(2000, parseInt(process.env.TTT_TICK_MS || '1000', 10) || 1000)));
