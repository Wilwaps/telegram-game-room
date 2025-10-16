(function(){
  try{
    if (typeof window.__SENTRY_DSN__ === 'undefined'){
      var s = document.createElement('script');
      s.src = '/config.js';
      s.async = false;
      document.head.appendChild(s);
    }
  }catch(_){ }
})();
