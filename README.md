# 🎮 Sala de Juegos - Telegram MiniApp

MiniApp de Telegram para juegos multijugador en tiempo real. Actualmente incluye **Tic Tac Toe** con arquitectura escalable para agregar más juegos.

## 📋 Características

### ✨ Funcionalidades Principales
- 🎯 **Juego en Tiempo Real** - Partidas multijugador con Socket.io
- 🏠 **Sistema de Salas** - Crear salas públicas o privadas
- 🔗 **Invitaciones** - Compartir código de sala o invitar por Telegram
- 📊 **Estadísticas** - Seguimiento de victorias, derrotas y empates
- 🎨 **UI Moderna** - Interfaz adaptada al tema de Telegram
- 📱 **Responsive** - Funciona en todos los dispositivos
- ⚡ **Tiempo Real** - Sincronización instantánea entre jugadores

### 🎮 Juegos Disponibles
- **Tic Tac Toe** - Clásico 3 en raya multijugador

## 🛠️ Stack Tecnológico

### Backend
- **Node.js** v16+ - Runtime de JavaScript
- **Express.js** - Framework web
- **Socket.io** - Comunicación en tiempo real
- **Redis** - Base de datos en memoria
- **ioredis** - Cliente de Redis
- **Winston** - Sistema de logging

### Frontend
- **HTML5** - Estructura
- **CSS3** - Estilos con variables CSS
- **JavaScript** (Vanilla) - Lógica del cliente
- **Socket.io Client** - Cliente WebSocket
- **Telegram WebApp SDK** - Integración con Telegram

## 📦 Instalación

### Prerrequisitos
- Node.js v16 o superior
- Redis v6 o superior
- npm o yarn
- Bot de Telegram (obtener token de @BotFather)

### 1. Clonar el repositorio
```bash
git clone <url-del-repositorio>
cd telegram-game-room
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
```bash
cp .env.example .env
```

Editar `.env` con tus configuraciones:
```env
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:3000

REDIS_HOST=localhost
REDIS_PORT=6379

TELEGRAM_BOT_TOKEN=tu_token_aqui
TELEGRAM_BOT_USERNAME=tu_bot_username
```

### 4. Iniciar Redis
```bash
# Windows (con Chocolatey)
redis-server

# Linux/Mac
redis-server
```

### 5. Iniciar el servidor
```bash
# Desarrollo
npm run dev

# Producción
npm start
```

El servidor estará disponible en `http://localhost:3000`

## 🚀 Despliegue

