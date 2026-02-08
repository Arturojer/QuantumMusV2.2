# 📋 REVISIÓN FASE 3: GRANDE ROUND (Cartas Altas)
## Plan de Auditoría Completa

**Estado Actual:** En Revisión  
**Responsable:** Sistema de Auditoría Automática  
**Fecha:** Febrero 8, 2026  

---

## ✅ CHECKLIST DE VALIDACIÓN

### 1. **ORDEN DE CARTAS - GRANDE (Cartas Altas)**

#### Requerimiento:
```
K > Q > J > 7 > 6 > 5 > 4 > A
```

#### Análisis de Código (card_deck.py):
```python
def get_card_order(game_mode='4'):
    """Get card order for comparison (higher index = better card)"""
    if game_mode == '8':
        return ['A', '2', '4', '5', '6', '7', 'J', 'Q', 'K', '3']
    else:
        return ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K']  # ✓ CORRECTO
```

**Verificación:**
- ✅ El índice más alto = mejor carta
- ✅ K está en índice 9 (máximo)
- ✅ A está en índice 0 (mínimo)
- ✅ Orden correcto: A(0) < 2 < 3 < 4 < 5 < 6 < 7 < J < Q < K(9)

#### Función de Comparación:
```python
def compare_cards(card1_value, card2_value, game_mode='4', lower_wins=False):
    order = get_card_order(game_mode)
    val1 = normalize_card_value(card1_value, game_mode)
    val2 = normalize_card_value(card2_value, game_mode)
    
    idx1 = order.index(val1)
    idx2 = order.index(val2)
    
    if lower_wins:
        # Lower cards win (CHICA mode)
        if idx1 < idx2: return 1
        elif idx1 > idx2: return -1
    else:
        # Higher cards win (GRANDE mode) ✓ DEFAULT
        if idx1 > idx2: return 1
        elif idx1 < idx2: return -1
    return 0
```

**Resultado:** ✅ CORRECTO - Orden y comparación funcionan bien

---

### 2. **SISTEMA DE APUESTAS - FASE GRANDE**

#### Estados de la Fase:
- `NO_BET`: Sin apuesta (inicio)
- `BET_PLACED`: Se colocó una apuesta
- `WAITING_RESPONSE`: Esperando respuesta de defensores
- `RESOLVED`: Fase terminada

#### Acciones Válidas:
1. **PASO** (paso/rechazo)
2. **ENVIDO** (apuesta/raise)
3. **ÓRDAGO** (all-in)
4. **ACCEPT** (aceptación implícita)

#### Análisis de Código (grande_betting_handler.py):

**Inicialización:**
```python
def initialize_grande_phase(self):
    self.game.state['grandePhase'] = {
        'phaseState': 'NO_BET',
        'attackingTeam': None,
        'defendingTeam': None,
        'currentBetAmount': 0,
        'betType': None,
        'lastBettingTeam': None,
        'defendersResponded': [],
        'allPassed': True,
        'result': None
    }
    self.game.state['activePlayerIndex'] = self.game.state['manoIndex']
```

**Issues Identificados:**
- ⚠️ **MANO habla primero pero sin apuesta?** → Cuando Mano inicia GRANDE sin apuesta previa (paso en MUS), ¿a quién se le asigna `activePlayerIndex`?
  - Si es Mano → ✅ Correcto
  - Si es siguiente → ❌ Revisar documentación de MUS

---

### 3. **DINÁMICA DE TURNOS Y ROLES**

#### Flujo Base (Sin Apuesta Previa):
```
Mano → Siguiente (CCW) → Siguiente (CCW) → Siguiente (CCW) → [loop back to Mano]
```

**Validación:** ¿Se implementa correctamente `_get_next_player_clockwise()`?

```python
def _get_next_player_clockwise(self, current_player):
    """Get next player in clockwise order (current + 1) mod 4"""
    return (current_player + 1) % 4
```

❓ **PROBLEMA POTENCIAL:** 
- Mus usa orden COUNTER-CLOCKWISE (0 → 3 → 2 → 1)
- ¿GRANDE usa CLOCKWISE (0 → 1 → 2 → 3)?
- **Necesita verificación con reglas de Mus tradicional**

