# 📖 GUÍA PASO A PASO - Configuración Completa

Esta guía te llevará desde cero hasta tener tu MiniApp funcionando en Telegram.

---

## 📋 PASO 1: Crear tu Bot de Telegram

### 1.1 Abrir BotFather
1. Abre Telegram en tu teléfono o computadora
2. Busca **@BotFather** (es el bot oficial de Telegram)
3. Inicia una conversación con él

### 1.2 Crear el Bot
1. Envía el comando: `/newbot`
2. BotFather te preguntará el **nombre** de tu bot:
   ```
   Ejemplo: Sala de Juegos
   ```
3. Luego te pedirá el **username** (debe terminar en 'bot'):
   ```
   Ejemplo: mi_sala_juegos_bot
   ```

### 1.3 Guardar el Token
BotFather te enviará un mensaje como este:
```
Done! Congratulations on your new bot. You will find it at t.me/mi_sala_juegos_bot
Use this token to access the HTTP API:
7734154282:AAHuk7rYVV2RI9HmfEPoVVv3E7aM6Jvma0w
```

**⚠️ IMPORTANTE:** Copia y guarda este token, lo necesitarás en el siguiente paso.

---

## 📋 PASO 2: Configurar Variables de Entorno

### 2.1 Crear archivo .env
1. Abre la carpeta del proyecto: `telegram-game-room`
2. Copia el archivo `.env.example` y renómbralo a `.env`

**En Windows PowerShell:**
```powershell
cd telegram-game-room
Copy-Item .env.example .env
```

### 2.2 Editar el archivo .env
Abre el archivo `.env` con tu editor de texto y modifica estas líneas:

```env
# ============================================
# TELEGRAM BOT API
# ============================================
TELEGRAM_BOT_TOKEN=7734154282:AAHuk7rYVV2RI9HmfEPoVVv3E7aM6Jvma0w
TELEGRAM_BOT_USERNAME=mi_sala_juegos_bot
```

**Reemplaza:**
- `7734154282:AAHuk7rYVV2RI9HmfEPoVVv3E7aM6Jvma0w` con tu token real
- `mi_sala_juegos_bot` con el username de tu bot (sin @)

### 2.3 Verificar otras configuraciones
El resto de las configuraciones ya están bien para desarrollo local:
```env
NODE_ENV=development
PORT=3000
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## 📋 PASO 3: Instalar Redis

Redis es necesario para almacenar las salas y sesiones.

### Opción A: Windows con Chocolatey (Recomendado)

1. **Instalar Chocolatey** (si no lo tienes):
   - Abre PowerShell como **Administrador**
   - Ejecuta:
   ```powershell
   Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
   ```

2. **Instalar Redis**:
   ```powershell
   choco install redis-64 -y
   ```

3. **Iniciar Redis**:
   ```powershell
   redis-server
   ```

### Opción B: Windows Manual

1. Descargar Redis desde: https://github.com/tporadowski/redis/releases
2. Descargar el archivo `Redis-x64-X.X.X.zip`
3. Extraer en `C:\Redis`
4. Abrir PowerShell en esa carpeta
5. Ejecutar:
   ```powershell
   .\redis-server.exe
   ```

### Verificar que Redis funciona

En otra terminal, ejecuta:
```powershell
redis-cli ping
```

Debe responder: `PONG`

---

## 📋 PASO 4: Instalar Dependencias del Proyecto

### 4.1 Verificar Node.js
Abre PowerShell y verifica que tienes Node.js instalado:
```powershell
node --version
```

Debe mostrar algo como: `v16.x.x` o superior

Si no tienes Node.js:
1. Descarga desde: https://nodejs.org/
2. Instala la versión LTS (recomendada)
3. Reinicia PowerShell

### 4.2 Instalar dependencias
En la carpeta del proyecto:
```powershell
cd telegram-game-room
npm install
```

Esto instalará todas las librerías necesarias. Tomará unos minutos.

---

## 📋 PASO 5: Iniciar el Servidor

### 5.1 Asegurarte que Redis está corriendo
En una terminal, debe estar ejecutándose:
```powershell
redis-server
```

### 5.2 Iniciar el servidor de desarrollo
En otra terminal:
```powershell
cd telegram-game-room
npm run dev
```

Deberías ver algo como:
```
🚀 Iniciando servicios...
✅ Redis conectado
✅ Socket.io inicializado
✅ Telegram Bot inicializado

