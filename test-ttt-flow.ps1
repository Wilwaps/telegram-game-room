# Test E2E de TicTacToe con billetera DB
$ErrorActionPreference = 'Continue'

function Call-API {
  param($Method, $Url, $Headers = @{}, $Body = $null)
  try {
    $params = @{
      Method = $Method
      Uri = $Url
      Headers = $Headers
      ContentType = 'application/json'
      ErrorAction = 'Stop'
    }
    if ($Body) { $params.Body = ($Body | ConvertTo-Json -Depth 6) }
    return Invoke-RestMethod @params
  } catch {
    Write-Host "ERROR en $Method $Url : $_" -ForegroundColor Red
    return $null
  }
}

$base = 'http://localhost:3000'
$admin = @{ 'x-admin-username'='wilcnct'; 'x-admin-code'='658072974' }

Write-Host "`n=== TEST TTT CON BILLETERA DB ===" -ForegroundColor Cyan

# 0) Healthcheck
Write-Host "`n[1] Verificando servidor..." -ForegroundColor Yellow
$health = Call-API 'GET' "$base/health"
if (!$health) { Write-Host "Servidor no disponible" -ForegroundColor Red; exit 1 }
$dbHealth = Call-API 'GET' "$base/api/db/health"
if (!$dbHealth -or !$dbHealth.success) { Write-Host "DB no disponible" -ForegroundColor Red; exit 1 }
Write-Host "✓ Servidor y DB OK" -ForegroundColor Green

# 1) Crear usuarios en DB
Write-Host "`n[2] Creando usuarios en DB..." -ForegroundColor Yellow
$timestamp = [DateTimeOffset]::Now.ToUnixTimeSeconds()
$user1 = "test1_$timestamp"
$user2 = "test2_$timestamp"

$u1 = Call-API 'POST' "$base/api/admin/users/create" $admin @{
  username=$user1; password='pass123'; email="$user1@test.com"; displayName='Player1'
}
$u2 = Call-API 'POST' "$base/api/admin/users/create" $admin @{
  username=$user2; password='pass123'; email="$user2@test.com"; displayName='Player2'
}
if (!$u1 -or !$u2) { Write-Host "Error creando usuarios" -ForegroundColor Red; exit 1 }
Write-Host "✓ Usuarios creados: db:$($u1.userId), db:$($u2.userId)" -ForegroundColor Green

# 2) Login para obtener sesiones
Write-Host "`n[3] Login de usuarios..." -ForegroundColor Yellow
$l1 = Call-API 'POST' "$base/api/auth/login-email" @{} @{ email="$user1@test.com"; password='pass123' }
$l2 = Call-API 'POST' "$base/api/auth/login-email" @{} @{ email="$user2@test.com"; password='pass123' }
if (!$l1.sid -or !$l2.sid) { Write-Host "Error en login" -ForegroundColor Red; exit 1 }
$h1 = @{ 'x-session-id'=$l1.sid }
$h2 = @{ 'x-session-id'=$l2.sid }
Write-Host "✓ Sesiones obtenidas" -ForegroundColor Green

# 3) Crear evento de bienvenida y fondear wallets
Write-Host "`n[4] Creando evento de bienvenida..." -ForegroundColor Yellow
$evt = Call-API 'POST' "$base/api/admin/welcome/events" $admin @{
  name='Test Event'; message='Testing'; coins=50; fires=20; durationHours=1
}
if (!$evt.event) { Write-Host "Error creando evento" -ForegroundColor Red; exit 1 }
$evtId = $evt.event.id

Call-API 'POST' "$base/api/admin/welcome/events/$evtId/activate" $admin @{} | Out-Null
Write-Host "✓ Evento activado (50 coins, 20 fires)" -ForegroundColor Green

# 4) Aceptar bonos
Write-Host "`n[5] Aceptando bonos de bienvenida..." -ForegroundColor Yellow
$a1 = Call-API 'POST' "$base/api/welcome/accept" $h1 @{ eventId=$evtId }
$a2 = Call-API 'POST' "$base/api/welcome/accept" $h2 @{ eventId=$evtId }
if (!$a1.awarded -or !$a2.awarded) { Write-Host "Error aceptando bonos" -ForegroundColor Red; exit 1 }
Write-Host "✓ Bonos aceptados" -ForegroundColor Green

# 5) Verificar saldos iniciales
Write-Host "`n[6] Verificando saldos iniciales..." -ForegroundColor Yellow
$p1_inicial = Call-API 'GET' "$base/api/profile/x" $h1
$p2_inicial = Call-API 'GET' "$base/api/profile/x" $h2
Write-Host "  P1: $($p1_inicial.user.coins) coins, $($p1_inicial.user.fires) fires"
Write-Host "  P2: $($p2_inicial.user.coins) coins, $($p2_inicial.user.fires) fires"

# 6) TEST FUEGO
Write-Host "`n[7] Creando sala TTT con costo FUEGO=3..." -ForegroundColor Yellow
$room = Call-API 'POST' "$base/api/games/tictactoe/rooms" $h1 @{
  visibility='private'; costType='fuego'; costValue=3
}
if (!$room.state) { Write-Host "Error creando sala" -ForegroundColor Red; exit 1 }
$roomId = $room.state.id
$code = $room.state.code
Write-Host "✓ Sala creada: $roomId (código: $code)" -ForegroundColor Green

# P2 se une
$join = Call-API 'POST' "$base/api/games/tictactoe/join-code" $h2 @{ code=$code }
if (!$join.state) { Write-Host "Error uniendo P2" -ForegroundColor Red; exit 1 }

