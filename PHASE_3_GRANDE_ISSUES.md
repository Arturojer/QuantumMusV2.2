# 🔍 FASE 3 - GRANDE ROUND: PROBLEMAS Y VALIDACIONES IDENTIFICADAS

**Fecha:** Febrero 8, 2026  
**Estado:** Análisis en progreso  
**Reviewed:** Backend (grande_betting_handler.py), Frontend (game.js)  

---

## ✅ VALIDACIONES COMPLETADAS

### 1. Orden de Cartas - CORRECTO ✅
```
Implementado: ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K']
Requerido:    K > Q > J > 7 > 6 > 5 > 4 > A
Resultado: CORRECTO - Índice mayor = carta mejor
```

### 2. Tests Backend - PASAN ✅
```
SCENARIO 1: All Four Players Pass ..................... ✓ PASS
SCENARIO 2: Bet Placed, Both Defenders Reject ........ ✓ PASS
SCENARIO 3: Bet Placed and Accepted ................... ✓ PASS
SCENARIO 4: Bet, Raise, Accept ........................ ✓ PASS
SCENARIO 5: Órdago (All-in) ........................... ✓ PASS

Total: 5/5 tests passed
Execution time: < 1 second
No errors in logs
```

### 3. Cambio de Roles en Raises - CORRECTO ✅
```python
# Antes: Team A ataca, Team B defiende
# Raise por Team B:
attackingTeam = raising_team  # Team B ahora ataca
defendingTeam = old_attacking_team  # Team A ahora defiende
defendersResponded = []  # Reset respuestas

VALIDACIÓN: ✓ Roles se invierten correctamente
VALIDACIÓN: ✓ Las respuestas se resetean
VALIDACIÓN: ✓ Se busca primer defensor del equipo anterior
```

### 4. Asignación de Puntos (Rejection) - CORRECTO ✅
```python
if both_defenders_reject:
    points = 1
    game.state['teams'][betting_team]['score'] += 1
    
VALIDACIÓN: ✓ Equipo que apuesta gana inmediatamente
VALIDACIÓN: ✓ Fase termina sin comparación
```

### 5. Deferred Comparison - FUNCIONA ✅
```python
# En _resolve_deferred_comparisons():
if phase['result'].get('comparison') == 'deferred':
    result = self.round_handler.grande_handler.compare_and_resolve_grande()
    
VALIDACIÓN: ✓ Se llama después de todas las 4 fases
VALIDACIÓN: ✓ Se guarda información correctamente
```

---

## ⚠️ PROBLEMAS IDENTIFICADOS

### **PROBLEMA 1: Orden de Turnos - CW vs CCW** 🔴

#### Descripción:
El código usa `+1 (CW)` en GRANDE pero MUS usa `+3 (CCW)`:

```python
# En MUS (game.js y game_logic.py):
nextPlayer() → activePlayerIndex = (activePlayerIndex + 3) % 4

# En GRANDE (grande_betting_handler.py):
_get_next_player_clockwise() → return (current_player + 1) % 4
```

#### Análisis:
- MUS usa CCW (counter-clockwise): 0 → 3 → 2 → 1 → 0
- GRANDE usa CW (clockwise): 0 → 1 → 2 → 3 → 0

#### Pregunta Teórica:
En Mus real, ¿cambiar de dirección entre rondas es correcto o hay error?

#### Riesgos:
- ❌ Los turnos pueden ir en dirección incorrecta
- ❌ Confusión en el flujo del juego entre MUS y GRANDE
- ❌ Comportamiento inconsistente para AI

#### Recomendación:
```python
# OPCIÓN 1: Usar CCW en GRANDE también
def _get_next_player_clockwise(self, current_player):
    """Get next player in counter-clockwise order (like MUS)"""
    return (current_player + 3) % 4  # Or (current_player - 1) % 4

# OPCIÓN 2: Renombrar y aclarar
def _get_next_player_in_turn_order(self, current_player):
    # Use consistent order with MUS phase
    return (current_player + 3) % 4
```

**ESTADO:** ⚠️ **CRÍTICO - Requiere Verificación con Reglas**

---

### **PROBLEMA 2: Manejo de Cartas Vacías en Comparación** 🟡

#### Descripción:
```python
team1_best = get_highest_card(team1_cards, self.game.game_mode)

if team1_best is None:
    # Fallback: usar 'A' (la carta más baja) → ¿Es correcto?
    val1 = 'A'
```

