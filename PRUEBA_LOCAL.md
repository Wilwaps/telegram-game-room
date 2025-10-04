# 🧪 Guía de Prueba Local - Sin Túnel

## ⚠️ Problema con ngrok
Tu IP está bloqueada por ngrok. Pero **no te preocupes**, hay formas más simples de probar la MiniApp.

---

## ✅ OPCIÓN 1: Probar desde Telegram Desktop (MÁS SIMPLE)

### Ventajas:
- ✅ No necesitas túnel
- ✅ Funciona con `localhost:3000`
- ✅ Ideal para desarrollo

### Pasos:

1. **Asegúrate que el servidor esté corriendo**
   ```powershell
   # Debería estar corriendo desde antes
   # Si no, ejecuta: npm run dev
   ```

2. **Configurar BotFather con localhost**
   - Abre Telegram Desktop (no móvil)
   - Ve a @BotFather
   - Envía: `/newapp`
   - Selecciona: @wilprueba1n8nbot
   - Completa la información:
     - Título: `Sala de Juegos`
     - Descripción corta: `Juegos multijugador`
     - URL: `http://localhost:3000`

3. **Configurar botón del menú**
   - Envía: `/setmenubutton`
   - Selecciona: @wilprueba1n8nbot
   - URL: `http://localhost:3000`
   - Texto: `🎮 Jugar`

4. **Probar**
   - En Telegram Desktop, busca: @wilprueba1n8nbot
   - Haz clic en "🎮 Jugar"
   - ¡Debería funcionar!

---

## ✅ OPCIÓN 2: Usar Cloudflare Tunnel (GRATIS y SIN RESTRICCIONES)

### Ventajas:
- ✅ Gratis y sin límites
- ✅ No requiere cuenta
- ✅ Funciona desde cualquier dispositivo
- ✅ URL estable

### Instalación:

1. **Descargar Cloudflare Tunnel**
   ```powershell
   Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile "cloudflared.exe"
   ```

2. **Iniciar túnel**
   ```powershell
   .\cloudflared.exe tunnel --url http://localhost:3000
   ```

3. **Copiar la URL**
   Verás algo como:
   ```
   Your quick Tunnel has been created! Visit it at:
   https://abc-def-123.trycloudflare.com
   ```

4. **Actualizar BotFather**
   - Usa esa URL en lugar de localhost
   - Actualiza la MiniApp y el botón del menú

---

## ✅ OPCIÓN 3: Probar Directamente en el Navegador

### Para desarrollo rápido:

1. **Abrir en el navegador**
   ```
   http://localhost:3000
   ```

2. **Simular Telegram WebApp**
   - Abre las DevTools (F12)
   - Ve a Console
   - Ejecuta:
   ```javascript
   window.Telegram = {
     WebApp: {
       initDataUnsafe: {
         user: {
           id: 123456,
           first_name: "Test",
           username: "testuser"
         }
       },
       expand: () => {},
       enableClosingConfirmation: () => {},
       MainButton: { show: () => {}, hide: () => {} },
       BackButton: { show: () => {}, hide: () => {} }
     }
   };
   location.reload();
   ```

3. **Probar funcionalidades**
   - Crear sala
   - Copiar código
   - Etc.

---

## 🎯 RECOMENDACIÓN

**Para empezar:** Usa la **OPCIÓN 1** (Telegram Desktop con localhost)

**Para probar desde el teléfono:** Usa la **OPCIÓN 2** (Cloudflare Tunnel)

---

## 📋 Comandos para Cloudflare Tunnel

```powershell
# Descargar
Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile "cloudflared.exe"

# Iniciar túnel
.\cloudflared.exe tunnel --url http://localhost:3000

# La URL aparecerá en la consola
# Ejemplo: https://abc-def-123.trycloudflare.com
```

---

## ✅ Estado Actual del Proyecto

- ✅ Servidor corriendo en `http://localhost:3000`
- ✅ Redis funcionando
- ✅ Bot configurado: @wilprueba1n8nbot
- ⏳ Pendiente: Configurar MiniApp en BotFather

---

## 🚀 Siguiente Paso

**Elige una opción y continúa:**

### Si eliges OPCIÓN 1 (Telegram Desktop):
1. Abre Telegram Desktop
2. Configura la MiniApp con `http://localhost:3000`
3. Prueba desde Telegram Desktop

### Si eliges OPCIÓN 2 (Cloudflare):
1. Ejecuta los comandos de Cloudflare
2. Copia la URL generada
3. Configura la MiniApp con esa URL
4. Prueba desde cualquier dispositivo

**¿Cuál opción prefieres?** 🤔
