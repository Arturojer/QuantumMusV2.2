# Grande Phase - Frontend Integration Guide

## Quick Start

### Backend API Endpoints

The Grande phase betting is handled through the existing game action endpoint:

```javascript
// Send player action to backend
socket.emit('player_action', {
    room_id: currentRoom,
    player_index: myPlayerIndex,
    action: 'envido',  // or 'paso', 'accept', 'ordago'
    extra_data: {
        amount: 10  // For envido bets
    }
});
```

### Frontend Event Handlers

```javascript
// Listen for game state updates
socket.on('game_state_update', (data) => {
    updateGrandePhaseUI(data.state);
});

// Listen for Grande phase events
socket.on('grande_phase_update', (data) => {
    if (data.grande_ended) {
        showGrandeResult(data);
    }
    if (data.bet_placed) {
        showBetNotification(data);
    }
    if (data.comparison_deferred) {
        showDeferredMessage();
    }
});
```

## UI Components

### 1. **Action Buttons**

Display buttons based on game state:

```javascript
function updateGrandeButtons(gameState) {
    const grandePhase = gameState.grandePhase;
    const isMyTurn = gameState.activePlayerIndex === myPlayerIndex;
    const myTeam = getMyTeam(myPlayerIndex);
    
    // Clear all buttons
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.5';
    });
    
    if (!isMyTurn) return;
    
    // NO_BET state - can pass or bet
    if (grandePhase.phaseState === 'NO_BET') {
        enableButton('paso-btn', 'Pass');
        enableButton('envido-btn', 'Envido');
        enableButton('ordago-btn', 'Órdago');
    }
    
    // BET_PLACED - defender can reject, accept, raise, or órdago
    else if (grandePhase.phaseState === 'BET_PLACED' && 
             myTeam === grandePhase.defendingTeam) {
        enableButton('paso-btn', 'Reject');
        enableButton('accept-btn', 'Accept');
        enableButton('envido-btn', `Raise (${grandePhase.currentBetAmount}+)`);
        enableButton('ordago-btn', 'Órdago');
    }
}

function enableButton(buttonId, label) {
    const btn = document.getElementById(buttonId);
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.textContent = label;
}
```

### 2. **Bet Amount Selector**

Modal for choosing bet amount:

```javascript
function showEnvidoModal() {
    const modal = document.getElementById('bet-modal');
    const slider = document.getElementById('bet-slider');
    const display = document.getElementById('bet-amount-display');
    
    // Set slider range
    const currentBet = gameState.grandePhase?.currentBetAmount || 0;
    slider.min = currentBet + 2;
    slider.max = 30;
    slider.value = currentBet + 5;
    
    // Update display
    slider.addEventListener('input', () => {
        display.textContent = slider.value + ' puntos';
    });
    
    modal.style.display = 'block';
}

function confirmEnvido() {
    const amount = parseInt(document.getElementById('bet-slider').value);
    
    socket.emit('player_action', {
        room_id: currentRoom,
        player_index: myPlayerIndex,
        action: 'envido',
        extra_data: { amount: amount }
    });
    
    document.getElementById('bet-modal').style.display = 'none';
}
```

### 3. **Game State Display**

Show current Grande phase state:

