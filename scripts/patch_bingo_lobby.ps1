Param()
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$file = Join-Path $root 'backend\services\socketService.js'
$backup = "$file.bak_$(Get-Date -Format 'yyyyMMdd_HHmmss')"

if (-not (Test-Path $file)) { throw "No se encontró $file" }
Copy-Item $file $backup -Force

$text = Get-Content -Raw -Encoding UTF8 $file

# 1) Insertar cardCount y recalcular cost
$text = $text -replace '([\s]*)const cost = room\.ticketPrice \* Math\.max\(1,\s*parseInt\(cardsCount,\s*10\)\);\s*', "$1const cardCount = Math.max(1, parseInt(cardsCount, 10));`r`n$1const cost = room.ticketPrice * cardCount;`r`n"

# 2) Envolver el bloque de gasto en modo fuego
$text = $text -replace '([\s]*)const spendRes = await this\.economy\.spend\(', "$1if (room.ecoMode === 'fire') {`r`n$1const spendRes = await this.economy.spend("
$text = $text -replace '([\s]*if \(spendRes\.tx\) s\.emit\(constants\.SOCKET_EVENTS\.FIRES_TRANSACTION,\s*spendRes\.tx\);\s*\r?\n)([\s]*)(\}\);\s*)', "$1$2$3`r`n$2}"

# 3) Envolver entries/pot en modo fuego
$text = $text -replace '([\s]*)room\.entries\[socket\.userId\] = \(room\.entries\[socket\.userId\] \|\| 0\) \+ cost;\s*\r?\n\s*room\.pot \+= cost;', "$1if (room.ecoMode === 'fire') {`r`n$1  room.entries[socket.userId] = (room.entries[socket.userId] || 0) + cost;`r`n$1  room.pot += cost;`r`n$1}"

# 4) Usar cardCount donde corresponde
$text = $text -replace 'room\.addPlayer\(socket\.userId,\s*socket\.userName,\s*cardsCount\);', 'room.addPlayer(socket.userId, socket.userName, cardCount);'
$text = $text -replace 'existing\.cardsCount = \(existing\.cardsCount \|\| 0\) \+ cardsCount;', 'existing.cardsCount = (existing.cardsCount || 0) + cardCount;'

# 5) Inyectar validaciones en START_BINGO
$inject = @"
          // Verificar que todos los jugadores estén listos
          if (typeof room.allReady === 'function' && !room.allReady()) {
            return this.emitError(socket, 'Faltan jugadores listos');
          }

          // En modo fuego, validar tickets comprados
          if (room.ecoMode === 'fire') {
            const missingUserIds = (room.players || [])
              .filter(p => !room.entries[p.userId] || room.entries[p.userId] <= 0)
              .map(p => p.userId);
            if (missingUserIds.length > 0) {
              this.io.to(code).emit(constants.SOCKET_EVENTS.BINGO_MODE_UPDATED, { room: room.toJSON(), missingUserIds });
              return this.emitError(socket, 'Jugadores sin tickets');
            }
          }
"@
$text = $text -replace "(\s*if \(room\.started\) return this\.emitError\(socket, 'La partida ya inició'\);\s*)", "`$1`r`n$inject"

# 6) Insertar handlers BINGO_SET_MODE y BINGO_SET_READY antes de DRAW_NEXT
$handlers = @"
      // Cambiar modo económico del Bingo
      socket.on(constants.SOCKET_EVENTS.BINGO_SET_MODE, async ({ roomCode, ecoMode = 'friendly', ticketPrice } = {}) => {
        try {
          const code = roomCode || socket.currentBingoRoom;
          if (!code) return this.emitError(socket, 'Sala no encontrada');
          const room = await redisService.getBingoRoom(code);
          if (!room) return this.emitError(socket, 'Sala no encontrada');
          if (room.hostId !== socket.userId) return this.emitError(socket, 'Solo el anfitrión puede cambiar el modo');
          if (room.started) return this.emitError(socket, 'La partida ya inició');

          room.ecoMode = ecoMode === 'fire' ? 'fire' : 'friendly';
          if (typeof ticketPrice === 'number') {
            room.ticketPrice = Math.max(1, parseInt(ticketPrice, 10) || room.ticketPrice || 1);
          }
          await redisService.setBingoRoom(code, room);

          let missingUserIds = [];
          if (room.ecoMode === 'fire') {
            missingUserIds = (room.players || [])
              .filter(p => !room.entries[p.userId] || room.entries[p.userId] <= 0)
              .map(p => p.userId);
          }
          this.io.to(code).emit(constants.SOCKET_EVENTS.BINGO_MODE_UPDATED, { room: room.toJSON(), missingUserIds });
        } catch (err) {
          logger.error('Error BINGO_SET_MODE:', err);
          this.emitError(socket, 'No se pudo actualizar el modo de la sala');
        }
      });

      // Marcar listo/no listo en lobby de Bingo
      socket.on(constants.SOCKET_EVENTS.BINGO_SET_READY, async ({ roomCode, ready = true } = {}) => {
        try {
          const code = roomCode || socket.currentBingoRoom;
          if (!code) return this.emitError(socket, 'Sala no encontrada');
          const room = await redisService.getBingoRoom(code);
          if (!room) return this.emitError(socket, 'Sala no encontrada');
          if (room.started) return this.emitError(socket, 'La partida ya inició');

          const player = room.getPlayer(socket.userId);
          if (!player) return this.emitError(socket, 'No estás en la sala');

          room.setReady(socket.userId, !!ready);
          await redisService.setBingoRoom(code, room);
          this.io.to(code).emit(constants.SOCKET_EVENTS.BINGO_READY_UPDATED, { room: room.toJSON(), allReady: room.allReady && room.allReady() });
        } catch (err) {
          logger.error('Error BINGO_SET_READY:', err);
          this.emitError(socket, 'No se pudo actualizar listo');
        }
      });
"@
$text = $text -replace "(\r?\n\s*socket\.on\(constants\.SOCKET_EVENTS\.DRAW_NEXT,)", "`r`n$handlers`r`n`$1"

Set-Content -Path $file -Value $text -Encoding UTF8
Write-Host "Patched $file. Backup: $backup"
