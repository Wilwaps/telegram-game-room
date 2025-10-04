# 🌐 Solución: Obtener URL Pública para Telegram

## ⚠️ Problema
Telegram requiere una URL pública con HTTPS para las MiniApps. No acepta `localhost` ni `127.0.0.1`.

## ✅ SOLUCIÓN MÁS SIMPLE: Desplegar en Railway (5 minutos)

Railway es **GRATIS** y te da una URL pública automáticamente.

### PASO 1: Preparar el Proyecto para Git

```powershell
# Inicializar git (si no está inicializado)
git init

# Agregar todos los archivos
git add .

# Hacer commit
git commit -m "Initial commit - Telegram Game Room"
```

### PASO 2: Subir a GitHub

1. **Crear repositorio en GitHub:**
   - Ve a: https://github.com/new
   - Nombre: `telegram-game-room`
   - Público o Privado (tu eliges)
   - NO inicialices con README
   - Click en "Create repository"

2. **Conectar y subir:**
   ```powershell
   git remote add origin https://github.com/TU_USUARIO/telegram-game-room.git
   git branch -M main
   git push -u origin main
   ```

### PASO 3: Desplegar en Railway

1. **Ir a Railway:**
   - Abre: https://railway.app/
   - Click en "Start a New Project"
   - Login con GitHub

2. **Deploy from GitHub:**
   - Click en "Deploy from GitHub repo"
   - Selecciona: `telegram-game-room`
   - Railway detectará automáticamente que es Node.js

3. **Agregar Redis:**
   - Click en "+ New"
   - Selecciona "Database" → "Redis"
   - Railway lo conectará automáticamente

4. **Configurar Variables:**
   - Click en tu proyecto
   - Ve a "Variables"
   - Agrega:
     ```
     TELEGRAM_BOT_TOKEN=7734154282:AAHuk7rYVV2RI9HmfEPoVVv3E7aM6Jvma0w
     TELEGRAM_BOT_USERNAME=wilprueba1n8nbot
     NODE_ENV=production
     ```

5. **Obtener URL Pública:**
   - Ve a "Settings" → "Networking"
   - Click en "Generate Domain"
   - Copia la URL (ej: `https://telegram-game-room-production.up.railway.app`)

### PASO 4: Actualizar BotFather

1. Ve a @BotFather en Telegram
2. Envía: `/myapps`
3. Selecciona tu app
4. Edit Web App URL
5. Pega la URL de Railway
6. También actualiza el botón del menú con `/setmenubutton`

### PASO 5: ¡Probar!

Ahora tu MiniApp funcionará desde cualquier dispositivo con Telegram.

---

## 🚀 ALTERNATIVA RÁPIDA: Usar Render (También Gratis)

### PASO 1: Ir a Render
- https://render.com/
- Sign up con GitHub

### PASO 2: New Web Service
- Click en "New +"
- Selecciona "Web Service"
- Conecta tu repositorio de GitHub

### PASO 3: Configurar
- Name: `telegram-game-room`
- Environment: `Node`
- Build Command: `npm install`
- Start Command: `npm start`

### PASO 4: Variables de Entorno
Agrega las mismas variables que en Railway

### PASO 5: Deploy
Render te dará una URL como: `https://telegram-game-room.onrender.com`

---

## ⚡ ALTERNATIVA ULTRA-RÁPIDA: Usar Glitch (Sin Git)

### PASO 1: Ir a Glitch
- https://glitch.com/
- Click en "New Project" → "glitch-hello-node"

### PASO 2: Subir Archivos
- Click en "Tools" → "Import from GitHub"
- O arrastra tus archivos

### PASO 3: Configurar .env
- Click en ".env" en el panel izquierdo
- Agrega tus variables

### PASO 4: Obtener URL
- Tu proyecto tendrá una URL como: `https://tu-proyecto.glitch.me`

---

## 📊 Comparación de Opciones

| Servicio | Velocidad | Gratis | Estabilidad | Recomendado |
|----------|-----------|--------|-------------|-------------|
| Railway  | ⚡⚡⚡    | ✅ Sí  | ⭐⭐⭐⭐⭐  | ✅ **SÍ**   |
| Render   | ⚡⚡      | ✅ Sí  | ⭐⭐⭐⭐    | ✅ Sí       |
| Glitch   | ⚡        | ✅ Sí  | ⭐⭐⭐      | Para pruebas |

---

## 🎯 MI RECOMENDACIÓN

**USA RAILWAY** porque:
- ✅ Más rápido de configurar
- ✅ Redis incluido gratis
- ✅ Deploy automático desde GitHub
- ✅ URL pública con HTTPS
- ✅ Logs en tiempo real
- ✅ $5 de crédito gratis al mes

---

## 📋 Checklist para Railway

- [ ] Proyecto subido a GitHub
- [ ] Cuenta creada en Railway
- [ ] Proyecto desplegado
- [ ] Redis agregado
- [ ] Variables configuradas
- [ ] URL pública obtenida
- [ ] BotFather actualizado
- [ ] MiniApp probada

---

## 🆘 Si Necesitas Ayuda

1. **Subir a GitHub:**
   ```powershell
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/TU_USUARIO/telegram-game-room.git
   git push -u origin main
   ```

2. **Railway:** https://railway.app/
3. **Documentación:** Ver `DEPLOYMENT.md`

---

## ⏱️ Tiempo Estimado

- Railway: **5-10 minutos**
- Render: **10-15 minutos**
- Glitch: **5 minutos** (pero menos estable)

---

**¿Quieres que te ayude a desplegar en Railway paso a paso?** 🚀
