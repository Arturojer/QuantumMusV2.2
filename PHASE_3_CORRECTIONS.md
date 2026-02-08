# 🔧 FASE 3 - GRANDE ROUND: PLAN DE CORRECCIONES

**Documento:** Correcciones Recomendadas  
**Generado:** Febrero 8, 2026  
**Prioridad:** P0 → P2  

---

## 📊 RESUMEN EJECUTIVO

| Item | Prioridad | Estado | Complejidad | Impacto |
|------|-----------|--------|-------------|----------|
| 1. Integración WebSocket Frontend | **P0** | ❌ NO HECHO | MEDIA | 🔴 CRÍTICO |
| 2. Verificación CW vs CCW | **P1** | ❌ PENDIENTE | BAJA | 🟡 IMPORTANTE |
| 3. Validación NO_BET flow | **P1** | ❌ PENDIENTE | MEDIA | 🟡 IMPORTANTE |
| 4. Manejo desempates | **P1** | ❌ PENDIENTE | MEDIA | 🟡 IMPORTANTE |
| 5. Validación cartas vacías | **P2** | ❌ PENDIENTE | BAJA | 🟢 MEJORA |
| 6. Documentación de turnos | **P2** | ❌ PENDIENTE | BAJA | 🟢 MEJORA |

**Total:** 6 Items  
**Estimado:** 12-16 horas de desarrollo + testing  

---

## 🔴 PRIORIDAD 0: BLOQUEADORES

### CORRECCIÓN 1: Integración WebSocket en Frontend

#### Archivo: `Frontend/game.js`

#### Cambio 1.1: Detectar modo online en handleBettingRound()

**Ubicación:** Alrededor de línea 1119  
**Modificar:** La función `handleBettingRound()`

```javascript
// ANTES:
function handleBettingRound(playerIndex, action, betAmount = 0) {
    console.log(`Player ${playerIndex + 1} in betting round ${gameState.currentRound}: ${action}, bet amount: ${betAmount}`);
    console.log(`[handleBettingRound] Handling locally`);
    // ... código local
}

// DESPUÉS:
function handleBettingRound(playerIndex, action, betAmount = 0) {
    console.log(`Player ${playerIndex + 1} in betting round ${gameState.currentRound}: ${action}, bet amount: ${betAmount}`);
    
    // Detectar modo online
    if (window.onlineMode && window.QuantumMusSocket && window.QuantumMusOnlineRoom) {
        const serverIdx = (playerIndex + (window.QuantumMusLocalIndex || 0)) % 4;
        const data = action === 'raise' || action === 'envido' ? { amount: betAmount } : {};
        if (action === 'raise') action = 'envido';
        
        console.log(`[handleBettingRound] Sending action to server: player ${serverIdx}, action: ${action}`);
        
        window.QuantumMusSocket.emit('player_action', {
            room_id: window.QuantumMusOnlineRoom,
            player_index: serverIdx,
            action: action,
            data: data
        });
        return;  // No ejecutar lógica local en modo online
    }
    
    console.log(`[handleBettingRound] Handling locally (offline mode)`);
    // ... código local existente ...
}
```

**Validación:**
- [ ] Envía `player_action` al servidor correctamente
- [ ] No ejecuta lógica local en modo online
- [ ] Maneja conversión de índices correctamente
- [ ] Logging correctamente

---

#### Cambio 1.2: Escuchar actualizaciones del servidor

**Ubicación:** Al inicio de `initGame()` (alrededor de línea 200)  
**Agregar:** Listener para eventos del servidor