#### Flujo con Apuesta Previa:
```
Betting Team (non-Mano) → First Defender (Mano or closest to Mano) → 
[roles switch on raise]
```

**Código:**
```python
def _place_bet(self, player_index, betting_team, bet_type, bet_amount):
    phase['attackingTeam'] = betting_team
    phase['defendingTeam'] = self.game.get_opponent_team(betting_team)
    first_defender = self._get_next_defender_clockwise(player_index)
    self.game.state['activePlayerIndex'] = first_defender
```

**Validación:**
- ✅ Se asignan roles atacante/defensor
- ✅ Se encuentra primer defensor
- ⚠️ **¿CW vs CCW?** Confirmar con reglas

---

### 4. **CAMBIOS DE ROLES EN RAISES**

#### Escenario: Equipo A apuesta → Equipo B sube (raise)

**Antes:**
```
Attacking: Team A
Defending: Team B
```

**Después (raise):**
```
Attacking: Team B (nuevo)
Defending: Team A (ahora defienden)
```

**Código:**
```python
def _handle_raise(self, player_index, raising_team, new_bet_amount, is_ordago=False):
    old_attacking_team = phase['attackingTeam']
    phase['attackingTeam'] = raising_team  # ✓ Se invierte
    phase['defendingTeam'] = old_attacking_team
    phase['lastBettingTeam'] = raising_team
    phase['defendersResponded'] = []  # ✓ Se resetea
    
    first_defender = self._get_first_team_member_from_mano(old_attacking_team)
    self.game.state['activePlayerIndex'] = first_defender
```

**Validación:** ✅ CORRECTO
- ✓ Los roles se invierten
- ✓ Se resetean las respuestas
- ✓ Se busca primer defensor del equipo anterior

---

### 5. **RESOLUCIÓN DE APUESTAS**

#### Caso A: Ambos defensores rechazan
```python
def _resolve_rejection(self, winning_team):
    points = 1
    self.game.state['teams'][winning_team]['score'] += 1
    # Grande ends
```

**Verificación:**
- ✅ Equipo que apuesta gana 1 punto
- ✅ La fase termina inmediatamente
- ✅ No hay comparación

#### Caso B: Se acepta la apuesta
```python
def _resolve_acceptance(self):
    phase['result'] = {
        'attackingTeam': phase['attackingTeam'],
        'defendingTeam': phase['defendingTeam'],
        'betAmount': phase['currentBetAmount'],
        'betType': phase['betType'],
        'comparison': 'deferred',
        'resolved': False
    }
```

**Verificación:**
- ✅ Se guarda información de ambos equipos
- ✅ La comparación se DIFIERE (después de CHICA, PARES, JUEGO)
- ✅ Se preserva monto de apuesta

#### Caso C: Todos pasan (sin apuesta)
```python
def _resolve_all_pass(self):
    phase['result'] = {
        'betAmount': 1,
        'comparison': 'deferred',
        'allPassed': True,
        'resolved': False
    }
```

**Verificación:**
- ✅ Se juega por 1 punto
- ✅ La comparación se DIFIERE

---

### 6. **COMPARACIÓN DE CARTAS (Deferred)**

#### Función: `compare_and_resolve_grande()`
```python
def compare_and_resolve_grande(self):
    # Get best cards from each team
    team1_best = get_highest_card(team1_cards, self.game.game_mode)
    team2_best = get_highest_card(team2_cards, self.game.game_mode)
    
    result = compare_cards(
        team1_best['value'] if team1_best else 'A',
        team2_best['value'] if team2_best else 'A',
        self.game.game_mode
    )
    
    # Determine winner (ties go to Mano's team)
    if result > 0:
        winner_team = 'team1'
    elif result < 0:
        winner_team = 'team2'
    else:
        # Tie - Mano's team wins
        mano_team = self.game.get_player_team(self.game.state['manoIndex'])
        winner_team = mano_team
```

**Problemas Identificados:**

❌ **PROBLEMA 1: Acceso a Hands**
```python
for player_idx, hand in self.game.hands.items():
```
- Este acceso podría fallar si `self.game.hands` no está inicializado correctamente
- **Recomendación:** Agregar verificación