```javascript
function updateGrandeDisplay(gameState) {
    const grandePhase = gameState.grandePhase;
    const display = document.getElementById('grande-status');
    
    if (!grandePhase) {
        display.textContent = '';
        return;
    }
    
    let statusHTML = '';
    
    // Show current bet
    if (grandePhase.currentBetAmount > 0) {
        statusHTML += `
            <div class="bet-display">
                <span class="bet-icon">💰</span>
                <span class="bet-amount">${grandePhase.currentBetAmount}</span>
                <span class="bet-type">${grandePhase.betType}</span>
            </div>
        `;
        
        if (grandePhase.betType === 'ordago') {
            statusHTML += '<div class="ordago-indicator">⚠️ ÓRDAGO! ⚠️</div>';
        }
    }
    
    // Show teams
    if (grandePhase.attackingTeam) {
        statusHTML += `
            <div class="teams-display">
                <div class="attacking-team">
                    ⚔️ ${getTeamName(grandePhase.attackingTeam)}
                </div>
                <div class="vs">vs</div>
                <div class="defending-team">
                    🛡️ ${getTeamName(grandePhase.defendingTeam)}
                </div>
            </div>
        `;
    }
    
    // Show phase state
    statusHTML += `<div class="phase-state">${getPhaseStateText(grandePhase.phaseState)}</div>`;
    
    display.innerHTML = statusHTML;
}

function getPhaseStateText(state) {
    const stateTexts = {
        'NO_BET': 'Waiting for action...',
        'BET_PLACED': 'Bet on the table!',
        'WAITING_RESPONSE': 'Waiting for response...',
        'RESOLVED': 'Grande complete'
    };
    return stateTexts[state] || state;
}
```

### 4. **Turn Indicator**

Highlight active player:

```javascript
function updateTurnIndicator(gameState) {
    const activePlayer = gameState.activePlayerIndex;
    
    // Remove all highlights
    document.querySelectorAll('.player-zone').forEach(zone => {
        zone.classList.remove('active-turn');
    });
    
    // Highlight active player
    const activeZone = document.getElementById(`player-${activePlayer}-zone`);
    activeZone.classList.add('active-turn');
    
    // Show indicator
    if (activePlayer === myPlayerIndex) {
        document.getElementById('your-turn-indicator').style.display = 'block';
        playTurnSound();
    } else {
        document.getElementById('your-turn-indicator').style.display = 'none';
    }
}
```

### 5. **Notification System**

Show action notifications:

```javascript
function showActionNotification(playerIndex, action, data) {
    const playerName = getPlayerName(playerIndex);
    let message = '';
    
    switch(action) {
        case 'paso':
            message = grandePhase.currentBetAmount > 0 
                ? `${playerName} rejects the bet` 
                : `${playerName} passes`;
            break;
        case 'envido':
            message = `${playerName} bets ${data.amount} points!`;
            break;
        case 'ordago':
            message = `${playerName} calls ÓRDAGO!`;
            break;
        case 'accept':
            message = `${playerName} accepts the bet!`;
            break;
    }
    
    showToast(message, 3000);
}

function showGrandeResult(result) {
    let message = '';
    
    if (result.winner_team) {
        const teamName = getTeamName(result.winner_team);
        message = `${teamName} wins ${result.points} points!`;
    } else if (result.comparison_deferred) {
        message = `${result.bet_amount} points at stake - cards will be revealed after all phases`;
    }
    
    showToast(message, 5000);
}
```

## Complete Example Workflow

### Scenario: Player 0 bets, Player 1 raises, Player 0 accepts

