// Script para añadir fondos de prueba a usuarios DB
const db = require('./backend/db');

async function addTestFunds() {
  const hostEmail = 'test@example.com';
  const guestEmail = 'guest@example.com';
  
  try {
    console.log('Añadiendo fondos de prueba...');
    
    // Crear usuarios si no existen
    console.log('Creando usuarios de prueba...');
    await db.query(
      `INSERT INTO users(username, email, display_name, password_hash, role, created_at) 
       VALUES ($1, $2, $3, $4, $5, NOW()) 
       ON CONFLICT (email) DO NOTHING`,
      [hostEmail, hostEmail, 'Test Host', 'hash123', 'client']
    );
    
    await db.query(
      `INSERT INTO users(username, email, display_name, password_hash, role, created_at) 
       VALUES ($1, $2, $3, $4, $5, NOW()) 
       ON CONFLICT (email) DO NOTHING`,
      [guestEmail, guestEmail, 'Test Guest', 'hash123', 'client']
    );
    
    // Obtener IDs de usuarios
    console.log('Obteniendo IDs de usuarios...');
    const hostResult = await db.query('SELECT id FROM users WHERE email = $1', [hostEmail]);
    const guestResult = await db.query('SELECT id FROM users WHERE email = $1', [guestEmail]);
    
    const hostId = hostResult.rows[0].id;
    const guestId = guestResult.rows[0].id;
    
    console.log(`Host ID: ${hostId}`);
    console.log(`Guest ID: ${guestId}`);
    
    // Crear billeteras si no existen
    console.log('Creando billeteras...');
    await db.query(
      `INSERT INTO wallets(user_id, fires_balance, coins_balance, updated_at) 
       VALUES ($1, 0, 0, NOW()) 
       ON CONFLICT (user_id) DO NOTHING`,
      [hostId]
    );
    
    await db.query(
      `INSERT INTO wallets(user_id, fires_balance, coins_balance, updated_at) 
       VALUES ($1, 0, 0, NOW()) 
       ON CONFLICT (user_id) DO NOTHING`,
      [guestId]
    );
    
    // Añadir fuegos a las billeteras
    console.log('Añadiendo fuegos...');
    await db.query(
      'UPDATE wallets SET fires_balance = fires_balance + $1 WHERE user_id = $2',
      [10, hostId]
    );
    
    await db.query(
      'UPDATE wallets SET fires_balance = fires_balance + $1 WHERE user_id = $2',
      [10, guestId]
    );
    
    // Verificar saldos finales
    console.log('Verificando saldos...');
    const hostBal = await db.query('SELECT fires_balance FROM wallets WHERE user_id = $1', [hostId]);
    const guestBal = await db.query('SELECT fires_balance FROM wallets WHERE user_id = $1', [guestId]);
    
    console.log(`Saldo final Host: ${hostBal.rows[0].fires_balance} fuegos`);
    console.log(`Saldo final Guest: ${guestBal.rows[0].fires_balance} fuegos`);
    
    console.log('✅ Fondos añadidos correctamente');
    
  } catch (error) {
    console.log('❌ Error al añadir fondos:', error.message);
  }
}

addTestFunds();
