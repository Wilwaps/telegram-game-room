# Test simple de TTT
$base = 'http://localhost:3000'

# Verificar servidor
try {
  $health = Invoke-RestMethod -Uri "$base/health" -Method GET
  Write-Host "✓ Servidor OK" -ForegroundColor Green
} catch {
  Write-Host "✗ Servidor no responde" -ForegroundColor Red
  exit 1
}

# Verificar DB
try {
  $dbHealth = Invoke-RestMethod -Uri "$base/api/db/health" -Method GET
  Write-Host "✓ DB OK" -ForegroundColor Green
} catch {
  Write-Host "✗ DB no responde" -ForegroundColor Red
  exit 1
}

Write-Host "`n✅ Sistema listo para pruebas" -ForegroundColor Cyan
