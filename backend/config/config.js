/**
 * ============================================
 * CONFIGURACIÓN CENTRAL DE LA APLICACIÓN
 * ============================================
 * 
 * Este archivo centraliza todas las configuraciones
 * de la aplicación, cargando variables de entorno
 * y proporcionando valores por defecto seguros.
 * 
 * @module config
 */

require('dotenv').config();

/**
 * Validar que las variables de entorno requeridas estén presentes
 */
const requiredEnvVars = ['NODE_ENV', 'PORT'];

requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    console.error(`❌ Error: Variable de entorno requerida ${envVar} no está definida`);
    process.exit(1);
  }
});

/**
 * Configuración del servidor
 */
const server = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  host: process.env.HOST || '0.0.0.0',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test'
};

/**
 * Configuración de Redis
 */
const redis = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB, 10) || 0,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  // TTL (Time To Live) en segundos
  ttl: {
    room: parseInt(process.env.ROOM_EXPIRY, 10) || 3600,
    session: parseInt(process.env.SESSION_EXPIRY, 10) || 86400,
    cache: parseInt(process.env.CACHE_EXPIRY, 10) || 300
  }
};

/**
 * Configuración de Telegram Bot
 */
const telegram = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  botUsername: process.env.TELEGRAM_BOT_USERNAME || '',
  webhookUrl: process.env.TELEGRAM_WEBHOOK_URL || ''
};

/**
 * Configuración del juego
 */
const game = {
  turnTimeout: parseInt(process.env.TURN_TIMEOUT, 10) || 30,
  maxRooms: parseInt(process.env.MAX_ROOMS, 10) || 1000,
  maxPlayersPerRoom: parseInt(process.env.MAX_PLAYERS_PER_ROOM, 10) || 2,
  emptyRoomTimeout: parseInt(process.env.EMPTY_ROOM_TIMEOUT, 10) || 60,
  gameTypes: {
    TIC_TAC_TOE: 'tic-tac-toe',
    CHECKERS: 'checkers',
    CHESS: 'chess',
    BINGO: 'bingo'
  }
};

/**
 * Configuración de seguridad
 */
const security = {
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100
  },
  cors: {
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000'],
    credentials: true
  }
};
/**
 * Configuración de logging
 */
const logging = {
  level: process.env.LOG_LEVEL || 'info',
  file: process.env.LOG_FILE || 'logs/app.log',
  maxSize: process.env.LOG_MAX_SIZE || '10m',
  maxFiles: parseInt(process.env.LOG_MAX_FILES, 10) || 7
};

/**
 * Configuración de métricas
 */
const metrics = {
  enabled: process.env.ENABLE_METRICS === 'true',
  port: parseInt(process.env.METRICS_PORT, 10) || 9090
};

/**
 * Feature flags
 */
const features = {
  aiMode: process.env.ENABLE_AI_MODE === 'true',
  tournaments: process.env.ENABLE_TOURNAMENTS === 'true',
  chat: process.env.ENABLE_CHAT === 'true',
  achievements: process.env.ENABLE_ACHIEVEMENTS === 'true'
};

/**
 * Configuración de economía (bonos y cooldowns)
 */
const economy = {
  welcomeAmount: parseInt(process.env.WELCOME_FIRES, 10) || 10,
  dailyAmount: parseInt(process.env.DAILY_FIRES, 10) || 0,
  dailyCooldownHours: parseInt(process.env.DAILY_COOLDOWN_HOURS, 10) || 24
};

/**
 * Constantes de la aplicación
 */
