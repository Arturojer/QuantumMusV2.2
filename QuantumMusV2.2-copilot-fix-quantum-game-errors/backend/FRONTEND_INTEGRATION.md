# Frontend Integration Guide - Online Mode Betting

## Overview

The backend now broadcasts complete betting state to all online players. This guide shows how to use that information to display the correct buttons and UI elements.

## What the Backend Sends

When a player action occurs, the server broadcasts via WebSocket:

```javascript
socketio.emit('game_update', {
    game_state: {
        state: {
            currentRound: 'GRANDE' | 'CHICA' | 'PARES' | 'JUEGO',
            activePlayerIndex: 0 | 1 | 2 | 3,
            teams: { team1: {...}, team2: {...} },
            currentBet: { amount, bettingTeam, betType },
            grandePhase: { /* phase details */ },
            chicaPhase: { /* phase details */ },
            paresPhase: { /* phase details */ },
            juegoPhase: { /* phase details */ }
        },
        players: [...],
        hand_sizes: {...}
    },
    action: { player_index, action, data }
});
```

## Phase Information Structure

Each phase (grande/chica/pares/juego) contains:

```javascript
{
    phaseState: 'NO_BET' | 'BET_PLACED' | 'WAITING_RESPONSE' | 'RESOLVED',
    attackingTeam: 'team1' | 'team2' | null,
    defendingTeam: 'team1' | 'team2' | null,
    currentBetAmount: number,
    betType: 'envido' | 'ordago' | null,
    lastBettingTeam: 'team1' | 'team2' | null,
    defendersResponded: [player_indices],
    allPassed: boolean,
    result: object | null
}
```

## Button Visibility Logic

### 1. Determine Current Phase

```javascript
function getCurrentPhase(gameState) {
    const round = gameState.state.currentRound.toLowerCase();
    const phaseKey = `${round}Phase`;
    return gameState.state[phaseKey];
}
```

### 2. Check if Player Should See Buttons

```javascript
function shouldShowBettingButtons(gameState, myPlayerIndex) {
    const state = gameState.state;
    const phase = getCurrentPhase(gameState);
    
    // Not my turn? Show nothing
    if (state.activePlayerIndex !== myPlayerIndex) {
        return { show: false, reason: 'Not your turn' };
    }
    
    // Get my team
    const myTeam = getPlayerTeam(state.teams, myPlayerIndex);
    
    // No bet active? Show betting options
    if (phase.phaseState === 'NO_BET') {
        return {
            show: true,
            buttons: ['envido', 'ordago', 'paso']
        };
    }
    
    // Bet active - am I defending?
    if (phase.phaseState === 'BET_PLACED' || phase.phaseState === 'WAITING_RESPONSE') {
        if (myTeam === phase.defendingTeam) {
            return {
                show: true,
                buttons: ['accept', 'reject', 'raise'],
                currentBet: phase.currentBetAmount,
                betType: phase.betType
            };
        }
    }
    
    return { show: false, reason: 'Waiting for other player' };
}
```

### 3. Helper: Get Player Team

```javascript
function getPlayerTeam(teams, playerIndex) {
    if (teams.team1.players.includes(playerIndex)) {
        return 'team1';
    }
    return 'team2';
}
```

## Example Implementation

### React Component

