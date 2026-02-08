# Guía de despliegue online - Quantum Mus

## Resumen de cambios

El juego está preparado para funcionar online. Se han realizado las siguientes modificaciones:

### Frontend
- **config.js**: Detecta automáticamente la URL del servidor (funciona en local y producción)
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

## Códigos de sala

- Los códigos tienen **8 caracteres** (alfanuméricos)
- Al crear partida, el host recibe el código automáticamente
- Los jugadores que se unen deben introducir el código exacto

## Modo offline/demo

Si no hay conexión al servidor, el juego funciona en modo local:
- Crear partida genera un código local
- Puedes usar "Demo: añadir jugadores de prueba" para jugar solo
- No es posible unirse a salas de otros en modo offline