#### Análisis:
- Si un equipo no tiene cartas → ¿Qué sucede?
- El fallback a 'A' parece razonable (peor carta)
- **PERO:** ¿Puede ocurrir una mano sin cartas?

#### Riesgos:
- ❌ Comparación incorrecta si `team1_cards` está vacío
- ❌ Comportamiento indefinido en edge cases

#### Solución:
```python
def compare_and_resolve_grande(self):
    if not team1_cards:
        logger.warning(f"Team 1 has no cards! This should not happen.")
        team1_best = None  # Handle properly downstream
    
    if not team2_cards:
        logger.warning(f"Team 2 has no cards! This should not happen.")
        team2_best = None
```

**ESTADO:** 🟡 **IMPORTANTE - Agregar Validación**

---

### **PROBLEMA 3: Desempates con Mano No Participante** 🟡

#### Descripción:
```python
# En compare_and_resolve_grande():
if result == 0:  # Empate
    # "Mano's team wins"
    mano_team = self.game.get_player_team(self.game.state['manoIndex'])
    winner_team = mano_team
```

#### Análisis:
- En Mus real: desempates van a Mano
- **PERO:** ¿Y si Mano ni apuesta ni defiende?
  - Ejemplo: Mano pasa en GRANDE, Team A vs Team B juegan
  - Si empatan → ¿Gana Mano (no participante)?

#### Pregunta Teórica:
¿En Mus real, si Mano no participa en la mano, dirimen los empates?

#### Riesgos:
- ❌ Mano puede ganar sin haber apostado
- ❌ Ventaja injusta

#### Solución Propuesta:
```python
# Versión mejorada:
if result == 0:  # Empate
    mano_team = self.game.get_player_team(self.game.state['manoIndex'])
    
    # Verificar si Mano participó en esta mano
    if phase['result'].get('allPassed'):
        # Todos pasaron, sin apuesta → Mano gana
        winner_team = mano_team
    elif mano_is_in_attacking_or_defending_team:
        # Mano participó → Mano's team gana desempate
        winner_team = mano_team
    else:
        # Mano no participó → ¿Quién gana?
        # Opción A: Equipo no-Mano gana (más justo)
        # Opción B: Sigue siendo Mano
        # Necesita clarificación de reglas
        logger.warning("Empate con Mano no participante - Comportamiento undefined")
        winner_team = mano_team  # Default actual
```

**ESTADO:** 🟡 **IMPORTANTE - Revisar Reglas**

---

### **PROBLEMA 4: Integración Frontend-Backend** 🟡

#### Descripción:
El Frontend en `game.js` no tiene integración WebSocket para GRANDE:

```javascript
// Frontend/game.js
function handleBettingRound(playerIndex, action, betAmount = 0) {
    // ❌ NO ENVÍA A SERVIDOR
    // ✅ Solo maneja localmente
}
```

#### Análisis:
- No hay `socket.emit('player_action', {...})`
- No hay listener para `game_update` desde servidor
- No hay sincronización de estado

#### Riesgos:
- ❌ En modo online: Las acciones no se envían al servidor
- ❌ IA no recibe actualizaciones
- ❌ Otros jugadores no ven las acciones
- ❌ Estado desincronizado

#### Solución:
```javascript
function handleBettingRound(playerIndex, action, betAmount = 0) {
    // Detectar si es online
    if (window.onlineMode && window.QuantumMusSocket && window.QuantumMusOnlineRoom) {
        // Enviar al servidor
        const serverIdx = (playerIndex + (window.QuantumMusLocalIndex || 0)) % 4;
        const data = action === 'raise' || action === 'envido' ? { amount: betAmount } : {};
        if (action === 'raise') action = 'envido';
        
        window.QuantumMusSocket.emit('player_action', {
            room_id: window.QuantumMusOnlineRoom,
            player_index: serverIdx,
            action: action,
            data: data
        });
        return;  // No ejecutar localmente
    }
    
    // Modo local: manejar aquí
    // ... código local existente ...
}
```

**ESTADO:** 🔴 **CRÍTICO - Requiere Implementación**

---

### **PROBLEMA 5: Flujo de Turnos en NO_BET State** 🟡

#### Descripción:
En el estado `NO_BET`, cuando los jugadores pasan secuencialmente:

