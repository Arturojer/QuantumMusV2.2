# Socket.IO Event Protocol - Quantum Mus Game

Documento de referencia para todos los eventos Socket.IO en la comunicación cliente-servidor.

## 📊 Resumen de Eventos

| Tipo | Evento | Origen | Destino | Descripción |
|------|--------|--------|---------|-------------|
| **Conexión** | `connect` | Cliente | Servidor | Cliente se conecta |
| **Conexión** | `connected` | Servidor | Cliente | Confirmación de conexión |
| **Conexión** | `disconnect` | Cliente | Servidor | Cliente se desconecta |
| **Sala** | `create_room` | Cliente | Servidor | Crear nueva sala de juego |
| **Sala** | `room_created` | Servidor | Cliente | Confirmación de sala creada |
| **Sala** | `join_room` | Cliente | Servidor | Unirse a una sala |
| **Sala** | `joined_room` | Servidor | Cliente | Confirmación de entrada a sala |
| **Sala** | `room_updated` | Servidor | Broadcast | Actualización del estado de la sala |
| **Sala** | `set_character` | Cliente | Servidor | Establecer personaje del jugador |
| **Sala** | `leave_room` | Cliente | Servidor | Salir de una sala |
| **Sala** | `left_room` | Servidor | Cliente | Confirmación de salida |
| **Juego** | `start_game` | Cliente | Servidor | Iniciar partida |
| **Juego** | `game_started` | Servidor | Broadcast | Partida iniciada con cartas repartidas |
| **Juego** | `player_action` | Cliente | Servidor | Acción del jugador (mus, paso, envido, ordago) |
| **Juego** | `game_update` | Servidor | Broadcast | Actualización general del estado del juego |
| **Juego** | `game_ended` | Servidor | Broadcast | Fin de la partida |
| **Juego** | `game_error` | Servidor | Cliente | Error durante la partida |
| **Descartes** | `discard_cards` | Cliente | Servidor | Descartar cartas |
| **Descartes** | `cards_discarded` | Servidor | Broadcast | Confirmación de descarte |
| **Descartes** | `new_cards_dealt` | Servidor | Broadcast | Nuevas cartas repartidas post-descarte |
| **Entrelazamiento** | `get_entanglement_state` | Cliente | Servidor | Solicitar estado de pares |
| **Entrelazamiento** | `entanglement_state` | Servidor | Cliente | Información de estado de pares |
| **Entrelazamiento** | `get_player_entanglement` | Cliente | Servidor | Solicitar pares de un jugador |
| **Entrelazamiento** | `player_entanglement_info` | Servidor | Cliente | Información de pares de un jugador |
| **Entrelazamiento** | `play_card_with_entanglement` | Cliente | Servidor | Jugar carta y verificar entrelazamiento |
| **Entrelazamiento** | `entanglement_activated` | Servidor | Broadcast | Par activado durante juego |
| **Estado** | `get_game_state` | Cliente | Servidor | Solicitar estado actual |
| **Estado** | `game_state` | Servidor | Cliente | Envío de estado actual |
| **Rondas** | `round_ended` | Servidor | Broadcast | Fin de ronda (GRANDE, CHICA, PARES, JUEGO) |
| **MISSING** | `grande_phase_update` | ??? | ??? | ⚠️ No usado - REMOVER |

---

## 🔴 EVENTOS CRÍTICOS (Deben funcionar siempre)

### 1. `player_action` 
**Dirección**: Cliente → Servidor  
**Origen**: insp.js línea 501 | game.js (no emite)  
**Destino**: server.py línea 313  

**Estructura del Payload:**
```json
{
  "room_id": "room-uuid-123",
  "player_index": 1,
  "action": "envido",
  "data": {
    "amount": 20,
    "round": "GRANDE"
  }
}
```

**Acciones válidas:**
- `mus` - Declaración de MUS (sin parámetros)
- `paso` - Paso (sin parámetros)
- `envido` - Apuesta envido (requiere `data.amount`)
- `ordago` - Apuesta ordago (monto fijo: 40)
- `accept` - Aceptar apuesta
- `raise` - Contra-apuesta (requiere `data.amount`)

