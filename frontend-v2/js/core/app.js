import { CONFIG } from './config.js';
import { UI } from './ui.js';
import { Utils } from './utils.js';
import { Registry } from './registry.js';

// Importar juegos (plugins)
import '../plugins/bingo/index.js';
import '../plugins/domino/index.js';

const App = {
  user: null,
  selectedGameId: null,

  async init(){
    UI.init();
    this.user = this.getUser();
    this.bindNav();
    this.renderLobby();
    // Splash breve
    await Utils.sleep(700);
    UI.showScreen('lobby-screen');
  },

  getUser(){
    const tg = window.Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user) {
      const u = tg.initDataUnsafe.user;
      return { userId: String(u.id), userName: u.username || u.first_name || 'Usuario' };
    }
    return { userId: 'dev_'+Math.random().toString(36).slice(2,10), userName: 'Dev User' };
  },

  renderLobby(){
    const grid = document.getElementById('games-grid');
    grid.innerHTML = '';
    const games = Registry.list();
    if (!games.length){
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.textContent = 'No hay juegos registrados (v2).';
      grid.appendChild(empty);
      return;
    }
    games.forEach(game => {
      const card = document.createElement('div');
      card.className = `game-card gc-${game.id}`;
      card.innerHTML = `
        <div class="icon">${game.icon || '🎮'}</div>
        <div class="meta">
          <div class="name">${Utils.escapeHtml(game.name)}</div>
          <div class="desc">${Utils.escapeHtml(game.desc || '')}</div>
          <div>
            <button class="btn">Jugar</button>
          </div>
        </div>
      `;
      card.addEventListener('click', ()=> {
        this.markCardActive(game.id);
        this.startGame(game.id);
      });
      grid.appendChild(card);
    });
    if (this.selectedGameId){ this.markCardActive(this.selectedGameId); }
  },

  markCardActive(id){
    this.selectedGameId = id;
    document.querySelectorAll('#games-grid .game-card').forEach(el=> el.classList.remove('active'));
    const el = document.querySelector(`#games-grid .gc-${CSS.escape(id)}`);
    if (el) el.classList.add('active');
  },

  startGame(id){
    const game = Registry.get(id);
    if (!game){ UI.showToast('Juego no encontrado', 'error'); return; }
    this.selectedGameId = id;
    UI.showScreen('game-screen');
    document.getElementById('game-title').textContent = game.name;
    // aplicar tema por juego en el screen
    const screen = document.getElementById('game-screen');
    screen.classList.remove('theme-bingo','theme-domino');
    screen.classList.add(`theme-${id}`);
    const root = document.getElementById('game-root');
    root.innerHTML = '';
    try {
      game.mount(root, { CONFIG, UI, Utils, user: this.user, onExit: ()=>this.exitGame() });
    } catch (e){
      console.error('Error al montar juego', e);
      UI.showToast('Error al iniciar el juego', 'error');
      this.exitGame();
    }
  },

  exitGame(){
    const root = document.getElementById('game-root');
    const current = root.__plugin;
    try { current && current.unmount && current.unmount(); } catch(_){}
    root.__plugin = null;
    UI.showScreen('lobby-screen');
  }
};

App.bindNav = function(){
  document.addEventListener('click', (e)=>{
    const a = e.target.closest && e.target.closest('a.nav-item[data-action]');
    if (!a) return;
    e.preventDefault();
    const action = a.getAttribute('data-action');
    // actualizar estados activos en todas las navs
    document.querySelectorAll('.bottom-nav .nav-item').forEach(n=> n.classList.remove('active'));
    document.querySelectorAll(`.bottom-nav .nav-item[data-action="${action}"]`).forEach(n=> n.classList.add('active'));
    switch(action){
      case 'lobby': UI.showScreen('lobby-screen'); break;
      case 'profile': UI.showScreen('profile-screen'); break;
      case 'raffles': UI.showScreen('raffles-screen'); break;
      case 'bingo': App.startGame('bingo'); break;
      case 'game': UI.showScreen('game-screen'); break;
      default: UI.showScreen('lobby-screen'); break;
    }
  }, { passive:false });
};

window.AppV2 = App;

// Bootstrap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ()=> App.init());
} else {
  App.init();
}
