# 🗂️ Estructura de Carpetas Backend para Quantum Mus

## 📋 Estructura Recomendada

```
quantum-mus/
├── frontend/                          # Todo el código del cliente
│   ├── assets/                        # Recursos estáticos
│   │   ├── images/                    # Imágenes y sprites
│   │   ├── sounds/                    # Efectos de sonido (opcional)
│   │   └── fonts/                     # Fuentes personalizadas (opcional)
│   ├── css/                           # Hojas de estilo
│   │   ├── styles.css                 # Estilos del juego principal
│   │   └── navigation-styles.css     # Estilos de navegación y lobby
│   ├── js/                            # JavaScript del cliente
│   │   ├── game.js                    # Lógica del juego principal
│   │   ├── navigation.js              # Sistema de navegación
│   │   ├── generate-cards.js          # Generador de cartas
│   │   └── game-integration.js       # Integración Game Over
│   └── index.html                     # Página principal
│
├── backend/                           # Todo el código del servidor
│   ├── src/                           # Código fuente del servidor
│   │   ├── config/                    # Configuración
│   │   │   ├── database.js            # Configuración de base de datos
│   │   │   ├── websocket.js           # Configuración de WebSocket
│   │   │   └── environment.js         # Variables de entorno
│   │   │
│   │   ├── models/                    # Modelos de datos
│   │   │   ├── Player.js              # Modelo de jugador
│   │   │   ├── Room.js                # Modelo de sala/partida
│   │   │   ├── Game.js                # Modelo de estado del juego
│   │   │   └── Card.js                # Modelo de carta
│   │   │
│   │   ├── controllers/               # Controladores de lógica
│   │   │   ├── roomController.js      # Gestión de salas
│   │   │   ├── gameController.js      # Lógica del juego
│   │   │   ├── playerController.js    # Gestión de jugadores
│   │   │   └── cardController.js      # Gestión de cartas
│   │   │
│   │   ├── services/                  # Servicios de negocio
│   │   │   ├── roomService.js         # Servicios de sala
│   │   │   ├── gameService.js         # Servicios de juego
│   │   │   ├── cardService.js         # Servicios de cartas
│   │   │   ├── entanglementService.js # Lógica de entrelazamiento
│   │   │   └── scoreService.js        # Cálculo de puntuaciones
│   │   │
│   │   ├── websocket/                 # Gestión de WebSocket
│   │   │   ├── socketManager.js       # Manager principal de sockets
│   │   │   ├── events/                # Eventos de WebSocket
│   │   │   │   ├── roomEvents.js      # Eventos de sala
│   │   │   │   ├── gameEvents.js      # Eventos de juego
│   │   │   │   └── playerEvents.js    # Eventos de jugador
│   │   │   └── handlers/              # Manejadores de eventos
│   │   │       ├── joinRoomHandler.js
│   │   │       ├── startGameHandler.js
│   │   │       ├── playCardHandler.js
│   │   │       └── envidoHandler.js
│   │   │
│   │   ├── middleware/                # Middleware
│   │   │   ├── auth.js                # Autenticación (opcional)
│   │   │   ├── validation.js          # Validación de datos
│   │   │   └── errorHandler.js        # Manejo de errores
│   │   │
│   │   ├── utils/                     # Utilidades
│   │   │   ├── codeGenerator.js       # Generador de códigos de sala
│   │   │   ├── logger.js              # Sistema de logs
│   │   │   ├── constants.js           # Constantes del juego
│   │   │   └── helpers.js             # Funciones auxiliares
│   │   │
│   │   ├── routes/                    # Rutas API REST (opcional)
│   │   │   ├── api.js                 # Router principal
│   │   │   ├── rooms.js               # Endpoints de salas
│   │   │   └── stats.js               # Endpoints de estadísticas
│   │   │
│   │   └── app.js                     # Punto de entrada del servidor
│   │
│   ├── tests/                         # Tests
│   │   ├── unit/                      # Tests unitarios
│   │   │   ├── services/
│   │   │   └── models/
│   │   └── integration/               # Tests de integración
│   │       ├── websocket/
│   │       └── api/
│   │
│   ├── package.json                   # Dependencias Node.js
│   └── .env.example                   # Ejemplo de variables de entorno
│
├── database/                          # Base de datos
│   ├── migrations/                    # Migraciones de BD
│   ├── seeds/                         # Datos de prueba
│   └── schema.sql                     # Esquema de base de datos
│
├── docs/                              # Documentación
│   ├── API.md                         # Documentación de API
│   ├── WEBSOCKET_EVENTS.md           # Documentación de eventos WS
│   ├── GAME_LOGIC.md                 # Lógica del juego
│   └── DEPLOYMENT.md                 # Guía de despliegue
│
├── scripts/                           # Scripts útiles
│   ├── deploy.sh                      # Script de despliegue
│   ├── backup.sh                      # Script de backup
│   └── seed-db.js                     # Popular base de datos
│
├── .gitignore                         # Archivos ignorados por Git
├── README.md                          # Documentación principal
└── docker-compose.yml                 # Configuración Docker (opcional)
```