**Validaciones en Servidor:**
- ✅ `room_id` debe existir en game_manager
- ✅ `player_index` debe ser [0,1,2,3]
- ✅ Debe ser turno del player actual (game.state['activePlayerIndex'])
- ✅ `action` debe ser válido para la ronda actual

**Respuesta Exitosa:**
```python
socketio.emit('game_update', {
    'game_state': game.get_public_state(),
    'action': {
        'player_index': 1,
        'action': 'envido',
        'data': {'amount': 20}
    }
}, room=room_id)
```

**Respuesta Errónea:**
```python
emit('game_error', {'error': 'Not your turn'})
```

---

### 2. `game_started`
**Dirección**: Servidor → Broadcast  
**Origen**: server.py línea 307  
**Destino**: game.js línea 519  

**Estructura:**
```json
{
  "success": true,
  "game_state": {
    "currentRound": "MUS",
    "manoIndex": 0,
    "activePlayerIndex": 0,
    "teams": {
      "team1": {"players": [0, 2], "score": 0},
      "team2": {"players": [1, 3], "score": 0}
    },
    "player_hands": {
      "0": [{"value": "A", "suit": "oros"}, ...],
      "1": [...],
      "2": [...],
      "3": [...]
    },
    "entanglement": {
      "pairs": [],
      "activated_pairs": []
    }
  },
  "server_ts": "2026-02-08T12:34:56.789Z",
  "processing_ms": 145
}
```

**Cliente debe:**
```javascript
// game.js: socket.once('game_started', (data) => { ... })
if (!data.success) return;
const gameStateData = data.game_state || {};
gameState.manoIndex = gameStateData.manoIndex;
gameState.activePlayerIndex = gameState.manoIndex;
// Mostrar cartas jugador local
displayPlayerHand(gameStateData.player_hands[localPlayerIndex]);
// Iniciar timer para primer jugador
startPlayerTurnTimer(gameState.activePlayerIndex);
```

---

### 3. `game_update`
**Dirección**: Servidor → Broadcast  
**Origen**: server.py línea 336  
**Destino**: game.js línea 556  

**Estructura:**
```json
{
  "game_state": {
    "currentRound": "GRANDE",
    "activePlayerIndex": 2,
    "currentBet": {
      "amount": 20,
      "bettingTeam": "team1",
      "betType": "envido",
      "responses": {
        "0": "accept",
        "1": "paso"
      }
    },
    "teams": {
      "team1": {"score": 10},
      "team2": {"score": 5}
    }
  },
  "action": {
    "player_index": 0,
    "action": "envido",
    "data": {"amount": 20}
  }
}
```

**Cliente debe:**
```javascript
const gs = data.game_state || {};
gameState.currentRound = gs.currentRound || gameState.currentRound;
gameState.activePlayerIndex = gs.activePlayerIndex;
if (gs.currentBet) gameState.currentBet = gs.currentBet;
if (gs.teams) {
  gameState.teams.team1.score = gs.teams.team1?.score ?? gameState.teams.team1.score;
  gameState.teams.team2.score = gs.teams.team2?.score ?? gameState.teams.team2.score;
}
updateRoundDisplay();
updateScoreboard();
startPlayerTurnTimer(gameState.activePlayerIndex);
```

---

### 4. `new_cards_dealt`
**Dirección**: Servidor → Broadcast  
**Origen**: server.py línea 426  
**Destino**: game.js línea 595  

**Estructura:**
```json
{
  "success": true,
  "game_state": {
    "currentRound": "MUS",
    "manoIndex": 1,
    "activePlayerIndex": 1
  },
  "player_hands": {
    "0": [{"value": "K", "suit": "oros"}, ...],
    "1": [{"value": "Q", "suit": "copas"}, ...],
    "2": [{"value": "J", "suit": "espadas"}, ...],
    "3": [{"value": "7", "suit": "bastos"}, ...]
  },
  "entanglement_state": {
    "pairs": [],
    "activated_pairs": []
  }
}
```

---

### 5. `discard_cards` ⚠️ RECIENTEMENTE AGREGADO
**Dirección**: Cliente → Servidor  
**Origen**: game.js línea 1108  
**Destino**: server.py línea 360  

