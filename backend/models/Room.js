/**
 * ============================================
 * MODELO DE SALA (ROOM)
 * ============================================
 * 
 * Representa una sala de juego con todos sus
 * atributos, validaciones y métodos auxiliares.
 * 
 * @module models/Room
 */

const { v4: uuidv4 } = require('uuid');
const { constants } = require('../config/config');

class Room {
  /**
   * Constructor de Room
   * @param {Object} data - Datos iniciales de la sala
   */
  constructor(data = {}) {
    this.code = data.code || this.generateRoomCode();
    this.id = data.id || uuidv4();
    this.host = data.host || null;
    this.gameType = data.gameType || 'tic-tac-toe';
    this.isPublic = data.isPublic !== undefined ? data.isPublic : false;
    this.status = data.status || constants.ROOM_STATUS.WAITING;
    this.players = data.players || [];
    this.board = data.board || this.initializeBoard();
    this.moves = data.moves || [];
    this.currentTurn = data.currentTurn || constants.PLAYER_SYMBOLS.X;
    this.winner = data.winner || null;
    this.winningLine = data.winningLine || null;
    this.rematchRequests = data.rematchRequests || [];
    
    // Timestamps
    this.createdAt = data.createdAt || Date.now();
    this.startTime = data.startTime || null;
    this.endTime = data.endTime || null;
    this.turnStartTime = data.turnStartTime || null;
    this.lastActivity = data.lastActivity || Date.now();
    
    // Configuración
    const envTurn = parseInt(process.env.TURN_TIMEOUT, 10) || 10;
    this.config = {
      turnTimeout: data.config?.turnTimeout || envTurn,
      allowSpectators: data.config?.allowSpectators || false,
      enableChat: data.config?.enableChat || true,
      ...data.config
    };
    
    // Metadata
    this.metadata = {
      totalMoves: 0,
      averageMoveTime: 0,
      ...data.metadata
    };

    // Modo y costo de entrada (para modos Amistoso/Fire)
    this.mode = data.mode || 'friendly'; // 'friendly' | 'fire'
    // costo por jugador cuando mode==='fire'
    const ec = (typeof data.entryCost === 'number') ? data.entryCost : parseInt(process.env.TTT_ENTRY_COST || '1', 10);
    this.entryCost = Math.max(0, parseInt(ec, 10) || 1);
  }

  /**
   * Generar código único de sala (6 dígitos numéricos)
   * @returns {string} Código de sala
   */
  generateRoomCode() {
    const characters = '0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
  }

  /**
   * Inicializar tablero según tipo de juego
   * @returns {Array} Tablero vacío
   */
  initializeBoard() {
    switch (this.gameType) {
      case 'tic-tac-toe':
        return Array(9).fill(null);
      case 'connect-four':
        return Array(42).fill(null); // 6x7
      case 'checkers':
        return Array(64).fill(null); // 8x8
      default:
        return Array(9).fill(null);
    }
  }

  /**
   * Agregar jugador a la sala
   * @param {Object} player - Datos del jugador
   * @returns {boolean} True si se agregó exitosamente
   */
  addPlayer(player) {
    if (this.isFull()) {
      return false;
    }

    const symbol = this.players.length === 0 
      ? constants.PLAYER_SYMBOLS.X 
      : constants.PLAYER_SYMBOLS.O;

    this.players.push({
      userId: player.userId,
      userName: player.userName,
      userAvatar: player.userAvatar,
      symbol: symbol,
      socketId: player.socketId || null,
      joinedAt: Date.now(),
      isReady: false,
      stats: {
        movesCount: 0,
        averageMoveTime: 0,
        wins: 0,
        losses: 0,
        draws: 0
      }
    });

    this.lastActivity = Date.now();
    return true;
  }

  /**
   * Remover jugador de la sala
   * @param {string} userId - ID del usuario
   * @returns {Object|null} Jugador removido o null
   */
  removePlayer(userId) {
    const index = this.players.findIndex(p => p.userId === userId);
    if (index === -1) {
      return null;
    }

    const [removedPlayer] = this.players.splice(index, 1);
    this.lastActivity = Date.now();
    return removedPlayer;
  }

  /**
   * Obtener jugador por ID
   * @param {string} userId - ID del usuario
   * @returns {Object|null} Jugador o null
   */
  getPlayer(userId) {
    return this.players.find(p => p.userId === userId) || null;
  }

  /**
   * Obtener jugador por símbolo
   * @param {string} symbol - Símbolo del jugador (X o O)
   * @returns {Object|null} Jugador o null
   */
  getPlayerBySymbol(symbol) {
    return this.players.find(p => p.symbol === symbol) || null;
  }

  /**
   * Verificar si la sala está llena
   * @returns {boolean}
   */
  isFull() {
    return this.players.length >= 2;
  }

  /**
   * Verificar si la sala está vacía
   * @returns {boolean}
   */
  isEmpty() {
    return this.players.length === 0;
  }

  /**
   * Verificar si el usuario es el host
   * @param {string} userId - ID del usuario
   * @returns {boolean}
   */
  isHost(userId) {
    return this.host === userId;
  }

  /**
   * Verificar si es el turno del jugador
   * @param {string} userId - ID del usuario
   * @returns {boolean}
   */
  isPlayerTurn(userId) {
    const player = this.getPlayer(userId);
    return player && player.symbol === this.currentTurn;
  }

