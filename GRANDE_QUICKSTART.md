# Grande Phase - Quick Start Guide

## 🚀 Getting Started in 5 Minutes

### Step 1: Verify Installation

The Grande phase implementation is complete! Verify the files:

```bash
# Check backend files exist
ls backend/grande_betting_handler.py
ls backend/test_grande_phase.py
```

### Step 2: Run Tests

```bash
cd backend
python test_grande_phase.py
```

You should see:
```
==================================================================
  GRANDE PHASE BETTING DYNAMICS - TEST SUITE
==================================================================

✓ SCENARIO 1: All Four Players Pass - PASSED
✓ SCENARIO 2: Bet and Double Rejection - PASSED
✓ SCENARIO 3: Bet and Accept - PASSED
✓ SCENARIO 4: Bet, Raise, Accept - PASSED
✓ SCENARIO 5: Órdago - PASSED

==================================================================
  ALL TESTS COMPLETED SUCCESSFULLY!
==================================================================
```

### Step 3: Understand the Flow

```
Game starts → MUS phase → Player chooses PASO → GRANDE begins
                                    ↓
                          Player 0 (Mano) speaks first
                                    ↓
                    ┌───────────────┴───────────────┐
                    ↓                               ↓
              Player PASSES                   Player BETS
                    ↓                               ↓
              Next player                     Defender responds
                                                    ↓
                                    ┌───────────────┼───────────────┐
                                    ↓               ↓               ↓
                                 REJECT          ACCEPT          RAISE
                                    ↓               ↓               ↓
                              1 point to      Bet locked,      Roles switch,
                              attacker        deferred         continue betting
```

### Step 4: Basic API Usage

```python
from game_logic import QuantumMusGame

# Create game
players = [
    {'username': 'Alice', 'id': 0},
    {'username': 'Bob', 'id': 1},
    {'username': 'Carol', 'id': 2},
    {'username': 'Dave', 'id': 3}
]
game = QuantumMusGame('room_123', players, '4')
game.deal_cards()

# Start Grande phase
game.state['currentRound'] = 'GRANDE'
game.round_handler.grande_handler.initialize_grande_phase()

# Player 0 (Mano) bets 10 points
result = game.process_action(0, 'envido', {'amount': 10})
print(result)
# {'success': True, 'bet_placed': True, 'bet_amount': 10, 'next_player': 1}

# Player 1 (defender) accepts
result = game.process_action(1, 'accept')
print(result)
# {'success': True, 'grande_ended': True, 'bet_accepted': True, 
#  'bet_amount': 10, 'comparison_deferred': True}
```

### Step 5: Frontend Integration

#### HTML Buttons
```html
<div class="action-buttons">
    <button id="paso-btn" class="action-btn">Paso</button>
    <button id="envido-btn" class="action-btn">Envido</button>
    <button id="accept-btn" class="action-btn">Accept</button>
    <button id="ordago-btn" class="action-btn">Órdago</button>
</div>

<div id="grande-status"></div>
```

#### JavaScript
```javascript
// Send action
document.getElementById('envido-btn').addEventListener('click', () => {
    socket.emit('player_action', {
        room_id: currentRoom,
        player_index: myPlayerIndex,
        action: 'envido',
        extra_data: { amount: 10 }
    });
});

// Receive updates
socket.on('grande_phase_update', (data) => {
    if (data.grande_ended) {
        alert(`Grande ended! ${data.bet_amount} points at stake.`);
    }
});
```

---

## 📖 Common Actions

### Player Passes (No Bet Yet)
```python
result = game.process_action(player_index, 'paso')
# Turn moves to next player clockwise
```

### Player Bets
```python
result = game.process_action(player_index, 'envido', {'amount': 10})
# Opponent must respond
```

### Defender Rejects
```python
result = game.process_action(defender_index, 'paso')
# Partner gets a chance, or 1 point awarded if both reject
```

### Defender Accepts
```python
result = game.process_action(defender_index, 'accept')
# Grande ends, comparison deferred
```