╔════════════════════════════════════════════╗
║   🎮 SALA DE JUEGOS - SERVIDOR ACTIVO 🎮  ║
╚════════════════════════════════════════════╝

🌐 Servidor: http://0.0.0.0:3000
🔧 Entorno: development
```

**¡Perfecto! El servidor está funcionando.**

---

## 📋 PASO 6: Configurar la MiniApp en Telegram

### 6.1 Crear la MiniApp
1. Vuelve a **@BotFather** en Telegram
2. Envía el comando: `/newapp`
3. Selecciona tu bot de la lista
4. BotFather te pedirá información:

**Título:**
```
Sala de Juegos
```

**Descripción corta:**
```
Juegos multijugador en tiempo real
```

**Descripción larga:**
```
Disfruta de juegos clásicos como Tic Tac Toe con tus amigos en tiempo real. Crea salas, invita amigos y compite. ¡Totalmente gratis!
```

**Foto (512x512 px):**
- Sube una imagen cuadrada de 512x512 píxeles
- Puede ser un logo o icono de juego

**GIF de demostración (opcional):**
- Puedes omitir esto por ahora

**URL de la Web App:**
```
http://localhost:3000
```
*(Para desarrollo local. Cuando despliegues, usarás tu dominio real)*

### 6.2 Configurar el Botón del Menú
1. Envía a BotFather: `/setmenubutton`
2. Selecciona tu bot
3. Elige: **Edit menu button URL**
4. Ingresa la URL:
   ```
   http://localhost:3000
   ```
5. Ingresa el texto del botón:
   ```
   🎮 Jugar
   ```

### 6.3 Configurar Comandos del Bot
1. Envía a BotFather: `/setcommands`
2. Selecciona tu bot
3. Envía esta lista de comandos:
```
start - Iniciar el bot
play - Abrir sala de juegos
stats - Ver estadísticas
help - Ayuda
```

---

## 📋 PASO 7: Probar la MiniApp

### 7.1 Abrir tu Bot
1. En Telegram, busca tu bot: `@mi_sala_juegos_bot`
2. Haz clic en **Iniciar** o envía `/start`

### 7.2 Abrir la MiniApp
1. Verás un botón en la parte inferior: **🎮 Jugar**
2. Haz clic en ese botón
3. Se abrirá la MiniApp dentro de Telegram

### 7.3 Probar Funcionalidades

**Crear una Sala:**
1. Haz clic en "➕ Crear Nueva Partida"
2. Se creará una sala con un código único
3. Verás la pantalla de espera

**Invitar a un Amigo:**
1. Copia el código de sala (6 caracteres)
2. Compártelo con un amigo
3. Tu amigo puede unirse con ese código

**Jugar:**
1. Cuando ambos jugadores estén en la sala
2. El juego comenzará automáticamente
3. Juega Tic Tac Toe en tiempo real

---

## 📋 PASO 8: Solución de Problemas Comunes

### ❌ Error: "Cannot connect to Redis"

**Solución:**
```powershell
# Verificar que Redis está corriendo
redis-cli ping

# Si no responde, iniciar Redis
redis-server
```

### ❌ Error: "Port 3000 already in use"

**Solución:**
```powershell
# Opción 1: Cambiar puerto en .env
# Editar .env y cambiar:
PORT=3001

# Opción 2: Matar proceso en puerto 3000
netstat -ano | findstr :3000
# Anotar el PID y ejecutar:
taskkill /PID <numero_pid> /F
```

### ❌ Error: "Module not found"

**Solución:**
```powershell
# Reinstalar dependencias
Remove-Item node_modules -Recurse -Force
Remove-Item package-lock.json -Force
npm install
```

### ❌ La MiniApp no se abre en Telegram

**Solución:**
1. Verifica que el servidor esté corriendo (`npm run dev`)
2. Verifica que la URL en BotFather sea correcta
3. Intenta cerrar y volver a abrir Telegram
4. Para desarrollo local, usa ngrok (ver siguiente sección)

---

## 📋 PASO 9: Desarrollo Local con ngrok (Opcional pero Recomendado)

Para que Telegram pueda acceder a tu servidor local, necesitas ngrok:

### 9.1 Instalar ngrok
1. Descarga desde: https://ngrok.com/download
2. Extrae el archivo
3. Crea cuenta gratis en ngrok.com
4. Copia tu authtoken

### 9.2 Configurar ngrok
```powershell
.\ngrok.exe authtoken <tu_authtoken>
```

### 9.3 Crear túnel
```powershell
.\ngrok.exe http 3000
```

Verás algo como:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:3000
```

