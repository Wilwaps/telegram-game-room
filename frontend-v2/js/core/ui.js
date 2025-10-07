import { Utils } from './utils.js';
import { CONFIG } from './config.js';

export const UI = {
  currentScreen: 'splash-screen',
  toastContainer: null,
  logContainer: null,

  init() {
    this.toastContainer = document.getElementById('toast-container');
    if (!this.toastContainer) {
      const c = document.createElement('div');
      c.id = 'toast-container';
      c.className = 'toast-container';
      document.body.appendChild(c);
      this.toastContainer = c;
    }
    this.ensureLogOverlay();
    const back = document.getElementById('back-to-lobby');
    back && back.addEventListener('click', () => this.showScreen('lobby-screen'));
  },

  showScreen(id) {
    try { this.log(`showScreen -> ${id}`, 'info', 'ui'); } catch(_) {}
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) { el.classList.add('active'); this.currentScreen = id; }
  },

  showToast(message, type = 'info', duration = CONFIG.UI.TOAST_DURATION) {
    if (!this.toastContainer) this.init();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    this.toastContainer.appendChild(toast);
    setTimeout(() => toast.style.opacity = '1', 10);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 260); }, duration);
    try { this.log(`toast: ${message} [${type}]`, 'info', 'ui'); } catch(_) {}
  },

  ensureLogOverlay() {
    let el = document.getElementById('realtime-log');
    if (!el) {
      el = document.createElement('div');
      el.id = 'realtime-log';
      document.body.appendChild(el);
    }
    this.logContainer = el;
  },

  log(message, level = 'info', source = 'app') {
    const ts = new Date().toLocaleTimeString();
    const line = `[${ts}] [${source}] ${message}`;
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
    if (!this.logContainer) this.ensureLogOverlay();
    if (this.logContainer) {
      const row = document.createElement('div');
      row.textContent = line;
      this.logContainer.appendChild(row);
      while (this.logContainer.childNodes.length > 200) this.logContainer.removeChild(this.logContainer.firstChild);
      this.logContainer.scrollTop = this.logContainer.scrollHeight;
    }
  }
};

window.UI_V2 = UI;
