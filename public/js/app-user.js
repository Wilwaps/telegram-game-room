(function(){
  function getCookie(name){
    try{
      const m = document.cookie.match(new RegExp('(?:^|; )'+name+'=([^;]*)'));
      return m? decodeURIComponent(m[1]) : '';
    }catch(_){ return '' }
  }
  function getQuery(name){ try { return new URL(window.location.href).searchParams.get(name); } catch(_){ return null } }
  function resolveFromTelegram(){
    try {
      const tg = window.Telegram && window.Telegram.WebApp;
      const user = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
      if (user && user.id) return 'tg:'+String(user.id);
    } catch(_){ }
    return null;
  }
  function ensureAnon(){
    // Priorizar sessionStorage para permitir IDs distintos por pestaña (tests multi-ventana)
    try { const s = sessionStorage.getItem('anonId'); if (s) return s; } catch(_){ }
    // Luego preferir cookie uid/uidp emitida por backend (persistente, compartida entre páginas)
    const cu = getCookie('uid') || getCookie('uidp');
    if (cu) {
      const val = 'anon:'+cu;
      try { sessionStorage.setItem('anonId', val); } catch(_){ }
      return val;
    }
    // Fallback local, estable y compartido
    try{
      let a = localStorage.getItem('anon_uid');
      if (!a) { a = 'anon:'+Math.random().toString(36).slice(2,10); localStorage.setItem('anon_uid', a); }
      try { sessionStorage.setItem('anonId', a); } catch(_){ }
      return a;
    }catch(_){ return 'anon:guest' }
  }
  function resolveUserId(){
    const qp = getQuery('uid'); if (qp) { try { sessionStorage.setItem('anonId', String(qp)); } catch(_){ } return String(qp); }
    const t = resolveFromTelegram(); if (t) return t;
    return ensureAnon();
  }
  window.AppUser = Object.freeze({ resolveUserId });
})();
