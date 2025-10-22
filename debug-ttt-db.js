// Script para debuggear TTT con modo DB activado
const mem = require('./backend/services/memoryStore');
const ttt = require('./backend/services/tictactoeStore');

// Activar modo DB
ttt.dbWalletEnabled = true;
console.log('Modo DB activado:', ttt.dbWalletEnabled);

// Crear usuarios tipo email (em:) que funcionan con DB
const hostId = 'em:test@example.com';
const guestId = 'em:guest@example.com';

// Verificar estado inicial de usuarios
const hostInitial = mem.getUser(hostId);
const guestInitial = mem.getUser(guestId);
console.log('\nUsuarios iniciales (antes de sync):');
console.log('  Host:', hostInitial ? `${hostInitial.fires} fuegos` : 'No existe');
console.log('  Guest:', guestInitial ? `${guestInitial.fires} fuegos` : 'No existe');

// Simular sync desde DB (esto normalmente lo hace el login)
mem.syncFromExtWallet(hostId);
mem.syncFromExtWallet(guestId);

// Verificar después de sync
const hostAfterSync = mem.getUser(hostId);
const guestAfterSync = mem.getUser(guestId);
console.log('\nUsuarios después de sync:');
console.log('  Host:', hostAfterSync ? `${hostAfterSync.fires} fuegos` : 'No existe');
console.log('  Guest:', guestAfterSync ? `${guestAfterSync.fires} fuegos` : 'No existe');

// Crear sala
const room = ttt.createRoom(hostId, { 
  visibility: 'private', 
  costType: 'fuego', 
  costValue: 3 
});

console.log('\nSala creada:', room.id);

// Simular join
ttt.joinRoom(room.id, guestId);

// Marcar listos
ttt.setReady(room.id, hostId, true);
ttt.setReady(room.id, guestId, true);

// Ver estado antes de iniciar
const state = ttt.getState(room.id);
console.log('\nEstado antes de iniciar:', state.status);

// Intentar iniciar
ttt.startGame(room.id, hostId)
  .then(result => {
    console.log('\n✅ Partida iniciada correctamente');
    console.log('Estado:', result.status);
  })
  .catch(err => {
    console.log('\n❌ Error al iniciar partida:', err.message);
  });
