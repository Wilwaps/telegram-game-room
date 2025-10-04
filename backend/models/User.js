/**
 * ============================================
 * MODELO DE USUARIO (USER)
 * ============================================
 * 
 * Representa un usuario con sus estadísticas,
 * preferencias y datos de sesión.
 * 
 * @module models/User
 */

class User {
  /**
   * Constructor de User
   * @param {Object} data - Datos iniciales del usuario
   */
  constructor(data = {}) {
    // Información básica de Telegram
    this.userId = data.userId || null;
    this.userName = data.userName || 'Usuario';
    this.userAvatar = data.userAvatar || '';
    this.firstName = data.firstName || '';
    this.lastName = data.lastName || '';
    this.languageCode = data.languageCode || 'es';
    
    // Información de sesión
    this.socketId = data.socketId || null;
    this.currentRoom = data.currentRoom || null;
    this.isOnline = data.isOnline !== undefined ? data.isOnline : false;
    
    // Estadísticas
    this.stats = {
      gamesPlayed: data.stats?.gamesPlayed || 0,
      wins: data.stats?.wins || 0,
      losses: data.stats?.losses || 0,
      draws: data.stats?.draws || 0,
      winStreak: data.stats?.winStreak || 0,
      bestWinStreak: data.stats?.bestWinStreak || 0,
      totalPlayTime: data.stats?.totalPlayTime || 0,
      averageGameDuration: data.stats?.averageGameDuration || 0,
      ...data.stats
    };
    
    // Estadísticas por juego
    this.gameStats = {
      'tic-tac-toe': {
        played: 0,
        wins: 0,
        losses: 0,
        draws: 0
      },
      'connect-four': {
        played: 0,
        wins: 0,
        losses: 0,
        draws: 0
      },
      'checkers': {
        played: 0,
        wins: 0,
        losses: 0,
        draws: 0
      },
      ...data.gameStats
    };
    
    // Logros
    this.achievements = data.achievements || [];
    
    // Preferencias
    this.preferences = {
      soundEnabled: data.preferences?.soundEnabled !== undefined ? data.preferences.soundEnabled : true,
      notificationsEnabled: data.preferences?.notificationsEnabled !== undefined ? data.preferences.notificationsEnabled : true,
      theme: data.preferences?.theme || 'auto',
      language: data.preferences?.language || 'es',
      ...data.preferences
    };
    
    // Timestamps
    this.createdAt = data.createdAt || Date.now();
    this.lastSeen = data.lastSeen || Date.now();
    this.lastGameAt = data.lastGameAt || null;
  }

  /**
   * Actualizar información de sesión
   * @param {string} socketId - ID del socket
   * @param {string|null} roomCode - Código de sala actual
   */
  updateSession(socketId, roomCode = null) {
    this.socketId = socketId;
    this.currentRoom = roomCode;
    this.isOnline = true;
    this.lastSeen = Date.now();
  }

  /**
   * Marcar como desconectado
   */
  disconnect() {
    this.socketId = null;
    this.isOnline = false;
    this.lastSeen = Date.now();
  }

  /**
   * Registrar resultado de juego
   * @param {string} result - 'win', 'loss', 'draw'
   * @param {string} gameType - Tipo de juego
   * @param {number} duration - Duración del juego en segundos
   */
  recordGameResult(result, gameType = 'tic-tac-toe', duration = 0) {
    // Actualizar estadísticas generales
    this.stats.gamesPlayed++;
    
    switch (result) {
      case 'win':
        this.stats.wins++;
        this.stats.winStreak++;
        if (this.stats.winStreak > this.stats.bestWinStreak) {
          this.stats.bestWinStreak = this.stats.winStreak;
        }
        break;
      case 'loss':
        this.stats.losses++;
        this.stats.winStreak = 0;
        break;
      case 'draw':
        this.stats.draws++;
        this.stats.winStreak = 0;
        break;
    }
    
    // Actualizar estadísticas por juego
    if (this.gameStats[gameType]) {
      this.gameStats[gameType].played++;
      if (result === 'win') {
        this.gameStats[gameType].wins++;
      } else if (result === 'loss') {
        this.gameStats[gameType].losses++;
      } else if (result === 'draw') {
        this.gameStats[gameType].draws++;
      }
    }
    
    // Actualizar tiempo de juego
    this.stats.totalPlayTime += duration;
    this.stats.averageGameDuration = Math.floor(
      this.stats.totalPlayTime / this.stats.gamesPlayed
    );
    
    this.lastGameAt = Date.now();
    this.lastSeen = Date.now();
  }