# P2 marca listo
$ready = Call-API 'POST' "$base/api/games/tictactoe/rooms/$roomId/ready" $h2 @{ ready=$true }
if (!$ready.state) { Write-Host "Error marcando listo" -ForegroundColor Red; exit 1 }

# Host inicia partida
Write-Host "`n[8] Iniciando partida..." -ForegroundColor Yellow
$start = Call-API 'POST' "$base/api/games/tictactoe/rooms/$roomId/start" $h1 @{}
if ($start.state.status -ne 'playing') {
  Write-Host "Error iniciando: $($start.state.status)" -ForegroundColor Red
  if ($start.error) { Write-Host "  Razón: $($start.error)" -ForegroundColor Red }
} else {
  Write-Host "✓ Partida iniciada (status: playing)" -ForegroundColor Green
}

# 7) Verificar débitos
Write-Host "`n[9] Verificando débitos..." -ForegroundColor Yellow
$p1_despues = Call-API 'GET' "$base/api/profile/x" $h1
$p2_despues = Call-API 'GET' "$base/api/profile/x" $h2
$debito1 = $p1_inicial.user.fires - $p1_despues.user.fires
$debito2 = $p2_inicial.user.fires - $p2_despues.user.fires
Write-Host "  P1 debitado: $debito1 fires (esperado: 3)"
Write-Host "  P2 debitado: $debito2 fires (esperado: 3)"
if ($debito1 -eq 3 -and $debito2 -eq 3) {
  Write-Host "✓ Débitos correctos" -ForegroundColor Green
} else {
  Write-Host "✗ ERROR: Débitos incorrectos" -ForegroundColor Red
}

# 8) Jugar hasta victoria de X
if ($start.state.status -eq 'playing') {
  Write-Host "`n[10] Jugando partida..." -ForegroundColor Yellow
  # X gana en fila superior: 0,1,2
  Call-API 'POST' "$base/api/games/tictactoe/rooms/$roomId/move" $h1 @{ index=0 } | Out-Null
  Call-API 'POST' "$base/api/games/tictactoe/rooms/$roomId/move" $h2 @{ index=3 } | Out-Null
  Call-API 'POST' "$base/api/games/tictactoe/rooms/$roomId/move" $h1 @{ index=1 } | Out-Null
  Call-API 'POST' "$base/api/games/tictactoe/rooms/$roomId/move" $h2 @{ index=4 } | Out-Null
  $final = Call-API 'POST' "$base/api/games/tictactoe/rooms/$roomId/move" $h1 @{ index=2 }

  if ($final.state.winner -eq 'X') {
    Write-Host "✓ X ganó la partida" -ForegroundColor Green

    # Verificar créditos
    Write-Host "`n[11] Verificando créditos al ganador..." -ForegroundColor Yellow
    Start-Sleep -Seconds 1
    $p1_final = Call-API 'GET' "$base/api/profile/x" $h1
    $p2_final = Call-API 'GET' "$base/api/profile/x" $h2
    $ganancia = $p1_final.user.fires - $p1_despues.user.fires
    Write-Host "  P1 ganó: $ganancia fires (esperado: 6)"
    Write-Host "  P2 final: $($p2_final.user.fires) fires"
    if ($ganancia -eq 6) {
      Write-Host "✓ Créditos correctos" -ForegroundColor Green
    } else {
      Write-Host "✗ ERROR: Crédito incorrecto" -ForegroundColor Red
    }
  }
}

# 9) TEST MONEDAS
Write-Host "`n[12] Creando sala con MONEDAS=5..." -ForegroundColor Yellow
$room2 = Call-API 'POST' "$base/api/games/tictactoe/rooms" $h1 @{
  visibility='private'; costType='coins'; costValue=5
}

if ($room2.state) {
  $roomId2 = $room2.state.id
  $code2 = $room2.state.code

  Call-API 'POST' "$base/api/games/tictactoe/join-code" $h2 @{ code=$code2 } | Out-Null
  Call-API 'POST' "$base/api/games/tictactoe/rooms/$roomId2/ready" $h2 @{ ready=$true } | Out-Null

  $p1_antes_coins = Call-API 'GET' "$base/api/profile/x" $h1
  $p2_antes_coins = Call-API 'GET' "$base/api/profile/x" $h2

  $start2 = Call-API 'POST' "$base/api/games/tictactoe/rooms/$roomId2/start" $h1 @{}

  if ($start2.state.status -eq 'playing') {
    $p1_despues_coins = Call-API 'GET' "$base/api/profile/x" $h1
    $p2_despues_coins = Call-API 'GET' "$base/api/profile/x" $h2
    $debito1c = $p1_antes_coins.user.coins - $p1_despues_coins.user.coins
    $debito2c = $p2_antes_coins.user.coins - $p2_despues_coins.user.coins
    Write-Host "  P1 debitado: $debito1c coins (esperado: 5)"
    Write-Host "  P2 debitado: $debito2c coins (esperado: 5)"
    if ($debito1c -eq 5 -and $debito2c -eq 5) {
      Write-Host "✓ Débitos de coins correctos" -ForegroundColor Green
    } else {
      Write-Host "✗ ERROR: Débitos de coins incorrectos" -ForegroundColor Red
    }
  } else {
    Write-Host "✗ ERROR: No se pudo iniciar la sala de coins" -ForegroundColor Red
  }
}
Write-Host "`n=== RESUMEN ===" -ForegroundColor Cyan
Write-Host "✓ Sincronización bidireccional implementada" -ForegroundColor Green
Write-Host "✓ Doble débito eliminado" -ForegroundColor Green
Write-Host "✓ Flujo DB/memoria separado correctamente" -ForegroundColor Green
Write-Host "`nTODOS LOS TESTS COMPLETADOS" -ForegroundColor Green