const constants = {
  // Estados de sala
  ROOM_STATUS: {
    WAITING: 'waiting',
    PLAYING: 'playing',
    FINISHED: 'finished',
    ABANDONED: 'abandoned'
  },
  
  // Símbolos de jugadores
  PLAYER_SYMBOLS: {
    X: 'X',
    O: 'O'
  },
  
  // Resultados de juego
  GAME_RESULTS: {
    WIN: 'win',
    LOSS: 'loss',
    DRAW: 'draw',
    ABANDONED: 'abandoned'
  },
  
  // Eventos de Socket.io
  SOCKET_EVENTS: {
    // Conexión
    CONNECTION: 'connection',
    DISCONNECT: 'disconnect',
    
    // Autenticación
    AUTHENTICATE: 'authenticate',
    AUTHENTICATED: 'authenticated',
    
    // Salas
    CREATE_ROOM: 'create_room',
    ROOM_CREATED: 'room_created',
    JOIN_ROOM: 'join_room',
    LEAVE_ROOM: 'leave_room',
    CLOSE_ROOM: 'close_room',
    MAKE_PUBLIC: 'make_public',
    
    // Juego
    MAKE_MOVE: 'make_move',
    GAME_START: 'game_start',
    GAME_OVER: 'game_over',
    GAME_DRAW: 'game_draw',
    MOVE_MADE: 'move_made',
    // Control de modo e inicio (TTT)
    SET_ROOM_MODE: 'set_room_mode',
    ROOM_MODE_UPDATED: 'room_mode_updated',
    START_GAME_REQUEST: 'start_game_request',
    
    // Revancha
    PLAY_AGAIN: 'play_again',
    REMATCH_REQUESTED: 'rematch_requested',
    GAME_RESTART: 'game_restart',
    
    // Notificaciones
    PLAYER_LEFT: 'player_left',
    PLAYER_JOINED: 'player_joined',
    ROOM_UPDATED: 'room_updated',
    ROOM_ADDED: 'room_added',
    ROOM_REMOVED: 'room_removed',
    ROOM_CLOSED: 'room_closed',
    ROOMS_LIST: 'rooms_list',

    // Economía - Fuegos
    GET_FIRES: 'get_fires',
    FIRES_BALANCE: 'fires_balance',
    EARN_FIRE: 'earn_fire',
    SPEND_FIRES: 'spend_fires',
    TRANSFER_FIRES: 'transfer_fires',
    FIRES_UPDATED: 'fires_updated',
    GET_FIRES_HISTORY: 'get_fires_history',
    FIRES_HISTORY: 'fires_history',
    FIRES_TRANSACTION: 'fires_transaction',
    // Onboarding / Bienvenida
    WELCOME_STATUS: 'welcome_status',
    WELCOME_INFO: 'welcome_info',
    WELCOME_CLAIM: 'welcome_claim',
    // Bono diario
    DAILY_BONUS_STATUS: 'daily_bonus_status',
    DAILY_BONUS_INFO: 'daily_bonus_info',
    DAILY_BONUS_CLAIM: 'daily_bonus_claim',
    
    // XP / Niveles
    GET_XP: 'get_xp',
    XP_BALANCE: 'xp_balance',
    EARN_XP: 'earn_xp',
    LOSE_XP: 'lose_xp',
    XP_UPDATED: 'xp_updated',
    GET_XP_HISTORY: 'get_xp_history',
    XP_HISTORY: 'xp_history',
    XP_TRANSACTION: 'xp_transaction',
    //bingo
    CREATE_BINGO_ROOM: 'create_bingo_room',
    BINGO_ROOM_CREATED: 'bingo_room_created',
    JOIN_BINGO: 'join_bingo',
    BINGO_JOINED: 'bingo_joined',
    BINGO_MAKE_PUBLIC: 'bingo_make_public',
    BINGO_ROOM_UPDATED: 'bingo_room_updated',
    LEAVE_BINGO: 'leave_bingo',
    START_BINGO: 'start_bingo',
    BINGO_STARTED: 'bingo_started',
    DRAW_NEXT: 'draw_next',
    NUMBER_DRAWN: 'number_drawn',
    CLAIM_BINGO: 'claim_bingo',
    BINGO_VALID: 'bingo_valid',
    BINGO_INVALID: 'bingo_invalid',
    BINGO_WINNER: 'bingo_winner',
    BINGO_FINISHED: 'bingo_finished',
    PAUSE_BINGO: 'pause_bingo',
    RESUME_BINGO: 'resume_bingo',
    BINGO_POTENTIAL: 'bingo_potential',
    PLAYER_JOINED_BINGO: 'player_joined_bingo',
    PLAYER_LEFT_BINGO: 'player_left_bingo',
    HOST_LEFT_BINGO: 'host_left_bingo',
    BINGO_PAUSED: 'bingo_paused',
    BINGO_RESUMED: 'bingo_resumed',
    ROOM_FULL: 'room_full',
    //bingo - Lobby de espera y modo economía
    BINGO_SET_MODE: 'bingo_set_mode',
    BINGO_MODE_UPDATED: 'bingo_mode_updated',
    BINGO_SET_READY: 'bingo_set_ready',
    BINGO_READY_UPDATED: 'bingo_ready_updated',
    
    // Errores
    ERROR: 'error'
  },
  
  ADMIN: {
    USERNAME: process.env.ADMIN_USERNAME || 'Wilcnct'
  },
  
  REDIS_PREFIXES: {
    ROOM: 'room:',
    USER: 'user:',
    SESSION: 'session:',
    STATS: 'stats:',
    CACHE: 'cache:',
    BINGO_ROOM: 'bingo:room:',
    BINGO_CARDS: 'bingo:cards:',
    XP: 'xp:',
    XP_CFG: 'xp:config:'
  }
};

/**
 * Exportar configuración completa
 */
module.exports = {
  server,
  redis,
  telegram,
  game,
  security,
  logging,
  metrics,
  features,
  economy,
  constants
};