❌ **PROBLEMA 2: Cartas Vacías**
```python
team1_best = get_highest_card(team1_cards, self.game.game_mode)
```
- Si `team1_cards` está vacío → `get_highest_card()` retorna `None`
- El fallback es `'A'`, pero ¿es correcto?
- **Recomendación:** Documentar este comportamiento

❌ **PROBLEMA 3: Empates**
```python
mano_team = self.game.get_player_team(self.game.state['manoIndex'])
winner_team = mano_team
```
- En Mus tradicional, desempates van a Mano ✅
- PERO: Solo si Mano participa en GRANDE
- **Escenario problemático:** Si Mano ni apuesta ni defiende, ¿quién gana en desempate?

---

### 7. **ASIGNACIÓN DE PUNTOS**

#### Escenarios de Puntuación:

| Escenario | Puntos | Ganador | Momento |
|-----------|--------|---------|---------|
| Rechazo ambos defensores | 1 | Equipo que apuesta | Inmediato |
| Apuesta aceptada, Atacante gana | `betAmount` | Atacante | Deferred |
| Apuesta aceptada, Defensor gana | `betAmount` | Defensor | Deferred |
| Empate (ambos equipos) | `betAmount` | Equipo de Mano | Deferred |
| Todos pasan | 1 | Mejor carta | Deferred |

**Validación de Código:**
```python
points = phase['result'].get('betAmount', 1)
self.game.state['teams'][winner_team]['score'] += points
```

**Resultado:** ✅ CORRECTO

---

## 🔍 PRUEBAS NECESARIAS

### Test 1: Escenario Sin Apuesta
```
MUS: Todos dicen MUS
DISCARD: Cards cambio
GRANDE: Los 4 pasan → Comparación deferred
```
**Verificar:** Comparación se realiza correctamente después

### Test 2: Escenario Rechazo Simple
```
GRANDE: Eq A apuesta → Eq B rechaza (ambos) → Eq A gana 1
```
**Verificar:** Fase termina inmediatamente

### Test 3: Escenario Apuesta Aceptada
```
GRANDE: Eq A apuesta → Eq B acepta → Comparación deferred
CHICA/PARES/JUEGO: (fases siguientes)
[EOF Mano]: Comparación se ejecuta
```
**Verificar:** Puntos se asignan después de todas las fases

### Test 4: Escenario Raise
```
GRANDE: Eq A apuesta → Eq B sube → Eq A acepta
Verificar: Roles se invierten correctamente
```

### Test 5: Orden de Turnos
```
GRANDE: Verificar secuencia de activePlayerIndex
- Sin apuesta previa: Mano start → Siguiente CCW/CW
- Con apuesta previa: Primer defensor responde
```

---

## 🔧 CORRECCIONES RECOMENDADAS

### Prioritario (P0):
1. ✅ Verificar orden CW vs CCW en `_get_next_player_clockwise()`
2. ✅ Validar que `compare_and_resolve_grande()` maneja cartas vacías correctamente
3. ✅ Documentar comportamiento de desempates con Mano no participante

### Importante (P1):
4. ⚠️ Agregar logging detallado de cambios de roles
5. ⚠️ Validar que `defendersResponded` se resetea correctamente en raises

### Mejora (P2):
6. 📝 Documentar orden de turnos (CW vs CCW respecto a CCW en MUS)
7. 📝 Crear escenario de prueba para empates

---

## 📊 RESUMEN INICIAL

| Aspecto | Estado | Notas |
|---------|--------|-------|
| Orden de cartas | ✅ OK | K > Q > J > 7 > 6 > 5 > 4 > A |
| Comparación | ✅ OK | get_highest_card() y compare_cards() |
| Sistema de apuestas | ⚠️ Revisar | Necesita test completo |
| Turnos y roles | ⚠️ Revisar | CW vs CCW pendiente |
| Cambio de roles | ✅ OK | Lógica invierte equipos |
| Asignación puntos | ✅ OK | Fórmula correcta |
| Deferred comparison | ⚠️ Revisar | Necesita verification de llamada |

---

## 📌 PRÓXIMOS PASOS

1. [ ] Ejecutar test_grande_phase.py para validar scenarios
2. [ ] Verificar CW vs CCW en reglas de Mus tradicional
3. [ ] Revisar integración Frontend-Backend (game.js)
4. [ ] Crear tests de integración
5. [ ] Documentar edge cases
