# Mus Round System Implementation

## Overview
A complete round management system has been implemented for the Quantum Mus game, following the traditional Mus rules with quantum card mechanics.

## Game State Manager
A comprehensive `gameState` object tracks:
- **Current Round**: MUS, GRANDE, CHICA, PARES, JUEGO
- **Player Positions**: Mano (starting player) and active player
- **Team Management**: Two teams (Copenhague vs Muchos Mundos)
- **Betting System**: Current bets, betting team, responses
- **Round Actions**: What each player has done
- **Discard Phase**: Which cards were discarded

## Round Flow

### 1. MUS Round (Discard Phase)
**Player Actions:**
- **MUS**: Request to discard cards
- **PASO**: Pass and move to betting rounds
- **ENVIDO**: Start betting immediately
- **ORDAGO**: All-in bet

**Discard Mechanism:**
- If all 4 players choose MUS:
  - All players' timers activate simultaneously (10 seconds)
  - Players select 1-4 cards to discard
  - Click "DESCARTAR" button to confirm
  - New cards are dealt
  - MUS round restarts
- If timeout occurs: automatically MUS or discard all cards
- If any player chooses PASO/ENVIDO/ORDAGO: move to GRANDE round

### 2. GRANDE Round (Higher Cards Win)
**Card Order (8 Reyes mode):**
K (or 3) > Q > J > 7 > 6 > 5 > 4 > A (or 2)

**Betting Options:**
- **PASO**: Reject the bet
- **ENVIDO**: Raise the bet (2-30 points)
- **ORDAGO**: All-in
- **Accept** (implicit when not passing)

**Betting Flow:**
1. When someone bets, opponent team responds one by one
2. If both opponents PASO: betting team gets 1 point (or bet amount)
3. If they accept: cards are revealed and winner gets points
4. If they raise: betting team must respond to the raise
5. If everyone passes: move to next round, winner gets 1 point

### 3. CHICA Round (Lower Cards Win)
Same betting mechanics as GRANDE, but lower cards win (reverse order).

## Features Implemented

### Visual Feedback
- **Active Player Highlight**: Glowing box-shadow on current player's zone
- **Timer Bars**: Visual countdown for each player's turn
- **Action Notifications**: Pop-up showing what each player chose
- **Button States**: Buttons only enabled when it's local player's turn
- **Scoreboard Updates**: Real-time team scores and current round display

### AI Player Behavior
Non-local players make automatic decisions:
- **MUS Round**: 50% MUS, 30% PASO, 20% ENVIDO
- **Discard**: 0-2 random cards
- **Betting Rounds**: 60% PASO, 30% ACCEPT, 10% RAISE
- **Decision Delay**: 2-4 seconds (realistic timing)

### Timer System
- **Single Player Timer**: 10 seconds per turn
- **All Players Timer**: 10 seconds simultaneously during discard
- **Auto Actions**: Automatic MUS/PASO/discard on timeout
- **Visual Countdown**: Shrinking progress bars

### Button Integration
The quantum gate buttons now control the round system:
- **H (MUS)**: Choose MUS in MUS round
- **M (ENVIDO)**: Bet points (shows slider modal)
- **I (PASO)**: Pass in any round
- **O (ÓRDAGO)**: All-in bet

## Game Flow Example

1. **Game Start**: Player 1 (mano) begins, MUS round active
2. **Player 1**: Chooses MUS → Player 2's turn
3. **Player 2**: Chooses MUS → Player 3's turn
4. **Player 3**: Chooses MUS → Player 4's turn
5. **Player 4**: Chooses MUS → All selected cards, timers activate
6. **Discard Phase**: All players select and discard cards simultaneously
7. **New Cards Dealt**: MUS round restarts
8. **Player 1**: Chooses ENVIDO (10 points) → GRANDE round starts
9. **Player 2** (opponent): Chooses ACCEPT
10. **Cards Revealed**: Winner determined, points awarded
11. **Move to CHICA**: Next round begins

## Technical Details

### State Management Functions
- `getPlayerTeam(playerIndex)`: Get team for a player
- `getTeammate(playerIndex)`: Find player's teammate
- `resetRoundState()`: Clear round-specific data
- `nextPlayer()`: Move to next player counter-clockwise

### Round Handlers
- `handleMusRound(playerIndex, action)`: Process MUS phase decisions
- `handleBettingRound(playerIndex, action, betAmount)`: Process betting
- `startDiscardPhase()`: Initiate simultaneous card discard
- `moveToNextRound()`: Advance to next round
- `revealAndScoreRound()`: Calculate and award points

### UI Functions
- `showDiscardUI()`: Enable card selection for discard
- `showActionNotification()`: Display player actions
- `updateScoreboard()`: Refresh scores and round display
- `updateActivePlayerHighlight()`: Visual indicator for active player
- `updateButtonStates()`: Enable/disable buttons based on turn

## Console Logging
Debug information is logged at key points:
- Turn changes
- Player decisions
- Round transitions
- Betting events
- Points awarded

## Next Steps (Not Yet Implemented)
- **PARES Round**: Pairs-based scoring
- **JUEGO Round**: Points-based scoring (31+ wins)
- **Card Revelation**: Show opponent cards at round end
- **Win Condition**: First team to reach target score
- **Advanced AI**: Smarter betting strategies based on hand strength