```javascript
// Al hacer inicialización del socket
if (window.QuantumMusSocket) {
    
    // Listener para actualizaciones de juego
    window.QuantumMusSocket.on('game_update', (data) => {
        console.log('[game_update] Recibido:', data);
        
        if (!data.game_state) return;
        
        const state = data.game_state;
        
        // Actualizar estado del juego
        gameState.currentRound = state.currentRound || gameState.currentRound;
        gameState.activePlayerIndex = state.activePlayerIndex || gameState.activePlayerIndex;
        gameState.manoIndex = state.manoIndex || gameState.manoIndex;
        
        // Actualizar scores
        if (state.teams) {
            gameState.teams.team1.score = state.teams.team1.score;
            gameState.teams.team2.score = state.teams.team2.score;
        }
        
        // Actualizar apuesta actual
        if (state.currentBet) {
            gameState.currentBet = { ...gameState.currentBet, ...state.currentBet };
        }
        
        // Actualizar UI
        updateScoreboard();
        updateRoundDisplay();
        
        // Si es nuestro turno, iniciar timer
        if (gameState.activePlayerIndex === window.QuantumMusLocalIndex) {
            startPlayerTurnTimer(gameState.activePlayerIndex);
        }
    });
    
    // Listener para eventos específicos de GRANDE
    window.QuantumMusSocket.on('grande_phase_update', (data) => {
        console.log('[grande_phase_update] Recibido:', data);
        
        if (data.grande_ended) {
            console.log('GRANDE phase ended:', data.reason);
            // Mostrar resultado
            if (data.reason === 'rejection') {
                showTeamPointsNotification(data.winner_team, data.points);
            } else if (data.comparison_deferred) {
                showNotification('Cartas se compararán después de todas las fases');
            }
            
            // Mover a siguiente ronda
            setTimeout(() => moveToNextRound(), 2000);
        }
    });
    
    // Listener para errores
    window.QuantumMusSocket.on('game_error', (data) => {
        console.error('[game_error]', data.error);
        showAlert(`Error: ${data.error}`);
    });
}
```

**Validación:**
- [ ] Escucha eventos `game_update` correctamente
- [ ] Actualiza estado del juego
- [ ] Actualiza UI después de recibir datos
- [ ] Maneja errores del servidor

---

### Cambio 1.3: Validar que emitimos datos correctos

**Ubicación:** Función `handleBettingRound()` nuevamente  
**Agregar:** Logging detallado

```javascript
// Agregar antes de socket.emit:
console.log('[handleBettingRound DEBUG]', {
    playerIndex: playerIndex,
    action: action,
    betAmount: betAmount,
    serverIdx: serverIdx,
    room: window.QuantumMusOnlineRoom,
    data: data
});
```

---

## 🟡 PRIORIDAD 1: IMPORTANTES

### CORRECCIÓN 2: Verificación CW vs CCW

#### Archivo: `backend/grande_betting_handler.py`

#### Opción A: Unificar a CCW (recomendado)

```python
# ANTES:
def _get_next_player_clockwise(self, current_player):
    """Get next player in clockwise order (current + 1) mod 4"""
    return (current_player + 1) % 4

# DESPUÉS:
def _get_next_player_clockwise(self, current_player):
    """
    Get next player in counter-clockwise order (same as MUS phase).
    Counter-clockwise: 0 → 3 → 2 → 1 → 0
    """
    return (current_player + 3) % 4  # Equivalent to (current_player - 1) % 4
```

**Justificación:**
- Mantiene consistencia con MUS fase
- Reglas de Mus tradicional usan CCW
- Evita confusión entre fases

**Nota:** Documentar esto en README

---

### CORRECCIÓN 3: Validar NO_BET Flow

#### Archivo: `backend/grande_betting_handler.py`

#### Agregar test explícito:

```python
# En test_grande_phase.py, agregar nuevo test:

def test_scenario_phase_no_bet_full_cycle():
    """Test all 4 players passing in NO_BET state"""
    print_separator("SCENARIO: Full No-Bet Cycle (All 4 Players Pass)")
    
    players = [
        {'username': 'Player0', 'id': 0},
        {'username': 'Player1', 'id': 1},
        {'username': 'Player2', 'id': 2},
        {'username': 'Player3', 'id': 3}
    ]
    
    game = QuantumMusGame('test_full_no_bet', players, '4')
    game.deal_cards()
    game.state['currentRound'] = 'GRANDE'
    game.round_handler.grande_handler.initialize_grande_phase()
    
    # Mano pasa
    print("Player 0 (Mano) passes")
    result0 = game.process_action(0, 'paso')
    assert result0['success'], "Mano paso should succeed"
    assert game.state['activePlayerIndex'] == 1, "Should move to next player"
    
    # Siguiente pasa (Player 1 - Team 2)
    print("Player 1 passes")
    result1 = game.process_action(1, 'paso')
    assert result1['success'], "Player 1 paso should succeed"
    assert game.state['activePlayerIndex'] == 2, "Should move to next player"
    
    # Player 2 pasa
    print("Player 2 passes")
    result2 = game.process_action(2, 'paso')
    assert result2['success'], "Player 2 paso should succeed"
    assert game.state['activePlayerIndex'] == 3, "Should move to next player"
    
    # Player 3 pasa (último jugador)
    print("Player 3 passes")
    result3 = game.process_action(3, 'paso')
    assert result3['success'], "Player 3 paso should succeed"
    
    # Debería completar El ciclo y resolver como todos pasan
    assert result3.get('grande_ended'), "Grande should end when all pass"
    assert result3.get('all_passed'), "Should be marked as all_passed"
    assert result3.get('comparison_deferred'), "Comparison should be deferred"
    assert result3.get('points_at_stake') == 1, "Should be 1 point"
    
    print("\n✓ Full no-bet cycle completed successfully")
    return True

# Ejecutar en main:
if __name__ == '__main__':
    # ... otros tests ...
    test_scenario_phase_no_bet_full_cycle()
```

