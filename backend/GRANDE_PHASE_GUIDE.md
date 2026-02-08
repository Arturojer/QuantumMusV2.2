# Grande Phase Betting Dynamics - Implementation Guide

## Overview

This implementation follows the traditional Mus "Grande" phase rules with precise turn-based betting dynamics, team coordination, and deferred hand comparison.

## Key Features

### 1. **Sequential Turn-Based Betting (Clockwise)**
- Mano (first to act) speaks first
- Actions proceed clockwise: Player 0 → 1 → 2 → 3 → 0
- Each player acts on their turn only
- Turn order strictly enforced

### 2. **Team-Based Attack/Defense Dynamics**
- **Team A (Mano's team)**: Acts first
- **Team B (Opposing team)**: Responds
- Teams switch roles during raises
- Attacking team places bets
- Defending team responds

### 3. **Betting States**

#### NO_BET State
When no bet has been placed yet:
- Players can: **Pass** (check) or **Bet** (envido/órdago)
- Passing moves to next player clockwise
- First bet establishes attacking/defending teams
- If all 4 players pass → Grande played for 1 point (deferred)

#### BET_PLACED State
When a bet exists:
- Defending team must respond
- First defender is: closest player to Mano clockwise on defending team
- Options: **Reject** (paso), **Accept**, **Raise** (envido), **Órdago**

#### WAITING_RESPONSE State
After first defender acts:
- If rejected → partner gets a chance
- If both reject → betting team wins 1 point immediately
- If accepted → Grande ends, comparison deferred
- If raised → roles switch, original bettor must respond

## Betting Actions

### 1. **PASO (Pass/Check/Reject)**

**When NO_BET exists:**
- Acts as a "check" - no action
- Turn passes to next player clockwise
- All 4 players passing → play for 1 point

**When BET exists:**
- Acts as a "reject"
- First defender rejects → partner must respond
- Both defenders reject → betting team wins 1 point

### 2. **ENVIDO (Bet/Raise)**

**Initial bet:**
- Amount: 2-30 points (typically 2, 5, 10, etc.)
- Betting team becomes attacking team
- Opponent must respond

**As a raise:**
- Increases current bet
- Roles switch: raiser becomes new attacking team
- Original bettor must respond

### 3. **ÓRDAGO (All-in)**

**Characteristics:**
- Bet of 40 points (entire game)
- Can be initial bet or raise
- Opponent must accept or reject
- Rejection ends game immediately
- Acceptance → winner takes all

### 4. **ACCEPT (Implicit)**

**Effect:**
- Locks in the bet amount
- Grande phase ends immediately
- Hand comparison is DEFERRED until after all 4 phases
- Points awarded after Juego phase completes

## Phase Flow Examples

### Example 1: All Pass
```
Player 0 (Mano): Paso → Player 1
Player 1: Paso → Player 2
Player 2: Paso → Player 3
Player 3: Paso → All passed
Result: Grande played for 1 point (comparison deferred)
```

### Example 2: Bet and Double Rejection
```
Player 0 (Mano): Paso → Player 1
Player 1 (Team 2): Envido 5 → Defender is Player 2
Player 2 (Team 1): Paso (reject) → Partner Player 0
Player 0 (Team 1): Paso (reject) → Both rejected
Result: Team 2 wins 1 point immediately, Grande ends
```

### Example 3: Bet and Accept
```
Player 0 (Mano, Team 1): Envido 10 → Defender is Player 1
Player 1 (Team 2): Accept
Result: 10 points at stake, comparison deferred, Grande ends
```

### Example 4: Bet, Raise, Accept
```
Player 0 (Team 1): Envido 5 → Defender is Player 1
Player 1 (Team 2): Envido 15 (raise) → Roles switch, Defender is Player 0
Player 0 (Team 1): Accept
Result: 15 points at stake, comparison deferred
```

### Example 5: Órdago
```
Player 0 (Mano): Paso → Player 1
Player 1 (Team 2): ÓRDAGO! → Defender is Player 2
Player 2 (Team 1): Accept
Result: 40 points at stake (entire game), comparison deferred
```

## Deferred Comparison System

### Why Deferred?
Traditional Mus rules require all 4 phases (Grande, Chica, Pares, Juego) to complete before revealing cards for any accepted bets.

### Storage
```python
grandePhase['result'] = {
    'attackingTeam': 'team1',
    'defendingTeam': 'team2',
    'betAmount': 10,
    'betType': 'envido',
    'comparison': 'deferred',
    'resolved': False
}
```

### Resolution Timing
1. **Immediate points awarded:** Rejections (1 point)
2. **Deferred points:** Accepted bets
3. **Resolution trigger:** After JUEGO phase completes
4. **Comparison order:** Grande → Chica → Pares → Juego

### Tie Resolution
- Compare highest cards for Grande
- If exactly tied → **Mano's team wins**
- Mano advantage is crucial in Mus strategy

## Implementation Architecture

### Files

#### `grande_betting_handler.py`
- **GrandeBettingHandler class**: Core Grande betting logic
- Methods:
  - `initialize_grande_phase()`: Set up Grande state
  - `handle_action()`: Process player actions
  - `compare_and_resolve_grande()`: Resolve deferred comparison
  - Turn management helpers

#### `round_handlers.py`
- Integrates GrandeBettingHandler
- Routes GRANDE round actions to handler
- Manages transition from MUS → GRANDE

#### `game_logic.py`
- Game state management
- Deferred results storage
- Phase initialization
- End-of-hand comparison resolution

### State Structure

```python
state['grandePhase'] = {
    'phaseState': 'NO_BET',  # or 'BET_PLACED', 'WAITING_RESPONSE', 'RESOLVED'
    'attackingTeam': 'team1',
    'defendingTeam': 'team2',
    'currentBetAmount': 10,
    'betType': 'envido',  # or 'ordago'
    'lastBettingTeam': 'team1',
    'defendersResponded': [1],  # Player indices
    'allPassed': False,
    'result': {
        'betAmount': 10,
        'comparison': 'deferred',
        'resolved': False
    }
}
```

## API Usage

### Initialize Grande Phase
```python
game.round_handler.grande_handler.initialize_grande_phase()
```

### Process Action
```python
# Player 0 bets 10 points
result = game.process_action(0, 'envido', {'amount': 10})

# Player 1 rejects
result = game.process_action(1, 'paso')

# Player 2 accepts
result = game.process_action(2, 'accept')

# Player 3 calls órdago
result = game.process_action(3, 'ordago')
```

### Check Results
```python
if result['success']:
    if result.get('grande_ended'):
        print(f"Grande ended!")
        if result.get('winner_team'):
            print(f"Winner: {result['winner_team']}")
        if result.get('comparison_deferred'):
            print(f"Comparison deferred until end of hand")
```

### Resolve Deferred Comparisons
```python
# Called automatically after all 4 phases
game._resolve_deferred_comparisons()

# Manual resolution
result = game.round_handler.grande_handler.compare_and_resolve_grande()
```

## Testing

### Run Test Suite
```bash
cd backend
python test_grande_phase.py
```

### Test Scenarios Covered
1. ✓ All players pass
2. ✓ Bet and double rejection
3. ✓ Bet and accept
4. ✓ Bet, raise, accept
5. ✓ Órdago

## Future Enhancements

### Phase Handlers (Similar to Grande)
- **ChicaBettingHandler**: Lower cards win
- **ParesBettingHandler**: Pairs betting
- **JuegoBettingHandler**: Juego/Punto betting

### Advanced Features
- **Señas (Signals)**: Team communication system
- **Multiple raises**: Handle 3+ raise cycles
- **Score tracking**: Detailed round-by-round history
- **Tournament mode**: Best of N games

## Rules Reference

### Mus Card Values (8 Reyes Mode)
```
GRANDE (Highest wins):
K (Rey) > Q (Caballo) > J (Sota) > 7 > 6 > 5 > 4 > A (As)

CHICA (Lowest wins):
A (As) < 4 < 5 < 6 < 7 < J < Q < K
```

### Point System
- **Envido**: 2-30 points (playerChoiceS)
- **Órdago**: 40 points (entire game)
- **Rejection**: 1 point to betting team
- **Win target**: 40 points

### Team Structure
- **Team 1 (Copenhague)**: Players 0, 2
- **Team 2 (Muchos Mundos)**: Players 1, 3
- **Mano**: Rotates clockwise each hand

## Troubleshooting

### Common Issues

**Issue**: Wrong player's turn
```python
# Check active player
if player_index != game.state['activePlayerIndex']:
    return {'success': False, 'error': 'Not your turn'}
```

**Issue**: Phase not initialized
```python
# Ensure Grande phase initialized
if not game.state.get('grandePhase'):
    game.round_handler.grande_handler.initialize_grande_phase()
```

**Issue**: Deferred comparison not resolving
```python
# Check result state
if game.state['grandePhase']['result']['comparison'] == 'deferred':
    game.round_handler.grande_handler.compare_and_resolve_grande()
```

## Contact & Support

For questions or issues with the Grande phase implementation:
- Review test cases in `test_grande_phase.py`
- Check detailed rules in main README
- Examine handler logic in `grande_betting_handler.py`

---

**Implementation Status**: ✅ Complete  
**Test Coverage**: ✅ 5/5 scenarios passing  
**Documentation**: ✅ Complete  
**Ready for Production**: ✅ Yes
