# Servidor Tibia (OT) estable: Investigación y Guía Paso a Paso (Windows)

## Resumen (qué vamos a usar y por qué)
- **Servidor recomendado:** The Forgotten Server (TFS) — release estable 1.4.2. Referencias:
  - Releases oficiales: https://github.com/otland/forgottenserver/releases
  - Guía oficial compilar en Windows (vcpkg): https://github.com/otland/forgottenserver/wiki/Compiling-on-Windows-(vcpkg)
- **Por qué 1.4.2:** ampliamente probado en producción, gran comunidad y documentación. Existe TFS 1.6 más reciente, pero 1.4.2 suele ser el punto estable más usado. Si necesitas lo último, puedes ir a 1.6; si priorizas estabilidad probada, usa 1.4.2.
- **Datapack recomendado (contenido):** OTServBR-Global (12.x) — activo y mantenido:
  - Repo: https://github.com/opentibiabr/otservbr-global
  - Nota: requiere cliente compatible (OTClient recomendado). 
- **AAC (web) recomendado:** MyAAC o Znote AAC para cuentas/personajes:
  - MyAAC: https://github.com/slawkens/myaac/releases
  - Znote AAC: https://github.com/Znote/ZnoteAAC/releases

## Requisitos (Windows 10/11)
- Visual Studio 2022 (o Build Tools) con Desktop development with C++ (MSVC, CMake, Windows SDK)
- Git
- CMake 3.20+
- vcpkg (gestor de libs)
- (Opcional) MariaDB/MySQL (para producción). Para pruebas rápidas puedes usar SQLite.

## Parte A: Compilar TFS (1.4.2) en Windows con vcpkg
1) Instalar dependencias (Visual Studio + Git + CMake).
2) Preparar `vcpkg` (PowerShell):
```powershell
# Clonar vcpkg
git clone https://github.com/microsoft/vcpkg "C:\vcpkg"; if ($LASTEXITCODE -ne 0) { throw 'git clone vcpkg falló' }

# Bootstrap
& "C:\vcpkg\bootstrap-vcpkg.bat"; if ($LASTEXITCODE -ne 0) { throw 'bootstrap vcpkg falló' }

# Integración a usuario
& "C:\vcpkg\vcpkg.exe" integrate install; if ($LASTEXITCODE -ne 0) { throw 'vcpkg integrate falló' }
```
3) Clonar TFS 1.4.2:
```powershell
# Carpeta de trabajo, ajusta si prefieres otra
$TfsDir = "C:\tfs"
if (!(Test-Path $TfsDir)) { New-Item -Path $TfsDir -ItemType Directory | Out-Null }

# Clonar TFS (puedes usar --branch 1.4.2 o descargar la release fuente)
git clone --recursive https://github.com/otland/forgottenserver.git "$TfsDir\forgottenserver"; if ($LASTEXITCODE -ne 0) { throw 'git clone TFS falló' }
```
4) Configurar y compilar con CMake:
```powershell
$src = "$TfsDir\forgottenserver"
$build = "$src\build"
if (!(Test-Path $build)) { New-Item -Path $build -ItemType Directory | Out-Null }

# Configurar (x64)
cmake -S "$src" -B "$build" -A x64 -DCMAKE_TOOLCHAIN_FILE="C:/vcpkg/scripts/buildsystems/vcpkg.cmake"; if ($LASTEXITCODE -ne 0) { throw 'cmake configure falló' }

# Compilar Release
cmake --build "$build" --config Release; if ($LASTEXITCODE -ne 0) { throw 'cmake build falló' }
```
5) Resultado: `forgottenserver.exe` en `build/bin/Release`.

## Parte B: Datapack (contenido del juego)
Opción recomendada: OTServBR-Global (12.x)
```powershell
$DataDir = "$TfsDir\data"
if (!(Test-Path $DataDir)) { New-Item -Path $DataDir -ItemType Directory | Out-Null }

# Clonar datapack
$OtsDir = "$TfsDir\otservbr-global"
git clone https://github.com/opentibiabr/otservbr-global "$OtsDir"; if ($LASTEXITCODE -ne 0) { throw 'git clone otservbr-global falló' }

# Copia la carpeta data del datapack hacia la carpeta data de TFS (ajusta si difiere la estructura)
# Revisa README del datapack por pasos específicos.
```
Notas:
- Revisa el README del datapack; algunas ramas esperan binarios concretos o configuraciones adicionales.
- Alternativa: usar el `data/` por defecto del TFS (muy básico, solo para pruebas).

## Parte C: Base de Datos
- Para pruebas rápidas, usa SQLite (sin instalar nada). 
- Para producción, usa MariaDB/MySQL.

1) SQLite (rápido):
- En `config.lua` del TFS:
  - `sqlType = "sqlite"`
  - `sqlFile = "data/database.s3db"` (o ruta preferida)

2) MySQL/MariaDB (producción):
- Instala MariaDB/MySQL.
- Crea DB y usuario:
```sql
CREATE DATABASE tfs CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'tfsuser'@'localhost' IDENTIFIED BY 'TuPasswordFuerte123';
GRANT ALL PRIVILEGES ON tfs.* TO 'tfsuser'@'localhost';
FLUSH PRIVILEGES;
```
- Importa el esquema de TFS (archivo `schema.sql` dentro del repo TFS o del datapack):
```powershell
# Con MySQL CLI (ejemplo)
mysql -u tfsuser -p tfs < "C:\ruta\a\schema.sql"
```
- En `config.lua`:
  - `sqlType = "mysql"`
  - `sqlHost = "127.0.0.1"`
  - `sqlUser = "tfsuser"`
  - `sqlPass = "TuPasswordFuerte123"`
  - `sqlDatabase = "tfs"`

