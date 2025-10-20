(function(){
  function hasDriver(){ try{ return !!(window&&window.driver&&window.driver.js&&window.driver.js.driver); }catch(_){ return false; } }
  function drv(){ try{ return window.driver.js.driver; }catch(_){ return null; } }
  function once(key){ try{ if (localStorage.getItem(key)) return false; localStorage.setItem(key,'1'); return true; }catch(_){ return true; } }
  function el(sel){ try{ return document.querySelector(sel); }catch(_){ return null; } }
  function tryHighlight(sel, pop){ try{ var D=drv(); if (!D) return false; var t = el(sel); if (!t) return false; var d = D(); d.highlight({ element: sel, popover: pop||{} }); return true; }catch(_){ return false; } }

  function tourGames(){
    if (!once('__tour_games_seen')) return;
    if (tryHighlight('#fabCreate', { title:'Crear sala', description:'Inicia una partida rápida.' })) return;
    tryHighlight('#appFooterNav a[data-key="juegos"]', { title:'Juegos', description:'Explora los juegos disponibles.' });
  }
  function tourRaffles(){
    if (!once('__tour_raffles_seen')) return;
    if (tryHighlight('a[href="/raffles/create"]', { title:'Crear rifa', description:'Crea tu propia rifa.' })) return;
    tryHighlight('#appFooterNav a[data-key="raffles"]', { title:'Rifas', description:'Explora o crea rifas.' });
  }
  function tourProfile(){
    if (!once('__tour_profile_seen')) return;
    tryHighlight('#appFooterNav a[data-key="profile"]', { title:'Perfil', description:'Consulta tu perfil y estado.' });
  }

  function run(path){
    if (!hasDriver()) return;
    try{
      if (path==='/games' || path.startsWith('/games')) return tourGames();
      if (path==='/raffles' || path.startsWith('/raffles')) return tourRaffles();
      if (path==='/profile' || path.startsWith('/profile')) return tourProfile();
    }catch(_){ }
  }

  window.DriverTours = { runToursForRoute: run };
})();
