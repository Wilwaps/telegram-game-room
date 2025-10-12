const dotenv = require('dotenv');
const path = require('path');

// Carga .env.local si existe, luego .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const PORT = parseInt(process.env.PORT || '3000', 10);

const security = {
  rateLimit: {
    windowMs: parseInt(process.env.RL_WINDOW_MS || String(60 * 1000), 10),
    maxRequests: parseInt(process.env.RL_MAX_REQ || '120', 10)
  },
  admin: {
    username: process.env.ADMIN_USERNAME || 'wilcnct',
    code: process.env.ADMIN_CODE || '658072974'
  }
};

module.exports = { PORT, security };
