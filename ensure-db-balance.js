// Script para asegurar saldos en DB para usuarios TTT
const welcomeRepo = require('./backend/repos/welcomeRepo');

async function ensureBalances() {
  const hostId = 'em:test@example.com';
  const guestId = 'em:guest@example.com';
  
  try {
    // Verificar saldos actuales en DB
    const hostBal = await welcomeRepo.getWalletExtBalances(hostId);
    const guestBal = await welcomeRepo.getWalletExtBalances(guestId);
    
    console.log('Saldos actuales en DB:');
    console.log('  Host:', hostBal ? `${hostBal.fires} fuegos` : 'No encontrado');
    console.log('  Guest:', guestBal ? `${guestBal.fires} fuegos` : 'No encontrado');
    
    // Asegurar que ambos usuarios tienen al menos 10 fuegos
    if (!hostBal || hostBal.fires < 10) {
      const result = await welcomeRepo.creditFiresByExt(hostId, 10, { 
        type: 'admin_credit', 
        reference: 'debug_test', 
        meta: { reason: 'test_funds' } 
      });
      console.log('Crédito para host:', result.ok ? '✅ OK' : '❌ Error');
    }
    
    if (!guestBal || guestBal.fires < 10) {
      const result = await welcomeRepo.creditFiresByExt(guestId, 10, { 
        type: 'admin_credit', 
        reference: 'debug_test', 
        meta: { reason: 'test_funds' } 
      });
      console.log('Crédito para guest:', result.ok ? '✅ OK' : '❌ Error');
    }
    
    // Verificar saldos finales
    const hostBalFinal = await welcomeRepo.getWalletExtBalances(hostId);
    const guestBalFinal = await welcomeRepo.getWalletExtBalances(guestId);
    
    console.log('\nSaldos finales en DB:');
    console.log('  Host:', hostBalFinal ? `${hostBalFinal.fires} fuegos` : 'No encontrado');
    console.log('  Guest:', guestBalFinal ? `${guestBalFinal.fires} fuegos` : 'No encontrado');
    
  } catch (error) {
    console.log('Error:', error.message);
  }
}

ensureBalances();
