# 🎯 INSTRUCCIONES FINALES - Configurar y Probar la MiniApp

## ✅ Estado Actual del Proyecto

- ✅ Bot creado: **@wilprueba1n8nbot**
- ✅ Token configurado
- ✅ Redis funcionando
- ✅ Servidor corriendo en: **http://localhost:3000**
- ✅ Todas las dependencias instaladas

---

## 🚀 PASOS FINALES (5 minutos)

### PASO 1: Abrir Telegram Desktop

**IMPORTANTE:** Debes usar **Telegram Desktop** (no la versión web ni móvil para esta configuración inicial)

Descarga si no lo tienes: https://desktop.telegram.org/

---

### PASO 2: Configurar la MiniApp en BotFather

1. **Abrir BotFather**
   - En Telegram Desktop, busca: `@BotFather`
   - Abre el chat

2. **Crear la MiniApp**
   - Envía: `/newapp`
   - Selecciona: `@wilprueba1n8nbot`

3. **Completar información:**

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
   Disfruta de Tic Tac Toe con tus amigos en tiempo real. Crea salas, invita amigos y compite.
   ```

   **Foto (512x512):**
   - Puedes omitir esto por ahora (envía `/empty`)

   **GIF de demostración:**
   - Omitir (envía `/empty`)

   **URL de la Web App:**
   ```
   http://localhost:3000
   ```

   ✅ BotFather confirmará: "Web App created successfully!"

---

### PASO 3: Configurar el Botón del Menú

1. **Envía a BotFather:**
   ```
   /setmenubutton
   ```

2. **Selecciona:** `@wilprueba1n8nbot`

3. **Elige:** `Edit menu button URL`

4. **URL:**
   ```
   http://localhost:3000
   ```

5. **Texto del botón:**
   ```
   🎮 Jugar
   ```

---

### PASO 4: Configurar Comandos del Bot

1. **Envía a BotFather:**
   ```
   /setcommands
   ```

2. **Selecciona:** `@wilprueba1n8nbot`

3. **Copia y pega estos comandos:**
   ```
   start - Iniciar el bot
   play - Abrir sala de juegos
   stats - Ver estadísticas
   help - Ayuda
   ```

---

### PASO 5: ¡PROBAR LA MINIAPP!

1. **Buscar tu bot**
   - En Telegram Desktop, busca: `@wilprueba1n8nbot`
   - Haz clic en el bot

2. **Iniciar el bot**
   - Haz clic en **"INICIAR"** o envía `/start`

3. **Abrir la MiniApp**
   - Verás un botón en la parte inferior: **🎮 Jugar**
   - Haz clic en ese botón
   - ¡La MiniApp debería abrirse!

---

## 🎮 PRUEBAS A REALIZAR

### Prueba 1: Crear Sala
1. Haz clic en "➕ Crear Nueva Partida"
2. Deberías ver una pantalla de espera
3. Verás un código de 6 caracteres (ej: ABC123)

### Prueba 2: Copiar Código
1. Haz clic en el botón 📋 junto al código
2. Debería aparecer un mensaje: "Código copiado"

### Prueba 3: Verificar en el Servidor
Abre PowerShell y ejecuta:
```powershell
curl http://localhost:3000/api/stats
```

Deberías ver:
```json
{
  "success": true,
  "stats": {
    "totalRooms": 1,
    "publicRooms": 0,
    "activeGames": 0,
    "waitingRooms": 1,
    "totalPlayers": 1
  }
}
```

### Prueba 4: Jugar (necesitas 2 dispositivos)

**Opción A: Dos cuentas de Telegram Desktop**
1. Abre Telegram Desktop con otra cuenta
2. Busca @wilprueba1n8nbot
3. Abre la MiniApp
4. Haz clic en "🔗 Unirse con Código"
5. Ingresa el código de la sala
6. ¡Deberían poder jugar!

**Opción B: Telegram Desktop + Navegador**
1. Abre http://localhost:3000 en Chrome
2. Abre DevTools (F12)
3. Pega este código en Console:
```javascript
window.Telegram = {
  WebApp: {
    initDataUnsafe: { user: { id: 999, first_name: "Test", username: "test" } },
    expand: () => {}, enableClosingConfirmation: () => {},
    MainButton: { show: () => {}, hide: () => {}, onClick: () => {} },
    BackButton: { show: () => {}, hide: () => {}, onClick: () => {} },
    HapticFeedback: { impactOccurred: () => {}, notificationOccurred: () => {} }
  }
};
location.reload();
```
4. Únete a la sala con el código
5. ¡Juega contra ti mismo!

---

## 📊 Verificar que Todo Funciona

### Health Check
```powershell
curl http://localhost:3000/api/health
```

Debe responder:
```json
{
  "status": "ok",
  "services": {
    "redis": true,
    "telegram": true
  }
}
```

### Ver Salas Activas
```powershell
.\Redis\redis-cli.exe KEYS "room:*"
```

### Ver Logs del Servidor
En la terminal donde corre `npm run dev`, verás:
```
✅ Usuario autenticado
✅ Sala creada: ABC123
✅ Socket conectado
```

---

## 🐛 Solución de Problemas

### La MiniApp no se abre
1. Verifica que el servidor esté corriendo (`npm run dev`)
2. Verifica que Redis esté corriendo (`.\Redis\redis-cli.exe ping`)
3. Cierra y vuelve a abrir Telegram Desktop
4. Intenta con `/start` de nuevo

### Error de conexión
1. Abre http://localhost:3000 en el navegador
2. Deberías ver la interfaz del juego
3. Si no carga, revisa los logs del servidor

### No aparece el botón "🎮 Jugar"
1. Verifica que configuraste el botón del menú en BotFather
2. Cierra y vuelve a abrir el chat con el bot
3. Intenta enviar `/start` de nuevo

---

## 🎉 ¡FELICIDADES!

Si llegaste hasta aquí y todo funciona, **¡lo lograste!**

Tienes tu propia MiniApp de Telegram funcionando con:
- ✅ Juego multijugador en tiempo real
- ✅ Sistema de salas
- ✅ Sincronización instantánea
- ✅ Interfaz moderna

---

## 📱 Para Probar desde el Teléfono

Si quieres probar desde tu teléfono, necesitarás desplegar el proyecto en un servidor real.

**Opciones:**
1. **Railway** (más fácil) - Ver `DEPLOYMENT.md`
2. **Heroku** - Ver `DEPLOYMENT.md`
3. **VPS** - Ver `DEPLOYMENT.md`

---

## 📚 Documentación Disponible

- `README.md` - Documentación completa
- `QUICKSTART.md` - Inicio rápido
- `ARCHITECTURE.md` - Arquitectura del sistema
- `DEPLOYMENT.md` - Guía de despliegue
- `CONFIGURACION_BOT.md` - Configuración del bot
- `GUIA_PASO_A_PASO.md` - Guía detallada

---

## 🎯 Resumen de Comandos

```powershell
# Iniciar Redis
.\Redis\redis-server.exe

# Iniciar servidor
npm run dev

# Health check
curl http://localhost:3000/api/health

# Ver estadísticas
curl http://localhost:3000/api/stats

# Ver salas activas
.\Redis\redis-cli.exe KEYS "room:*"

# Limpiar todas las salas
.\Redis\redis-cli.exe FLUSHDB
```

---

**¡Disfruta tu Sala de Juegos! 🎮✨**