## Parte D: Configurar `config.lua`
- Ubicación: junto al binario o dentro de `data/` según datapack.
- Ajustes mínimos:
  - IP/puertos: `ip = "0.0.0.0"`, `loginPort = 7171`, `gamePort = 7172` (si aplica en tu distro).
  - `houseRentPeriod`, `motd`, `rates`, etc. según tus preferencias.
  - `sqlType` y credenciales como arriba.

## Parte E: Arrancar el servidor
```powershell
# RUTA de ejemplo; ajusta a tu build real
& "$TfsDir\forgottenserver\build\bin\Release\forgottenserver.exe"
```
- Mantén la consola abierta. Verás logs de inicio; si hay errores de DB o rutas, corrígelos.

## Parte F: Red y conexión externa
1) Firewall de Windows (abrir puertos):
```powershell
New-NetFirewallRule -DisplayName "Tibia 7171" -Direction Inbound -Protocol TCP -LocalPort 7171 -Action Allow
New-NetFirewallRule -DisplayName "Tibia 7172" -Direction Inbound -Protocol TCP -LocalPort 7172 -Action Allow
```
2) Router: Reenvío de puertos hacia la IP local de tu PC (7171 y 7172 TCP). 
3) Verificación externa:
- Desde datos móviles o canyouseeme.org prueba tu IP pública en 7171/7172.

Si tienes CGNAT o no puedes abrir puertos:
- Usa **Playit.gg** para exponer 7171/7172 sin tocar el router: https://playit.gg/
  - Crea túneles TCP a `localhost:7171` y `localhost:7172`.
  - Comparte a tu amigo los endpoints públicos de Playit.gg y el cliente/versión compatibles.

## Parte G: Cliente del juego
- Recomendado: **OTClient** (o **OTClientV8**). El datapack OTServBR-Global suele recomendar el de **mehaj** (consulta el README del datapack):
  - Ejemplo: https://github.com/OTCv8/otclientv8 (variantes mantenidas por la comunidad)
- Configura en el cliente:
  - Host: tu IP pública o dirección de Playit.gg
  - Puerto: 7171 (o el que indique el cliente)
  - Versión/protocolo: el que corresponda al datapack (12.x en OTServBR-Global)

## Parte H: Cuentas/Personajes (AAC)
- **MyAAC** (PHP) o **Znote AAC** para gestionar cuentas vía web.
- Ruta rápida con XAMPP (Apache+PHP+MySQL):
  1) Instala XAMPP.
  2) Copia MyAAC en `C:\xampp\htdocs\myaac`.
  3) Configura `config.php` con credenciales de la DB `tfs`.
  4) Abre `http://localhost/myaac` y sigue el instalador.
- Alternativa mínima (solo pruebas): crear cuentas directamente en DB (no recomendado a largo plazo).

## Paso a Paso (modo “cocina”)
1) Instalar Visual Studio (C++), Git, CMake.
2) Preparar vcpkg y compilar TFS (sección A). 
3) Clonar datapack y colocar `data/` (sección B).
4) Elegir DB:
   - Pruebas: SQLite (editar `config.lua`).
   - Producción: MySQL/MariaDB y cargar `schema.sql` (sección C).
5) Editar `config.lua` (sección D).
6) Abrir puertos en Firewall (sección F.1).
7) Hacer Port Forwarding en el router o usar Playit.gg (sección F.2/F.3).
8) Arrancar el servidor (sección E).
9) Instalar cliente OT y configurar host/puerto (sección G).
10) Crear cuentas/personajes con MyAAC/Znote (sección H).
11) Que tu amigo conecte usando tu dominio/IP/túnel y la versión correcta.

## Troubleshooting (rápido)
- "No conecta":
  - Verifica que el server esté arrancado sin errores.
  - Comprueba que 7171/7172 están abiertos (firewall y router).
  - Prueba desde 4G o canyouseeme.org.
  - Si CGNAT, usa Playit.gg.
- "Faltan libs" al arrancar:
  - Copia DLLs de la carpeta `build/bin/Release` o asegúrate de compilar con `Release` y tener vcpkg integrado.
- "DB falla":
  - Revisa credenciales en `config.lua` y que importaste `schema.sql`.
- "Cliente incompatible":
  - Asegúrate de usar un cliente que soporte el protocolo de tu datapack.

## Alternativas (con precaución)
- **TFS 1.6** (más reciente): puedes optar por la release 1.6 si deseas features nuevas; valida compatibilidad del datapack.
- **OTX Server (8.6 clásico)**: más features para 8.6, pero historial de estabilidad variable frente a TFS estable. Úsalo si tu objetivo es 8.6 específicamente.

## Referencias
- TFS Releases: https://github.com/otland/forgottenserver/releases
- Compilar en Windows (vcpkg): https://github.com/otland/forgottenserver/wiki/Compiling-on-Windows-(vcpkg)
- OTLand Docs (TFS 1.4): https://docs.otland.net/ots-guide/tfs-documentation/tfs-1.4
- OTServBR-Global (datapack): https://github.com/opentibiabr/otservbr-global
- MyAAC: https://github.com/slawkens/myaac/releases
- Znote AAC: https://github.com/Znote/ZnoteAAC/releases
- Playit.gg: https://playit.gg/
