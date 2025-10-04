/**
 * ============================================
 * GESTIÓN DE PANTALLA DE RESULTADOS
 * ============================================
 */

const Result = {
  currentResult: null,

  /**
   * Inicializar módulo de resultados
   */
  init() {
    this.setupEventListeners();
    this.setupSocketListeners();
  },

  /**
   * Configurar event listeners
   */
  setupEventListeners() {
    // Botón jugar de nuevo
    const playAgainBtn = document.getElementById('play-again-btn');
    if (playAgainBtn) {
      playAgainBtn.addEventListener('click', () => this.handlePlayAgain());
    }

    // Botón volver al lobby
    const backToLobbyBtn = document.getElementById('back-to-lobby-btn');
    if (backToLobbyBtn) {
      backToLobbyBtn.addEventListener('click', () => this.handleBackToLobby());
    }

    // Botón compartir resultado
    const shareResultBtn = document.getElementById('share-result-btn');
    if (shareResultBtn) {
      shareResultBtn.addEventListener('click', () => this.handleShareResult());
    }
  },

  /**
   * Configurar listeners de Socket.io
   */
  setupSocketListeners() {
    // Revancha solicitada
    SocketClient.on('rematch_requested', (data) => {
      console.log('Revancha solicitada por:', data.userName);
      UI.showToast(`${data.userName} quiere la revancha`, 'info');
      
      // Actualizar botón para mostrar estado
      const playAgainBtn = document.getElementById('play-again-btn');
      if (playAgainBtn && data.ready && data.total) {
        playAgainBtn.innerHTML = `<span class="btn-icon">⏳</span><span class="btn-text">Esperando (${data.ready}/${data.total})</span>`;
      }
    });

    // Juego reiniciado
    SocketClient.on('game_restart', (data) => {
      console.log('Juego reiniciado:', data);
      UI.showToast('¡Nueva partida iniciada!', 'success');
      
      // Resetear botón antes de cambiar de pantalla
      const playAgainBtn = document.getElementById('play-again-btn');
      if (playAgainBtn) {
        playAgainBtn.disabled = false;
        playAgainBtn.innerHTML = '<span class="btn-icon">🔄</span><span class="btn-text">Jugar de Nuevo</span>';
      }
      
      Game.restart(data.room);
    });
  },

  /**
   * Mostrar resultado
   */
  show(result) {
    console.log('Mostrando resultado:', result);
    this.currentResult = result;

    // Limpiar pantalla anterior
    const resultScreen = document.getElementById('result-screen');
    if (!resultScreen) {
      console.error('result-screen no encontrado');
      return;
    }

    // Actualizar título y mensaje
    const resultTitle = document.getElementById('result-title');
    const resultMessage = document.getElementById('result-message');
    const resultIcon = document.getElementById('result-icon');

    if (result.isDraw) {
      if (resultTitle) resultTitle.textContent = '¡Empate!';
      if (resultMessage) resultMessage.textContent = 'Nadie ganó esta vez';
      if (resultIcon) resultIcon.textContent = '🤝';
    } else if (result.isWinner) {
      if (resultTitle) resultTitle.textContent = '¡Victoria!';
      if (resultMessage) resultMessage.textContent = 'Has ganado la partida';
      if (resultIcon) resultIcon.textContent = '🏆';
      UI.createConfetti();
    } else {
      if (resultTitle) resultTitle.textContent = 'Derrota';
      if (resultMessage) resultMessage.textContent = `${result.winnerName} ha ganado`;
      if (resultIcon) resultIcon.textContent = '😔';
    }

    // Actualizar estadísticas
    const gameDuration = document.getElementById('game-duration');
    const totalMoves = document.getElementById('total-moves');

    if (gameDuration && result.duration) {
      const minutes = Math.floor(result.duration / 60);
      const seconds = result.duration % 60;
      gameDuration.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    if (totalMoves && result.moves) {
      totalMoves.textContent = result.moves;
    }

    // Mostrar pantalla
    UI.showScreen('result-screen');
    TelegramApp.hapticFeedback(result.isWinner ? 'success' : 'error');
  },

  /**
   * Manejar jugar de nuevo
   */
  handlePlayAgain() {
    // Usar socket.currentRoom como fuente de verdad
    const roomCode = SocketClient.currentRoom || this.currentResult?.roomCode;
    
    if (!roomCode) {
      console.error('No hay sala actual para revancha');
      UI.showToast('Error al solicitar revancha', 'error');
      return;
    }

    console.log('Solicitando revancha en sala:', roomCode);
    TelegramApp.hapticFeedback('medium');
    
    // Emitir evento de revancha
    SocketClient.playAgain(roomCode);
    
    // Mostrar feedback
    UI.showToast('Esperando al otro jugador...', 'info');
    
    // Deshabilitar botón temporalmente
    const playAgainBtn = document.getElementById('play-again-btn');
    if (playAgainBtn) {
      playAgainBtn.disabled = true;
      playAgainBtn.textContent = 'Esperando...';
      
      // Rehabilitar después de 5 segundos
      setTimeout(() => {
        playAgainBtn.disabled = false;
        playAgainBtn.innerHTML = '<span class="btn-icon">🔄</span><span class="btn-text">Jugar de Nuevo</span>';
      }, 5000);
    }
  },

  /**
   * Manejar volver al lobby
   */
  handleBackToLobby() {
    TelegramApp.hapticFeedback('light');
    
    // Limpiar resultado actual
    this.currentResult = null;
    
    // Salir de la sala si existe
    if (SocketClient.currentRoom) {
      SocketClient.leaveRoom(SocketClient.currentRoom);
    }
    
    // Volver al lobby
    UI.showScreen('lobby-screen');
    Lobby.refreshRooms();
  },

  /**
   * Manejar compartir resultado
   */
  handleShareResult() {
    if (!this.currentResult) return;

    const resultText = this.currentResult.isWinner 
      ? '¡Acabo de ganar una partida de Tic Tac Toe! 🏆'
      : this.currentResult.isDraw
      ? 'Empate en Tic Tac Toe 🤝'
      : 'Partida de Tic Tac Toe completada';

    const shareUrl = `${window.location.origin}?room=${this.currentResult.roomCode}`;
    
    TelegramApp.shareUrl(shareUrl, resultText);
    TelegramApp.hapticFeedback('success');
  }
};