**Estructura del Payload:**
```json
{
  "room_id": "room-uuid-123",
  "player_index": 0,
  "card_indices": [0, 2]
}
```

---

### 6. `cards_discarded` ⚠️ RECIENTEMENTE AGREGADO
**Dirección**: Servidor → Broadcast  
**Origen**: server.py línea 414  
**Destino**: game.js (NUEVO LISTENER - línea ~630)  

**Estructura:**
```json
{
  "player_index": 0,
  "num_cards": 2,
  "game_state": {
    "currentRound": "MUS",
    "cardsDiscarded": {
      "0": [0, 2]
    }
  }
}
```

**Cliente debe:**
```javascript
// NUEVO: game.js socket.on('cards_discarded', ...)
const playerIdx = data.player_index;
const numCards = data.num_cards;
gameState.cardsDiscarded[playerIdx] = Array(numCards).fill(null);

// Verificar si todos descartaron
if (Object.keys(gameState.cardsDiscarded).length === 4) {
  console.log('Todos han descartado, esperando nuevas cartas');
}
```

---

### 7. `round_ended` ⚠️ RECIENTEMENTE AGREGADO
**Dirección**: Servidor → Broadcast  
**Origen**: server.py línea 347  
**Destino**: game.js (NUEVO LISTENER - línea ~650)  

**Estructura:**
```json
{
  "result": {
    "winner": "team1",
    "round": "GRANDE",
    "points": 5,
    "description": "5pts (envido accepted)"
  }
}
```

---

### 8. `entanglement_activated` ⚠️ RECIENTEMENTE AGREGADO
**Dirección**: Servidor → Broadcast  
**Origen**: server.py línea 514  
**Destino**: game.js (NUEVO LISTENER - línea ~680)  

**Estructura:**
```json
{
  "entanglement_data": {
    "pair_id": "pair-001",
    "pair": [0, 2],
    "result": "entangled"
  },
  "card_played": {"value": "K", "suit": "oros"},
  "player_index": 0,
  "round": "GRANDE"
}
```

---

### 9. `entanglement_state` ⚠️ RECIENTEMENTE AGREGADO
**Dirección**: Servidor → Unicast  
**Origen**: server.py línea 471  
**Destino**: game.js (NUEVO LISTENER - línea ~700)  

**Estructura:**
```json
{
  "entanglement": {
    "pairs": [
      {"pair_id": "pair-001", "players": [0, 2], "status": "active"}
    ],
    "activated_pairs": [
      {"pair_id": "pair-001", "round": "GRANDE"}
    ],
    "statistics": {
      "total_pairs": 2,
      "activated_pairs": 1,
      "superposition_pairs": 1
    }
  },
  "game_mode": "4"
}
```

---

### 10. `player_entanglement_info` ⚠️ RECIENTEMENTE AGREGADO
**Dirección**: Servidor → Unicast  
**Origen**: server.py línea 490  
**Destino**: game.js (NUEVO LISTENER - línea ~720)  

**Estructura:**
```json
{
  "player_index": 0,
  "entanglement_info": [
    {
      "card_index": 0,
      "pair_id": "pair-001",
      "partner_card": {"value": "K", "suit": "oros"},
      "status": "inactive"
    }
  ],
  "entangled_cards": [0, 3]
}
```

---

## ⚠️ EVENTOS PROBLEMÁTICOS

### `grande_phase_update` - STATUS: REMOVER O IMPLEMENTAR
**Cliente escucha:** game.js línea 574  
**Servidor emite:** ❌ NO EMITE  

**Problema:** Listener sin implementación en servidor.

**Soluciones:**
1. **Remover listener en game.js** (más simple)
2. **Implementar en servidor** (requiere lógica adicional)

**Si mantener, estructura debería ser:**
```json
{
  "grande_phase": {
    "currentBet": {...},
    "currentRound": "GRANDE",
    "activePlayerIndex": 2,
    "responses": {...}
  }
}
```

---

## 🔍 Checklist de Validación de Datos

