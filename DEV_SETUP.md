# Guía de Configuración para Desarrollo Local

## Separación de Entornos

### Producción (Railway)
- **Bot:** `@xyz3w_bot`
- **Rama:** `main`
- **Usuarios:** Reales
- **Deploy:** Automático al hacer push a `main`

### Desarrollo (Local)
- **Bot:** Bot de prueba (configurar en `.env.local`)
- **Rama:** `develop` o `feature/*`
- **Usuarios:** Testing
- **Deploy:** Manual, solo local

---

## Requisitos Previos

- Node.js >= 16.0.0
- npm >= 8.0.0
- Docker Desktop (para Redis)
- Git

---

## Configuración Inicial

### 1. Clonar el repositorio
```bash
git clone https://github.com/Wilwaps/telegram-game-room.git
cd telegram-game-room
```

### 2. Cambiar a rama develop
```bash
git checkout develop
```

### 3. Instalar dependencias
```bash
npm install
```

### 4. Configurar variables de entorno
```bash
# Copiar template
cp .env.local.example .env.local

# Editar .env.local con tus valores
# IMPORTANTE: Usar bot de PRUEBA, NO el de producción
```

**Configuración mínima en `.env.local`:**
```env
NODE_ENV=development
PORT=3000

REDIS_HOST=localhost
REDIS_PORT=6379

# Bot de PRUEBA (NO usar @xyz3w_bot)
TELEGRAM_BOT_TOKEN=tu_bot_de_prueba_token
TELEGRAM_BOT_USERNAME=tu_bot_de_prueba_username

ADMIN_USERNAME=Wilcnct
FRONTEND_URL=http://localhost:3000
```

### 5. Iniciar Redis con Docker
```bash
npm run docker:up
```

Verificar que Redis esté corriendo:
```bash
npm run docker:logs
```

### 6. Iniciar servidor de desarrollo
```bash
npm run dev:watch
```

El servidor estará disponible en `http://localhost:3000`

---

## Desarrollo Frontend

### Opción 1: Live Server (VS Code)
1. Instalar extensión "Live Server"
2. Click derecho en `frontend/index.html`
3. Seleccionar "Open with Live Server"
4. Se abrirá en `http://127.0.0.1:5500/frontend/`

### Opción 2: http-server
```bash
npm install -g http-server
cd frontend
http-server -p 8080
```

---

## Testing con Telegram

### Opción 1: ngrok (Recomendado)
```bash
# Instalar ngrok
npm install -g ngrok

# Exponer puerto 3000
ngrok http 3000

# Copiar URL HTTPS (ej: https://abc123.ngrok.io)
# Configurar en BotFather:
# /setdomain → tu_bot → https://abc123.ngrok.io
```

### Opción 2: Telegram Web
- Abrir https://web.telegram.org
- Buscar tu bot de prueba
- Iniciar conversación
- Click en "Open WebApp" o usar comando `/start`

---

## Workflow de Desarrollo

### 1. Crear feature branch
```bash
git checkout develop
git pull origin develop
git checkout -b feature/nombre-feature
```

### 2. Desarrollar y testear localmente
```bash
# Terminal 1: Redis
npm run docker:up

# Terminal 2: Backend
npm run dev:watch

# Terminal 3: Frontend (opcional)
# Live Server o http-server
```

### 3. Commit y push a feature branch
```bash
git add .
git commit -m "feat: descripción del cambio"
git push origin feature/nombre-feature
```

### 4. Merge a develop cuando esté estable
```bash
git checkout develop
git merge feature/nombre-feature
git push origin develop
```

### 5. Merge a main SOLO cuando esté 100% testeado
```bash
git checkout main
git merge develop
git push origin main  # Esto dispara deploy en Railway
```

---

## Comandos Útiles

### Docker (Redis)
```bash
npm run docker:up      # Iniciar Redis
npm run docker:down    # Detener Redis
npm run docker:logs    # Ver logs de Redis
```

### Desarrollo
```bash
npm run dev            # Iniciar servidor (sin watch)
npm run dev:watch      # Iniciar con auto-reload
```

### Testing
```bash
npm test               # Ejecutar tests
npm run test:watch     # Tests en modo watch
```

### Linting y formato
```bash
npm run lint           # Verificar código
npm run lint:fix       # Corregir automáticamente
npm run format         # Formatear código
```

---

## Estructura de Ramas

```
main (producción)
  └── develop (integración)
       ├── feature/bingo
       ├── feature/timer
       └── feature/nueva-funcionalidad
```

### Reglas
- **main**: Solo código estable y testeado
- **develop**: Integración de features
- **feature/***: Desarrollo de features específicas

---

## Debugging

### Ver logs del servidor
```bash
# Los logs se muestran en consola con npm run dev:watch
```

### Ver datos en Redis
```bash
# Conectar a Redis CLI
docker exec -it telegram-game-redis-dev redis-cli

# Comandos útiles:
KEYS *                    # Ver todas las keys
GET room:ABC123           # Ver sala específica
HGETALL stats:userId      # Ver estadísticas de usuario
FLUSHDB                   # Limpiar base de datos (CUIDADO)
```

### Verificar conexión a Telegram
1. Abrir `http://localhost:3000` en navegador
2. Debería ver mensaje de error (normal, necesita Telegram)
3. Usar ngrok para exponer y probar con bot real

---

## Troubleshooting

### Redis no inicia
```bash
# Verificar que Docker esté corriendo
docker ps

# Reiniciar Redis
npm run docker:down
npm run docker:up
```

### Puerto 3000 ocupado
```bash
# Cambiar puerto en .env.local
PORT=3001

# O matar proceso en puerto 3000 (Windows)
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Bot no responde
- Verificar que ngrok esté corriendo
- Verificar token del bot en `.env.local`
- Verificar que el webhook esté configurado en BotFather

---

## Notas Importantes

⚠️ **NUNCA** usar el bot de producción (`@xyz3w_bot`) en desarrollo local

⚠️ **NUNCA** hacer push directo a `main`, siempre pasar por `develop`

⚠️ **SIEMPRE** testear localmente antes de merge a `develop`

✅ Usar `.env.local` para configuración local (no commitear)

✅ Mantener `develop` sincronizado con `main` regularmente

---

## Recursos

- [Documentación de Telegram MiniApps](https://core.telegram.org/bots/webapps)
- [Socket.io Docs](https://socket.io/docs/v4/)
- [Redis Commands](https://redis.io/commands/)
- [ngrok Docs](https://ngrok.com/docs)
