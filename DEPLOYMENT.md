# Guía de despliegue online - Quantum Mus

## Resumen de cambios

El juego está preparado para funcionar online. Se han realizado las siguientes modificaciones:

### Frontend
- **config.js** + **config.override.js**: URL del servidor centralizada. Por defecto usa el mismo origen que la página (localhost o tu dominio). Para producción con backend en otra URL, edita solo `config.override.js` (ver más abajo).
- **Socket.IO**: Integrado para comunicación en tiempo real
- **Navegación**: Crear/unir salas, lobby con jugadores en tiempo real, selección de personaje
- **Juego**: Sincronización de estado y acciones con el servidor

### Backend
- **Servidor estático**: Sirve el frontend desde la raíz del proyecto
- **CORS**: Configurado para aceptar conexiones desde cualquier origen
- **Evento set_character**: Para actualizar el personaje elegido en el lobby
- **Variables de entorno**: HOST, PORT, FLASK_DEBUG para producción

## Cómo ejecutar localmente

1. **Instalar dependencias:**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Iniciar el servidor:**
   ```bash
   python server.py
   ```

3. **Abrir en el navegador:** `http://localhost:5000`

El servidor sirve tanto el frontend como el backend. No es necesario un servidor separado para los archivos estáticos.

## Despliegue en producción

### Opción A: Servidor propio (VPS, etc.)

1. Copiar el proyecto al servidor
2. Configurar variables de entorno:
   ```bash
   export FLASK_DEBUG=false
   export PORT=5000
   export HOST=0.0.0.0
   ```
3. Ejecutar con un proceso persistente (systemd, supervisor, etc.):
   ```bash
   cd backend && python server.py
   ```

### Opción B: Plataformas cloud (Render, Railway, Heroku, etc.)

1. Configurar el directorio de trabajo como `backend/`
2. Comando de inicio: `python server.py`
3. Variables de entorno:
   - `PORT`: Lo proporciona la plataforma automáticamente
   - `FLASK_DEBUG=false`

### Opción C: Con Gunicorn (recomendado para producción)

Para mayor estabilidad, usar Gunicorn con gevent para Socket.IO:

```bash
pip install gunicorn gevent gevent-websocket
gunicorn --worker-class geventwebsocket.gunicorn.workers.GeventWebSocketWorker -w 1 -b 0.0.0.0:5000 "server:app"
```

**Nota:** El frontend debe servirse desde el mismo dominio para evitar problemas de CORS con WebSockets. Si el frontend está en otro dominio, configura `CORS_ORIGINS` en el backend.

## Cambiar la URL del servidor (frontend → backend)

Toda la conexión al backend (WebSocket y API) usa una **configuración centralizada**. No hay URLs tipo `localhost` repartidas por el código.

- **Mismo dominio (recomendado):** Si sirves el frontend y el backend desde el mismo dominio (p. ej. `https://midominio.com` para la web y `https://midominio.com` para el API), no hace falta cambiar nada. El cliente usa `window.location.origin` automáticamente.
- **Backend en otra URL:** Edita **solo** el archivo `config.override.js` en la raíz del proyecto:
  1. Abre `config.override.js`.
  2. Descomenta la línea que define `QUANTUM_MUS_SERVER_URL` y pon la URL base de tu backend (sin barra final), por ejemplo:
     ```js
     window.QUANTUM_MUS_SERVER_URL = 'https://api.midominio.com';
     ```
  3. Asegura CORS en el backend para ese origen (frontend).

Así puedes subir el proyecto a internet y cambiar la dirección del servidor en un solo sitio sin tocar el resto del código.

## Códigos de sala

- Los códigos tienen **8 caracteres** (alfanuméricos)
- Al crear partida, el host recibe el código automáticamente
- Los jugadores que se unen deben introducir el código exacto

## Modo offline/demo

Si no hay conexión al servidor, el juego funciona en modo local:
- Crear partida genera un código local
- Puedes usar "Demo: añadir jugadores de prueba" para jugar solo
- No es posible unirse a salas de otros en modo offline
