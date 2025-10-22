// Script para verificar estructura de DB
const db = require('./backend/db');

async function checkStructure() {
  try {
    console.log('Verificando estructura de base de datos...');
    
    // Verificar tablas existentes
    const tables = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('Tablas en la base de datos:');
    tables.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    // Verificar estructura de users
    console.log('\nVerificando estructura de tabla users...');
    const userColumns = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    
    if (userColumns.rows.length > 0) {
      userColumns.rows.forEach(row => {
        console.log(`  ${row.column_name}: ${row.data_type}`);
      });
    } else {
      console.log('  Tabla users no encontrada');
    }
    
    // Verificar estructura de wallets
    console.log('\nVerificando estructura de tabla wallets...');
    const walletColumns = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'wallets' 
      ORDER BY ordinal_position
    `);
    
    if (walletColumns.rows.length > 0) {
      walletColumns.rows.forEach(row => {
        console.log(`  ${row.column_name}: ${row.data_type}`);
      });
    } else {
      console.log('  Tabla wallets no encontrada');
    }
    
  } catch (error) {
    console.log('❌ Error al verificar estructura:', error.message);
  }
}

checkStructure();
