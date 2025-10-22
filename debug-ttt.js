// Script para debuggear TTT
const ttt = require('./backend/services/tictactoeStore');

// Crear una sala de prueba
const hostId = 'test:host';
const room = ttt.createRoom(hostId, { 
  visibility: 'private', 
  costType: 'fuego', 
  costValue: 3 
});

console.log('Sala creada:', room);

// Simular join
const guestId = 'test:guest';
ttt.joinRoom(room.id, guestId);

// Marcar listos
ttt.setReady(room.id, hostId, true);
ttt.setReady(room.id, guestId, true);

// Ver estado antes de iniciar
const state = ttt.getState(room.id);
console.log('Estado antes de iniciar:', state);

// Intentar iniciar
ttt.startGame(room.id, hostId)
  .then(result => {
    console.log('Partida iniciada:', result);
  })
  .catch(err => {
    console.log('Error al iniciar:', err.message);
  });