**Validación:**
- [ ] Complete ciclo de 4 pasadas termina correctamente
- [ ] No hay loops infinitos
- [ ] Estado pasa a RESOLVED

---

### CORRECCIÓN 4: Manejar Desempates Correctamente

#### Archivo: `backend/grande_betting_handler.py`

#### Función: `compare_and_resolve_grande()`

```python
# ANTES:
def compare_and_resolve_grande(self):
    # ... código de comparación ...
    if result > 0:
        winner_team = 'team1'
    elif result < 0:
        winner_team = 'team2'
    else:
        # Tie - Mano's team wins
        mano_team = self.game.get_player_team(self.game.state['manoIndex'])
        winner_team = mano_team

# DESPUÉS:
def compare_and_resolve_grande(self):
    phase = self.state['grandePhase']
    
    # ... código de comparación ...
    if result > 0:
        winner_team = 'team1'
    elif result < 0:
        winner_team = 'team2'
    else:
        # TIE - Aplicar regla de Mano
        mano_index = self.game.state['manoIndex']
        mano_team = self.game.get_player_team(mano_index)
        
        # Verificar si Mano participó en GRANDE
        attacking_team = phase['result'].get('attackingTeam')
        defending_team = phase['result'].get('defendingTeam')
        
        if attacking_team and defending_team:
            # Hubo apuesta/defensa, Mano participó
            logger.info(f"Grande tied. Mano ({mano_team}) wins desempate")
            winner_team = mano_team
        elif phase['result'].get('allPassed'):
            # Todos pasaron, Mano es quien "defiende" implícitamente
            logger.info(f"All passed - Grande tied. Mano ({mano_team}) wins")
            winner_team = mano_team
        else:
            # Edge case: indefinido
            logger.warning("Desempate en Grande - Mano no participó explícitamente")
            logger.warning(f"Defaulting to Mano team: {mano_team}")
            winner_team = mano_team
    
    # Asignar puntos
    points = phase['result'].get('betAmount', 1)
    self.game.state['teams'][winner_team]['score'] += points
    
    phase['result']['winner'] = winner_team
    phase['result']['points'] = points
    phase['result']['resolved'] = True
    
    logger.info(f"{winner_team} wins {points} points in Grande (Resultado: {'Empate' if result == 0 else 'Comparación'})")
    
    return {
        'winner': winner_team,
        'points': points,
        'team1_best': team1_best,
        'team2_best': team2_best,
        'result': 'tie' if result == 0 else 'comparison'
    }
```

**Validación:**
- [ ] Desempates documentados explícitamente
- [ ] Logging claro de qué ocurre
- [ ] Mano siempre gana desempates

---

## 🟢 PRIORIDAD 2: MEJORAS

### CORRECCIÓN 5: Validación de Cartas Vacías

#### Archivo: `backend/grande_betting_handler.py`

#### Función: `compare_and_resolve_grande()`

