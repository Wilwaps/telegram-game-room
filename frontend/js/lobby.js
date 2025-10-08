/**
 * ============================================
 * GESTIÓN DEL LOBBY
 * ============================================
 */

const Lobby = {
  rooms: [],
  currentFilter: 'all',
  joinGameType: 'tic-tac-toe', // 'tic-tac-toe' | 'domino'

  /**
   * Inicializar lobby
   */
  init() {
    this.setupEventListeners();
    this.setupSocketListeners();
  },

  /**
   * Configurar event listeners
   */
  setupEventListeners() {
    // Botón crear sala
    const createRoomBtn = document.getElementById('create-room-btn');
    if (createRoomBtn) {
      createRoomBtn.addEventListener('click', () => this.handleCreateRoom());
    }

    // Botón unirse con código
    const joinCodeBtn = document.getElementById('join-code-btn');
    if (joinCodeBtn) {
      joinCodeBtn.addEventListener('click', () => { this.joinGameType = 'tic-tac-toe'; this.handleJoinWithCode('Unirse a Tic Tac Toe'); });
    }

    // Botón refrescar salas
    const refreshBtn = document.getElementById('refresh-rooms-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshRooms());
    }

    // Botón unirse en modal
    const joinRoomBtn = document.getElementById('join-room-btn');
    if (joinRoomBtn) {
      joinRoomBtn.addEventListener('click', () => this.handleJoinRoom());
    }

    // Input de código (Enter para unirse)
    const roomCodeInput = document.getElementById('room-code-input');
    if (roomCodeInput) {
      roomCodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.handleJoinRoom();
        }
      });

      // Formatear código mientras se escribe, dependiendo del juego seleccionado
      roomCodeInput.addEventListener('input', (e) => {
        e.target.value = this.formatRoomCodeForCurrentGame(e.target.value);
      });
    }

    // Filtros de salas
    const filterTabs = document.querySelectorAll('.filter-tabs .tab');
    filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.handleFilterChange(tab.dataset.filter);
      });
    });

    // Delegación de eventos para cards de salas
    const roomsList = document.getElementById('rooms-list');
    if (roomsList) {
      roomsList.addEventListener('click', (e) => {
        const roomCard = e.target.closest('.room-card');
        if (roomCard) {
          const roomCode = roomCard.dataset.roomCode;
          const gameType = roomCard.dataset.gameType || 'tic-tac-toe';
          if (gameType === 'bingo') {
            SocketClient.joinBingo(roomCode, 1);
          } else {
            this.handleJoinRoomByCode(roomCode);
          }
        }
      });
    }
  },

  /**
   * Configurar listeners de Socket.io
   */
  setupSocketListeners() {
    // Lista de salas actualizada
    SocketClient.on('rooms_list', (rooms) => {
      this.rooms = rooms;
      this.renderRooms();
    });

    // Nueva sala agregada (idempotente)
    SocketClient.on('room_added', (room) => {
      const idx = this.rooms.findIndex(r => r.code === room.code);
      if (idx === -1) {
        this.rooms.push(room);
      } else {
        this.rooms[idx] = room;
      }
      this.renderRooms();
    });

    // Sala actualizada
    SocketClient.on('room_updated', (room) => {
      const index = this.rooms.findIndex(r => r.code === room.code);
      if (index !== -1) {
        this.rooms[index] = room;
        this.renderRooms();
      }
    });

    // Sala eliminada
    SocketClient.on('room_removed', (roomCode) => {
      this.rooms = this.rooms.filter(r => r.code !== roomCode);
      this.renderRooms();
    });

    // Sala creada (TicTacToe) → navegar a sala de espera
    SocketClient.on('room_created', (room) => {
      WaitingRoom.show(room);
    });

  },

  /**
   * Manejar creación de sala
   */
  handleCreateRoom() {
    TelegramApp.hapticFeedback('medium');
    UI.showLoading('Creando sala...');
    SocketClient.createRoom(false);
  },

  /**
   * Manejar unirse con código
   */
  handleJoinWithCode(title = 'Unirse a Sala') {
    TelegramApp.hapticFeedback('light');
    // Actualizar título del modal
    try {
      const modal = document.getElementById('code-modal');
      const titleEl = modal ? modal.querySelector('.modal-title') : null;
      if (titleEl) titleEl.textContent = title;
      // Ajustar placeholder y hint según juego
      const input = modal ? modal.querySelector('#room-code-input') : null;
      const hint = modal ? modal.querySelector('.input-hint') : null;
      if (input) {
        if (this.joinGameType === 'domino') {
          input.placeholder = 'Ingresa el código (6 dígitos)';
          input.setAttribute('inputmode', 'numeric');
          input.setAttribute('pattern', '\\d{6}');
        } else {
          input.placeholder = 'Ingresa el código (6 caracteres)';
          input.setAttribute('inputmode', 'text');
          input.setAttribute('pattern', '[A-Za-z0-9]{6}');
        }
      }
      if (hint) {
        hint.textContent = this.joinGameType === 'domino'
          ? 'El código debe tener 6 dígitos'
          : 'El código debe tener 6 caracteres alfanuméricos';
      }
    } catch(_) {}
    UI.showModal('code-modal');
    
    // Enfocar input
    setTimeout(() => {
      const input = document.getElementById('room-code-input');
      if (input) {
        input.value = '';
        input.focus();
      }
    }, 100);
  },

  /**
   * Manejar unirse a sala
   */
  handleJoinRoom() {
    const input = document.getElementById('room-code-input');
    if (!input) return;

    const roomCodeRaw = input.value.trim();
    const roomCode = roomCodeRaw.toUpperCase();
    const valid = Utils.isValidRoomCode(roomCode);
    if (!valid) {
      UI.showToast('Código inválido (6 caracteres)', 'error');
      TelegramApp.hapticFeedback('error');
      return;
    }

    UI.hideModal('code-modal');
    // Unirse a Tic Tac Toe
    this.handleJoinRoomByCode(roomCode);
  },

  /**
   * Unirse a sala por código
   */
  handleJoinRoomByCode(roomCode) {
    TelegramApp.hapticFeedback('medium');
    UI.showLoading('Uniéndose a sala...');
    SocketClient.joinRoom(roomCode);
  },

  /**
   * Cambiar filtro
   */
  handleFilterChange(filter) {
    this.currentFilter = filter;

    // Actualizar tabs activos
    const tabs = document.querySelectorAll('.filter-tabs .tab');
    tabs.forEach(tab => {
      if (tab.dataset.filter === filter) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    this.renderRooms();
  },

  /**
   * Refrescar lista de salas
   */
  refreshRooms() {
    TelegramApp.hapticFeedback('light');
    // Las salas se actualizan automáticamente via Socket.io
    UI.showToast('Actualizando...', 'info', 1000);
  },

  /**
   * Renderizar salas
   */
  renderRooms() {
    let filteredRooms = this.rooms;

    // Aplicar filtro
    if (this.currentFilter === 'waiting') {
      filteredRooms = this.rooms.filter(r => r.status === 'waiting');
    }

    UI.renderRoomsList(filteredRooms);
  },


  /**
   * Formatear código de sala según juego seleccionado
   */
  formatRoomCodeForCurrentGame(value) {
    if (this.joinGameType === 'domino') {
      return value.replace(/\D/g, '').substring(0, 6);
    }
    return Utils.formatRoomCode(value);
  },

  /**
   * Mostrar lobby
   */
  show() {
    UI.showScreen('lobby-screen');
    TelegramApp.hideBackButton();
    TelegramApp.hideMainButton();
  }
};

// Hacer módulos globales
window.Lobby = Lobby;