```python
def _handle_no_bet_action(self, player_index, player_team, action, extra_data):
    if action == 'paso':
        # Mover siguiente jugador
        next_player = self._get_next_player_clockwise(player_index)
        
        # ¿Verificación de full circle?
        if next_player == self.game.state['manoIndex'] and player_index != self.game.state['manoIndex']:
            # Parecería que completa circle aquí...
            if phase['allPassed']:
                return self._resolve_all_pass()
```

#### Análisis:
- La lógica parece ser:
  - Jugador A (no-mano) pasa → siguiente
  - Siguiente pasa → siguiente
  - ...
  - Regresa a Mano → Check si todos pasaron

#### Pregunta:
¿Qué ocurre cuando Mano es el único que ha actuado y pasa?
- ¿Continúa con siguiente?
- ¿O la fase termina inmediatamente?

#### Riesgos:
- ❌ Flujo indefinido si solo Mano pasa
- ❌ Potencial loop infinito

**ESTADO:** 🟡 **IMPORTANTE - Revisar Lógica**

---

## 📋 RESUMEN DE ESTADO

| Aspecto | Estado | Notas |
|---------|--------|-------|
| Orden de cartas | ✅ OK | K > Q > J > 7 > 6 > 5 > 4 > A |
| Tests básicos | ✅ PASS | 5/5 scenarios |
| Cambio de roles | ✅ OK | Invierte equipos correctamente |
| Rejection | ✅ OK | Asigna 1 punto |
| Deferred comparison | ✅ OK | Se llama al final |
| **Orden de turnos CW/CCW** | ⚠️ REVISAR | MUS vs GRANDE inconsistente |
| **Cartas vacías** | 🟡 MEJORAR | Agregar validación |
| **Desempate sin Mano** | 🟡 REVISAR | Comportamiento indefinido |
| **Frontend-Backend** | 🔴 FALTA | Sin WebSocket |
| **NO_BET logic** | 🟡 REVISAR | Loop potencial |

---

## 📌 ACCIONES RECOMENDADAS

### Priority 0 - BLOQUEADORES:
1. [ ] **Implementar WebSocket en Frontend** (game.js)
   - Agregar `socket.emit('player_action', ...)` en `handleBettingRound()`
   - Agregar listeners para `game_update`
   - Validar sincronización de estado

### Priority 1 - IMPORTANTE:
2. [ ] **Verificar CW vs CCW**
   - Consultar reglas de Mus tradicional
   - Decidir: ¿Mantener inconsistencia o unificar?
   - Si se unifica: actualizar ambos

3. [ ] **Validar NO_BET flow**
   - Especialmente cuando solo Mano actúa
   - Crear test scenario: Mano pasa, otro pasa, etc.

4. [ ] **Revisar desempates sin Mano**
   - ¿Qué sucede realmente?
   - Documentar comportamiento esperado

### Priority 2 - MEJORAS:
5. [ ] **Agregar validación de cartas vacías**
   - Logging detallado
   - Manejo explícito de edge cases

6. [ ] **Mejorar documentación de turnos**
   - Aclarar CW vs CCW
   - Incluir diagramas de flujo

---

## 🧪 TESTS A EJECUTAR

```python
# Test 1: Orden de turnos en NO_BET
def test_turn_order_no_bet():
    # Mano → Siguiente → Siguiente → Siguiente → [vuelve a Mano?]
    # Verificar secuencia: 0 → 1 → 2 → 3 → 0

# Test 2: Desempate sin Mano participante
def test_tie_mano_not_participating():
    # Mano pasa
    # Team A apuesta, Team B acepta
    # Cartas empatan → ¿Quién gana?

# Test 3: Full betting cycle online
def test_online_full_betting():
    # Conectar cliente y servidor
    # Realizar ciclo completo de GRANDE
    # Verificar sincronización
```

---

## 📝 NOTAS PARA LA PRÓXIMA REVISIÓN

1. **GRANDE está ~80% implementado**
   - Backend: ✅ Completo y testeado
   - Frontend: ⚠️ Falta integración WebSocket
   - Lógica: ⚠️ Algunas dudas sobre reglas

2. **Proceder con Fase 4: CHICA después de resolver Priority 0**

3. **Documento disponible:** [PHASE_3_GRANDE_REVIEW.md](./PHASE_3_GRANDE_REVIEW.md)
