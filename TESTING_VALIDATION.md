# Plan de Testing y Validación - Comunicación Socket.IO

Documento para validar que todos los problemas de comunicación han sido resueltos.

---

## ✅ Checklist de Validación

### Fase 1: Listeners Instalados Correctamente

- [ ] **Archivo game.js modificado**
  - [ ] Tiene listener para `cards_discarded` (alrededor de línea 630)
  - [ ] Tiene listener para `round_ended` (alrededor de línea 650)
  - [ ] Tiene listener para `entanglement_activated` (alrededor de línea 680)
  - [ ] Tiene listener para `entanglement_state` (alrededor de línea 700)
  - [ ] Tiene listener para `player_entanglement_info` (alrededor de línea 720)
  - [ ] Todos con console.log para debugging
  - [ ] Ningún error de sintaxis (press F5 para verificar console)

### Fase 2: Estado del Servidor

- [ ] **server.py está funcionando**
  - [ ] Sin errores en consola Python
  - [ ] Logging muestra conexiones de clientes
  - [ ] Endpoints HTTP responden (/health, /api/rooms)

### Fase 3: Conectividad Cliente-Servidor

- [ ] **Navegador console sin errores**
  - [ ] WebSocket conectado (buscar mensajes de conexión)
  - [ ] Sin warnings de CORS
  - [ ] Socket ID visible en console

- [ ] **Test: Crear y Unirse a Sala**
  - [ ] Botón "Crear Sala" funciona
  - [ ] Otros jugadores pueden unirse
  - [ ] Todos ven el mismo estado de sala

### Fase 4: Testing de Eventos Críticos

#### Test 1: Discard Phase
```
ANTES (❌ No funcionaba):
- Jugadores descartaban cartas
- Otros jugadores NO veían notificación
- No sabían si todos descartaron

DESPUÉS (✅ Debe funcionar):
1. Abrir Developer Tools → Console
2. Iniciar partida con 4 jugadores
3. Todos descartan cartas al mismo tiempo
4. En Console: Debe verse
   [SOCKET] cards_discarded event received: {player_index: 0, num_cards: 2}
   [SOCKET] cards_discarded event received: {player_index: 1, num_cards: 3}
   [SOCKET] cards_discarded event received: {player_index: 2, num_cards: 1}
   [SOCKET] cards_discarded event received: {player_index: 3, num_cards: 2}
5. Verificar: gameState.cardsDiscarded contiene 4 jugadores
   (escribir en console: gameState.cardsDiscarded)
6. Cuando todos descartaron, nuevas cartas llegan automáticamente
```

#### Test 2: Round Transition
```
ANTES (❌ No funcionaba):
- Rondas de apuesta no terminaban correctamente
- Cartas no se revelaban
- Puntos no se asignaban

DESPUÉS (✅ Debe funcionar):
1. Iniciar partida y llegar a ronda GRANDE
2. Ambos equipos apuestan: Envido (3pts)
3. Cuando se resuelve apuesta, en Console debe verse:
   [SOCKET] round_ended event received: {
     result: {winner: "team1", round: "GRANDE", points: 3}
   }
4. Cards se revelan automáticamente
5. Puntos se asignan (ver en scoreboard)
6. Parpadeo de "Team X gana 3pts"
7. Avanza automáticamente a próxima ronda (CHICA)
```

#### Test 3: Entanglement Activation
```
ANTES (❌ No funcionaba):
- Pares entrelazados no se activaban correctamente
- No había feedback visual
- Estado de pares inconsistente entre clientes

DESPUÉS (✅ Debe funcionar):
1. Cargar partida (modo online)
2. Cuando par se activa, en Console debe verse:
   [SOCKET] entanglement_activated event received: {
     entanglement_data: {...},
     player_index: 0,
     round: "GRANDE"
   }
3. Animación de quantum collapse debe ocurrir
4. gameState.entanglement.events debe registrar activación
5. Todos los clientes ven lo mismo
```

---

## 🧪 Test de Validación Paso a Paso

### TEST A: Console Monitoring (5 minutos)

**Objetivo**: Verificar que se reciben eventos Socket.IO

