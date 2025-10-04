# 🌐 Configuración de ngrok

## ✅ Estado Actual

- ✅ ngrok v3.30.0 instalado en: `telegram-game-room\ngrok\`
- ⏳ Esperando authtoken

---

## 📋 Pasos para Obtener el Authtoken

### 1. Registrarse en ngrok
La página ya se abrió en tu navegador: https://dashboard.ngrok.com/signup

**Opciones de registro:**
- Google (recomendado - más rápido)
- GitHub
- Email

### 2. Obtener el Authtoken

Después de registrarte, verás tu dashboard con:

```
Your Authtoken
2abc123def456ghi789jkl0
```

**Copia ese token** (es único para tu cuenta)

### 3. Configurar ngrok

Una vez que tengas el authtoken, ejecuta:

```powershell
.\ngrok\ngrok.exe config add-authtoken TU_AUTHTOKEN_AQUI
```

Ejemplo:
```powershell
.\ngrok\ngrok.exe config add-authtoken 2abc123def456ghi789jkl0
```

### 4. Iniciar el Túnel

```powershell
.\ngrok\ngrok.exe http 3000
```

Verás algo como:
```
ngrok

Session Status                online
Account                       tu_email@gmail.com
Version                       3.30.0
Region                        United States (us)
Latency                       45ms
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123.ngrok-free.app -> http://localhost:3000

Connections                   ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

**IMPORTANTE:** Copia la URL de "Forwarding": `https://abc123.ngrok-free.app`

---

## 🔧 Configurar el Proyecto con ngrok

### 1. Actualizar .env

Edita el archivo `.env` y cambia:

```env
FRONTEND_URL=https://abc123.ngrok-free.app
```

(Reemplaza con tu URL real de ngrok)

### 2. Reiniciar el Servidor

En la terminal donde corre el servidor:
- Presiona `Ctrl+C` para detener
- Ejecuta: `npm run dev`

---

## 📱 Actualizar BotFather

### 1. Ir a @BotFather en Telegram

### 2. Actualizar la MiniApp
```
/myapps
```
- Selecciona tu app
- Edit Web App URL
- Pega: `https://abc123.ngrok-free.app`

### 3. Actualizar el Botón del Menú
```
/setmenubutton
```
- Selecciona tu bot
- Edit menu button URL
- Pega: `https://abc123.ngrok-free.app`

---

## ✅ Verificar que Funciona

### 1. Desde tu Teléfono
1. Abre Telegram en tu teléfono
2. Busca: @wilprueba1n8nbot
3. Haz clic en "🎮 Jugar"
4. Debería abrir la MiniApp

### 2. Verificar Conexiones
En la terminal de ngrok verás las conexiones en tiempo real:
```
GET /                          200 OK
GET /css/variables.css         200 OK
GET /js/app.js                 200 OK
```

---

## 🐛 Solución de Problemas

### Error: "Invalid authtoken"
- Verifica que copiaste el token completo
- No debe tener espacios al inicio o final
- Vuelve a ejecutar el comando de configuración

### Error: "Failed to start tunnel"
- Verifica que el puerto 3000 esté libre
- Asegúrate que el servidor esté corriendo
- Intenta con otro puerto: `.\ngrok\ngrok.exe http 3001`

### La MiniApp no carga
- Verifica que ngrok esté corriendo
- Verifica que actualizaste la URL en BotFather
- Verifica que el servidor esté corriendo
- Revisa los logs de ngrok para ver si llegan requests

---

## 📊 Comandos Útiles

```powershell
# Ver versión de ngrok
.\ngrok\ngrok.exe version

# Configurar authtoken
.\ngrok\ngrok.exe config add-authtoken TU_TOKEN

# Iniciar túnel en puerto 3000
.\ngrok\ngrok.exe http 3000

# Iniciar túnel en otro puerto
.\ngrok\ngrok.exe http 3001

# Ver configuración actual
.\ngrok\ngrok.exe config check
```

---

## 💡 Notas Importantes

1. **La URL de ngrok cambia cada vez** que lo reinicias (en la versión gratuita)
2. **Debes actualizar BotFather** cada vez que cambies la URL
3. **ngrok debe estar corriendo** mientras pruebes la app
4. **El plan gratuito** tiene límites pero es suficiente para desarrollo

---

## 🎯 Siguiente Paso

Una vez configurado ngrok:
1. ✅ Túnel activo
2. ✅ URL copiada
3. ✅ .env actualizado
4. ✅ Servidor reiniciado
5. ✅ BotFather actualizado
6. ✅ Probar desde el teléfono

**¡Listo para probar la MiniApp desde cualquier dispositivo!** 🎉