### Defender Raises
```python
result = game.process_action(defender_index, 'envido', {'amount': 20})
# Roles switch, original bettor must respond
```

### Player Calls Órdago
```python
result = game.process_action(player_index, 'ordago')
# 40 points at stake, opponent must accept/reject
```

---

## 🎮 Complete Game Example

```python
# Initialize
game = QuantumMusGame('test_room', players, '4')
game.deal_cards()
game.state['currentRound'] = 'GRANDE'
game.round_handler.grande_handler.initialize_grande_phase()

# Turn 1: Mano (Player 0) bets 5
result = game.process_action(0, 'envido', {'amount': 5})
assert result['success'] == True
assert result['next_player'] == 1  # Defender

# Turn 2: Defender (Player 1) raises to 15
result = game.process_action(1, 'envido', {'amount': 15})
assert result['success'] == True
assert result['raised'] == True
assert result['next_player'] == 0  # Back to original bettor

# Turn 3: Original bettor (Player 0) accepts
result = game.process_action(0, 'accept')
assert result['success'] == True
assert result['grande_ended'] == True
assert result['bet_amount'] == 15
assert result['comparison_deferred'] == True

# Grande phase complete!
# 15 points will be awarded after all 4 phases (Grande, Chica, Pares, Juego)
```

---

## 🔍 Debugging

### Check Current State
```python
# Print current phase state
print(game.state['grandePhase'])
```

### Check Active Player
```python
print(f"Active player: {game.state['activePlayerIndex']}")
print(f"Mano: {game.state['manoIndex']}")
```

### Check Teams
```python
player_team = game.get_player_team(player_index)
print(f"Player {player_index} is on {player_team}")
```

### Check Bet Status
```python
phase = game.state['grandePhase']
print(f"Phase state: {phase['phaseState']}")
print(f"Current bet: {phase['currentBetAmount']}")
print(f"Attacking team: {phase['attackingTeam']}")
```

---

## 📚 Documentation Files

1. **`GRANDE_IMPLEMENTATION_SUMMARY.md`** - Complete overview
2. **`backend/GRANDE_PHASE_GUIDE.md`** - Detailed implementation guide
3. **`GRANDE_FRONTEND_INTEGRATION.md`** - Frontend integration examples
4. **`backend/test_grande_phase.py`** - Test suite
5. **This file** - Quick start guide

---

## ❓ FAQ

**Q: When does Grande phase start?**  
A: After MUS phase, when any player chooses PASO, ENVIDO, or ÓRDAGO.

**Q: Who speaks first in Grande?**  
A: Mano (the player who dealt, tracked in `state['manoIndex']`).

**Q: What happens if all players pass?**  
A: Grande is played for 1 point, comparison deferred until end.

**Q: Can I raise multiple times?**  
A: Yes! Each raise switches roles. Keep raising until someone accepts or rejects.

**Q: When are cards compared?**  
A: After all 4 phases (Grande, Chica, Pares, Juego) complete.

**Q: What if hands are tied?**  
A: Mano's team wins the tie.

**Q: How much can I bet?**  
A: Envido: 2-30 points. Órdago: 40 points (entire game).

**Q: What if both defenders reject?**  
A: Attacking team wins 1 point immediately (not the bet amount).

---

## ✅ Verification Checklist

Before using in production:

- [ ] Run test suite: `python backend/test_grande_phase.py`
- [ ] Verify no errors: Check `get_errors()` output
- [ ] Review implementation: Read `GRANDE_PHASE_GUIDE.md`
- [ ] Test frontend integration: Follow `GRANDE_FRONTEND_INTEGRATION.md`
- [ ] Understand game flow: Review `GRANDE_IMPLEMENTATION_SUMMARY.md`

---

## 🎉 You're Ready!

The Grande phase is fully implemented and tested. Start using it in your game!

**Need Help?**
- Review the test scenarios in `test_grande_phase.py`
- Check the detailed guide in `GRANDE_PHASE_GUIDE.md`
- Examine the implementation in `grande_betting_handler.py`

**Happy Gaming! 🎴**