```jsx
function BettingButtons({ gameState, myPlayerIndex, onAction }) {
    const buttonInfo = shouldShowBettingButtons(gameState, myPlayerIndex);
    
    if (!buttonInfo.show) {
        return <div className="waiting">
            {buttonInfo.reason || 'Waiting...'}
        </div>;
    }
    
    // No bet active - show betting options
    if (buttonInfo.buttons.includes('envido')) {
        return (
            <div className="betting-options">
                <button onClick={() => onAction('envido', { amount: 2 })}>
                    Envido (2)
                </button>
                <button onClick={() => onAction('ordago')}>
                    Órdago (40)
                </button>
                <button onClick={() => onAction('paso')}>
                    Paso
                </button>
            </div>
        );
    }
    
    // Bet active - show response options
    if (buttonInfo.buttons.includes('accept')) {
        return (
            <div className="response-options">
                <div className="current-bet">
                    Current bet: {buttonInfo.currentBet} points
                </div>
                <button onClick={() => onAction('accept')}>
                    Quiero (Accept)
                </button>
                <button onClick={() => onAction('paso')}>
                    No Quiero (Reject)
                </button>
                <button onClick={() => onAction('envido', { amount: buttonInfo.currentBet + 2 })}>
                    Re-envido (+2)
                </button>
            </div>
        );
    }
    
    return null;
}
```

### Vue Component

```vue
<template>
    <div v-if="buttonInfo.show">
        <!-- No bet active -->
        <div v-if="showBettingOptions" class="betting-options">
            <button @click="placeBet('envido', 2)">Envido (2)</button>
            <button @click="placeBet('ordago', 40)">Órdago (40)</button>
            <button @click="placeBet('paso')">Paso</button>
        </div>
        
        <!-- Bet active - response needed -->
        <div v-else-if="showResponseOptions" class="response-options">
            <p>Current bet: {{ currentBet }} points</p>
            <button @click="respond('accept')">Quiero</button>
            <button @click="respond('paso')">No Quiero</button>
            <button @click="respond('raise')">Re-envido</button>
        </div>
    </div>
    <div v-else class="waiting">
        {{ waitMessage }}
    </div>
</template>

<script>
export default {
    props: ['gameState', 'myPlayerIndex'],
    computed: {
        buttonInfo() {
            return shouldShowBettingButtons(this.gameState, this.myPlayerIndex);
        },
        showBettingOptions() {
            return this.buttonInfo.buttons?.includes('envido');
        },
        showResponseOptions() {
            return this.buttonInfo.buttons?.includes('accept');
        },
        currentBet() {
            return this.buttonInfo.currentBet || 0;
        },
        waitMessage() {
            return this.buttonInfo.reason || 'Waiting for other players...';
        }
    },
    methods: {
        placeBet(action, amount = 0) {
            this.$emit('player-action', { action, data: { amount } });
        },
        respond(action) {
            this.$emit('player-action', { action });
        }
    }
}
</script>
```

## Displaying Game State Information

### Current Bet Display

```javascript
function BetDisplay({ gameState }) {
    const phase = getCurrentPhase(gameState);
    
    if (phase.phaseState === 'NO_BET') {
        return <div>No active bet</div>;
    }
    
    if (phase.phaseState === 'BET_PLACED' || phase.phaseState === 'WAITING_RESPONSE') {
        return (
            <div className="active-bet">
                <div className="bet-amount">{phase.currentBetAmount} points</div>
                <div className="bet-type">{phase.betType}</div>
                <div className="betting-team">
                    Team {phase.attackingTeam} is betting
                </div>
                <div className="defending-team">
                    Team {phase.defendingTeam} must respond
                </div>
            </div>
        );
    }
    
    return null;
}
```

### Active Player Indicator

```javascript
function PlayerIndicator({ gameState, playerIndex, myPlayerIndex }) {
    const isActive = gameState.state.activePlayerIndex === playerIndex;
    const isMe = playerIndex === myPlayerIndex;
    
    return (
        <div className={`player ${isActive ? 'active' : ''} ${isMe ? 'me' : ''}`}>
            {isActive && <span className="turn-indicator">🎯 Their turn</span>}
            {isMe && <span className="me-indicator">You</span>}
        </div>
    );
}
```

### Team Score Display

