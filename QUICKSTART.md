# 🚀 Guía de Inicio Rápido

Esta guía te ayudará a poner en marcha el proyecto en **5 minutos**.

## ⚡ Inicio Rápido

### 1. Instalar Dependencias

```bash
cd telegram-game-room
npm install
```

### 2. Configurar Variables de Entorno

Copia el archivo de ejemplo:
```bash
cp .env.example .env
```

Edita `.env` con tus datos:
```env
NODE_ENV=development
PORT=3000
TELEGRAM_BOT_TOKEN=7734154282:AAHuk7rYVV2RI9HmfEPoVVv3E7aM6Jvma0w
TELEGRAM_BOT_USERNAME=tu_bot_username
```

### 3. Iniciar Redis

**Windows:**
```powershell
# Si tienes Redis instalado
redis-server

# Si no, instalar con Chocolatey
choco install redis-64
redis-server
```

**Linux/Mac:**
```bash
redis-server
```

### 4. Iniciar el Servidor

```bash
# Modo desarrollo (con auto-reload)
npm run dev

# O modo producción
npm start
```

¡Listo! El servidor estará en `http://localhost:3000`

## 🔧 Configuración del Bot de Telegram

### Paso 1: Crear Bot
1. Abre [@BotFather](https://t.me/botfather)
2. Envía `/newbot`
3. Sigue las instrucciones
4. Copia el token y pégalo en `.env`

### Paso 2: Configurar MiniApp
```
/newapp
```
- Selecciona tu bot
- Nombre: **Sala de Juegos**
- URL: `http://localhost:3000` (desarrollo) o tu dominio
- Sube un icono 512x512px

### Paso 3: Probar
1. Abre tu bot en Telegram
2. Haz clic en el botón del menú
3. ¡Juega!

## 📝 Comandos Útiles

```bash
# Desarrollo con auto-reload
npm run dev

# Producción
npm start

# Ver logs
npm run logs

# Limpiar Redis (desarrollo)
redis-cli FLUSHDB
```

## 🐛 Solución de Problemas

### Redis no conecta
```bash
# Verificar que Redis esté corriendo
redis-cli ping
# Debe responder: PONG
```

### Puerto ocupado
Cambia el puerto en `.env`:
```env
PORT=3001
```

### Error de módulos
```bash
# Reinstalar dependencias
rm -rf node_modules package-lock.json
npm install
```

## 🎮 Probar sin Telegram

Para desarrollo local sin Telegram, la app usará datos de prueba automáticamente.

## 📚 Siguiente Paso

Lee el [README.md](README.md) completo para más información sobre:
- Arquitectura del proyecto
- Despliegue en producción
- Agregar nuevos juegos
- Contribuir al proyecto

---

**¿Problemas?** Abre un issue en GitHub o contacta al equipo.
