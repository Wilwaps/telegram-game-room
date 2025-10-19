(function(){
  function patchFetchWithSid(){
    try{
      if (window.__FETCH_PATCHED_FOR_SID__) return;
      const orig = window.fetch.bind(window);
      window.fetch = function(input, init){
        try{
          const url = (typeof input === 'string') ? input : (input && input.url) || '';
          const sameOrigin = !/^https?:\/\//i.test(url) || url.startsWith(window.location.origin) || url.startsWith('/');
          if (sameOrigin){
            const headers = new Headers((init && init.headers) || {});
            if (!headers.has('x-session-id')){
              const sidCookie = (document.cookie.match(/(?:^|; )sid=([^;]+)/)||[])[1] || '';
              const sid = sidCookie || sessionStorage.getItem('sid') || localStorage.getItem('sid') || '';
              if (sid) headers.set('x-session-id', sid);
            }
            if (!headers.has('x-anon-uid')){
              let anon = '';
              try { anon = sessionStorage.getItem('anonId') || ''; } catch(_){ }
              if (!anon){
                const cu = (document.cookie.match(/(?:^|; )uid=([^;]+)/)||[])[1] || (document.cookie.match(/(?:^|; )uidp=([^;]+)/)||[])[1] || '';
                if (cu) anon = 'anon:'+cu;
              }
              if (!anon){ try { anon = localStorage.getItem('anon_uid') || ''; } catch(_){ } }
              if (anon) headers.set('x-anon-uid', anon);
            }
            init = Object.assign({}, init, { headers });
          }
        }catch(_){ }
        return orig(input, init);
      };
      window.__FETCH_PATCHED_FOR_SID__ = true;
    }catch(_){ }
  }
  try { patchFetchWithSid(); } catch(_){ }
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
  async function ensureTelegramSession(){
    try{
      const tg = window.Telegram && window.Telegram.WebApp;
      if (!tg) return;
      const init = tg.initData;
      const unsafe = tg.initDataUnsafe;
      if (!init || !unsafe || !unsafe.user || !unsafe.user.id) return;
      const key = 'tgLoginDone:'+String(unsafe.user.id);
      if (sessionStorage.getItem(key) === 'ok') return;
      const resp = await fetch('/api/auth/telegram/verify',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ initData: String(init) }) });
      if (resp.ok) {
        sessionStorage.setItem(key,'ok');
        try {
          const data = await resp.json();
          if (data && data.sid){ try { sessionStorage.setItem('sid', String(data.sid)); localStorage.setItem('sid', String(data.sid)); } catch(_){ } }
          try { patchFetchWithSid(); } catch(_){ }
          const newId = data && data.userId ? String(data.userId) : '';
          if (newId.startsWith('tg:')) {
            const current = resolveUserId();
            if (!current.startsWith('tg:')) { setTimeout(()=>window.location.reload(), 150); }
          }
        } catch(_){ }
      } else {
        sessionStorage.removeItem(key);
      }
    }catch(_){ }
  }
  try { ensureTelegramSession(); } catch(_){ }
  window.AppUser = Object.freeze({ resolveUserId });
})();
