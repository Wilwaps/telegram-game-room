/**
 * ============================================
 * CLIENTE DE SOCKET.IO
 * ============================================
 */

const SocketClient = {
  socket: null,
  connected: false,
  currentRoom: null,
  userId: null,
  eventHandlers: new Map(),
  lastRoomsList: null,

  /**
   * Conectar al servidor
   */
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        const serverUrl = CONFIG.SERVER_URL || window.location.origin;
        console.log('🔌 Conectando a:', serverUrl);

        this.socket = io(serverUrl, {
          transports: CONFIG.SOCKET.TRANSPORTS,
          reconnection: CONFIG.SOCKET.RECONNECTION,
          reconnectionAttempts: CONFIG.SOCKET.RECONNECTION_ATTEMPTS,
          reconnectionDelay: CONFIG.SOCKET.RECONNECTION_DELAY,
          timeout: CONFIG.SOCKET.TIMEOUT,
          autoConnect: true,
          forceNew: false
        });

        let connectionTimeout = setTimeout(() => {
          if (!this.connected) {
            reject(new Error('Timeout de conexión al servidor'));
          }
        }, 10000);

        this.socket.on('connect', () => {
          console.log('✅ Conectado al servidor');
          clearTimeout(connectionTimeout);
          this.connected = true;
          resolve();
        });

        this.socket.on('disconnect', (reason) => {
          console.log('❌ Desconectado del servidor:', reason);
          this.connected = false;
          if (reason === 'io server disconnect') {
            // Reconectar manualmente si el servidor desconectó
            this.socket.connect();
          }
        });

        this.socket.on('reconnect', (attemptNumber) => {
          console.log('🔄 Reconectado después de', attemptNumber, 'intentos');
          UI.showToast('Conexión restablecida', 'success');
          this.connected = true;
        });

        this.socket.on('reconnect_attempt', (attemptNumber) => {
          console.log('🔄 Intento de reconexión', attemptNumber);
        });

        this.socket.on('reconnect_error', (error) => {
          console.error('❌ Error de reconexión:', error);
        });

        this.socket.on('reconnect_failed', () => {
          console.error('❌ Falló la reconexión');
          UI.showToast('No se pudo reconectar al servidor', 'error');
        });

        this.socket.on('connect_error', (error) => {
          console.error('❌ Error de conexión:', error.message);
          clearTimeout(connectionTimeout);
          reject(new Error('No se pudo conectar al servidor. Verifica tu conexión.'));
        });

        this.setupDefaultHandlers();

      } catch (error) {
        console.error('❌ Error al crear socket:', error);
        reject(error);
      }
    });
  },

  /**
   * ECONOMÍA - Fuegos
   */
  getFires() {
    this.socket.emit(CONFIG.EVENTS.GET_FIRES);
  },

  earnFire(amount = 1) {
    this.socket.emit(CONFIG.EVENTS.EARN_FIRE, amount);
  },

  spendFires(amount, reason = 'entry') {
    this.socket.emit(CONFIG.EVENTS.SPEND_FIRES, { amount, reason });
  },

  transferFires(targetUserId, amount) {
    this.socket.emit(CONFIG.EVENTS.TRANSFER_FIRES, { targetUserId, amount });
  },

  getFiresHistory(limit = 50, offset = 0) {
    this.socket.emit(CONFIG.EVENTS.GET_FIRES_HISTORY, { limit, offset });
  },

  /**
   * XP - Experiencia
   */
  getXp() {
    this.socket.emit(CONFIG.EVENTS.GET_XP);
  },

  getXpHistory(limit = 50, offset = 0) {
    this.socket.emit(CONFIG.EVENTS.GET_XP_HISTORY, { limit, offset });
  },

  /**
   * Onboarding / Bienvenida
   */
  welcomeStatus() {
    this.socket.emit(CONFIG.EVENTS.WELCOME_STATUS);
  },

  welcomeClaim() {
    this.socket.emit(CONFIG.EVENTS.WELCOME_CLAIM);
  },

  /**
   * ======================
   * BINGO - MÉTODOS
   * ======================
   */
  createBingoRoom({ isPublic = true, mode = 'line', autoDraw = false, drawIntervalMs = 5000 } = {}) {
    this.socket.emit(CONFIG.EVENTS.CREATE_BINGO_ROOM, { isPublic, mode, autoDraw, drawIntervalMs });
  },

  joinBingo(roomCode, cardsCount = 1) {
    this.socket.emit(CONFIG.EVENTS.JOIN_BINGO, { roomCode, cardsCount });
  },

  leaveBingo(roomCode) {
    const code = roomCode || this.currentBingoRoom;
    if (code) this.socket.emit(CONFIG.EVENTS.LEAVE_BINGO, { roomCode: code });
  },

  startBingo(roomCode) {
    const code = roomCode || this.currentBingoRoom;
    if (code) this.socket.emit(CONFIG.EVENTS.START_BINGO, { roomCode: code });
  },

  drawNext(roomCode) {
    const code = roomCode || this.currentBingoRoom;
    if (code) this.socket.emit(CONFIG.EVENTS.DRAW_NEXT, { roomCode: code });
  },

  notifyBingoPotential(cardId, pattern = 'unknown', roomCode) {
    const code = roomCode || this.currentBingoRoom;
    if (code && cardId) this.socket.emit(CONFIG.EVENTS.BINGO_POTENTIAL, { roomCode: code, cardId, pattern });
  },

  claimBingo(roomCode, cardId) {
    const code = roomCode || this.currentBingoRoom;
    if (code && cardId) this.socket.emit(CONFIG.EVENTS.CLAIM_BINGO, { roomCode: code, cardId });
  },

  makePublicBingo(roomCode) {
    const code = roomCode || this.currentBingoRoom;
    if (code) this.socket.emit(CONFIG.EVENTS.BINGO_MAKE_PUBLIC, { roomCode: code });
  },

  /**
   * ======================
   * DOMINÓ - MÉTODOS
   * ======================
   */
  createDominoRoom({ isPublic = true, mode = 'friendly', stake = 1 } = {}) {
    this.socket.emit(CONFIG.EVENTS.CREATE_DOMINO_ROOM, { isPublic, mode, stake });
  },

  joinDomino(roomCode) {
    if (roomCode) this.socket.emit(CONFIG.EVENTS.JOIN_DOMINO, { roomCode });
  },

  leaveDomino(roomCode) {
    const code = roomCode || this.currentDominoRoom;
    if (code) this.socket.emit(CONFIG.EVENTS.LEAVE_DOMINO, { roomCode: code });
  },

  startDomino(roomCode) {
    const code = roomCode || this.currentDominoRoom;
    if (code) this.socket.emit(CONFIG.EVENTS.START_DOMINO, { roomCode: code });
  },

  setDominoReady(ready = true, roomCode) {
    const code = roomCode || this.currentDominoRoom;
    if (code) this.socket.emit(CONFIG.EVENTS.DOMINO_READY, { roomCode: code, ready });
  },

  setDominoMode(mode = 'friendly', roomCode) {
    const code = roomCode || this.currentDominoRoom;
    if (code) this.socket.emit(CONFIG.EVENTS.DOMINO_SET_MODE, { roomCode: code, mode });
  },

  setDominoStake(stake = 1, roomCode) {
    const code = roomCode || this.currentDominoRoom;
    if (code) this.socket.emit(CONFIG.EVENTS.DOMINO_SET_STAKE, { roomCode: code, stake });
  },

  playDomino(tileId, end = 'right', roomCode) {
    const code = roomCode || this.currentDominoRoom;
    if (code && tileId) this.socket.emit(CONFIG.EVENTS.DOMINO_PLAY, { roomCode: code, tileId, end });
  },

  drawDomino(roomCode) {
    const code = roomCode || this.currentDominoRoom;
    if (code) this.socket.emit(CONFIG.EVENTS.DOMINO_DRAW, { roomCode: code });
  },

  passDomino(roomCode) {
    const code = roomCode || this.currentDominoRoom;
    if (code) this.socket.emit(CONFIG.EVENTS.DOMINO_PASS, { roomCode: code });
  },

  /**
   * Configurar manejadores por defecto
   */
  setupDefaultHandlers() {
    // Autenticación
    this.socket.on(CONFIG.EVENTS.AUTHENTICATED, (data) => {
      console.log('Usuario autenticado:', data);
      this.emit('authenticated', data);
    });

    // Lista de salas
    this.socket.on(CONFIG.EVENTS.ROOMS_LIST, (rooms) => {
      this.lastRoomsList = rooms;
      this.emit('rooms_list', rooms);
    });

    // Sala creada
    this.socket.on(CONFIG.EVENTS.ROOM_CREATED, (room) => {
      this.currentRoom = room.code;
      this.emit('room_created', room);
    });

    // ======================
    // BINGO - EVENTOS
    // ======================
    this.socket.on(CONFIG.EVENTS.BINGO_ROOM_CREATED, (payload) => {
      this.currentBingoRoom = payload?.room?.code;
      this.emit(CONFIG.EVENTS.BINGO_ROOM_CREATED, payload);
    });

    this.socket.on(CONFIG.EVENTS.BINGO_JOINED, (payload) => {
      this.currentBingoRoom = payload?.room?.code;
      this.emit(CONFIG.EVENTS.BINGO_JOINED, payload);
    });

    this.socket.on(CONFIG.EVENTS.PLAYER_JOINED_BINGO, (payload) => {
      this.emit(CONFIG.EVENTS.PLAYER_JOINED_BINGO, payload);
    });

    this.socket.on(CONFIG.EVENTS.PLAYER_LEFT_BINGO, (payload) => {
      this.emit(CONFIG.EVENTS.PLAYER_LEFT_BINGO, payload);
    });

    this.socket.on(CONFIG.EVENTS.BINGO_STARTED, (payload) => {
      this.emit(CONFIG.EVENTS.BINGO_STARTED, payload);
    });

    this.socket.on(CONFIG.EVENTS.NUMBER_DRAWN, (payload) => {
      this.emit(CONFIG.EVENTS.NUMBER_DRAWN, payload);
    });

    this.socket.on(CONFIG.EVENTS.BINGO_INVALID, (payload) => {
      this.emit(CONFIG.EVENTS.BINGO_INVALID, payload);
    });

    this.socket.on(CONFIG.EVENTS.BINGO_WINNER, (payload) => {
      this.emit(CONFIG.EVENTS.BINGO_WINNER, payload);
    });

    this.socket.on(CONFIG.EVENTS.BINGO_FINISHED, (payload) => {
      this.emit(CONFIG.EVENTS.BINGO_FINISHED, payload);
    });

    this.socket.on(CONFIG.EVENTS.BINGO_ROOM_UPDATED, (payload) => {
      this.emit(CONFIG.EVENTS.BINGO_ROOM_UPDATED, payload);
    });

    this.socket.on(CONFIG.EVENTS.BINGO_POTENTIAL, (payload) => {
      this.emit(CONFIG.EVENTS.BINGO_POTENTIAL, payload);
    });

    this.socket.on(CONFIG.EVENTS.HOST_LEFT_BINGO, (payload) => {
      this.currentBingoRoom = null;
      this.emit(CONFIG.EVENTS.HOST_LEFT_BINGO, payload);
    });

    // ======================
    // DOMINÓ - EVENTOS
    // ======================
    this.socket.on(CONFIG.EVENTS.DOMINO_ROOM_CREATED, (payload) => {
      this.currentDominoRoom = payload?.room?.code;
      this.emit(CONFIG.EVENTS.DOMINO_ROOM_CREATED, payload);
    });

    this.socket.on(CONFIG.EVENTS.DOMINO_ROOM_UPDATED, (payload) => {
      this.emit(CONFIG.EVENTS.DOMINO_ROOM_UPDATED, payload);
    });

    this.socket.on(CONFIG.EVENTS.DOMINO_START, (payload) => {
      this.emit(CONFIG.EVENTS.DOMINO_START, payload);
    });

    this.socket.on(CONFIG.EVENTS.DOMINO_STATE, (payload) => {
      this.emit(CONFIG.EVENTS.DOMINO_STATE, payload);
    });

    this.socket.on(CONFIG.EVENTS.DOMINO_ROUND_END, (payload) => {
      this.emit(CONFIG.EVENTS.DOMINO_ROUND_END, payload);
    });

    this.socket.on(CONFIG.EVENTS.DOMINO_MATCH_END, (payload) => {
      this.currentDominoRoom = null;
      this.emit(CONFIG.EVENTS.DOMINO_MATCH_END, payload);
    });

    // Sala agregada
    this.socket.on(CONFIG.EVENTS.ROOM_ADDED, (room) => {
      this.emit('room_added', room);
    });

    // Sala actualizada
    this.socket.on(CONFIG.EVENTS.ROOM_UPDATED, (room) => {
      this.emit('room_updated', room);
    });

    // Sala eliminada
    this.socket.on(CONFIG.EVENTS.ROOM_REMOVED, (roomCode) => {
      this.emit('room_removed', roomCode);
    });

    // Inicio de juego
    this.socket.on(CONFIG.EVENTS.GAME_START, (data) => {
      TelegramApp.hapticFeedback('success');
      this.emit('game_start', data);
    });

    // Movimiento realizado
    this.socket.on(CONFIG.EVENTS.MOVE_MADE, (data) => {
      TelegramApp.hapticFeedback('light');
      this.emit('move_made', data);
    });

    // Fin de juego
    this.socket.on(CONFIG.EVENTS.GAME_OVER, (data) => {
      TelegramApp.hapticFeedback('success');
      this.emit('game_over', data);
    });

    // Empate
    this.socket.on(CONFIG.EVENTS.GAME_DRAW, (data) => {
      TelegramApp.hapticFeedback('warning');
      this.emit('game_draw', data);
    });

    // Jugador abandonó
    this.socket.on(CONFIG.EVENTS.PLAYER_LEFT, (data) => {
      TelegramApp.hapticFeedback('warning');
      UI.showToast(`${data.userName} abandonó la partida`, 'warning');
      this.emit('player_left', data);
    });

    // Solicitud de revancha
    this.socket.on(CONFIG.EVENTS.REMATCH_REQUESTED, (data) => {
      this.emit('rematch_requested', data);
    });

    // Reinicio de juego
    this.socket.on(CONFIG.EVENTS.GAME_RESTART, (data) => {
      TelegramApp.hapticFeedback('success');
      UI.showToast(data.message, 'success');
      this.emit('game_restart', data);
    });

    // ======================
    // ECONOMÍA - FUEGOS
    // ======================
    this.socket.on(CONFIG.EVENTS.FIRES_BALANCE, (data) => {
      this.emit(CONFIG.EVENTS.FIRES_BALANCE, data);
    });

    this.socket.on(CONFIG.EVENTS.FIRES_UPDATED, (data) => {
      this.emit(CONFIG.EVENTS.FIRES_UPDATED, data);
    });

    this.socket.on(CONFIG.EVENTS.FIRES_HISTORY, (data) => {
      this.emit(CONFIG.EVENTS.FIRES_HISTORY, data);
    });

    this.socket.on(CONFIG.EVENTS.FIRES_TRANSACTION, (data) => {
      this.emit(CONFIG.EVENTS.FIRES_TRANSACTION, data);
    });

    // Onboarding / Bienvenida
    this.socket.on(CONFIG.EVENTS.WELCOME_INFO, (payload) => {
      this.emit(CONFIG.EVENTS.WELCOME_INFO, payload);
    });

    // ======================
    // XP - EVENTOS
    // ======================
    this.socket.on(CONFIG.EVENTS.XP_BALANCE, (payload) => {
      this.emit(CONFIG.EVENTS.XP_BALANCE, payload);
    });

    this.socket.on(CONFIG.EVENTS.XP_UPDATED, (payload) => {
      this.emit(CONFIG.EVENTS.XP_UPDATED, payload);
    });

    this.socket.on(CONFIG.EVENTS.XP_HISTORY, (payload) => {
      this.emit(CONFIG.EVENTS.XP_HISTORY, payload);
    });

    // Sala cerrada
    this.socket.on(CONFIG.EVENTS.ROOM_CLOSED, (data) => {
      this.currentRoom = null;
      UI.showToast(data.message, 'info');
      this.emit('room_closed', data);
    });

    // Errores
    this.socket.on(CONFIG.EVENTS.ERROR, (error) => {
      console.error('Error del servidor:', error);
      UI.showToast(error.message || 'Error del servidor', 'error');
      TelegramApp.hapticFeedback('error');
    });
  },

  /**
   * Autenticar usuario
   */
  authenticate(userData) {
    this.userId = userData.userId;
    this.socket.emit(CONFIG.EVENTS.AUTHENTICATE, userData);
  },

  /**
   * Crear sala
   */
  createRoom(isPublic = false) {
    this.socket.emit(CONFIG.EVENTS.CREATE_ROOM, { isPublic });
  },

  /**
   * Unirse a sala
   */
  joinRoom(roomCode) {
    this.socket.emit(CONFIG.EVENTS.JOIN_ROOM, roomCode);
  },

  /**
   * Hacer movimiento
   */
  makeMove(cellIndex) {
    this.socket.emit(CONFIG.EVENTS.MAKE_MOVE, {
      roomCode: this.currentRoom,
      cellIndex
    });
  },

  /**
   * Jugar de nuevo
   */
  playAgain(roomCode) {
    const room = roomCode || this.currentRoom;
    console.log('Solicitando revancha en sala:', room);
    this.socket.emit(CONFIG.EVENTS.PLAY_AGAIN, { roomCode: room });
  },

  /**
   * Salir de sala
   */
  leaveRoom() {
    if (this.currentRoom) {
      this.socket.emit(CONFIG.EVENTS.LEAVE_ROOM, this.currentRoom);
      this.currentRoom = null;
    }
  },

  /**
   * Cerrar sala
   */
  closeRoom() {
    if (this.currentRoom) {
      this.socket.emit(CONFIG.EVENTS.CLOSE_ROOM, this.currentRoom);
      this.currentRoom = null;
    }
  },

  /**
   * Hacer sala pública
   */
  makePublic() {
    if (this.currentRoom) {
      this.socket.emit(CONFIG.EVENTS.MAKE_PUBLIC, this.currentRoom);
    }
  },

  /**
   * Registrar manejador de evento
   */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
    // Entregar inmediatamente datos cacheados si aplica (evita perder ROOMS_LIST antes de registrar listeners)
    if (event === 'rooms_list' && Array.isArray(this.lastRoomsList)) {
      try { handler(this.lastRoomsList); } catch(_) {}
    }
  },

  /**
   * Eliminar manejador de evento
   */
  off(event, handler) {
    if (this.eventHandlers.has(event)) {
      const handlers = this.eventHandlers.get(event);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  },

  /**
   * Emitir evento local
   */
  emit(event, data) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  },

  /**
   * Desconectar
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.connected = false;
    }
  },

  /**
   * Verificar si está conectado
   */
  isConnected() {
    return this.connected && this.socket && this.socket.connected;
  }
};

// Hacer SocketClient global
window.SocketClient = SocketClient;
