# Quantum Mus Backend

Backend server for the Quantum Mus multiplayer card game using Flask and Socket.IO.

## Features

- **Real-time multiplayer** using WebSocket (Socket.IO)
- **Room management** for game lobbies
- **Complete game logic** for Mus rounds (MUS, GRANDE, CHICA, PARES, JUEGO)
- **Quantum card mechanics** (entanglement, superposition)
- **Team-based gameplay** (2v2)
- **SQLite database** for game history and statistics
- **RESTful API** endpoints

## Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Run the server:
```bash
python server.py
```

The server will start on the configured host/port. Set `HOST` and `PORT` as needed.

## API Endpoints

### HTTP Endpoints

- `GET /health` - Health check
- `GET /api/rooms` - List available rooms
- `POST /api/rooms` - Create a new room
- `GET /api/stats` - Get game statistics

### WebSocket Events

#### Client → Server

- `connect` - Connect to server
- `create_room` - Create a game room
- `join_room` - Join a room
- `leave_room` - Leave a room
- `start_game` - Start the game (when 4 players ready)
- `player_action` - Make a game action (MUS, PASO, ENVIDO, ORDAGO)
- `discard_cards` - Discard cards during MUS phase
- `get_game_state` - Request current game state

#### Server → Client

- `connected` - Connection confirmed
- `room_created` - Room created successfully
- `joined_room` - Successfully joined room
- `left_room` - Left room
- `room_updated` - Room state changed
- `game_started` - Game has started
- `game_update` - Game state updated
- `cards_discarded` - Cards were discarded
- `new_cards_dealt` - New cards dealt
- `round_ended` - Round finished
- `game_ended` - Game finished
- `game_error` - Error occurred

## Architecture

```
backend/
├── server.py              # Main Flask + Socket.IO server
├── game_manager.py        # Manages active game instances
├── room_manager.py        # Manages game rooms/lobbies
├── game_logic.py          # Main game state and logic
├── round_handlers.py      # Round-specific logic (MUS, GRANDE, CHICA)
├── card_deck.py           # Quantum card and deck management
├── models.py              # Database models
└── requirements.txt       # Python dependencies
```

## Game Flow

1. **Lobby Phase**
   - Players create or join rooms
   - Wait for 4 players
   - Start game when ready

2. **MUS Round**
   - Players choose: MUS, PASO, ENVIDO, ORDAGO
   - If all choose MUS: discard phase (simultaneous)
   - New cards dealt, repeat
   - When someone passes: move to GRANDE

3. **GRANDE Round** (Higher cards win)
   - Betting: PASO, ENVIDO, ORDAGO
   - Team responses
   - Card reveal and scoring

4. **CHICA Round** (Lower cards win)
   - Same betting mechanics

5. **PARES & JUEGO Rounds**
   - To be implemented

6. **New Hand**
   - After all rounds, new hand starts
   - Mano rotates
   - First to 40 points wins

## Database Schema

### Players
- username, games_played, games_won, total_points

### Games
- room_id, game_mode, status, winner_team, scores

### GameHistory
- Events and actions during games

## Configuration

Edit `server.py` to configure:
- Database URI
- Secret key
- CORS settings
- Port number

## Development

Run in debug mode:
```bash
python server.py
```

The server will auto-reload on code changes.

## Testing

Test WebSocket connection:
```javascript
const backendUrl = window.QUANTUM_MUS_SERVER_URL || 'https://quantum-mus-backend.onrender.com';
const socket = io(backendUrl);

socket.on('connect', () => {
  console.log('Connected!');
  
  // Create a room
  socket.emit('create_room', {
    name: 'Test Room',
    game_mode: '4'
  });
});
```
