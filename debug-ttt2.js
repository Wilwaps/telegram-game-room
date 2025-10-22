// Script para debuggear TTT con usuarios con saldo
const mem = require('./backend/services/memoryStore');
const ttt = require('./backend/services/tictactoeStore');

// Crear usuarios con saldo suficiente
mem.addFiresAdmin({ userId: 'test:host', amount: 10, reason: 'test_funds' });
mem.addFiresAdmin({ userId: 'test:guest', amount: 10, reason: 'test_funds' });

// Verificar saldos
const host = mem.getUser('test:host');
const guest = mem.getUser('test:guest');
console.log('Saldos iniciales:');
console.log('  Host:', host.fires, 'fuegos');
console.log('  Guest:', guest.fires, 'fuegos');

// Crear una sala de prueba
const room = ttt.createRoom('test:host', { 
  visibility: 'private', 
  costType: 'fuego', 
  costValue: 3 
});

console.log('\nSala creada:', room.id);

// Simular join
ttt.joinRoom(room.id, 'test:guest');

// Marcar listos
ttt.setReady(room.id, 'test:host', true);
ttt.setReady(room.id, 'test:guest', true);

// Ver estado antes de iniciar
const state = ttt.getState(room.id);
console.log('\nEstado antes de iniciar:', state.status);

// Intentar iniciar
ttt.startGame(room.id, 'test:host')
  .then(result => {
    console.log('\n✅ Partida iniciada correctamente');
    console.log('Estado:', result.status);
    
    // Verificar saldos después
    const hostAfter = mem.getUser('test:host');
    const guestAfter = mem.getUser('test:guest');
    console.log('\nSaldos después de iniciar:');
    console.log('  Host:', hostAfter.fires, 'fuegos');
    console.log('  Guest:', guestAfter.fires, 'fuegos');
  })
  .catch(err => {
    console.log('\n❌ Error al iniciar partida:', err.message);
    
    // Verificar saldos después del error
    const hostAfter = mem.getUser('test:host');
    const guestAfter = mem.getUser('test:guest');
    console.log('\nSaldos después del error:');
    console.log('  Host:', hostAfter.fires, 'fuegos');
    console.log('  Guest:', guestAfter.fires, 'fuegos');
  });