### Opción 1: Railway (Recomendado)
1. Crear cuenta en [Railway.app](https://railway.app)
2. Conectar repositorio de GitHub
3. Agregar servicio Redis
4. Configurar variables de entorno
5. Deploy automático

### Opción 2: Heroku
```bash
# Instalar Heroku CLI
heroku login
heroku create tu-app-name

# Agregar Redis
heroku addons:create heroku-redis:hobby-dev

# Configurar variables
heroku config:set TELEGRAM_BOT_TOKEN=tu_token
heroku config:set NODE_ENV=production

# Deploy
git push heroku main
```

### Opción 3: VPS (DigitalOcean, AWS, etc.)
```bash
# Conectar al servidor
ssh user@tu-servidor

# Instalar Node.js y Redis
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs redis-server

# Clonar y configurar
git clone <url-del-repositorio>
cd telegram-game-room
npm install
npm run build

# Usar PM2 para gestión de procesos
npm install -g pm2
pm2 start backend/server.js --name telegram-game-room
pm2 save
pm2 startup
```

## 📱 Configurar Bot de Telegram

### 1. Crear Bot
1. Abrir [@BotFather](https://t.me/botfather) en Telegram
2. Enviar `/newbot`
3. Seguir instrucciones
4. Guardar el token

### 2. Configurar MiniApp
```
/newapp
- Seleccionar tu bot
- Nombre: Sala de Juegos
- Descripción: Juegos multijugador en tiempo real
- URL: https://tu-dominio.com
- Subir icono (512x512 px)
```

### 3. Configurar Comandos
```
/setcommands
start - Iniciar el bot
play - Abrir sala de juegos
stats - Ver estadísticas
help - Ayuda
```

### 4. Configurar Botón de Menú
```
/setmenubutton
- URL: https://tu-dominio.com
- Texto: 🎮 Jugar
```

## 🏗️ Estructura del Proyecto

```
telegram-game-room/
├── backend/
│   ├── config/
│   │   ├── config.js          # Configuración central
│   │   └── logger.js          # Sistema de logging
│   ├── models/
│   │   ├── Room.js            # Modelo de sala
│   │   └── User.js            # Modelo de usuario
│   ├── services/
│   │   ├── redisService.js    # Servicio de Redis
│   │   ├── socketService.js   # Servicio de Socket.io
│   │   └── telegramService.js # Servicio de Telegram Bot
│   ├── utils/
│   │   ├── gameLogic.js       # Lógica del juego
│   │   └── validation.js      # Validaciones
│   └── server.js              # Servidor principal
├── frontend/
│   ├── css/
│   │   ├── variables.css      # Variables CSS
│   │   ├── main.css           # Estilos principales
│   │   ├── lobby.css          # Estilos del lobby
│   │   ├── game.css           # Estilos del juego
│   │   └── animations.css     # Animaciones
│   ├── js/
│   │   ├── config.js          # Configuración
│   │   ├── utils.js           # Utilidades
│   │   ├── telegram.js        # Integración Telegram
│   │   ├── socket-client.js   # Cliente Socket.io
│   │   ├── ui.js              # Gestión de UI
│   │   ├── lobby.js           # Lógica del lobby
│   │   ├── game.js            # Lógica del juego
│   │   └── app.js             # Aplicación principal
│   └── index.html             # Página principal
├── .env.example               # Ejemplo de variables
├── .gitignore                 # Archivos ignorados
├── package.json               # Dependencias
└── README.md                  # Este archivo
```

## 🎯 Uso

### Para Usuarios

1. **Abrir el bot** en Telegram
2. **Crear nueva partida** o unirse a una existente
3. **Invitar amigos** compartiendo el código
4. **Jugar** y disfrutar

### Para Desarrolladores

#### Agregar un nuevo juego
1. Crear lógica del juego en `backend/utils/`
2. Agregar tipo de juego en `config.js`
3. Crear componentes de UI en `frontend/`
4. Registrar eventos en `socketService.js`

#### Ejecutar tests
```bash
npm test
```

#### Linting
```bash
npm run lint
npm run lint:fix
```

#### Formatear código
```bash
npm run format
```

## 🔧 Configuración Avanzada

### Rate Limiting
Editar en `.env`:
```env
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### Timeouts
```env
TURN_TIMEOUT=30
EMPTY_ROOM_TIMEOUT=60
```

### Redis
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
ROOM_EXPIRY=3600
```

## 📊 Monitoreo

### Logs
Los logs se guardan en `logs/app.log`

### Estadísticas del servidor
```bash
curl http://localhost:3000/api/stats
```

### Health check
```bash
curl http://localhost:3000/api/health
```

## 🐛 Troubleshooting

### Error: Redis connection failed
```bash
# Verificar que Redis esté corriendo
redis-cli ping
# Debe responder: PONG
```

### Error: Port already in use
```bash
# Cambiar puerto en .env
PORT=3001
```

### Error: Telegram WebApp not available
- Verificar que la app se abra desde Telegram
- En desarrollo, usar datos de prueba

## 🤝 Contribuir

1. Fork el proyecto
2. Crear rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abrir Pull Request

## 📝 Licencia

MIT License - ver archivo `LICENSE` para más detalles

## 👥 Autores

- Tu Nombre - Desarrollo inicial

## 🙏 Agradecimientos

- Telegram por la plataforma de MiniApps
- Socket.io por la comunicación en tiempo real
- Comunidad de código abierto

## 📞 Soporte

- 📧 Email: tu-email@ejemplo.com
- 💬 Telegram: @tu_usuario
- 🐛 Issues: [GitHub Issues](https://github.com/tu-usuario/telegram-game-room/issues)

## 🗺️ Roadmap

- [ ] Agregar más juegos (Connect 4, Damas)
- [ ] Sistema de torneos
- [ ] Ranking global
- [ ] Logros y badges
- [ ] Modo vs IA
- [ ] Chat en tiempo real
- [ ] Replay de partidas
- [ ] Temas personalizables

---

**¡Hecho con ❤️ para la comunidad de Telegram!**