### 9.4 Actualizar BotFather
1. Copia la URL de ngrok: `https://abc123.ngrok.io`
2. Ve a @BotFather
3. Envía `/myapps`
4. Selecciona tu app
5. Edita la URL y pon la de ngrok
6. Actualiza también el botón del menú

### 9.5 Actualizar .env
```env
FRONTEND_URL=https://abc123.ngrok.io
```

Reinicia el servidor:
```powershell
# Ctrl+C para detener
npm run dev
```

**Ahora podrás probar la MiniApp desde cualquier dispositivo con Telegram.**

---

## 📋 PASO 10: Verificar que Todo Funciona

### Checklist Final

- [ ] Redis está corriendo (`redis-cli ping` responde PONG)
- [ ] Servidor está corriendo (ves los logs en la terminal)
- [ ] Archivo `.env` tiene tu token y username correctos
- [ ] Bot configurado en @BotFather
- [ ] MiniApp configurada con URL correcta
- [ ] Botón del menú configurado
- [ ] Puedes abrir la MiniApp desde Telegram
- [ ] Puedes crear una sala
- [ ] Puedes ver el código de sala
- [ ] (Opcional) ngrok funcionando para pruebas remotas

### Probar Funcionalidades

1. **Crear Sala** ✓
2. **Copiar Código** ✓
3. **Invitar Amigo** ✓
4. **Unirse a Sala** ✓
5. **Jugar Partida** ✓
6. **Ver Resultado** ✓
7. **Jugar de Nuevo** ✓
8. **Ver Estadísticas** ✓

---

## 📋 PASO 11: Próximos Pasos

### Para Desarrollo
- Lee `ARCHITECTURE.md` para entender la estructura
- Modifica estilos en `frontend/css/`
- Agrega funcionalidades en `backend/`

### Para Producción
- Lee `DEPLOYMENT.md` para desplegar
- Opciones: Railway, Heroku, VPS
- Configura dominio propio
- Activa SSL/HTTPS

---

## 🆘 Ayuda Adicional

### Comandos Útiles

```powershell
# Ver logs del servidor
npm run dev

# Detener servidor
Ctrl + C

# Limpiar Redis (borrar todas las salas)
redis-cli FLUSHDB

# Ver salas activas en Redis
redis-cli KEYS "room:*"

# Ver estadísticas del servidor
curl http://localhost:3000/api/stats

# Health check
curl http://localhost:3000/api/health
```

### Archivos Importantes

- **`.env`** - Variables de entorno (TU TOKEN AQUÍ)
- **`backend/server.js`** - Servidor principal
- **`frontend/index.html`** - Interfaz principal
- **`package.json`** - Dependencias

### Logs y Debugging

Los logs aparecen en la terminal donde ejecutaste `npm run dev`:
- ✅ Verde = Éxito
- ⚠️ Amarillo = Advertencia
- ❌ Rojo = Error

---

## 📞 ¿Necesitas Ayuda?

Si algo no funciona:

1. **Revisa los logs** en la terminal
2. **Verifica el health check**: http://localhost:3000/api/health
3. **Consulta** `QUICKSTART.md` y `README.md`
4. **Revisa** que Redis esté corriendo
5. **Verifica** que el `.env` esté bien configurado

---

## 🎉 ¡Felicidades!

Si llegaste hasta aquí y todo funciona, **¡lo lograste!** 

Ahora tienes tu propia MiniApp de juegos funcionando en Telegram.

**Siguiente nivel:**
- Personaliza los estilos
- Agrega más juegos
- Despliega en producción
- Comparte con amigos

---

**¡Disfruta tu Sala de Juegos! 🎮✨**