```javascript
// 1. Grande phase starts
socket.on('game_state_update', (data) => {
    if (data.state.currentRound === 'GRANDE') {
        updateGrandeDisplay(data.state);
        updateGrandeButtons(data.state);
    }
});

// 2. Player 0 (Mano) clicks Envido button
document.getElementById('envido-btn').addEventListener('click', () => {
    if (myPlayerIndex === 0) {
        showEnvidoModal();  // Shows slider to select amount
    }
});

// Player 0 selects 10 points and confirms
function confirmEnvido() {
    socket.emit('player_action', {
        room_id: currentRoom,
        player_index: 0,
        action: 'envido',
        extra_data: { amount: 10 }
    });
}

// 3. Backend processes and broadcasts
socket.on('grande_phase_update', (data) => {
    // data = {
    //     success: true,
    //     bet_placed: true,
    //     betting_team: 'team1',
    //     bet_amount: 10,
    //     next_player: 1
    // }
    
    showActionNotification(0, 'envido', { amount: 10 });
    updateGrandeDisplay(data.state);
    updateTurnIndicator(data.state);
});

// 4. Player 1 (defender) sees buttons: Reject, Accept, Raise, Órdago
// Player 1 clicks Raise
document.getElementById('envido-btn').addEventListener('click', () => {
    if (myPlayerIndex === 1) {
        showEnvidoModal();  // Shows slider (min: 12)
    }
});

// Player 1 raises to 20
socket.emit('player_action', {
    room_id: currentRoom,
    player_index: 1,
    action: 'envido',
    extra_data: { amount: 20 }
});

// 5. Backend broadcasts raise
socket.on('grande_phase_update', (data) => {
    // data = {
    //     success: true,
    //     raised: true,
    //     new_bet_amount: 20,
    //     attacking_team: 'team2',  // Roles switched!
    //     defending_team: 'team1',
    //     next_player: 0
    // }
    
    showActionNotification(1, 'envido', { amount: 20 });
    updateGrandeDisplay(data.state);
});

// 6. Player 0 (now defender) clicks Accept
document.getElementById('accept-btn').addEventListener('click', () => {
    if (myPlayerIndex === 0) {
        socket.emit('player_action', {
            room_id: currentRoom,
            player_index: 0,
            action: 'accept'
        });
    }
});

// 7. Backend broadcasts acceptance and phase end
socket.on('grande_phase_update', (data) => {
    // data = {
    //     success: true,
    //     grande_ended: true,
    //     bet_accepted: true,
    //     bet_amount: 20,
    //     comparison_deferred: true,
    //     move_to_next_round: true
    // }
    
    showActionNotification(0, 'accept', {});
    showToast('20 points at stake! Cards will be revealed after all phases.', 5000);
    
    // Wait for transition to Chica
    setTimeout(() => {
        transitionToNextRound('CHICA');
    }, 3000);
});
```

## CSS Styling

```css
/* Grande phase display */
.grande-status {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 15px;
    border-radius: 10px;
    margin: 10px 0;
    text-align: center;
}

.bet-display {
    font-size: 24px;
    font-weight: bold;
    margin: 10px 0;
}

.ordago-indicator {
    background: #ff4444;
    color: white;
    padding: 10px;
    border-radius: 5px;
    font-size: 20px;
    font-weight: bold;
    animation: pulse 1s infinite;
}

@keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
}

.teams-display {
    display: flex;
    justify-content: space-around;
    align-items: center;
    margin: 10px 0;
}

.attacking-team {
    color: #ff6b6b;
    font-weight: bold;
}

.defending-team {
    color: #4ecdc4;
    font-weight: bold;
}

/* Active turn indicator */
.player-zone.active-turn {
    box-shadow: 0 0 20px 5px #ffd700;
    border: 3px solid #ffd700;
    animation: glow 1.5s infinite alternate;
}

@keyframes glow {
    from { box-shadow: 0 0 20px 5px #ffd700; }
    to { box-shadow: 0 0 30px 10px #ffed4e; }
}

/* Action buttons */
.action-btn {
    padding: 12px 24px;
    font-size: 16px;
    font-weight: bold;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s;
    margin: 5px;
}

.action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

#paso-btn {
    background: #95a5a6;
    color: white;
}

#paso-btn:hover:not(:disabled) {
    background: #7f8c8d;
    transform: scale(1.05);
}

#envido-btn {
    background: #3498db;
    color: white;
}

#envido-btn:hover:not(:disabled) {
    background: #2980b9;
    transform: scale(1.05);
}

#accept-btn {
    background: #2ecc71;
    color: white;
}

#accept-btn:hover:not(:disabled) {
    background: #27ae60;
    transform: scale(1.05);
}

#ordago-btn {
    background: linear-gradient(45deg, #e74c3c, #c0392b);
    color: white;
    font-size: 18px;
}

#ordago-btn:hover:not(:disabled) {
    background: linear-gradient(45deg, #c0392b, #e74c3c);
    transform: scale(1.1);
}
```

## Summary

The Grande phase integration requires:

1. **Action handlers** for player clicks
2. **State updates** from backend via WebSocket
3. **UI updates** based on phase state
4. **Turn indicators** to show active player
5. **Notifications** for actions and results

All backend logic is handled by `GrandeBettingHandler` - frontend just sends actions and displays state!