## 📦 Tecnologías Recomendadas

### Backend
```json
{
  "dependencies": {
    "express": "^4.18.2",           // Framework web
    "socket.io": "^4.6.1",          // WebSocket para tiempo real
    "mongoose": "^8.0.0",           // ODM para MongoDB
    "dotenv": "^16.0.3",            // Variables de entorno
    "cors": "^2.8.5",               // CORS para API
    "joi": "^17.11.0",              // Validación de datos
    "winston": "^3.11.0",           // Sistema de logs
    "uuid": "^9.0.1"                // Generador de UUIDs
  },
  "devDependencies": {
    "nodemon": "^3.0.2",            // Auto-reload en desarrollo
    "jest": "^29.7.0",              // Framework de testing
    "eslint": "^8.55.0",            // Linter
    "prettier": "^3.1.1"            // Formateador de código
  }
}
```

### Base de Datos
- **Opción 1: MongoDB** (Recomendada) - NoSQL, flexible, fácil para prototipado
- **Opción 2: PostgreSQL** - SQL, más estructura, mejor para datos relacionales
- **Opción 3: Redis** - Para caché y datos en memoria (salas temporales)

## 🚀 Archivos Clave del Backend

### 1. `backend/src/app.js` - Servidor Principal
```javascript
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('../frontend'));

// WebSocket Manager
require('./websocket/socketManager')(io);

// API Routes
app.use('/api', require('./routes/api'));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🎮 Quantum Mus Server running on port ${PORT}`);
});
```

### 2. `backend/src/models/Room.js` - Modelo de Sala
```javascript
const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    length: 4
  },
  hostId: {
    type: String,
    required: true
  },
  gameMode: {
    type: String,
    enum: ['4', '8'],
    default: '4'
  },
  players: [{
    id: String,
    name: String,
    character: String,
    isReady: Boolean,
    team: Number // 1 or 2
  }],
  gameState: {
    type: Object,
    default: null
  },
  status: {
    type: String,
    enum: ['waiting', 'playing', 'finished'],
    default: 'waiting'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 7200 // Auto-delete after 2 hours
  }
});

module.exports = mongoose.model('Room', roomSchema);
```

### 3. `backend/src/services/entanglementService.js` - Lógica de Entrelazamiento
```javascript
class EntanglementService {
  /**
   * Crea pares entrelazados según el modo de juego
   * @param {string} gameMode - '4' o '8'
   * @param {Array} players - Lista de jugadores
   * @returns {Array} Pares de cartas entrelazadas
   */
  createEntangledPairs(gameMode, players) {
    const pairs = [];
    
    if (gameMode === '4') {
      // Solo reyes entrelazados
      pairs.push(
        { card1: 'rey_oros', card2: 'rey_copas', team: 1 },
        { card1: 'rey_espadas', card2: 'rey_bastos', team: 2 }
      );
    } else if (gameMode === '8') {
      // Reyes, 3s y 2s entrelazados
      const suits = ['oros', 'copas', 'espadas', 'bastos'];
      
      // Reyes
      pairs.push(
        { card1: 'rey_oros', card2: 'rey_copas', team: 1 },
        { card1: 'rey_espadas', card2: 'rey_bastos', team: 2 }
      );
      
      // 3s
      pairs.push(
        { card1: '3_oros', card2: '3_copas', team: 1 },
        { card1: '3_espadas', card2: '3_bastos', team: 2 }
      );
      
      // 2s
      pairs.push(
        { card1: '2_oros', card2: '2_copas', team: 1 },
        { card1: '2_espadas', card2: '2_bastos', team: 2 }
      );
    }
    
    return pairs;
  }
  
  /**
   * Verifica si dos cartas están entrelazadas
   */
  areEntangled(card1, card2, entangledPairs) {
    return entangledPairs.some(pair => 
      (pair.card1 === card1 && pair.card2 === card2) ||
      (pair.card1 === card2 && pair.card2 === card1)
    );
  }
}

module.exports = new EntanglementService();
```

### 4. `backend/src/websocket/socketManager.js` - Manager de WebSocket
```javascript
const Room = require('../models/Room');
const gameEvents = require('./events/gameEvents');
const roomEvents = require('./events/roomEvents');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);
    
    // Room events
    socket.on('create-room', (data) => roomEvents.createRoom(socket, io, data));
    socket.on('join-room', (data) => roomEvents.joinRoom(socket, io, data));
    socket.on('leave-room', (data) => roomEvents.leaveRoom(socket, io, data));
    socket.on('select-character', (data) => roomEvents.selectCharacter(socket, io, data));
    socket.on('change-game-mode', (data) => roomEvents.changeGameMode(socket, io, data));
    
    // Game events
    socket.on('start-game', (data) => gameEvents.startGame(socket, io, data));
    socket.on('play-card', (data) => gameEvents.playCard(socket, io, data));
    socket.on('canta-envido', (data) => gameEvents.cantaEnvido(socket, io, data));
    socket.on('apply-gate', (data) => gameEvents.applyQuantumGate(socket, io, data));
    
    // Disconnect
    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
      roomEvents.handleDisconnect(socket, io);
    });
  });
};
```

### 5. `backend/src/websocket/events/roomEvents.js` - Eventos de Sala
```javascript
const Room = require('../../models/Room');
const { generateRoomCode } = require('../../utils/codeGenerator');