  /**
   * Cambiar turno al siguiente jugador
   */
  switchTurn() {
    this.currentTurn = this.currentTurn === constants.PLAYER_SYMBOLS.X 
      ? constants.PLAYER_SYMBOLS.O 
      : constants.PLAYER_SYMBOLS.X;
    this.turnStartTime = Date.now();
  }

  /**
   * Realizar movimiento en el tablero
   * @param {number} position - Posición en el tablero
   * @param {string} symbol - Símbolo del jugador
   * @returns {boolean} True si el movimiento fue exitoso
   */
  makeMove(position, symbol) {
    if (this.board[position] !== null) {
      return false;
    }

    this.board[position] = symbol;
    this.moves.push({
      position,
      symbol,
      timestamp: Date.now(),
      moveNumber: this.moves.length + 1
    });

    this.metadata.totalMoves++;
    this.lastActivity = Date.now();
    return true;
  }

  /**
   * Iniciar juego
   */
  startGame() {
    this.status = constants.ROOM_STATUS.PLAYING;
    this.startTime = Date.now();
    this.turnStartTime = Date.now();
    this.lastActivity = Date.now();
  }

  /**
   * Finalizar juego
   * @param {string|null} winnerId - ID del ganador o null para empate
   * @param {Array|null} winningLine - Línea ganadora
   */
  endGame(winnerId = null, winningLine = null) {
    this.status = constants.ROOM_STATUS.FINISHED;
    this.winner = winnerId;
    this.winningLine = winningLine;
    this.endTime = Date.now();
    this.lastActivity = Date.now();

    // Actualizar estadísticas por sala (victorias/derrotas/empates)
    try {
      if (winnerId) {
        const winner = this.players.find(p => p.userId === winnerId);
        const loser = this.players.find(p => p.userId !== winnerId);
        if (winner) {
          winner.stats = winner.stats || {};
          winner.stats.wins = (winner.stats.wins || 0) + 1;
        }
        if (loser) {
          loser.stats = loser.stats || {};
          loser.stats.losses = (loser.stats.losses || 0) + 1;
        }
      } else {
        // Empate
        this.players.forEach(p => {
          p.stats = p.stats || {};
          p.stats.draws = (p.stats.draws || 0) + 1;
        });
      }
    } catch (_) { /* no-op */ }
  }

  /**
   * Reiniciar juego para revancha
   */
  resetGame() {
    this.board = this.initializeBoard();
    this.moves = [];
    this.currentTurn = Math.random() < 0.5 ? constants.PLAYER_SYMBOLS.X : constants.PLAYER_SYMBOLS.O;
    this.winner = null;
    this.winningLine = null;
    this.rematchRequests = [];
    this.status = constants.ROOM_STATUS.PLAYING;
    this.startTime = Date.now();
    this.turnStartTime = Date.now();
    this.lastActivity = Date.now();
    
    // Resetear estadísticas de jugadores
    this.players.forEach(player => {
      player.isReady = false;
      player.stats.movesCount = 0;
    });
  }

  /**
   * Agregar solicitud de revancha
   * @param {string} userId - ID del usuario
   * @returns {boolean} True si ambos jugadores están listos
   */
  addRematchRequest(userId) {
    if (!this.rematchRequests.includes(userId)) {
      this.rematchRequests.push(userId);
    }
    return this.rematchRequests.length === this.players.length;
  }

  /**
   * Obtener duración del juego en segundos
   * @returns {number|null} Duración en segundos o null
   */
  getGameDuration() {
    if (!this.startTime) {
      return null;
    }
    const endTime = this.endTime || Date.now();
    return Math.floor((endTime - this.startTime) / 1000);
  }

  /**
   * Obtener tiempo transcurrido del turno actual
   * @returns {number} Tiempo en segundos
   */
  getCurrentTurnDuration() {
    if (!this.turnStartTime) {
      return 0;
    }
    return Math.floor((Date.now() - this.turnStartTime) / 1000);
  }

  /**
   * Verificar si el turno ha expirado
   * @returns {boolean}
   */
  isTurnExpired() {
    return this.getCurrentTurnDuration() >= this.config.turnTimeout;
  }

  /**
   * Convertir a objeto plano para almacenamiento
   * @returns {Object}
   */
  toJSON() {
    return {
      code: this.code,
      id: this.id,
      host: this.host,
      gameType: this.gameType,
      isPublic: this.isPublic,
      status: this.status,
      players: this.players,
      board: this.board,
      moves: this.moves,
      currentTurn: this.currentTurn,
      winner: this.winner,
      winningLine: this.winningLine,
      rematchRequests: this.rematchRequests,
      mode: this.mode,
      entryCost: this.entryCost,
      createdAt: this.createdAt,
      startTime: this.startTime,
      endTime: this.endTime,
      turnStartTime: this.turnStartTime,
      lastActivity: this.lastActivity,
      config: this.config,
      metadata: this.metadata
    };
  }

  /**
   * Crear instancia desde objeto plano
   * @param {Object} data - Datos de la sala
   * @returns {Room}
   */
  static fromJSON(data) {
    return new Room(data);
  }

  /**
   * Validar datos de sala
   * @param {Object} data - Datos a validar
   * @returns {Object} { valid: boolean, errors: Array }
   */
  static validate(data) {
    const errors = [];

    if (data.gameType && !['tic-tac-toe', 'connect-four', 'checkers'].includes(data.gameType)) {
      errors.push('Tipo de juego inválido');
    }

    if (data.players && data.players.length > 2) {
      errors.push('Máximo 2 jugadores por sala');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = Room;
