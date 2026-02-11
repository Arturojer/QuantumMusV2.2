# Pares and Juego Declaration/Turn Fix Summary

## Issues Fixed

### 1. Critical Bug: game.teams Access Error ✅
**File**: `backend/server.py` lines 252-253

**Problem**: Code tried to access `game.teams` but teams are stored in `game.state['teams']`
```python
# BEFORE (caused crash)
team1_players = game.teams['team1']['players']
team2_players = game.teams['team2']['players']

# AFTER (fixed)
team1_players = game.state['teams']['team1']['players']
team2_players = game.state['teams']['team2']['players']
```

**Impact**: Caused Socket.IO errors and prevented juego declarations from completing.

---

### 2. Juego Scoring Inconsistency ✅
**File**: `backend/game_logic.py` line 958

**Problem**: Hardcoded '2' value to 1 point in `_check_certain_juego_outcome`, ignoring game mode
```python
# BEFORE
if val == '2':
    return 1  # Always 1, ignoring game_mode

# AFTER
if val == '2':
    return 2 if self.game_mode == '4' else 1  # Respects game_mode
```

**Impact**: Incorrect juego probability calculations in mode 4.

---

### 3. Auto-Declaration at Uncertain Probabilities ✅
**Files**: `backend/game_logic.py` - `_check_certain_pares_outcome` and `_check_certain_juego_outcome`

**Problem**: Auto-declaration was triggering at 50%, 13%, etc. instead of only 0%/100%
- Old logic tried to use `partner_card_id` attribute which didn't exist
- When partner info not found, treated entangled cards as having only one value
- Made uncertain outcomes appear certain

**Solution**: Rewrote to use correct quantum entanglement logic:
- K and A cards can swap (K↔A entanglement)
- 2 and 3 cards can swap in mode 8 (2↔3 entanglement)
- Check all possible collapse combinations
- Return None (manual) if ANY uncertainty exists

```python
# NEW LOGIC
if card_value == 'K':
    entangled_cards.append(['K', 'A'])
elif card_value == 'A':
    entangled_cards.append(['A', 'K'])
# ... check all combinations ...
```

**Impact**: Now correctly requires manual declaration when outcome is uncertain.

---

### 4. Wrong Entanglement Pairs ✅
**File**: `backend/Logica_cuantica/baraja.py` - `collapse_king_pit` method

**Problem**: Entanglement was K↔10 (Rey↔Pito) but should be K↔A (King↔Ace)
```python
# BEFORE
rey = self.PALO_CODE[palo] + self.VALOR_CODE[12]  # K
pito = self.PALO_CODE[palo] + self.VALOR_CODE[10]  # 10

# AFTER
rey = self.PALO_CODE[palo] + self.VALOR_CODE[12]  # K
as_card = self.PALO_CODE[palo] + self.VALOR_CODE[1]  # A (Ace/Pito)
```

**Clarification**: Pito = Ace (value 1), not 10

**Impact**: Correct quantum entanglement behavior.

---

### 5. Missing Mode 8 Value Equivalence for PARES ✅
**File**: `backend/game_logic.py` - `_check_certain_pares_outcome`

**Problem**: Didn't apply value normalization rules for mode 8
- In mode 8, A and 2 are equivalent (form pairs together)
- In mode 8, 3 and K are equivalent (form pairs together)

**Solution**: Added normalization function
```python
def normalizeValueForPares(val):
    if self.game_mode == '8':
        if val == 'A': return '2'  # A and 2 form pairs
        if val == '3': return 'K'  # 3 and K form pairs
    return val
```

**Example**:
- Hand: A/K, A/K, 2/3 (in mode 8)
- All 8 collapse combinations result in pairs
- Correctly auto-declares "tengo" (100% probability)

---

## How Entanglement Works

### Quantum Entanglement (Within Same Suit)
**Always Active:**
- K↔A: King and Ace are in 50/50 superposition
- When one collapses to K, the other collapses to A

**Mode 8 Only:**
- 2↔3: Two and Three are in 50/50 superposition
- When one collapses to 2, the other collapses to 3

### Value Equivalence (Mode 8 Only, For PARES)
When checking for pairs in mode 8:
- A = 2 (these values form pairs with each other)
- 3 = K (these values form pairs with each other)

**Example**: 
- Cards: A, 2, 5, 7
- Normalized: 2, 2, 5, 7
- Result: Has pair (2-2) → 100%

---

## Auto-Declaration Logic

### When to Auto-Declare
1. **100% Probability**: All possible collapse combinations have pares/juego → auto-declare "tengo"
2. **0% Probability**: No possible collapse combination has pares/juego → auto-declare "no tengo"
3. **Any Uncertainty**: Mixed outcomes across combinations → require manual declaration (puede/tengo/no tengo)

### Test Cases

#### Pares Examples
| Hand | Mode | Probability | Auto-Declare |
|------|------|-------------|--------------|
| K, K, 5, 7 | Any | 100% | tengo |
| 5, 6, 7, J | Any | 0% | no tengo |
| A/K, A/K, 6, 7 | 4 | 50% | manual |
| A/K, A/K, 2/3 | 8 | 100% | tengo |
| A/K, A/K, A/K, 5 | Any | 100% | tengo |

#### Juego Examples (31+ points)
| Hand | Mode | Min-Max | Auto-Declare |
|------|------|---------|--------------|
| K, K, K, K | Any | 40-40 | tengo |
| 4, 5, 6, 7 | Any | 22-22 | no tengo |
| K/A, K/A, K/A, K/A | 4 | 4-40 | manual |

---

## Files Modified

1. **backend/server.py**
   - Line 252-253: Fixed game.teams → game.state['teams']

2. **backend/game_logic.py**
   - Line 958: Fixed mode-dependent scoring for '2'
   - Lines 887-956: Rewrote `_check_certain_pares_outcome` with correct logic
   - Lines 958-1022: Rewrote `_check_certain_juego_outcome` with correct logic

3. **backend/Logica_cuantica/baraja.py**
   - Lines 123-155: Changed K↔10 to K↔A entanglement

---

## Testing

### Auto-Declaration Tests ✅
- 100% probability (4 of a kind): auto-declares "tengo" ✓
- 0% probability (all different): auto-declares "no tengo" ✓
- Uncertain outcomes: requires manual declaration ✓

### Betting Logic Tests
- Most scenarios working ✓
- One remaining issue: all "no tengo" should skip betting (currently starts betting)

---

## Remaining Work

1. **Betting Logic**: Fix "all no tengo" scenario to skip betting round
2. **Juego Penalties**: Verify -2 points deduction works correctly
3. **Punto Betting**: Verify collapse and penalties work in PUNTO round

---

## Security & Code Quality

- **Code Review**: ✅ Passed (minor naming suggestions only)
- **Security Scan**: ✅ Passed (no vulnerabilities found)
- **Tests**: ✅ 3/4 test scenarios passing

---

## Summary

All critical bugs that were causing auto-declaration at uncertain probabilities have been fixed. The system now correctly:

1. Only auto-declares at 0% or 100% probability
2. Uses correct K↔A entanglement (not K↔10)
3. Applies mode 8 value equivalence for PARES (A=2, 3=K)
4. Checks all possible quantum collapse combinations
5. Respects game mode for scoring calculations
6. Doesn't crash when accessing team information

The turn advancement logic was verified to be correct - manual declarations wait for collapse, while puede and auto-declarations advance immediately.