const roomEvents = {
  async createRoom(socket, io, data) {
    const { playerName, hostId } = data;
    const code = generateRoomCode();
    
    const room = new Room({
      code,
      hostId,
      players: [{
        id: socket.id,
        name: playerName,
        character: null,
        isReady: false,
        team: 1
      }]
    });
    
    await room.save();
    socket.join(code);
    
    socket.emit('room-created', {
      success: true,
      code,
      room: room.toObject()
    });
    
    console.log(`🎮 Room created: ${code} by ${playerName}`);
  },
  
  async joinRoom(socket, io, data) {
    const { roomCode, playerName } = data;
    const room = await Room.findOne({ code: roomCode });
    
    if (!room) {
      return socket.emit('join-error', { message: 'Sala no encontrada' });
    }
    
    if (room.players.length >= 4) {
      return socket.emit('join-error', { message: 'Sala llena' });
    }
    
    const team = room.players.length < 2 ? 1 : 2;
    
    room.players.push({
      id: socket.id,
      name: playerName,
      character: null,
      isReady: false,
      team
    });
    
    await room.save();
    socket.join(roomCode);
    
    io.to(roomCode).emit('player-joined', {
      player: room.players[room.players.length - 1],
      room: room.toObject()
    });
    
    console.log(`👤 ${playerName} joined room ${roomCode}`);
  },
  
  async changeGameMode(socket, io, data) {
    const { roomCode, gameMode } = data;
    const room = await Room.findOne({ code: roomCode });
    
    if (!room) return;
    
    // Verify host
    if (room.hostId !== socket.id) {
      return socket.emit('error', { message: 'Solo el host puede cambiar el modo' });
    }
    
    room.gameMode = gameMode;
    await room.save();
    
    io.to(roomCode).emit('game-mode-changed', {
      gameMode,
      message: `Modo cambiado a ${gameMode} reyes`
    });
    
    console.log(`⚙️ Room ${roomCode} game mode changed to ${gameMode} reyes`);
  }
};

module.exports = roomEvents;
```

## 🔄 Eventos WebSocket Principales

### Cliente → Servidor
- `create-room` - Crear nueva sala
- `join-room` - Unirse a sala existente
- `leave-room` - Salir de la sala
- `select-character` - Seleccionar personaje
- `change-game-mode` - Cambiar modo (4/8 reyes)
- `start-game` - Iniciar partida
- `play-card` - Jugar una carta
- `canta-envido` - Cantar envido
- `apply-gate` - Aplicar puerta cuántica

### Servidor → Cliente
- `room-created` - Sala creada exitosamente
- `player-joined` - Jugador se unió
- `player-left` - Jugador salió
- `character-selected` - Personaje seleccionado
- `game-mode-changed` - Modo de juego cambiado
- `game-started` - Juego iniciado
- `card-played` - Carta jugada
- `envido-cantado` - Envido cantado
- `gate-applied` - Puerta aplicada
- `game-over` - Juego terminado
- `error` - Error general

## 🌐 Variables de Entorno (.env)

```env
# Server
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000

# Database
MONGODB_URI=mongodb://localhost:27017/quantum-mus
# O para MongoDB Atlas:
# MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/quantum-mus

# Redis (opcional, para caché)
REDIS_URL=redis://localhost:6379

# JWT (si usas autenticación)
JWT_SECRET=your-super-secret-jwt-key

# Logging
LOG_LEVEL=debug
```

## 🚀 Comandos de Desarrollo

```json
{
  "scripts": {
    "start": "node src/app.js",
    "dev": "nodemon src/app.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "format": "prettier --write 'src/**/*.js'"
  }
}
```

## 📝 Notas Importantes

1. **Seguridad**: 
   - Valida todos los inputs del cliente
   - Implementa rate limiting para prevenir spam
   - Sanitiza los nombres de jugador y códigos de sala

2. **Escalabilidad**:
   - Usa Redis para sesiones si planeas múltiples instancias
   - Implementa clustering de Node.js para aprovechar múltiples cores
   - Considera usar PM2 para gestión de procesos en producción

3. **Monitoreo**:
   - Implementa Winston para logs estructurados
   - Usa herramientas como PM2 o New Relic para monitoreo
   - Configura alertas para errores críticos

4. **Testing**:
   - Tests unitarios para servicios y modelos
   - Tests de integración para WebSocket
   - Tests end-to-end para flujos completos

5. **Despliegue**:
   - Usa Docker para containerización
   - Deploy en Heroku, DigitalOcean, AWS, o Vercel
   - Configura CI/CD con GitHub Actions

Esta estructura te permite escalar el proyecto de forma organizada y mantener el código limpio y mantenible! 🎮✨
