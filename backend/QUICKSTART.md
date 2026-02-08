# Quantum Mus Backend - Quick Start Guide

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Start the Server

**Windows:**
```bash
run.bat
```

**Linux/Mac:**
```bash
chmod +x run.sh
./run.sh
```

**Or manually:**
```bash
python server.py
```

Server will start at: `http://localhost:5000`

### 3. Test the Server

Open another terminal and run:

```bash
python test_client.py
```

This will connect a test client and let you interact with the game.

---

## 📁 File Structure

```
backend/
├── server.py              # Main Flask + Socket.IO server (START HERE)
├── game_manager.py        # Manages multiple game instances
├── room_manager.py        # Manages lobbies and rooms
├── game_logic.py          # Core game state and logic
├── round_handlers.py      # Round-specific logic (MUS, GRANDE, CHICA)
├── card_deck.py           # Quantum card generation and deck
├── models.py              # Database models (SQLAlchemy)
├── config.py              # Configuration settings
├── requirements.txt       # Python dependencies
├── test_client.py         # Test WebSocket client
├── integration_guide.py   # Frontend integration examples
├── run.bat / run.sh       # Helper scripts to start server
└── README.md              # Full documentation
```

---

## 🎮 Testing the Game Flow

### Using test_client.py

1. **Connect:** Automatically connects to `localhost:5000`
2. **Create Room:** Automatically creates a test room
3. **Join Room:** Joins as TestPlayer
4. **Interactive Commands:**
   - `mus` - Choose MUS
   - `paso` - Choose PASO
   - `envido` - Choose ENVIDO (5 points)
   - `ordago` - Choose ORDAGO
   - `discard` - Discard cards [0,1]
   - `state` - Get current game state
   - `quit` - Exit

### Using Browser Console

1. Open `http://localhost:5000/health` to verify server is running
2. Open browser console
3. Copy-paste from `integration_guide.py` JavaScript code
4. Test WebSocket connection:

```javascript
const socket = io('http://localhost:5000');

socket.on('connect', () => {
    console.log('Connected!');
    
    // Create a room
    socket.emit('create_room', {
        name: 'Browser Test',
        game_mode: '4'
    });
});
```

---

## 🔌 API Endpoints

### HTTP Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check & server status |
| GET | `/api/rooms` | List available rooms |
| POST | `/api/rooms` | Create new room |
| GET | `/api/stats` | Game statistics |

### WebSocket Events

#### Client → Server

| Event | Data | Description |
|-------|------|-------------|
| `create_room` | `{name, game_mode}` | Create new game room |
| `join_room` | `{room_id, player_name, character}` | Join a room |
| `leave_room` | `{room_id}` | Leave room |
| `start_game` | `{room_id}` | Start game (when 4 players) |
| `player_action` | `{room_id, action, player_index, data}` | Make game action |
| `discard_cards` | `{room_id, player_index, card_indices}` | Discard cards |
| `get_game_state` | `{room_id, player_index}` | Request game state |

#### Server → Client

| Event | Description |
|-------|-------------|
| `connected` | Connection confirmed |
| `room_created` | Room created successfully |
| `joined_room` | Joined room |
| `room_updated` | Room state changed |
| `game_started` | Game started |
| `game_update` | Game state updated |
| `cards_discarded` | Cards discarded |
| `new_cards_dealt` | New cards dealt |
| `round_ended` | Round finished |
| `game_ended` | Game finished |
| `game_error` | Error occurred |

---

## 🎯 Game Actions

### MUS Round
- `mus` - Continue with MUS (allows discard)
- `paso` - End MUS, move to GRANDE
- `envido` - Bet X points and move to GRANDE
- `ordago` - All-in bet

### Betting Rounds (GRANDE, CHICA)
- `paso` - Pass/reject bet
- `accept` - Accept current bet
- `envido` - Raise bet
- `ordago` - All-in

### Discard Phase
When all 4 players choose MUS:
- Select card indices to discard (0-3)
- Send `discard_cards` event
- Receive new cards

---

## 🔧 Configuration

Edit `config.py` or set environment variables:

```bash
# Development
export FLASK_ENV=development
export FLASK_DEBUG=True

# Production
export FLASK_ENV=production
export SECRET_KEY=your-secret-key-here
export DATABASE_URL=postgresql://user:pass@host/db
```

---

## 📊 Database

SQLite database is automatically created at: `quantum_mus.db`

To reset database:
```bash
rm quantum_mus.db
python server.py
```

---

## 🐛 Troubleshooting

### Port already in use
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:5000 | xargs kill -9
```

### Dependencies not installing
```bash
# Upgrade pip
python -m pip install --upgrade pip

# Install with verbose output
pip install -r requirements.txt -v
```

### WebSocket not connecting
- Check firewall settings
- Verify server is running: `http://localhost:5000/health`
- Check browser console for CORS errors
- Try `http://localhost:5000` instead of `https://`

---

## 📝 Next Steps

1. ✅ Backend is ready!
2. ⏭️ Integrate frontend (see `integration_guide.py`)
3. ⏭️ Test multiplayer with 4 clients
4. ⏭️ Deploy to production server
5. ⏭️ Add PARES and JUEGO rounds

---

## 🤝 Support

- Check `README.md` for detailed documentation
- Review `integration_guide.py` for frontend examples
- Use `test_client.py` for testing WebSocket events
- Check server logs for debugging

**Happy Gaming! 🎮✨**
