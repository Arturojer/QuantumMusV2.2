"""
Frontend Integration Guide for Quantum Mus Backend

This file shows how to integrate the frontend with the WebSocket backend.
"""

# ============================================================
# JAVASCRIPT INTEGRATION EXAMPLE
# ============================================================

INTEGRATION_CODE = """

// 1. Install Socket.IO client library
// Add to your HTML:
// <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>

// 2. Connect to backend
const backendUrl = (window.QUANTUM_MUS_SERVER_URL || 'https://quantum-mus-backend.onrender.com');
const socket = io(backendUrl);

// Store game state
let gameState = {
    roomId: null,
    playerIndex: null,
    myHand: [],
    currentRound: 'MUS',
    teams: {}
};

// ============================================================
// EVENT HANDLERS
// ============================================================

// Connection established
socket.on('connect', () => {
    console.log('Connected to server:', socket.id);
});

// Room created
socket.on('room_created', (data) => {
    if (data.success) {
        gameState.roomId = data.room.id;
        console.log('Room created:', data.room);
    }
});

// Joined room successfully
socket.on('joined_room', (data) => {
    if (data.success) {
        gameState.roomId = data.room_id;
        gameState.playerIndex = data.player_index;
        console.log('Joined room as player', data.player_index);
    } else {
        console.error('Failed to join:', data.error);
    }
});

// Room updated (new player joined, etc.)
socket.on('room_updated', (data) => {
    console.log('Room updated:', data.room.players.length, '/ 4 players');
    updateLobbyUI(data.room);
});

// Game started
socket.on('game_started', (data) => {
    console.log('Game started!');
    gameState = { ...gameState, ...data.game_state.state };
    
    // Request my cards
    socket.emit('get_game_state', {
        room_id: gameState.roomId,
        player_index: gameState.playerIndex
    });
    
    // Hide lobby, show game
    showGameScreen();
});

// Game state received (includes my hand)
socket.on('game_state', (data) => {
    const state = data.game_state;
    gameState.myHand = state.my_hand;
    gameState.currentRound = state.state.currentRound;
    gameState.teams = state.state.teams;
    
    console.log('My hand:', gameState.myHand);
    renderGameState(state);
});

// Game state updated (after any action)
socket.on('game_update', (data) => {
    const action = data.action;
    const state = data.game_state.state;
    
    console.log(`Player ${action.player_index} did: ${action.action}`);
    
    gameState.currentRound = state.currentRound;
    gameState.activePlayerIndex = state.activePlayerIndex;
    
    // Show action notification
    showActionNotification(action.player_index, action.action);
    
    // Update UI
    updateScoreboard(state.teams);
    updateActivePlayer(state.activePlayerIndex);
});

// Cards discarded
socket.on('cards_discarded', (data) => {
    console.log(`Player ${data.player_index} discarded ${data.num_cards} cards`);
});

// New cards dealt after discard
socket.on('new_cards_dealt', (data) => {
    console.log('New cards dealt!');
    
    // Request updated state
    socket.emit('get_game_state', {
        room_id: gameState.roomId,
        player_index: gameState.playerIndex
    });
});

// Round ended
socket.on('round_ended', (data) => {
    const result = data.result;
    console.log(`Round ${result.round} ended!`);
    console.log(`Winner: ${result.winner_team}, Points: ${result.points}`);
    
    showRoundResult(result);
});

// Game ended
socket.on('game_ended', (data) => {
    console.log('Game ended!');
    console.log('Winner:', data.winner);
    
    showGameEndScreen(data);
});

// Error
socket.on('game_error', (data) => {
    console.error('Game error:', data.error);
    alert(data.error);
});

// ============================================================
// ACTIONS - Send to server
// ============================================================

function createRoom(roomName, gameMode = '4') {
    socket.emit('create_room', {
        name: roomName,
        game_mode: gameMode
    });
}

function joinRoom(roomId, playerName, character) {
    socket.emit('join_room', {
        room_id: roomId,
        player_name: playerName,
        character: character
    });
}

function startGame() {
    socket.emit('start_game', {
        room_id: gameState.roomId
    });
}

function chooseMus() {
    socket.emit('player_action', {
        room_id: gameState.roomId,
        action: 'mus',
        player_index: gameState.playerIndex
    });
}

function choosePaso() {
    socket.emit('player_action', {
        room_id: gameState.roomId,
        action: 'paso',
        player_index: gameState.playerIndex
    });
}

function chooseEnvido(amount) {
    socket.emit('player_action', {
        room_id: gameState.roomId,
        action: 'envido',
        player_index: gameState.playerIndex,
        data: { amount: amount }
    });
}

function chooseOrdago() {
    socket.emit('player_action', {
        room_id: gameState.roomId,
        action: 'ordago',
        player_index: gameState.playerIndex
    });
}

function discardCards(cardIndices) {
    socket.emit('discard_cards', {
        room_id: gameState.roomId,
        player_index: gameState.playerIndex,
        card_indices: cardIndices
    });
}

// ============================================================
// INTEGRATION WITH EXISTING GAME.JS
// ============================================================

// In your existing game.js, replace button handlers:

// MUS button
buttons[0].onclick = () => {
    if (gameState.activePlayerIndex === gameState.playerIndex) {
        chooseMus();
    }
};

// ENVIDO button
buttons[1].onclick = () => {
    if (gameState.activePlayerIndex === gameState.playerIndex) {
        showEnvidoModal((amount) => {
            chooseEnvido(amount);
        });
    }
};

// PASO button
buttons[2].onclick = () => {
    if (gameState.activePlayerIndex === gameState.playerIndex) {
        choosePaso();
    }
};

// ORDAGO button
buttons[3].onclick = () => {
    if (gameState.activePlayerIndex === gameState.playerIndex) {
        chooseOrdago();
    }
};

// DISCARD button
discardBtn.onclick = () => {
    const selectedCards = [];
    const cards = document.querySelectorAll('#player1-zone .quantum-card');
    cards.forEach((card, index) => {
        if (card.dataset.selected === 'true') {
            selectedCards.push(index);
        }
    });
    
    discardCards(selectedCards);
};

"""

# Save this integration code to a file
if __name__ == '__main__':
    with open('frontend_integration.js', 'w') as f:
        f.write(INTEGRATION_CODE)
    print('Integration code written to frontend_integration.js')
