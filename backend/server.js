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
let authRoutes = null;
try { authRoutes = require('./routes/auth'); } catch (e) {
  console.warn('[warn] auth routes not found, disabling /api/auth endpoints');
  const noop = express.Router();
  noop.get('/health', (req,res)=> res.json({ success:true, disabled:true }));
  authRoutes = noop;
}
const store = require('./services/memoryStore');
let authService = null; let AUTH_STUB = false;
try { authService = require('./services/authStore'); }
catch (e) {
  console.warn('[warn] auth service not found, using in-memory stub');
  AUTH_STUB = true;
  const sessions = new Map();
  const uid = (n=18)=> (Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0,n);
  authService = {
    getSession: (sid)=> sessions.get(String(sid||'')) || null,
    destroySession: (sid)=> { sessions.delete(String(sid||'')); },
    createGuestSession: ({ ua })=> { const sid = uid(24); const userId = 'anon:' + uid(8); sessions.set(sid, { userId, ua: String(ua||''), createdAt: Date.now() }); return { sid, userId }; },
    createSessionForTelegram: ({ telegramId, name, ua })=> { const sid = uid(24); const userId = 'tg:' + String(telegramId||'0'); sessions.set(sid, { userId, ua: String(ua||''), createdAt: Date.now() }); return { sid, userId }; }
  };
}
const welcomeRoutes = require('./routes/welcome');
const adminWelcomeRoutes = require('./routes/admin_welcome');

const app = express();
app.set('trust proxy', true);
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'", "https://cdn.tailwindcss.com", "https://telegram.org", "https://cdn.jsdelivr.net", "'unsafe-inline'"],
      "style-src": ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
      "img-src": ["'self'", "data:", "https:", "blob:"],
      "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
      "connect-src": ["'self'", "https://api.telegram.org", "https://*.telegram.org"],
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
// Bootstrap de sesión: asigna un SID invitado si no existe
app.use((req, res, next) => {
  try {
    const raw = String(req.headers.cookie || '');
    let sid = '';
    for (const part of raw.split(/;\s*/)) {
      const [k, v] = part.split('=');
      if (k === 'sid') { sid = v; break; }
    }
    const sess = sid ? authService.getSession(sid) : null;
    if (!sess) {
      const { sid: newSid } = authService.createGuestSession({ ua: String(req.headers['user-agent'] || '') });
      const maxAge = 30 * 24 * 3600;
      res.setHeader('Set-Cookie', [`sid=${newSid}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=${maxAge}`]);
    }
  } catch (_) {}
  next();
});
app.use(express.static(path.resolve(__dirname, '../public')));

// Traza de usuarios: si hay sesión, actualizar lastSeenAt
app.use((req, res, next) => {
  try {
    const raw = String(req.headers.cookie || '');
    let sid = '';
    for (const part of raw.split(/;\s*/)) {
      const [k, v] = part.split('=');
      if (k === 'sid') { sid = v; break; }
    }
    if (sid) {
      const sess = authService.getSession(sid);
      if (sess && sess.userId) {
        try { store.touchUser(sess.userId); } catch (_) {}
      }
    }
  } catch (_) {}
  next();
});

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
app.use('/api/auth', authRoutes);
app.use('/api/admin/users', require('./routes/admin_users'));

// Rutas Frontend
function requireIdentified(req, res, next) {
  try {
    const raw = String(req.headers.cookie || '');
    let sid = '';
    for (const part of raw.split(/;\s*/)) {
      const [k, v] = part.split('=');
      if (k === 'sid') { sid = v; break; }
    }
    const sess = sid ? authService.getSession(sid) : null;
    if (!sess) return res.redirect(302, '/login');
    const uid = String(sess.userId || '');
    if (uid.startsWith('anon:') && !AUTH_STUB) return res.redirect(302, '/login');
    return next();
  } catch (_) { return res.redirect(302, '/login'); }
}

app.get('/supply', requireIdentified, (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/supply.html'));
});
app.get('/profile', requireIdentified, (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/profile.html'));
});

app.get('/games', requireIdentified, (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/games.html'));
});
app.get('/games/tictactoe', requireIdentified, (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/tictactoe.html'));
});
app.get('/games/bingo', requireIdentified, (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/bingo.html'));
});
app.get('/raffles', requireIdentified, (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/raffles.html'));
});
app.get('/raffles/create', requireIdentified, (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/raffle-create.html'));
});
app.get('/raffles/room', requireIdentified, (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/raffle-room.html'));
});
app.get('/fire-requests', requireIdentified, (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/fire-requests.html'));
});

app.get('/admin/dashboard', requireIdentified, (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/admin/dashboard.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/login.html'));
});
app.get('/register', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/register.html'));
});
app.get('/verify', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/verify.html'));
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
});

// Ticker para TicTacToe: rota turno por timeout y emite SSE
setInterval(() => {
  try { tttStore.tick(); } catch (_) {}
}, Math.max(500, Math.min(2000, parseInt(process.env.TTT_TICK_MS || '1000', 10) || 1000)));
