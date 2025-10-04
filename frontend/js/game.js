/**
 * ============================================
 * GESTIÓN DEL JUEGO
 * ============================================
 */

const Game = {
  currentRoom: null,
  board: Array(9).fill(null),
  mySymbol: null,
  currentTurn: null,
  isMyTurn: false,
  gameStartTime: null,
  timerInterval: null,
  turnStartTime: null,

  /**
   * Inicializar juego
   */
  init() {
    this.setupEventListeners();
    this.setupSocketListeners();
  },

  /**
   * Configurar event listeners
   */
  setupEventListeners() {
    // Celdas del tablero
    const cells = document.querySelectorAll('.cell');
    cells.forEach((cell, index) => {
      cell.addEventListener('click', () => this.handleCellClick(index));
    });

    // Botón salir
    const leaveBtn = document.getElementById('leave-game-btn');
    if (leaveBtn) {
      leaveBtn.addEventListener('click', () => this.handleLeave());
    }
  },

  /**
   * Configurar listeners de Socket.io
   */
  setupSocketListeners() {
    // Movimiento realizado
    SocketClient.on('move_made', (data) => {
      this.handleMoveMade(data);
    });

    // Fin de juego
    SocketClient.on('game_over', (data) => {
      this.handleGameOver(data);
    });

    // Empate
    SocketClient.on('game_draw', (data) => {
      this.handleGameDraw(data);
    });

    // Reinicio de juego
    SocketClient.on('game_restart', (data) => {
      this.restart(data.room);
    });

    // Jugador abandonó
    SocketClient.on('player_left', (data) => {
      // El servidor ya maneja la victoria automática
    });
  },

  /**
   * Iniciar juego
   */
  start(data) {
    this.currentRoom = data.room;
    this.board = data.room.board;
    this.currentTurn = data.room.currentTurn;
    this.gameStartTime = Date.now();

    // Determinar mi símbolo
    const myUserId = SocketClient.userId;
    const myPlayer = data.room.players.find(p => p.userId === myUserId);
    this.mySymbol = myPlayer ? myPlayer.symbol : null;

    // Actualizar UI
    UI.showScreen('game-screen');
    this.updateGameUI();
    this.renderBoard();
    this.updateTurnIndicator();
    this.startTimer();

    // Configurar botón de atrás
    TelegramApp.showBackButton(() => this.handleLeave());

    UI.showToast(data.message || '¡Que comience el juego!', 'success');
  },

  /**
   * Actualizar UI del juego
   */
  updateGameUI() {
    if (!this.currentRoom) return;

    const [playerX, playerO] = this.currentRoom.players;

    // Jugador X
    if (playerX) {
      const nameEl = document.getElementById('player-x-name');
      const avatarEl = document.getElementById('player-x-avatar');

      if (nameEl) nameEl.textContent = playerX.userName;
      if (avatarEl) {
        avatarEl.src = playerX.userAvatar || 
          `https://ui-avatars.com/api/?name=${encodeURIComponent(playerX.userName)}&background=2481cc&color=fff`;
      }
    }

    // Jugador O
    if (playerO) {
      const nameEl = document.getElementById('player-o-name');
      const avatarEl = document.getElementById('player-o-avatar');

      if (nameEl) nameEl.textContent = playerO.userName;
      if (avatarEl) {
        avatarEl.src = playerO.userAvatar || 
          `https://ui-avatars.com/api/?name=${encodeURIComponent(playerO.userName)}&background=2481cc&color=fff`;
      }
    }
  },

  /**
   * Renderizar tablero
   */
  renderBoard() {
    const cells = document.querySelectorAll('.cell');
    
    cells.forEach((cell, index) => {
      const symbol = this.board[index];
      
      if (symbol) {
        const symbolEl = document.createElement('span');
        symbolEl.className = 'symbol';
        symbolEl.textContent = symbol === 'X' ? '❌' : '⭕';
        cell.innerHTML = '';
        cell.appendChild(symbolEl);
        cell.classList.add('disabled');
      } else {
        cell.innerHTML = '';
        cell.classList.remove('disabled');
      }
    });

    // Actualizar contador de movimientos
    const movesCount = this.board.filter(cell => cell !== null).length;
    const movesEl = document.getElementById('moves-count');
    if (movesEl) movesEl.textContent = movesCount;
  },

  /**
   * Actualizar indicador de turno
   */
  updateTurnIndicator() {
    this.isMyTurn = this.currentTurn === this.mySymbol;

    const turnText = document.getElementById('current-turn-text');
    const playerXPanel = document.getElementById('player-x-panel');
    const playerOPanel = document.getElementById('player-o-panel');

    if (turnText) {
      turnText.textContent = this.isMyTurn ? 'Tu turno' : 'Turno del oponente';
    }

    // Resaltar panel activo
    if (playerXPanel && playerOPanel) {
      if (this.currentTurn === 'X') {
        playerXPanel.classList.add('active');
        playerOPanel.classList.remove('active');
      } else {
        playerOPanel.classList.add('active');
        playerXPanel.classList.remove('active');
      }
    }
  },

  /**
   * Iniciar temporizador
   */
  startTimer() {
    this.stopTimer();
    this.turnStartTime = Date.now();

    const timerEl = document.getElementById('timer');
    const timerProgress = document.getElementById('timer-circle-progress');
    const maxTime = CONFIG.GAME.TURN_TIMEOUT;

    this.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.turnStartTime) / 1000);
      const remaining = Math.max(0, maxTime - elapsed);

      if (timerEl) {
        timerEl.textContent = remaining;

        // Cambiar color según tiempo restante
        if (remaining <= 5) {
          timerEl.classList.add('danger');
          timerEl.classList.remove('warning');
        } else if (remaining <= 10) {
          timerEl.classList.add('warning');
          timerEl.classList.remove('danger');
        } else {
          timerEl.classList.remove('warning', 'danger');
        }
      }

      // Actualizar círculo de progreso
      if (timerProgress) {
        const progress = (remaining / maxTime) * 157; // 157 es la circunferencia
        timerProgress.style.strokeDashoffset = 157 - progress;

        if (remaining <= 5) {
          timerProgress.classList.add('danger');
          timerProgress.classList.remove('warning');
        } else if (remaining <= 10) {
          timerProgress.classList.add('warning');
          timerProgress.classList.remove('danger');
        } else {
          timerProgress.classList.remove('warning', 'danger');
        }
      }

      if (remaining === 0) {
        this.stopTimer();
      }
    }, 1000);
  },

  /**
   * Detener temporizador
   */
  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  },

  /**
   * Manejar clic en celda
   */
  handleCellClick(index) {
    // Verificar si es mi turno
    if (!this.isMyTurn) {
      UI.showToast('No es tu turno', 'warning');
      TelegramApp.hapticFeedback('error');
      return;
    }

    // Verificar si la celda está vacía
    if (this.board[index] !== null) {
      UI.showToast('Celda ocupada', 'warning');
      TelegramApp.hapticFeedback('error');
      return;
    }

    // Enviar movimiento al servidor
    TelegramApp.hapticFeedback('medium');
    SocketClient.makeMove(index);

    // Deshabilitar temporalmente el tablero
    this.disableBoard();
  },

  /**
   * Manejar movimiento realizado
   */
  handleMoveMade(data) {
    this.board = data.board;
    this.currentTurn = data.currentTurn;

    this.renderBoard();
    this.updateTurnIndicator();
    this.startTimer();
    this.enableBoard();
  },

  /**
   * Manejar fin de juego
   */
  handleGameOver(data) {
    this.stopTimer();
    this.board = data.board;
    this.renderBoard();

    // Mostrar línea ganadora
    if (data.winningLine) {
      this.showWinningLine(data.winningLine);
    }

    // Determinar si gané
    const iWon = data.winner === SocketClient.userId;

    // Mostrar resultado después de animación
    setTimeout(() => {
      Result.show({
        type: iWon ? 'win' : 'loss',
        winner: data.winner,
        winnerName: data.winnerName,
        duration: Math.floor((Date.now() - this.gameStartTime) / 1000),
        moves: this.board.filter(c => c !== null).length,
        reason: data.reason
      });
    }, 1500);
  },

  /**
   * Manejar empate
   */
  handleGameDraw(data) {
    this.stopTimer();
    this.board = data.board;
    this.renderBoard();

    setTimeout(() => {
      Result.show({
        type: 'draw',
        duration: Math.floor((Date.now() - this.gameStartTime) / 1000),
        moves: this.board.filter(c => c !== null).length
      });
    }, 1000);
  },

  /**
   * Mostrar línea ganadora
   */
  showWinningLine(winningLine) {
    const cells = document.querySelectorAll('.cell');
    
    // Resaltar celdas ganadoras
    winningLine.forEach(index => {
      cells[index].classList.add('winning');
    });

    // Dibujar línea
    const line = document.getElementById('winning-line');
    if (line) {
      const coords = this.calculateLineCoordinates(winningLine);
      if (coords) {
        const lineElement = line.querySelector('line');
        lineElement.setAttribute('x1', coords.x1);
        lineElement.setAttribute('y1', coords.y1);
        lineElement.setAttribute('x2', coords.x2);
        lineElement.setAttribute('y2', coords.y2);
        line.classList.add('show');
      }
    }
  },

  /**
   * Calcular coordenadas de línea ganadora
   */
  calculateLineCoordinates(winningLine) {
    const board = document.getElementById('game-board');
    if (!board) return null;

    const rect = board.getBoundingClientRect();
    const cellSize = rect.width / 3;

    const getCenter = (index) => {
      const row = Math.floor(index / 3);
      const col = index % 3;
      return {
        x: col * cellSize + cellSize / 2,
        y: row * cellSize + cellSize / 2
      };
    };

    const start = getCenter(winningLine[0]);
    const end = getCenter(winningLine[2]);

    return {
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y
    };
  },

  /**
   * Deshabilitar tablero
   */
  disableBoard() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => cell.classList.add('disabled'));
  },

  /**
   * Habilitar tablero
   */
  enableBoard() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach((cell, index) => {
      if (this.board[index] === null) {
        cell.classList.remove('disabled');
      }
    });
  },

  /**
   * Reiniciar juego
   */
  restart(room) {
    console.log('🔄 Reiniciando juego:', room);
    
    this.currentRoom = room;
    this.board = room.board;
    this.currentTurn = room.currentTurn;
    this.gameStartTime = Date.now();

    // Limpiar línea ganadora SVG
    const line = document.getElementById('winning-line');
    if (line) {
      line.classList.remove('show');
      line.style.display = 'none';
    }

    // Limpiar todas las clases de las celdas
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
      cell.classList.remove('winning', 'disabled');
      cell.style.backgroundColor = '';
      cell.style.border = '';
    });

    // Renderizar tablero limpio
    this.renderBoard();
    this.updateTurnIndicator();
    this.startTimer();
    this.enableBoard();

    UI.showScreen('game-screen');
    console.log('✅ Juego reiniciado correctamente');
  },

  /**
   * Manejar salir
   */
  handleLeave() {
    TelegramApp.showConfirm('¿Salir de la partida?', (confirmed) => {
      if (confirmed) {
        this.stopTimer();
        SocketClient.leaveRoom();
        Lobby.show();
      }
    });
  }
};

