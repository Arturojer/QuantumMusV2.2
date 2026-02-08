# Bet Acceptance & Card Revelation Fix

## Issue
When a bet is accepted and the game moves to CHICA, cards were not being revealed and points information was not being communicated properly.

## Root Cause Analysis

### Backend Behavior
The backend correctly implements traditional Mus rules where:
1. When a bet is accepted in GRANDE (or other rounds), the comparison is **deferred**
2. Cards are **not** compared until after all 4 phases complete (GRANDE, CHICA, PARES, JUEGO)
3. Points are **not** awarded until the end

However, the backend wasn't providing information about:
- Which cards to reveal (even though comparison is deferred)
- How many points are at stake
- Which teams are involved in the bet

### Frontend Behavior  
The standalone frontend (game.js) has:
- AI player logic that accepts bets 50% of the time
- Code to reveal cards when bet is accepted (line 659: `revealAllCards()`)
- Code to defer points properly (stored in `pendingPoints`)

The frontend code **is working correctly** for standalone play.

## Changes Made

### 1. Updated `grande_betting_handler.py`

#### `_resolve_acceptance()` method:
- Added card information retrieval using `get_highest_card()`
- Returns `reveal_cards: True` flag
- Returns `card_info` with best cards from each team
- Returns `attacking_team` and `defending_team` information

#### `_resolve_all_pass()` method:
- Added same card information for when all players pass
- Ensures cards are revealed even when no bet is placed

### 2. Updated `generic_betting_handler.py`

#### `_resolve_acceptance()` method:
- Added `_get_round_card_info()` helper method call
- Returns `reveal_cards: True` flag
- Returns `card_info` with relevant cards for the round type

#### `_resolve_all_pass()` method:
- Added card information for all-pass scenario

#### New `_get_round_card_info()` method:
- Extracts card information based on round type:
  - GRANDE: highest cards
  - CHICA: lowest cards
  - PARES/JUEGO: all team cards

## How It Works Now

### When Bet is Accepted:

1. **Backend processes action:**
   ```python
   result = {
       'success': True,
       'bet_accepted': True,
       'bet_amount': points,
       'attacking_team': 'team1',
       'defending_team': 'team2',
       'reveal_cards': True,
       'card_info': {
           'team1_best': {...},
           'team2_best': {...}
       },
       'move_to_chica': True  # or 'move_to_next_round': True
   }
   ```

2. **Backend emits to Socket.IO clients:**
   ```javascript
   socketio.emit('game_update', {
       'game_state': updated_state,
       'result': result  // Contains reveal_cards and card_info
   }, room=room_id)
   ```

3. **Frontend (when integrated) should:**
   - Check `result.reveal_cards` flag
   - Use `result.card_info` to display relevant cards
   - Store `result.bet_amount` as pending points
   - Show which teams are involved (`attacking_team`, `defending_team`)
   - Move to next round

### Standalone Frontend (game.js)
The standalone frontend already handles this correctly:
- AI accepts bets (50% chance)
- Calls `revealAllCards()` on line 659
- Stores pending points in `gameState.pendingPoints`
- Moves to next round after 2-second delay

## Testing the Fix

### Backend Testing
```python
# In test_grande_phase.py or similar
result = game.process_action(player_index, 'accept')

assert result['success'] == True
assert result['reveal_cards'] == True
assert 'card_info' in result
assert 'team1_best' in result['card_info']
assert 'team2_best' in result['card_info']
assert result['move_to_chica'] == True
```

### Frontend Testing (Standalone)
1. Open `index.html` in browser
2. Start a game
3. Progress through MUS phase
4. In GRANDE: let AI make a bet
5. When defending AI accepts, observe:
   - Cards are revealed (`revealAllCards()` is called)
   - Round result modal shows
   - Game moves to CHICA after 2 seconds
   - Points are stored as pending

### Full Stack Testing (Backend + Frontend Integration)
**Note:** Currently there is NO Socket.IO integration in game.js
To fully integrate:
1. Add Socket.IO client library to index.html
2. Add socket connection and event listeners in game.js
3. Replace local action handling with socket.emit('player_action')
4. Listen for 'game_update' events and process result

## Expected Behavior

✅ **When bet is accepted:**
- Cards ARE revealed (best cards shown)
- Points are NOT awarded yet (deferred)
- Information is shown: "X points at stake, betting team vs defending team"
- Game moves to CHICA

✅ **After all 4 phases complete:**
- All deferred bets are resolved
- Winners are determined by comparing cards
- Points are awarded
- Scores are updated
- New hand begins

## Notes

- The backend follows traditional Mus rules with deferred comparison
- Cards can be revealed to players even though comparison is deferred
- Points are tracked as "pending" until all phases complete
- This implementation is correct for authentic Mus gameplay
