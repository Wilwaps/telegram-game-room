/**
 * ============================================
 * MODELO: SALA DE BINGO
 * ============================================
 */

class BingoRoom {
  constructor(data = {}) {
    this.code = data.code || '';
    this.hostId = data.hostId || '';
    this.hostName = data.hostName || '';
    this.status = data.status || 'waiting';
    this.isPublic = data.isPublic !== undefined ? data.isPublic : true;
    this.maxPlayers = data.maxPlayers || 30;
    this.players = data.players || [];
    
    // Economía
    this.pot = data.pot || 0;
    this.entries = data.entries || {}; // { userId: fuegosGastados }
    
    // Juego
    this.mode = data.mode || 'line'; // 'line' | 'double' | 'full'
    this.drawOrder = data.drawOrder || [];
    this.drawnSet = new Set(data.drawnSet || []);
    this.drawnCount = data.drawnCount || 0;
    
    // Configuración
    this.ticketPrice = data.ticketPrice || 1;
    this.maxCardsPerUser = data.maxCardsPerUser || 10;
    this.autoDraw = data.autoDraw !== undefined ? data.autoDraw : false;
    this.drawIntervalMs = data.drawIntervalMs || 5000;
    
    // Estado
    this.started = data.started || false;
    this.winner = data.winner || null;
    this.winnerCardId = data.winnerCardId || null;
    this.createdAt = data.createdAt || Date.now();
    this.startedAt = data.startedAt || null;
    this.finishedAt = data.finishedAt || null;
  }

  /**
   * Agregar jugador
   */
  addPlayer(userId, userName, cardsCount = 0) {
    if (this.players.length >= this.maxPlayers) {
      throw new Error('Sala llena');
    }
    
    if (this.getPlayer(userId)) {
      throw new Error('Jugador ya está en la sala');
    }

    this.players.push({
      userId,
      userName,
      cardIds: [],
      cardsCount
    });
  }

  /**
   * Remover jugador
   */
  removePlayer(userId) {
    this.players = this.players.filter(p => p.userId !== userId);
  }

  /**
   * Obtener jugador
   */
  getPlayer(userId) {
    return this.players.find(p => p.userId === userId);
  }

  /**
   * Verificar si está vacía
   */
  isEmpty() {
    return this.players.length === 0;
  }

  /**
   * Verificar si está llena
   */
  isFull() {
    return this.players.length >= this.maxPlayers;
  }

  /**
   * Iniciar juego
   */
  start() {
    if (this.started) {
      throw new Error('El juego ya ha iniciado');
    }
    
    this.status = 'playing';
    this.started = true;
    this.startedAt = Date.now();
  }

  /**
   * Finalizar juego
   */
  finish(winnerId = null, winnerCardId = null) {
    this.status = 'finished';
    this.winner = winnerId;
    this.winnerCardId = winnerCardId;
    this.finishedAt = Date.now();
  }

  /**
   * Agregar número cantado
   */
  drawNumber(number) {
    if (this.drawnSet.has(number)) {
      throw new Error('Número ya cantado');
    }
    
    this.drawnSet.add(number);
    this.drawnCount++;
  }

  /**
   * Verificar si todos los números han sido cantados
   */
  isComplete() {
    return this.drawnCount >= 75;
  }

  /**
   * Serializar a JSON
   */
  toJSON() {
    return {
      code: this.code,
      hostId: this.hostId,
      hostName: this.hostName,
      status: this.status,
      isPublic: this.isPublic,
      maxPlayers: this.maxPlayers,
      players: this.players,
      pot: this.pot,
      entries: this.entries,
      mode: this.mode,
      drawOrder: this.drawOrder,
      drawnSet: Array.from(this.drawnSet),
      drawnCount: this.drawnCount,
      ticketPrice: this.ticketPrice,
      maxCardsPerUser: this.maxCardsPerUser,
      autoDraw: this.autoDraw,
      drawIntervalMs: this.drawIntervalMs,
      started: this.started,
      winner: this.winner,
      winnerCardId: this.winnerCardId,
      createdAt: this.createdAt,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt
    };
  }

  /**
   * Crear desde JSON
   */
  static fromJSON(data) {
    return new BingoRoom(data);
  }
}

module.exports = BingoRoom;