```python
# Agregar validaciones al inicio:
def compare_and_resolve_grande(self):
    phase = self.game.state['grandePhase']
    
    if not phase or phase.get('result', {}).get('resolved'):
        logger.warning("compare_and_resolve_grande: Phase not deferred or already resolved")
        return None
    
    # Obtener cartas
    try:
        team1_cards = []
        team2_cards = []
        
        for player_idx, hand in self.game.hands.items():
            if not hand:
                logger.warning(f"Player {player_idx} has empty hand!")
                continue
            
            if player_idx in self.game.state['teams']['team1']['players']:
                team1_cards.extend([card.to_dict() for card in hand])
            else:
                team2_cards.extend([card.to_dict() for card in hand])
        
        # Validar que ambos equipos tienen cartas
        if not team1_cards:
            logger.error("Team 1 has NO CARDS - this should not happen!")
            logger.error(f"Hands state: {self.game.hands}")
            # No comparar, asignar a team2 por defecto
            team1_best = None
        else:
            team1_best = get_highest_card(team1_cards, self.game.game_mode)
        
        if not team2_cards:
            logger.error("Team 2 has NO CARDS - this should not happen!")
            logger.error(f"Hands state: {self.game.hands}")
            team2_best = None
        else:
            team2_best = get_highest_card(team2_cards, self.game.game_mode)
        
        # Comparar
        if team1_best and team2_best:
            result = compare_cards(...)
        elif team1_best:
            logger.warning("Team 2 sin cartas - Team 1 gana")
            winner_team = 'team1'
        elif team2_best:
            logger.warning("Team 1 sin cartas - Team 2 gana")
            winner_team = 'team2'
        else:
            logger.error("Ambas equipos sin cartas - estado inválido")
            winner_team = self.game.get_player_team(self.game.state['manoIndex'])
    
    except Exception as e:
        logger.error(f"Error comparing Grande: {e}")
        raise
```

---

### CORRECCIÓN 6: Documentación de Turnos

#### Archivo: Crear `GRANDE_TURN_ORDER.md`

```markdown
# GRANDE Phase - Turn Order Documentation

## Turn Direction

GRANDE uses **Counter-Clockwise (CCW)** order, consistent with MUS phase:

```
0 → 3 → 2 → 1 → 0
```

### Implementation

```python
# Get next player in CCW order
def next_player_ccw(current_player):
    return (current_player + 3) % 4  # Or (current_player - 1) % 4
```

## Scenarios

### Scenario 1: NO_BET (All Pass)
```
Player 0 (Mano) → 'paso'
Player 3 → 'paso'
Player 2 → 'paso'
Player 1 → 'paso'
[Back to 0, phase ends: all_passed]
```

### Scenario 2: BET_PLACED
```
Player 0 (Mano) → 'paso'
Player 1 → 'envido' (5 points)
[Team 1 is now defending; Team 2 is attacking]

Defending team (1) first responder:
Player 2 (first on defending team CCW from 1) → 'paso'
Player 0 (partner of 2) → 'paso'
[Both rejected, phase ends]
```

### Scenario 3: RAISE (Roles Switch)
```
Original:
- Attacking: Team 1 (Player 0 bet)
- Defending: Team 2 (Player 1)

Player 1 → 'envido' (raise to 15)

After raise:
- Attacking: Team 2 (now they raised)
- Defending: Team 1 (now defending)

Next to respond: First from Team 1 CCW from Player 1
= Player 0 (Mano) → Can 'accept' or 'paso'
```

## Rules & Edge Cases

- **CW vs CCW**: Consistent with MUS phase (CCW)
- **Turn after raise**: Finding next defender on new defending team, starting from betting player position
- **Mano's turn**: Mano always follows CCW order like any other player
- **Full cycle**: When sequence returns to starting player, evaluate if phase complete

## Verification

See `test_scenario_phase_no_bet_full_cycle()` in `test_grande_phase.py`
```

---

## 📅 TIMELINE ESTIMADO

| Corrección | Tiempo | Notas |
|-----------|--------|-------|
| 1.1-1.3 WebSocket | 4 horas | Implementación + testing |
| 2 CW vs CCW | 1 hora | Cambio + regression test |
| 3 NO_BET flow | 2 horas | Test + validación |
| 4 Desempates | 2 horas | Mejora de lógica |
| 5 Cartas vacías | 1 hora | Logging + validación |
| 6 Documentación | 1 hora | Escribir docs |
| **Testing Total** | 4 horas | End-to-end + scenarios |
| **TOTAL** | ~15 horas | Dev + testing |

---

## ✅ CHECKLIST FINAL

Antes de pasar a **Fase 4: CHICA Phase**, validar:

- [ ] WebSocket implementado y testeado en modo online
- [ ] CW vs CCW unificado en CCW
- [ ] NO_BET flow valida todos los 4 ciclos
- [ ] Desempates documentados y funcionales
- [ ] Cartas vacías manejadas correctamente
- [ ] Documentación de turnos completa
- [ ] 100% de tests pasan (backend + frontend)
- [ ] Estado sincronizado entre cliente/servidor

**Documento generado:** February 8, 2026  
**Estado:** Listo para implementación