### En Cliente (cuando recibe):
- [ ] Verificar que `data` no es null/undefined
- [ ] Validar tipos de datos principales (room_id debe ser string, player_index debe ser number)
- [ ] Confirmar que los datos cumplen schema esperado
- [ ] Logging con timestamp: `console.log('[SOCKET]', eventName, timestamp, data)`

### En Servidor (cuando emite):
- [ ] Confirmar que el room existe
- [ ] Validar estructura antes de emitir
- [ ] Incluir timestamp en respuestas
- [ ] Usar `room=room_id` para broadcast a sala específica
- [ ] Usar `emit()` para respuesta al cliente que solicitó
- [ ] Loguear eventos críticos con timestamp

---

## 📈 Orden de Eventos Típico (Flujo Normal)

```
SECUENCIA DE UNA PARTIDA:

1. Cliente: connect
   ↓
2. Servidor: connected (confirmación)
   ↓
3. Cliente: create_room | join_room
   ↓
4. Servidor: room_created | joined_room
   ↓
5. Servidor: room_updated (broadcast a todos en sala)
   ↓
6. Todos en sala: start_game
   ↓
7. Servidor: game_started + player_hands
   ---- COMIENZA EL JUEGO ----
   ↓
8. Turno 1 - MUS PHASE:
   - Cliente emite: player_action (action: 'mus' | 'paso' | 'envido')
   - Servidor emite: game_update (broadcast)
   - Próximo jugador: startPlayerTurnTimer
   
9. Si todos MUS → DESCARTE:
   - Cliente emite: discard_cards
   - Servidor emite: cards_discarded (cada discard)
   - Servidor emite: new_cards_dealt (cuando todos descartaron)
   - Ciclo de descarte se repite hasta que alguien corte con apuesta
   
10. Turno N - APUESTA ROUND (GRANDE/CHICA/PARES/JUEGO):
    - Cliente emite: player_action (action: 'envido' | 'ordago' | 'accept' | 'paso')
    - Servidor emite: game_update (broadcast)
    - Cuando ronda termina: server emite round_ended
    - Cliente reveala cartas y asigna puntos
    
11. Fin de Mano:
    - Resetea estado
    - Próxima mano - volver a paso 8
    
12. Cuando equipo llega a 40pts:
    - Servidor emite: game_ended
    - Cliente muestra modal de victoria
```

---

## 🐛 Debugging Tips

### En Console del Cliente:
```javascript
// Ver todos los eventos Socket.IO
if (window.QuantumMusSocket) {
  const socket = window.QuantumMusSocket;
  const originalEmit = socket.emit;
  socket.emit = function(event, data, ...args) {
    console.log('[SOCKET EMIT]', event, data);
    return originalEmit.apply(socket, arguments);
  };
  const originalOn = socket.on;
  socket.on = function(event, callback) {
    const wrappedCallback = function(data) {
      console.log('[SOCKET ON]', event, data);
      return callback.apply(this, arguments);
    };
    return originalOn.apply(socket, [event, wrappedCallback]);
  };
}
```

### En Servidor (Python):
```python
# En handle_player_action, antes de procesar:
logger.info(f"""
  [PLAYER ACTION] 
  room_id={room_id}
  player_index={player_index}
  action={action}
  data={extra_data}
  timestamp={datetime.utcnow().isoformat()}
""")
```

---

## 📝 Cambios Realizados (v1.1)

1. ✅ Agregado listener `cards_discarded` en game.js
2. ✅ Agregado listener `round_ended` en game.js
3. ✅ Agregado listener `entanglement_activated` en game.js
4. ✅ Agregado listener `entanglement_state` en game.js
5. ✅ Agregado listener `player_entanglement_info` en game.js
6. ⚠️ Marcado `grande_phase_update` como problemático
7. 📋 Documentado este protocolo exhaustivamente

---

## 🚀 Próximos Pasos

- [ ] Implementar `grande_phase_update` en servidor O remover listener del cliente
- [ ] Agregar validación de schema en ambos lados
- [ ] Implementar ACK/confirmación para eventos críticos
- [ ] Crear test suite para validar protocolo
- [ ] Documentar límites de rate-limiting