```javascript
function ScoreBoard({ gameState, myPlayerIndex }) {
    const teams = gameState.state.teams;
    const myTeam = getPlayerTeam(teams, myPlayerIndex);
    
    return (
        <div className="scoreboard">
            <div className={`team ${myTeam === 'team1' ? 'my-team' : ''}`}>
                <h3>Team 1 (Copenhagen)</h3>
                <div className="score">{teams.team1.score}</div>
                <div className="players">
                    {teams.team1.players.map(p => (
                        <span key={p}>{gameState.players[p].username}</span>
                    ))}
                </div>
            </div>
            
            <div className={`team ${myTeam === 'team2' ? 'my-team' : ''}`}>
                <h3>Team 2 (Bohmian)</h3>
                <div className="score">{teams.team2.score}</div>
                <div className="players">
                    {teams.team2.players.map(p => (
                        <span key={p}>{gameState.players[p].username}</span>
                    ))}
                </div>
            </div>
        </div>
    );
}
```

## WebSocket Event Handlers

### Sending Actions

```javascript
function sendPlayerAction(action, data = {}) {
    socket.emit('player_action', {
        room_id: currentRoomId,
        player_index: myPlayerIndex,
        action: action,
        data: data
    });
}
```

### Receiving Updates

```javascript
socket.on('game_update', (data) => {
    // Update local game state
    setGameState(data.game_state);
    
    // Show action notification
    const action = data.action;
    showNotification(
        `${getPlayerName(action.player_index)} played ${action.action}`
    );
});

socket.on('game_error', (data) => {
    showError(data.error);
});

socket.on('round_ended', (data) => {
    showRoundResult(data.result);
});
```

## Complete Example Flow

```javascript
// 1. Player 0 (Alice) bets 5 points
sendPlayerAction('envido', { amount: 5 });

// 2. Server broadcasts to all players:
socket.on('game_update', (data) => {
    // gameState.state.grandePhase = {
    //     phaseState: 'BET_PLACED',
    //     attackingTeam: 'team1',
    //     defendingTeam: 'team2',
    //     currentBetAmount: 5,
    //     betType: 'envido'
    // }
    
    // Player 3 (Diana, team2) sees: ACCEPT/REJECT/RAISE
    // Players 0,1,2 see: "Waiting for Diana..."
});

// 3. Player 3 raises to 10
sendPlayerAction('envido', { amount: 10 });

// 4. Server broadcasts:
socket.on('game_update', (data) => {
    // gameState.state.grandePhase = {
    //     phaseState: 'BET_PLACED',
    //     attackingTeam: 'team2',  // <-- switched
    //     defendingTeam: 'team1',  // <-- switched
    //     currentBetAmount: 10,
    //     betType: 'envido'
    // }
    
    // Player 2 (Charlie, team1) sees: ACCEPT/REJECT/RAISE
});

// 5. Player 2 accepts
sendPlayerAction('accept');

// 6. Server broadcasts:
socket.on('game_update', (data) => {
    // gameState.state.currentRound = 'CHICA'
    // Round ended, 10 points at stake (deferred)
});
```

## Testing Button Logic

```javascript
// Test 1: Initial bet
const state1 = {
    state: {
        currentRound: 'GRANDE',
        activePlayerIndex: 3,
        grandePhase: {
            phaseState: 'BET_PLACED',
            defendingTeam: 'team2'
        }
    }
};

// Player 3 (team2) should see accept/reject
const result1 = shouldShowBettingButtons(state1, 3);
console.assert(result1.show === true);
console.assert(result1.buttons.includes('accept'));

// Player 0 (team1) should wait
const result2 = shouldShowBettingButtons(state1, 0);
console.assert(result2.show === false);
```

## Summary

**Frontend needs to:**
1. ✅ Listen to `game_update` WebSocket events
2. ✅ Check `activePlayerIndex` to determine turn
3. ✅ Check phase info to determine button visibility
4. ✅ Show ACCEPT/REJECT/RAISE when defending
5. ✅ Show ENVIDO/ORDAGO/PASO when no bet active
6. ✅ Display current bet amount and teams
7. ✅ Emit `player_action` events to server

**All backend state is now available for proper button logic implementation!**
