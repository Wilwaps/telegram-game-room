export const Socket = {
  socket: null,
  connected: false,
  listeners: new Map(),

  async connect(url = window.location.origin){
    if (this.socket) return this.socket;
    // Opcional: si no existe io (modo offline), devolver stub
    if (!window.io){
      console.warn('[v2] Socket.io no disponible, modo offline');
      this.socket = {
        on: ()=>{}, off: ()=>{}, emit: ()=>{}, connected: false
      };
      return this.socket;
    }
    this.socket = window.io(url, {
      transports: ['websocket','polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000
    });
    this.socket.on('connect', ()=>{ this.connected = true; this.emitLocal('connect'); });
    this.socket.on('disconnect', ()=>{ this.connected = false; this.emitLocal('disconnect'); });
    return this.socket;
  },

  on(event, handler){
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(handler);
  },
  off(event, handler){
    if (this.listeners.has(event)) this.listeners.get(event).delete(handler);
  },
  emitLocal(event, payload){
    const set = this.listeners.get(event);
    if (set) set.forEach(fn=>{ try{ fn(payload); }catch(e){ console.error(e); } });
  },
  emit(event, payload){ this.socket && this.socket.emit && this.socket.emit(event, payload); }
};

window.SocketV2 = Socket;
