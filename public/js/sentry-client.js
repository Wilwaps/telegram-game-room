(function(){
  function init(){
    try{
      if (!window.__SENTRY_DSN__ || typeof window.Sentry === 'undefined') return;
      window.Sentry.init({
        dsn: window.__SENTRY_DSN__,
        integrations: [new window.Sentry.BrowserTracing()],
        tracesSampleRate: 0.2
      });
    }catch(_){ }
  }
  function loadFallback(cb){
    try{
      if (typeof window.Sentry !== 'undefined') { cb && cb(); return; }
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@sentry/browser@7.121.0/build/bundle.tracing.min.js';
      s.crossOrigin = 'anonymous';
      s.onload = function(){ try{ cb && cb(); }catch(_){ } };
      document.head.appendChild(s);
    }catch(_){ }
  }
  try{
    if (!window.__SENTRY_DSN__) return;
    if (typeof window.Sentry === 'undefined') { loadFallback(init); }
    else { init(); }
  }catch(_){ }
})();
