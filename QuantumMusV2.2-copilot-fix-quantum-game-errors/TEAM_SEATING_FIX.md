# Team Seating Fix - Players Alternating by Team

## Overview
This fix ensures that in online multiplayer games, players from the two teams (Copenhague and Bohmian) are seated in an alternating pattern around the table so that teammates face each other.

## Team Assignments by Character

### Team 1 - Copenhague (Copenhagen)
- **Preskill** (John Preskill)
- **Zoller** (Peter Zoller)
- **Broadbent** (Anne Broadbent)
- **Martinis** (Nicole Yunger Halpern)

### Team 2 - Bohmian
- **Cirac** (Ignacio Cirac)
- **Deutsch** (David Deutsch)
- **Simmons** (Matthew Simmons)
- **Monroe** (Karen Hallberg)

## Seating Pattern

The system now ensures players are seated in this pattern:
```
Position 0: Team 1 (e.g., Preskill)
Position 1: Team 2 (e.g., Cirac)
Position 2: Team 1 (e.g., Zoller)     <- Faces Position 0 (teammate)
Position 3: Team 2 (e.g., Deutsch)    <- Faces Position 1 (teammate)
```

This means:
- **Team 1 players** are at positions **0 and 2** (facing each other)
- **Team 2 players** are at positions **1 and 3** (facing each other)
- Turn order alternates: Team1 → Team2 → Team1 → Team2

## Changes Made

### Backend (game_logic.py)
1. **Enhanced player interleaving logic**: The `__init__` method now properly interleaves players based on their `team` attribute (assigned when they select their character in the lobby)

2. **Team-aware index assignment**: After interleaving, the code assigns team indices based on the actual team membership of each player, not just even/odd positions

3. **Added logging**: Now logs both team assignments and the character order for debugging:
   ```python
   logger.info(f"Teams for room {room_id}: team1={teams['team1']['players']}, team2={teams['team2']['players']}")
   logger.info(f"Player order: {[p.get('character', 'unknown') for p in self.players]}")
   ```

### Frontend (navigation.js)
1. **Use server's interleaved player order**: The `onlineGameStarted` event handler now extracts and uses the interleaved player list from `detail.game_state.players` instead of the original lobby order

2. **Recalculate local player index**: Finds the local player's new position in the interleaved order

3. **Enhanced logging**: Displays the interleaved order showing each player's character and team for easy verification

## How It Works

1. **Lobby Phase**: Players join and select their characters. Each character has a `team` attribute (1 or 2)

2. **Game Start**: When the host clicks "Start Game":
   - Backend receives the player list in join order
   - Backend separates players into two lists by team
   - Backend interleaves: [Team1[0], Team2[0], Team1[1], Team2[1], ...]
   - Backend assigns team indices based on actual team membership

3. **Game Display**: Each client:
   - Receives the interleaved player list from the server
   - Calculates their new position in the interleaved order
   - Renders the table with proper team alternation
   - Ensures teammates are positioned facing each other

## Verification

To verify the fix is working:

1. Check server logs when a game starts:
   ```
   Teams for room XXXX: team1=[0, 2], team2=[1, 3]
   Player order: ['preskill', 'cirac', 'zoller', 'deutsch']
   ```

2. Check browser console when game starts:
   ```
   [ONLINE] onlineGameStarted event received:
   interleavedOrder: ["preskill(T1)", "cirac(T2)", "zoller(T1)", "deutsch(T2)"]
   ```

3. Visual verification: In the game, teammates should be positioned across from each other (top and bottom, or left and right)

## Benefits

- **Strategic gameplay**: Teammates face each other for better communication/signals
- **Fair turn order**: Teams alternate speaking, preventing one team from dominating conversation
- **Consistent with traditional Mus**: Matches the classic card game's seating arrangement
- **Character identity preserved**: Players keep their chosen quantum physicist characters while ensuring proper team distribution
