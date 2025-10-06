/**
 * ============================================
 * GESTIÓN DE PANTALLA DE RESULTADOS
 * ============================================
 */

const Result = {
  currentResult: null,

  init() {
    this.setupEventListeners();
    this.setupSocketListeners();
  },

  setupEventListeners() {
    const playAgainBtn = document.getElementById('play-again-btn');
    if (playAgainBtn) playAgainBtn.addEventListener('click', () => this.handlePlayAgain());

    const backBtn = document.getElementById('back-lobby-result-btn');
    if (backBtn) backBtn.addEventListener('click', () => this.handleBackToLobby());

    const shareBtn = document.getElementById('share-result-btn');
    if (shareBtn) shareBtn.addEventListener('click', () => this.handleShare());
  },

  setupSocketListeners() {
    SocketClient.on('rematch_requested', (data) => {
      UI.showToast(`${data.ready}/${data.total} jugadores listos`, 'info');
      const btn = document.getElementById('play-again-btn');
      if (btn && data.ready && data.total) {
        btn.innerHTML = `<span class="btn-icon">⏳</span><span class="btn-text">Esperando (${data.ready}/${data.total})</span>`;
      }
    });

    SocketClient.on('game_restart', (data) => {
      const btn = document.getElementById('play-again-btn');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span class="btn-icon">🔄</span><span class="btn-text">Jugar de Nuevo</span>';
      }
      UI.showToast('¡Nueva partida iniciada!', 'success');
      Game.restart(data.room);
    });
  },

  show(result) {
    this.currentResult = result;
    const icon = document.getElementById('result-icon');
    const title = document.getElementById('result-title');
    const message = document.getElementById('result-message');

    if (result.type === 'draw' || result.isDraw) {
      if (icon) icon.textContent = '🤝';
      if (title) title.textContent = '¡Empate!';
      if (message) message.textContent = 'Nadie ganó esta vez';
      TelegramApp.hapticFeedback('warning');
    } else if (result.type === 'win' || result.isWinner) {
      if (icon) icon.textContent = '🏆';
      if (title) title.textContent = '¡Victoria!';
      if (message) message.textContent = 'Has ganado la partida';
      UI.createConfetti();
      TelegramApp.hapticFeedback('success');
    } else {
      if (icon) icon.textContent = '😢';
      if (title) title.textContent = 'Derrota';
      if (message) message.textContent = result.winnerName ? `${result.winnerName} ha ganado` : 'Has perdido la partida';
      TelegramApp.hapticFeedback('error');
    }

    const durationEl = document.getElementById('game-duration');
    const movesEl = document.getElementById('total-moves');
    if (typeof result.duration === 'number' && durationEl) durationEl.textContent = Utils.formatDuration(result.duration);
    if (typeof result.moves === 'number' && movesEl) movesEl.textContent = result.moves;

    UI.showScreen('result-screen');
  },

  handlePlayAgain() {
    const roomCode = SocketClient.currentRoom || this.currentResult?.roomCode;
    if (!roomCode) {
      UI.showToast('Error al solicitar revancha', 'error');
      return;
    }
    SocketClient.playAgain(roomCode);
    const btn = document.getElementById('play-again-btn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="btn-icon">⏳</span><span class="btn-text">Esperando...</span>';
    }
  },

  handleBackToLobby() {
    this.currentResult = null;
    if (SocketClient.currentRoom) {
      SocketClient.leaveRoom(SocketClient.currentRoom);
    }
    UI.showScreen('lobby-screen');
    Lobby.refreshRooms();
  },

  handleShare() {
    if (!this.currentResult) return;
    const text = this.currentResult.type === 'win'
      ? '¡Gané una partida de Tic Tac Toe! 🏆'
      : this.currentResult.type === 'draw'
      ? 'Empate en Tic Tac Toe 🤝'
      : 'Partida de Tic Tac Toe completada';
    const url = `${window.location.origin}?room=${this.currentResult.roomCode || ''}`;
    TelegramApp.shareLink(url, text);
    TelegramApp.hapticFeedback('medium');
  }
};

window.Result = Result;
