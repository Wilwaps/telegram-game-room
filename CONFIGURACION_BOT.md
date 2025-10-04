# 🤖 Configuración del Bot en Telegram

## ✅ Estado Actual del Proyecto

- ✅ Bot creado: @wilprueba1n8nbot
- ✅ Token configurado: 7734154282:AAHuk7rYVV2RI9HmfEPoVVv3E7aM6Jvma0w
- ✅ Redis funcionando
- ✅ Servidor activo en: http://localhost:3000

---

## 📋 PASO 6: Configurar MiniApp en BotFather

### 1. Abrir BotFather
1. Abre Telegram
2. Busca: **@BotFather**
3. Abre el chat

### 2. Crear la MiniApp
Envía este comando:
```
/newapp
```

Luego selecciona tu bot: **@wilprueba1n8nbot**

### 3. Información de la App

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
- Necesitas subir una imagen cuadrada
- Puede ser un logo o icono de juego
- Por ahora puedes omitir esto

**URL de la Web App:**
```
http://localhost:3000
```

⚠️ **IMPORTANTE:** Esta URL solo funcionará en tu computadora. Para que funcione desde tu teléfono, necesitarás usar ngrok (ver más abajo).

---

## 📋 PASO 7: Configurar Botón del Menú

### 1. Configurar el botón
Envía a BotFather:
```
/setmenubutton
```

Selecciona: **@wilprueba1n8nbot**

### 2. Editar URL del botón
Elige: **Edit menu button URL**

URL:
```
http://localhost:3000
```

### 3. Texto del botón
```
🎮 Jugar
```

---

## 📋 PASO 8: Configurar Comandos

Envía a BotFather:
```
/setcommands
```

Selecciona: **@wilprueba1n8nbot**

Copia y pega estos comandos:
```
start - Iniciar el bot
play - Abrir sala de juegos
stats - Ver estadísticas
help - Ayuda
```

---

## 🌐 PASO 9: Usar ngrok (Para probar desde el teléfono)

### ¿Por qué ngrok?
`localhost:3000` solo funciona en tu computadora. Para probar desde tu teléfono, necesitas exponer tu servidor a internet temporalmente.

### 1. Descargar ngrok
1. Ve a: https://ngrok.com/download
2. Descarga la versión para Windows
3. Extrae el archivo `ngrok.exe`

### 2. Crear cuenta (gratis)
1. Registrate en: https://dashboard.ngrok.com/signup
2. Copia tu authtoken

### 3. Configurar ngrok
Abre PowerShell donde está ngrok.exe:
```powershell
.\ngrok.exe authtoken <tu_authtoken>
```

### 4. Iniciar túnel
```powershell
.\ngrok.exe http 3000
```

Verás algo como:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:3000
```

### 5. Actualizar BotFather
1. Copia la URL de ngrok: `https://abc123.ngrok.io`
2. Ve a @BotFather
3. Envía `/myapps`
4. Selecciona tu app
5. Edita la URL y pon la de ngrok
6. Actualiza también el botón del menú con la URL de ngrok

### 6. Actualizar .env
Edita el archivo `.env`:
```env
FRONTEND_URL=https://abc123.ngrok.io
```

Reinicia el servidor:
- Presiona `Ctrl+C` en la terminal del servidor
- Ejecuta: `npm run dev`

---

## 🧪 PASO 10: Probar la MiniApp

### Desde tu Computadora (sin ngrok)
1. Abre Telegram Desktop
2. Busca: @wilprueba1n8nbot
3. Haz clic en "Iniciar"
4. Haz clic en el botón "🎮 Jugar"
5. Debería abrir la MiniApp

### Desde tu Teléfono (con ngrok)
1. Asegúrate que ngrok está corriendo
2. Asegúrate que actualizaste la URL en BotFather
3. Abre Telegram en tu teléfono
4. Busca: @wilprueba1n8nbot
5. Haz clic en "Iniciar"
6. Haz clic en el botón "🎮 Jugar"

---

## ✅ Checklist de Verificación

- [ ] Bot creado en @BotFather
- [ ] Token configurado en .env
- [ ] Redis corriendo
- [ ] Servidor corriendo (npm run dev)
- [ ] MiniApp creada en @BotFather
- [ ] URL configurada en BotFather
- [ ] Botón del menú configurado
- [ ] Comandos configurados
- [ ] (Opcional) ngrok configurado
- [ ] Puedes abrir la MiniApp desde Telegram

---

## 🎮 Funcionalidades para Probar

1. **Crear Sala**
   - Haz clic en "➕ Crear Nueva Partida"
   - Verifica que se crea un código de 6 caracteres

2. **Copiar Código**
   - Haz clic en el botón de copiar (📋)
   - Verifica que se copia al portapapeles

3. **Invitar Amigos**
   - Haz clic en "📤 Invitar Amigos"
   - Verifica que se abre el diálogo de compartir

4. **Jugar** (necesitas 2 dispositivos o 2 cuentas)
   - Crea sala en dispositivo 1
   - Únete con código en dispositivo 2
   - Juega Tic Tac Toe
   - Verifica que los movimientos se sincronizan

---

## 🐛 Solución de Problemas

### La MiniApp no se abre
- Verifica que el servidor esté corriendo
- Verifica que la URL en BotFather sea correcta
- Intenta cerrar y volver a abrir Telegram
- Verifica los logs del servidor

### Error de conexión
- Verifica que Redis esté corriendo
- Verifica que el puerto 3000 no esté ocupado
- Revisa los logs del servidor

### No se sincronizan los movimientos
- Verifica que Socket.io esté funcionando
- Abre la consola del navegador (F12) y busca errores
- Verifica que ambos jugadores estén conectados

---

## 📞 Comandos Útiles

```powershell
# Ver si Redis está corriendo
.\Redis\redis-cli.exe ping

# Ver salas activas
.\Redis\redis-cli.exe KEYS "room:*"

# Limpiar todas las salas
.\Redis\redis-cli.exe FLUSHDB

# Health check del servidor
curl http://localhost:3000/api/health

# Ver estadísticas
curl http://localhost:3000/api/stats
```

---

## 🎉 ¡Listo!

Si todo funciona correctamente, ¡felicidades! Tienes tu propia MiniApp de juegos funcionando en Telegram.

**Siguiente paso:** Personaliza los estilos, agrega más juegos, o despliega en producción.
