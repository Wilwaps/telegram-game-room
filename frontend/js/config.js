/**
 * ============================================
 * CONFIGURACIÓN DEL FRONTEND
 * ============================================
 */

const CONFIG = {
  // URL del servidor (cambiar en producción)
  SERVER_URL: window.location.origin,
  
  // Configuración de Socket.io
  SOCKET: {
    TRANSPORTS: ['websocket', 'polling'],
    RECONNECTION: true,
    RECONNECTION_ATTEMPTS: 5,
    RECONNECTION_DELAY: 1000,
    TIMEOUT: 20000
  },
  
  // Configuración del juego
  GAME: {
    TURN_TIMEOUT: 30, // segundos
    BOARD_SIZE: 9,
    WINNING_COMBINATIONS: [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // Filas
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columnas
      [0, 4, 8], [2, 4, 6]              // Diagonales
    ]
  },
  
  // Configuración de UI
  UI: {
    TOAST_DURATION: 3000,
    ANIMATION_DURATION: 300,
    CONFETTI_COUNT: 50
  },
  
  // Eventos de Socket.io
  EVENTS: {
    // Conexión
    CONNECTION: 'connection',
    DISCONNECT: 'disconnect',
    
    // Autenticación
    AUTHENTICATE: 'authenticate',
    AUTHENTICATED: 'authenticated',
    
    // Salas
    CREATE_ROOM: 'create_room',
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
    ROOM_ADDED: 'room_added',
    ROOM_REMOVED: 'room_removed',
    ROOM_CLOSED: 'room_closed',
    ROOMS_LIST: 'rooms_list',
    ROOM_CREATED: 'room_created',

    // Bingo
    CREATE_BINGO_ROOM: 'create_bingo_room',
    BINGO_ROOM_CREATED: 'bingo_room_created',
    JOIN_BINGO: 'join_bingo',
    BINGO_JOINED: 'bingo_joined',
    BINGO_MAKE_PUBLIC: 'bingo_make_public',
    BINGO_ROOM_UPDATED: 'bingo_room_updated',
    PLAYER_JOINED_BINGO: 'player_joined_bingo',
    PLAYER_LEFT_BINGO: 'player_left_bingo',
    START_BINGO: 'start_bingo',
    BINGO_STARTED: 'bingo_started',
    DRAW_NEXT: 'draw_next',
    NUMBER_DRAWN: 'number_drawn',
    CLAIM_BINGO: 'claim_bingo',
    BINGO_VALID: 'bingo_valid',
    BINGO_INVALID: 'bingo_invalid',
    BINGO_WINNER: 'bingo_winner',
    BINGO_FINISHED: 'bingo_finished',
    BINGO_POTENTIAL: 'bingo_potential',
    HOST_LEFT_BINGO: 'host_left_bingo',
    BINGO_PAUSED: 'bingo_paused',
    BINGO_RESUMED: 'bingo_resumed',
    ROOM_FULL: 'room_full',

    // Economía - Fuegos
    GET_FIRES: 'get_fires',
    FIRES_BALANCE: 'fires_balance',
    EARN_FIRE: 'earn_fire',
    SPEND_FIRES: 'spend_fires',
    FIRES_UPDATED: 'fires_updated',
    GET_FIRES_HISTORY: 'get_fires_history',
    FIRES_HISTORY: 'fires_history',
    FIRES_TRANSACTION: 'fires_transaction',
    // Onboarding / Bienvenida
    WELCOME_STATUS: 'welcome_status',
    WELCOME_INFO: 'welcome_info',
    WELCOME_CLAIM: 'welcome_claim',
    // XP / Niveles
    GET_XP: 'get_xp',
    XP_BALANCE: 'xp_balance',
    EARN_XP: 'earn_xp',
    LOSE_XP: 'lose_xp',
    XP_UPDATED: 'xp_updated',
    GET_XP_HISTORY: 'get_xp_history',
    XP_HISTORY: 'xp_history',
    
    // Errores
    ERROR: 'error'
  }
};

// Hacer CONFIG global
window.CONFIG = CONFIG;