```javascript
// Ejecutar en console del navegador:

// 1. Ver socket ID
console.log('Socket ID:', window.QuantumMusSocket?.id);

// 2. Contar eventos recibidos
window._socketEventCount = {};
['game_started', 'game_update', 'game_ended', 'new_cards_dealt', 
 'cards_discarded', 'round_ended', 'entanglement_activated'].forEach(event => {
  const socket = window.QuantumMusSocket;
  if (!socket) return;
  socket.on(event, () => {
    window._socketEventCount[event] = (window._socketEventCount[event] || 0) + 1;
  });
});

// 3. Después de jugar 1 mano, verificar:
console.log('Eventos recibidos en esta mano:', window._socketEventCount);
console.log('Esperado al menos 1 de cada:');
console.log('  cards_discarded: ✓ si ≥ 4');
console.log('  round_ended: ✓ si ≥ 5 (GRANDE, CHICA, PARES, JUEGO, o hasta que se den puntos)');
console.log('  entanglement_activated: ✓ si hay pares');
```

**Resultado Esperado:**
```
Socket ID: abc123def456...
Eventos recibidos en esta mano: {
  game_started: 1,
  game_update: 47,
  game_ended: 0,
  new_cards_dealt: 2,
  cards_discarded: 4,      ← NUEVO, debe ser 4
  round_ended: 5,          ← NUEVO, debe ser ≥ 5
  entanglement_activated: 2  ← NUEVO, si hay pares
}
```

---

### TEST B: Game State Consistency (10 minutos)

**Objetivo**: Verificar que estado se mantiene sincronizado

```javascript
// 1. Crear 2 tabs del navegador
// 2. Jugador 1 en tab1, Jugador 2 en tab2
// 3. Iniciar misma partida
// 4. Examinar estado cuando ambos listos:

// En tab1 (Jugador 1):
console.log('Tab1 - gameState.teams:', gameState.teams);

// En tab2 (Jugador 2):
console.log('Tab2 - gameState.teams:', gameState.teams);

// Ambos deberían tener EXACTAMENTE los mismos scores
// Ejecutar en console después de cada ronda:
console.log(`Team1: ${gameState.teams.team1.score}, Team2: ${gameState.teams.team2.score}`);
```

**Resultado Esperado:**
```
Tab1 - gameState.teams: {team1: {score: 15}, team2: {score: 8}}
Tab2 - gameState.teams: {team1: {score: 15}, team2: {score: 8}}
// AMBOS iguales ✓
```

---

### TEST C: Full Game Execution (20 minutos)

**Objetivo**: Jugar una partida completa sin errores

**Pasos:**
1. Abrir Developer Tools (F12)
2. Crear sala
3. 4 jugadores se unen
4. Start game
5. Jugar 5 manos completas
6. Verificar que:
   - ✓ MUS phase funciona (alguien corta, van a descartes)
   - ✓ Descartes se ven (otros jugadores ven notificaciones)
   - ✓ Nuevas cartas llegan después de descartes
   - ✓ Rondas de apuesta avanzan (GRANDE → CHICA → PARES → JUEGO)
   - ✓ Cartas se revelan al final
   - ✓ Puntos se asignan
   - ✓ Mano siguiente comienza automáticamente

**Logging en Console:**
```
Esperar ver líneas como:
[SOCKET] game_started event received: {...}
[SOCKET] game_update event received: {...}
[SOCKET] cards_discarded event received: {...}
[SOCKET] new_cards_dealt event received: {...}
[SOCKET] round_ended event received: {...}
[SOCKET] entanglement_activated event received: {...}

SIN ninguno de estos errores:
✗ Uncaught TypeError: Cannot read property
✗ undefined is not a function
✗ gameState is not defined
```

---

## 🔍 Debugging Avanzado

### Si `cards_discarded` NO llega:

**Paso 1: Verificar que listeners están instalados**
```javascript
// En console:
window.QuantumMusSocket._events['cards_discarded']
// Debe retornar: [Function] (no undefined)
```

**Paso 2: Verificar que servidor emite**
```python
# En terminal donde corre Flask:
# Debe verse líneas como:
# INFO:__main__:Player 0 discarded 2 cards in room room-uuid
# INFO:__main__:All players discarded in room room-uuid
```

**Paso 3: Verificar CORS**
```javascript
// En console:
fetch('http://localhost:5000/health')
  .then(r => r.json())
  .then(d => console.log('Server OK:', d))
  .catch(e => console.error('CORS ERROR:', e));
```

### Si `round_ended` NO llega:

**Paso 1: Ver en server logs que apuesta se resuelve**
```python
# Debe verse líneas como:
# INFO:__main__:Round ended: team1 wins 5 points
```

**Paso 2: Verificar que game.py emite**
```python
# En server.py, buscar:
if result.get('round_ended'):
    socketio.emit('round_ended', ...)
    # Esto debe ejecutarse
```

