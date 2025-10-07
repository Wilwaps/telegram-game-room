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
      el.style.position = 'fixed';
      el.style.right = '8px';
      el.style.bottom = '48px';
      el.style.maxHeight = '30vh';
      el.style.width = 'min(90vw, 360px)';
      el.style.overflow = 'auto';
      el.style.background = 'rgba(0,0,0,0.55)';
      el.style.color = '#fff';
      el.style.fontSize = '11px';
      el.style.lineHeight = '1.35';
      el.style.padding = '8px';
      el.style.borderRadius = '8px';
      el.style.zIndex = '1500';
      const stored = localStorage.getItem('ui.log.visible.v2');
      const visible = stored === 'true';
      el.style.display = visible ? 'block' : 'none';
      document.body.appendChild(el);
    }
    this.logContainer = el;

    let btn = document.getElementById('realtime-log-toggle');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'realtime-log-toggle';
      btn.textContent = '📝 Logs';
      btn.title = 'Mostrar/Ocultar logs';
      btn.className = 'btn-icon';
      btn.style.position = 'fixed';
      btn.style.right = '8px';
      btn.style.bottom = '8px';
      btn.style.zIndex = '1600';
      btn.addEventListener('click', () => this.toggleLog());
      document.body.appendChild(btn);
    }
    const visibleNow = (this.logContainer && this.logContainer.style.display !== 'none');
    btn.textContent = visibleNow ? '🧹 Ocultar log' : '📝 Logs';
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
  },

  setLogVisible(visible){
    this.ensureLogOverlay();
    if (this.logContainer) this.logContainer.style.display = visible ? 'block' : 'none';
    try { localStorage.setItem('ui.log.visible.v2', String(visible)); } catch(_){}
    const btn = document.getElementById('realtime-log-toggle');
    if (btn) btn.textContent = visible ? '🧹 Ocultar log' : '📝 Logs';
  },

  toggleLog(){
    const visible = this.logContainer && this.logContainer.style.display !== 'none';
    this.setLogVisible(!visible);
  }
};

window.UI_V2 = UI;