/**
 * ============================================
 * PANTALLA DE RESULTADOS
 * ============================================
 */

const Result = {
  currentResult: null,

  /**
   * Inicializar resultados
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

    // Botón compartir
    const shareBtn = document.getElementById('share-result-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => this.handleShare());
    }

    // Botón volver al lobby
    const backBtn = document.getElementById('back-lobby-result-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.handleBackToLobby());
    }
  },

  /**
   * Configurar listeners de Socket.io
   */
  setupSocketListeners() {
    // Solicitud de revancha
    SocketClient.on('rematch_requested', (data) => {
      this.handleRematchRequested(data);
    });
  },

  /**
   * Mostrar resultados
   */
  show(result) {
    this.currentResult = result;
    UI.showScreen('result-screen');

    // Actualizar UI según resultado
    const icon = document.getElementById('result-icon');
    const title = document.getElementById('result-title');
    const message = document.getElementById('result-message');

    if (result.type === 'win') {
      if (icon) icon.textContent = '🏆';
      if (title) title.textContent = '¡Victoria!';
      if (message) message.textContent = 'Has ganado la partida';
      UI.createConfetti();
      TelegramApp.hapticFeedback('success');
    } else if (result.type === 'loss') {
      if (icon) icon.textContent = '😢';
      if (title) title.textContent = 'Derrota';
      if (message) {
        message.textContent = result.reason === 'opponent_left' 
          ? 'Tu oponente abandonó' 
          : 'Has perdido la partida';
      }
      TelegramApp.hapticFeedback('error');
    } else {
      if (icon) icon.textContent = '🤝';
      if (title) title.textContent = '¡Empate!';
      if (message) message.textContent = 'Nadie ganó esta vez';
      TelegramApp.hapticFeedback('warning');
    }

    // Actualizar estadísticas
    const durationEl = document.getElementById('game-duration');
    const movesEl = document.getElementById('total-moves');

    if (durationEl) durationEl.textContent = Utils.formatDuration(result.duration);
    if (movesEl) movesEl.textContent = result.moves;

    // Configurar botón de atrás
    TelegramApp.showBackButton(() => this.handleBackToLobby());
  },

  /**
   * Manejar jugar de nuevo
   */
  handlePlayAgain() {
    TelegramApp.hapticFeedback('medium');
    SocketClient.playAgain();
    UI.updateButtonText('play-again-btn', 'Esperando...');
    UI.disableButton('play-again-btn');
  },

  /**
   * Manejar solicitud de revancha
   */
  handleRematchRequested(data) {
    UI.showToast(`${data.ready}/${data.total} jugadores listos`, 'info');
  },

  /**
   * Manejar compartir
   */
  handleShare() {
    if (!this.currentResult) return;

    let text = '';
    if (this.currentResult.type === 'win') {
      text = `¡Gané una partida de Tic Tac Toe! 🏆\nDuración: ${Utils.formatDuration(this.currentResult.duration)}`;
    } else if (this.currentResult.type === 'loss') {
      text = `Jugué Tic Tac Toe 🎮\nDuración: ${Utils.formatDuration(this.currentResult.duration)}`;
    } else {
      text = `¡Empate en Tic Tac Toe! 🤝\nDuración: ${Utils.formatDuration(this.currentResult.duration)}`;
    }

    TelegramApp.shareLink(window.location.origin, text);
    TelegramApp.hapticFeedback('medium');
  },

  /**
   * Manejar volver al lobby
   */
  handleBackToLobby() {
    TelegramApp.hapticFeedback('medium');
    SocketClient.leaveRoom();
    Lobby.show();
  }
};

// Hacer módulos globales
window.Game = Game;
window.Result = Result;
