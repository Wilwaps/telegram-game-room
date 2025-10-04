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
    ROOM_CREATED: 'room_created',
    
    // Economía - Fuegos
    GET_FIRES: 'get_fires',
    FIRES_BALANCE: 'fires_balance',
    EARN_FIRE: 'earn_fire',
    SPEND_FIRES: 'spend_fires',
    TRANSFER_FIRES: 'transfer_fires',
    FIRES_UPDATED: 'fires_updated',
    
    // Errores
    ERROR: 'error'
  }
};

// Hacer CONFIG global
window.CONFIG = CONFIG;
