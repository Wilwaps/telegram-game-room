# 🚀 Guía de Despliegue

Esta guía cubre el despliegue del proyecto en diferentes plataformas.

## 📋 Checklist Pre-Despliegue

- [ ] Configurar variables de entorno
- [ ] Crear bot de Telegram
- [ ] Configurar dominio (opcional)
- [ ] Configurar Redis
- [ ] Probar localmente
- [ ] Configurar SSL/HTTPS

## 🌐 Opción 1: Railway (Recomendado)

Railway es la opción más simple y rápida.

### Paso 1: Preparar el Proyecto

1. Subir código a GitHub
2. Asegurar que `.env` esté en `.gitignore`

### Paso 2: Crear Proyecto en Railway

1. Ir a [railway.app](https://railway.app)
2. Click en "New Project"
3. Seleccionar "Deploy from GitHub repo"
4. Autorizar y seleccionar tu repositorio

### Paso 3: Agregar Redis

1. Click en "+ New"
2. Seleccionar "Database" → "Redis"
3. Railway configurará automáticamente `REDIS_URL`

### Paso 4: Configurar Variables

En Settings → Variables, agregar:

```env
NODE_ENV=production
TELEGRAM_BOT_TOKEN=tu_token
TELEGRAM_BOT_USERNAME=tu_bot_username
FRONTEND_URL=${{RAILWAY_PUBLIC_DOMAIN}}
```

### Paso 5: Deploy

1. Railway desplegará automáticamente
2. Obtener URL pública en Settings
3. Configurar esta URL en @BotFather

**Costo:** Gratis hasta $5/mes de uso

---

## 🔷 Opción 2: Heroku

### Paso 1: Instalar Heroku CLI

```bash
# Windows
choco install heroku-cli

# Mac
brew tap heroku/brew && brew install heroku

# Linux
curl https://cli-assets.heroku.com/install.sh | sh
```

### Paso 2: Login y Crear App

```bash
heroku login
heroku create tu-app-name
```

### Paso 3: Agregar Redis

```bash
heroku addons:create heroku-redis:hobby-dev
```

### Paso 4: Configurar Variables

```bash
heroku config:set NODE_ENV=production
heroku config:set TELEGRAM_BOT_TOKEN=tu_token
heroku config:set TELEGRAM_BOT_USERNAME=tu_bot_username
```

### Paso 5: Deploy

```bash
git push heroku main
```

### Paso 6: Ver Logs

```bash
heroku logs --tail
```

**Costo:** Gratis con limitaciones, $7/mes para hobby tier

---

## 🖥️ Opción 3: VPS (DigitalOcean, AWS, etc.)

### Paso 1: Crear Servidor

1. Crear droplet/instancia Ubuntu 22.04
2. Configurar SSH
3. Configurar firewall (puertos 80, 443, 22)

### Paso 2: Instalar Dependencias

```bash
# Conectar al servidor
ssh root@tu-servidor-ip

# Actualizar sistema
apt update && apt upgrade -y

# Instalar Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Instalar Redis
apt install -y redis-server

# Instalar Nginx
apt install -y nginx

# Instalar PM2
npm install -g pm2

# Instalar Certbot (SSL)
apt install -y certbot python3-certbot-nginx
```

### Paso 3: Clonar y Configurar Proyecto

```bash
# Crear usuario para la app
adduser gameroom
usermod -aG sudo gameroom
su - gameroom

# Clonar proyecto
git clone <tu-repositorio>
cd telegram-game-room

# Instalar dependencias
npm install --production

# Crear archivo .env
nano .env
```

Contenido de `.env`:
```env
NODE_ENV=production
PORT=3000
REDIS_HOST=localhost
REDIS_PORT=6379
TELEGRAM_BOT_TOKEN=tu_token
TELEGRAM_BOT_USERNAME=tu_bot_username
FRONTEND_URL=https://tu-dominio.com
```

### Paso 4: Configurar PM2

```bash
# Iniciar aplicación
pm2 start backend/server.js --name telegram-game-room

# Configurar inicio automático
pm2 startup
pm2 save

# Ver logs
pm2 logs telegram-game-room
```

### Paso 5: Configurar Nginx

```bash
sudo nano /etc/nginx/sites-available/gameroom
```

Contenido:
```nginx
server {
    listen 80;
    server_name tu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Activar sitio:
```bash
sudo ln -s /etc/nginx/sites-available/gameroom /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Paso 6: Configurar SSL

```bash
sudo certbot --nginx -d tu-dominio.com
```

### Paso 7: Configurar Redis

```bash
sudo nano /etc/redis/redis.conf
```

Cambiar:
```conf
supervised systemd
maxmemory 256mb
maxmemory-policy allkeys-lru
```

Reiniciar:
```bash
sudo systemctl restart redis
```

**Costo:** Desde $5/mes (DigitalOcean)

---

## 🐳 Opción 4: Docker

### Dockerfile

Crear `Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "backend/server.js"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - TELEGRAM_BOT_USERNAME=${TELEGRAM_BOT_USERNAME}
    depends_on:
      - redis
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
    restart: unless-stopped

volumes:
  redis-data:
```

### Deploy

```bash
# Build y start
docker-compose up -d

# Ver logs
docker-compose logs -f

# Stop
docker-compose down
```

---

## 🔧 Configuración Post-Despliegue

### 1. Configurar Bot de Telegram

```
/setmenubutton
URL: https://tu-dominio.com
Texto: 🎮 Jugar
```

### 2. Configurar Webhook (Opcional)

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://tu-dominio.com/api/telegram/webhook"
```

### 3. Verificar Health Check

```bash
curl https://tu-dominio.com/api/health
```

Debe responder:
```json
{
  "status": "ok",
  "timestamp": 1234567890,
  "services": {
    "redis": true,
    "telegram": true
  }
}
```

---

## 📊 Monitoreo

### PM2 Monitoring

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### Logs

```bash
# Ver logs en tiempo real
pm2 logs

# Ver logs específicos
pm2 logs telegram-game-room

# Ver errores
pm2 logs telegram-game-room --err
```

### Métricas

```bash
# Dashboard de PM2
pm2 monit

# Estadísticas
pm2 show telegram-game-room
```

---

## 🔄 Actualización

### Railway/Heroku
```bash
git push origin main
# Deploy automático
```

### VPS
```bash
ssh gameroom@tu-servidor
cd telegram-game-room
git pull
npm install
pm2 restart telegram-game-room
```

### Docker
```bash
docker-compose pull
docker-compose up -d --build
```

---

## 🐛 Troubleshooting

### Error: Cannot connect to Redis
```bash
# Verificar que Redis esté corriendo
redis-cli ping

# Reiniciar Redis
sudo systemctl restart redis
```

### Error: Port already in use
```bash
# Encontrar proceso
lsof -i :3000

# Matar proceso
kill -9 <PID>
```

### Error: Out of memory
```bash
# Aumentar memoria de Redis
sudo nano /etc/redis/redis.conf
# maxmemory 512mb

# Reiniciar
sudo systemctl restart redis
```

### Logs no aparecen
```bash
# Verificar permisos
chmod -R 755 logs/

# Crear directorio si no existe
mkdir -p logs
```

---

## 🔐 Seguridad

### Checklist de Seguridad

- [ ] HTTPS configurado (SSL)
- [ ] Variables de entorno seguras
- [ ] Redis con contraseña
- [ ] Firewall configurado
- [ ] Rate limiting activo
- [ ] Logs monitoreados
- [ ] Backups configurados

### Configurar Firewall (UFW)

```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### Proteger Redis

```bash
sudo nano /etc/redis/redis.conf
```

Agregar:
```conf
requirepass tu_password_seguro
bind 127.0.0.1
```

Actualizar `.env`:
```env
REDIS_PASSWORD=tu_password_seguro
```

---

## 📈 Optimización

### Compresión

Ya incluido en `server.js` con `compression` middleware.

### Caché

Redis ya implementado para caché de salas.

### CDN (Opcional)

Para assets estáticos, usar Cloudflare:
1. Agregar dominio a Cloudflare
2. Configurar DNS
3. Activar caché automático

---

## 💾 Backups

### Backup de Redis

```bash
# Manual
redis-cli SAVE

# Automático (cron)
crontab -e
```

Agregar:
```cron
0 2 * * * redis-cli SAVE && cp /var/lib/redis/dump.rdb /backups/redis-$(date +\%Y\%m\%d).rdb
```

### Backup de Código

```bash
# Git
git push origin main

# Archivo
tar -czf backup-$(date +%Y%m%d).tar.gz telegram-game-room/
```

---

## 📞 Soporte

Si encuentras problemas:
1. Revisa los logs: `pm2 logs`
2. Verifica health check: `/api/health`
3. Consulta la documentación
4. Abre un issue en GitHub

---

**¡Listo para producción!** 🚀