  /**
   * Agregar logro
   * @param {string} achievementId - ID del logro
   * @param {Object} data - Datos adicionales del logro
   */
  addAchievement(achievementId, data = {}) {
    if (!this.hasAchievement(achievementId)) {
      this.achievements.push({
        id: achievementId,
        unlockedAt: Date.now(),
        ...data
      });
    }
  }

  /**
   * Verificar si tiene un logro
   * @param {string} achievementId - ID del logro
   * @returns {boolean}
   */
  hasAchievement(achievementId) {
    return this.achievements.some(a => a.id === achievementId);
  }

  /**
   * Calcular ratio de victorias
   * @returns {number} Porcentaje de victorias (0-100)
   */
  getWinRate() {
    if (this.stats.gamesPlayed === 0) {
      return 0;
    }
    return Math.round((this.stats.wins / this.stats.gamesPlayed) * 100);
  }

  /**
   * Calcular ratio de victorias por juego
   * @param {string} gameType - Tipo de juego
   * @returns {number} Porcentaje de victorias (0-100)
   */
  getWinRateByGame(gameType) {
    const stats = this.gameStats[gameType];
    if (!stats || stats.played === 0) {
      return 0;
    }
    return Math.round((stats.wins / stats.played) * 100);
  }

  /**
   * Obtener nivel basado en experiencia
   * @returns {number} Nivel del usuario
   */
  getLevel() {
    // Fórmula simple: nivel = raíz cuadrada de (partidas jugadas / 10)
    return Math.floor(Math.sqrt(this.stats.gamesPlayed / 10)) + 1;
  }

  /**
   * Obtener puntos de experiencia
   * @returns {number} Puntos de experiencia
   */
  getExperience() {
    return this.stats.wins * 10 + this.stats.draws * 5 + this.stats.gamesPlayed;
  }

  /**
   * Obtener ranking (simplificado)
   * @returns {string} Rango del usuario
   */
  getRank() {
    const winRate = this.getWinRate();
    const gamesPlayed = this.stats.gamesPlayed;
    
    if (gamesPlayed < 10) {
      return 'Novato';
    } else if (winRate >= 70 && gamesPlayed >= 50) {
      return 'Maestro';
    } else if (winRate >= 60 && gamesPlayed >= 30) {
      return 'Experto';
    } else if (winRate >= 50 && gamesPlayed >= 20) {
      return 'Avanzado';
    } else if (winRate >= 40) {
      return 'Intermedio';
    } else {
      return 'Principiante';
    }
  }

  /**
   * Actualizar preferencias
   * @param {Object} preferences - Nuevas preferencias
   */
  updatePreferences(preferences) {
    this.preferences = {
      ...this.preferences,
      ...preferences
    };
  }

  /**
   * Obtener resumen de estadísticas
   * @returns {Object}
   */
  getStatsSummary() {
    return {
      gamesPlayed: this.stats.gamesPlayed,
      wins: this.stats.wins,
      losses: this.stats.losses,
      draws: this.stats.draws,
      winRate: this.getWinRate(),
      winStreak: this.stats.winStreak,
      bestWinStreak: this.stats.bestWinStreak,
      level: this.getLevel(),
      rank: this.getRank(),
      experience: this.getExperience()
    };
  }

  /**
   * Convertir a objeto plano para almacenamiento
   * @returns {Object}
   */
  toJSON() {
    return {
      userId: this.userId,
      userName: this.userName,
      userAvatar: this.userAvatar,
      firstName: this.firstName,
      lastName: this.lastName,
      languageCode: this.languageCode,
      socketId: this.socketId,
      currentRoom: this.currentRoom,
      isOnline: this.isOnline,
      stats: this.stats,
      gameStats: this.gameStats,
      achievements: this.achievements,
      preferences: this.preferences,
      createdAt: this.createdAt,
      lastSeen: this.lastSeen,
      lastGameAt: this.lastGameAt
    };
  }

  /**
   * Crear instancia desde objeto plano
   * @param {Object} data - Datos del usuario
   * @returns {User}
   */
  static fromJSON(data) {
    return new User(data);
  }

  /**
   * Validar datos de usuario
   * @param {Object} data - Datos a validar
   * @returns {Object} { valid: boolean, errors: Array }
   */
  static validate(data) {
    const errors = [];

    if (!data.userId) {
      errors.push('userId es requerido');
    }

    if (!data.userName || data.userName.trim().length === 0) {
      errors.push('userName es requerido');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = User;
