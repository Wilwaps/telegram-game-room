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
    // Asegurar tarjeta Dominó antes de enlazar eventos
    this.ensureDominoCard();
    this.setupEventListeners();
    this.setupSocketListeners();
  },

  /**
   * Configurar event listeners
   */
  setupEventListeners() {
    // Asegurar tarjeta Dominó (por si el DOM se montó tarde)
    this.ensureDominoCard();

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

      // Formatear código mientras se escribe
      roomCodeInput.addEventListener('input', (e) => {
        e.target.value = Utils.formatRoomCode(e.target.value);
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
          } else if (gameType === 'domino') {
            SocketClient.joinDomino(roomCode);
            UI.showToast(`Uniéndose a Dominó ${roomCode}...`, 'info');
          } else {
            this.handleJoinRoomByCode(roomCode);
          }
        }
      });
    }

    // Botones Dominó (si existen)
    const createDominoBtn = document.getElementById('create-domino-btn');
    if (createDominoBtn) {
      createDominoBtn.addEventListener('click', () => {
        this.joinGameType = 'domino';
        UI.showToast('Creando sala de Dominó...', 'info');
        SocketClient.createDominoRoom({ isPublic: true, mode: 'friendly', stake: 1 });
      });
    }
    const joinDominoBtn = document.getElementById('join-domino-btn');
    if (joinDominoBtn) {
      joinDominoBtn.addEventListener('click', () => {
        this.joinGameType = 'domino';
        this.handleJoinWithCode('Unirse a Dominó');
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

    // Sala creada (navegar a sala de espera)
    SocketClient.on('room_created', (room) => {
      WaitingRoom.show(room);
    });

    // Aviso al crear Dominó (no hay pantalla dedicada aún)
    SocketClient.on('domino_room_created', ({ room }) => {
      UI.showToast('Sala de Dominó creada', 'success');
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

    const roomCode = input.value.trim().toUpperCase();

    if (!Utils.isValidRoomCode(roomCode)) {
      UI.showToast('Código inválido (6 caracteres)', 'error');
      TelegramApp.hapticFeedback('error');
      return;
    }

    UI.hideModal('code-modal');
    if (this.joinGameType === 'domino') {
      // Unirse a Dominó
      SocketClient.joinDomino(roomCode);
      UI.showToast(`Uniéndose a Dominó ${roomCode}...`, 'info');
    } else {
      // Unirse a Tic Tac Toe
      this.handleJoinRoomByCode(roomCode);
    }
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
   * Insertar tarjeta de Dominó si no existe
   */
  ensureDominoCard() {
    try {
      const selector = document.querySelector('.game-selector');
      if (!selector) return;
      if (document.getElementById('select-domino')) return;
      const card = document.createElement('div');
      card.className = 'game-card';
      card.id = 'select-domino';
      card.innerHTML = `
        <div class="game-icon">🁣</div>
        <div class="game-info">
          <h3>Dominó</h3>
          <p>4 jugadores con stake opcional</p>
        </div>
        <div class="game-actions">
          <button id="create-domino-btn" class="btn btn-primary btn-small">Crear</button>
          <button id="join-domino-btn" class="btn btn-secondary btn-small">Unirse</button>
        </div>
      `;
      selector.appendChild(card);
    } catch (e) {
      console.error('ensureDominoCard error:', e);
    }
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