**Paso 3: Verificar estado de juego en client**
```javascript
console.log('Bet state:', gameState.currentBet);
console.log('Responses:', gameState.currentBet.responses);
// Todos 4 jugadores deben tener 'accept' o 'paso'
```

---

## 📊 Checklist de Resolución

| Problema Identificado | Solución Implementada | Testing |
|----------------------|----------------------|---------|
| ❌ `cards_discarded` no escuchado | ✅ Agregado listener game.js:630 | [ ] Jugar fase descarte |
| ❌ `round_ended` no escuchado | ✅ Agregado listener game.js:650 | [ ] Jugar ronda completa |
| ❌ `entanglement_activated` no escuchado | ✅ Agregado listener game.js:680 | [ ] Ver Par activarse |
| ❌ `entanglement_state` no escuchado | ✅ Agregado listener game.js:700 | [ ] Sincronizar estado |
| ❌ `player_entanglement_info` no escuchado | ✅ Agregado listener game.js:720 | [ ] Ver info de pares |
| ⚠️ `grande_phase_update` sin servidor | ℹ️ Documentado como problemático | [ ] Remover o implementar |

---

## 🚨 Errores Comunes Post-Implementación

### Error 1: "Unexpected token" en game.js
```
Síntoma: Página no carga, console muestra syntax error
Causa: Error de sintaxis al agregar listeners
Solución: Verificar que todos los `});` estén cerrados correctamente
Verificar: Las 5 líneas finales de cada listener tienen `});`
```

### Error 2: "gameState is not defined"
```
Síntoma: Console error cuando llega evento
Causa: Listeners usan gameState pero no está en scope
Solución: gameState debe ser variable global (NO dentro de initGame)
Verificar: gameState definido en línea ~1 de game.js
```

### Error 3: "Cannot read property 'cardsDiscarded' of undefined"
```
Síntoma: Error al procesar cards_discarded
Causa: gameState no se inicializó correctamente
Solución: Asegurar que initGame() se llamó primero
Verificar: document.getElementById('game-container') no es null
```

### Error 4: Eventos llegan pero estado no actualiza
```
Síntoma: Console muestra logging pero UI no se actualiza
Causa: Listeners no actualizan el estado o no llaman funciones de UI
Solución: Cada listener debe:
  1. Actualizar gameState
  2. Llamar updateScoreboard() o updateRoundDisplay()
  3. Iniciar timers si es necesario
```

---

## ✨ Validación Final

**Ejecutar ANTES de considerar "resuelto":**

```javascript
// Test que todo está funcionando:
console.log('🔍 VALIDATION CHECKLIST:');
console.log('✓ gameState definido:', typeof gameState === 'object');
console.log('✓ Socket conectado:', window.QuantumMusSocket?.connected);
console.log('✓ Listeners instalados:');
console.log('  - game_started:', !!window.QuantumMusSocket?.listeners('game_started'));
console.log('  - game_update:', !!window.QuantumMusSocket?.listeners('game_update'));
console.log('  - cards_discarded:', !!window.QuantumMusSocket?.listeners('cards_discarded'));
console.log('  - round_ended:', !!window.QuantumMusSocket?.listeners('round_ended'));
console.log('  - entanglement_activated:', !!window.QuantumMusSocket?.listeners('entanglement_activated'));
console.log('✓ Funciones disponibles:');
console.log('  - updateScoreboard:', typeof updateScoreboard === 'function');
console.log('  - revealAllCards:', typeof revealAllCards === 'function');
console.log('  - moveToNextRound:', typeof moveToNextRound === 'function');
console.log('✓ Game inicializado:', gameInitialized === true);
console.log('');
console.log('Si todo muestra ✓, los cambios están correctos! 🎉');
```

---

## 📞 Si hay problemas:

1. **Revisar console del navegador** (F12 → Console)
2. **Revisar terminal donde corre Flask** (buscar DEBUG o ERROR)
3. **Revisar logs de red** (F12 → Network, filtrar "socket.io")
4. **Comparar con documentación SOCKET_PROTOCOL.md**
5. **Buscar en COMUNICACION_ANALISIS.md qué evento está fallando**

---

## 🎯 Objetivo Cumplido Cuando:

✅ 4 jugadores en partida online  
✅ Todos ven descartes de otros (cards_discarded)  
✅ Rondas terminan correctamente (round_ended)  
✅ Cartas se revelan y puntos se asignan  
✅ Entrelazamiento variables (entanglement_activated)  
✅ Console muestra todos los eventos esperados  
✅ Sin errores en console  
✅ Sin desincronización entre clientes  

