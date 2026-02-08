"""
Quantum Mus - Backend Server
Flask + Socket.IO for real-time multiplayer game
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
import logging
import os
from datetime import datetime
import time

# Prefer eventlet for better WebSocket support and lower latency under limited CPU
try:
    import eventlet
    eventlet.monkey_patch()
except Exception:
    eventlet = None

# Directorio del frontend (padre del backend) para servir archivos estáticos
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

# CORS: orígenes permitidos (variable de entorno ALLOWED_ORIGINS; por defecto "*" para no bloquear en pruebas)
def _get_cors_origins():
    raw = os.environ.get('ALLOWED_ORIGINS', '*').strip()
    if not raw or raw == '*':
        return '*'
    return [o.strip() for o in raw.split(',') if o.strip()]

CORS_ORIGINS = _get_cors_origins()

# Import game modules
from game_manager import GameManager
from room_manager import RoomManager
from models import db, Game, Player, GameHistory

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = 'quantum-mus-secret-2026'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///quantum_mus.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Enable CORS (Flask HTTP) usando ALLOWED_ORIGINS
CORS(app, resources={r"/*": {"origins": CORS_ORIGINS}})

# Initialize Socket.IO (WebSocket) con los mismos orígenes permitidos
socketio = SocketIO(
    app, 
    cors_allowed_origins=CORS_ORIGINS,
    async_mode='eventlet' if eventlet else 'threading',
    ping_timeout=120,  # Aumentar timeout a 2 minutos
    ping_interval=30,  # Enviar ping cada 30 segundos
    max_http_buffer_size=1e6  # 1MB buffer para mensajes
)

# Initialize database
db.init_app(app)

# Initialize managers
room_manager = RoomManager()
game_manager = GameManager()

# Create tables
with app.app_context():
    db.create_all()
    logger.info("Database initialized")


# ==================== HTTP ENDPOINTS ====================

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'active_games': len(game_manager.games),
        'active_rooms': len(room_manager.rooms)
    })

@app.route('/api/rooms', methods=['GET'])
def get_rooms():
    """Get list of available rooms"""
    rooms = room_manager.get_available_rooms()
    return jsonify({'rooms': rooms})

@app.route('/api/rooms', methods=['POST'])
def create_room():
    """Create a new game room"""
    data = request.json
    room_name = data.get('name', 'Quantum Room')
    game_mode = data.get('game_mode', '4')
    max_players = 4
    # Instrumentation: measure server processing time for room creation
    recv_ts = time.time()
    room = room_manager.create_room(room_name, game_mode, max_players)
    send_ts = time.time()
    processing_ms = int((send_ts - recv_ts) * 1000)

    logger.info(f"POST /api/rooms processed in {processing_ms}ms - room {room['id']}")

    return jsonify({
        'success': True,
        'room': room,
        'server_ts': datetime.utcnow().isoformat(),
        'processing_ms': processing_ms
    }), 201

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get global game statistics"""
    total_games = Game.query.count()
    total_players = Player.query.count()
    
    return jsonify({
        'total_games': total_games,
        'total_players': total_players,
        'active_games': len(game_manager.games)
    })


# ==================== FRONTEND ESTÁTICO ====================
@app.route('/')
def serve_index():
    """Sirve la página principal del juego"""
    return send_from_directory(FRONTEND_DIR, 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    """Sirve archivos estáticos (js, css, assets). Debe ir al final."""
    if filename.startswith('api/') or filename == 'health':
        return jsonify({'error': 'Not found'}), 404
    filepath = os.path.join(FRONTEND_DIR, filename)
    if os.path.isfile(filepath):
        return send_from_directory(FRONTEND_DIR, filename)
    return send_from_directory(FRONTEND_DIR, 'index.html')


# ==================== WEBSOCKET EVENTS ====================

@socketio.on_error_default
def default_error_handler(e):
    """Global error handler for Socket.IO"""
    logger.error(f"Socket.IO error: {e}", exc_info=True)
    emit('socket_error', {'error': str(e)})

@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    logger.info(f"Client connected: {request.sid}")
    emit('connected', {'sid': request.sid})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    logger.info(f"Client disconnected: {request.sid}")
    
    try:
        # Remove player from any rooms/games
        room_id = room_manager.get_player_room(request.sid)
        if room_id:
            # Don't use leave_room() during disconnect - socket is already closing
            # Just clean up the room manager directly
            room_manager.remove_player(room_id, request.sid)
            
            # Notify remaining players of room update
            remaining_room = room_manager.get_room(room_id)
            if remaining_room:
                socketio.emit('room_updated', {
                    'room': remaining_room
                }, room=room_id)
    except Exception as e:
        logger.error(f"Error during disconnect cleanup for {request.sid}: {e}")

@socketio.on('create_room')
def handle_create_room(data):
    """Create a new game room"""
    # Instrumentation: measure server-side receive -> response time
    recv_ts = time.time()
    room_name = data.get('name', 'Quantum Room')
    game_mode = data.get('game_mode', '4')

    room = room_manager.create_room(room_name, game_mode, 4)

    send_ts = time.time()
    processing_ms = int((send_ts - recv_ts) * 1000)

    logger.info(f"Socket create_room processed in {processing_ms}ms - room {room['id']}")

    emit('room_created', {
        'success': True,
        'room': room,
        'server_ts': datetime.utcnow().isoformat(),
        'processing_ms': processing_ms
    })

@socketio.on('join_room')
def handle_join_room(data):
    """Join a game room"""
    room_id = data.get('room_id')
    player_name = data.get('player_name', 'Anonymous')
    character = data.get('character')  # Puede ser None al unirse, se elige después
    
    result = room_manager.add_player(room_id, request.sid, player_name, character)
    
    if result['success']:
        join_room(room_id)
        
        # Notify player
        emit('joined_room', {
            'success': True,
            'room_id': room_id,
            'player_index': result['player_index'],
            'room': room_manager.get_room(room_id)
        })
        
        # Notify all players in room
        socketio.emit('room_updated', {
            'room': room_manager.get_room(room_id)
        }, room=room_id)
    else:
        emit('joined_room', {
            'success': False,
            'error': result.get('error', 'Failed to join room')
        })

@socketio.on('set_character')
def handle_set_character(data):
    """Actualizar el personaje de un jugador ya en la sala"""
    room_id = data.get('room_id')
    character = data.get('character')
    
    if room_manager.set_player_character(room_id, request.sid, character):
        socketio.emit('room_updated', {
            'room': room_manager.get_room(room_id)
        }, room=room_id)
    else:
        emit('game_error', {'error': 'No se pudo actualizar el personaje'})

@socketio.on('leave_room')
def handle_leave_room(data):
    """Leave a game room"""
    room_id = data.get('room_id')
    
    try:
        if room_manager.remove_player(room_id, request.sid):
            try:
                leave_room(room_id)
            except Exception as e:
                logger.warning(f"Could not leave room {room_id}: {e}")
            
            # Notify player
            emit('left_room', {'success': True})
            
            # Notify remaining players
            socketio.emit('room_updated', {
                'room': room_manager.get_room(room_id)
            }, room=room_id)
    except Exception as e:
        logger.error(f"Error leaving room {room_id}: {e}", exc_info=True)
        emit('game_error', {'error': 'Failed to leave room'})

@socketio.on('start_game')
def handle_start_game(data):
    """Start the game in a room"""
    room_id = data.get('room_id')
    
    room = room_manager.get_room(room_id)
    if not room or len(room['players']) < 4:
        emit('game_error', {'error': 'Need 4 players to start'})
        return
    
    # Create game instance
    game = game_manager.create_game(room_id, room['players'], room['game_mode'])
    
    # Deal initial cards
    game.deal_cards()
    
    # Notify all players
    socketio.emit('game_started', {
        'game_state': game.get_public_state()
    }, room=room_id)

@socketio.on('player_action')
def handle_player_action(data):
    """Handle player action (MUS, PASO, ENVIDO, ORDAGO, etc.)"""
    room_id = data.get('room_id')
    action = data.get('action')
    player_index = data.get('player_index')
    extra_data = data.get('data', {})
    
    game = game_manager.get_game(room_id)
    if not game:
        emit('game_error', {'error': 'Game not found'})
        return
    
    # Validate it's player's turn
    if game.state['activePlayerIndex'] != player_index:
        emit('game_error', {'error': 'Not your turn'})
        return
    
    # Process action
    result = game.process_action(player_index, action, extra_data)
    
    if result['success']:
        # Notify all players of game state update
        socketio.emit('game_update', {
            'game_state': game.get_public_state(),
            'action': {
                'player_index': player_index,
                'action': action,
                'data': extra_data
            }
        }, room=room_id)
        
        # Check if round ended
        if result.get('round_ended'):
            socketio.emit('round_ended', {
                'result': result['round_result']
            }, room=room_id)
        
        # Check if game ended
        if result.get('game_ended'):
            socketio.emit('game_ended', {
                'winner': result['winner'],
                'final_scores': result['final_scores']
            }, room=room_id)
    else:
        emit('game_error', {'error': result.get('error', 'Invalid action')})

@socketio.on('discard_cards')
def handle_discard_cards(data):
    """Handle card discard during MUS phase"""
    room_id = data.get('room_id')
    player_index = data.get('player_index')
    card_indices = data.get('card_indices', [])
    
    game = game_manager.get_game(room_id)
    if not game:
        emit('game_error', {'error': 'Game not found'})
        return
    
    result = game.discard_cards(player_index, card_indices)
    
    if result['success']:
        # Notify all players
        socketio.emit('cards_discarded', {
            'player_index': player_index,
            'num_cards': len(card_indices),
            'game_state': game.get_public_state()
        }, room=room_id)
        
        # If all players discarded, deal new cards
        if result.get('all_discarded'):
            game.deal_new_cards()
            socketio.emit('new_cards_dealt', {
                'game_state': game.get_public_state()
            }, room=room_id)
    else:
        emit('game_error', {'error': result.get('error', 'Failed to discard')})

@socketio.on('get_game_state')
def handle_get_game_state(data):
    """Get current game state"""
    room_id = data.get('room_id')
    player_index = data.get('player_index', 0)
    
    game = game_manager.get_game(room_id)
    if game:
        emit('game_state', {
            'game_state': game.get_player_state(player_index)
        })
    else:
        emit('game_error', {'error': 'Game not found'})


# ==================== ENTANGLEMENT EVENTS ====================

@socketio.on('get_entanglement_state')
def handle_get_entanglement_state(data):
    """Get current entanglement state for all pairs"""
    room_id = data.get('room_id')
    player_index = data.get('player_index', 0)
    
    game = game_manager.get_game(room_id)
    if not game:
        emit('game_error', {'error': 'Game not found'})
        return
    
    entanglement_state = game.get_full_entanglement_state()
    
    emit('entanglement_state', {
        'entanglement': entanglement_state,
        'game_mode': game.game_mode
    })

@socketio.on('get_player_entanglement')
def handle_get_player_entanglement(data):
    """Get entanglement information for a specific player"""
    room_id = data.get('room_id')
    player_index = data.get('player_index', 0)
    
    game = game_manager.get_game(room_id)
    if not game:
        emit('game_error', {'error': 'Game not found'})
        return
    
    entanglement_info = game.get_entanglement_info_for_player(player_index)
    entangled_cards = game.get_player_entangled_cards(player_index)
    
    emit('player_entanglement_info', {
        'player_index': player_index,
        'entanglement_info': entanglement_info,
        'entangled_cards': entangled_cards
    })

@socketio.on('play_card_with_entanglement')
def handle_play_card_with_entanglement(data):
    """Handle card play and check for entanglement activation"""
    room_id = data.get('room_id')
    player_index = data.get('player_index')
    card_index = data.get('card_index')
    
    game = game_manager.get_game(room_id)
    if not game:
        emit('game_error', {'error': 'Game not found'})
        return
    
    # Play the card and check for entanglement
    result = game.play_card_and_check_entanglement(player_index, card_index)
    
    if result['success']:
        # If entanglement was triggered, broadcast to all players
        if result['entanglement']:
            socketio.emit('entanglement_activated', {
                'entanglement_data': result['entanglement'],
                'card_played': result['card'],
                'player_index': player_index,
                'round': game.state['currentRound']
            }, room=room_id)
            
            logger.info(f"Entanglement activated in room {room_id}: "
                       f"Player {player_index} played entangled card")
        
        # Broadcast game state update
        socketio.emit('game_update', {
            'game_state': game.get_public_state(),
            'player_states': {
                i: game.get_player_state(i) for i in range(4)
            }
        }, room=room_id)
    else:
        emit('game_error', {'error': result.get('error', 'Failed to play card')})


# ==================== RUN SERVER ====================

if __name__ == '__main__':
    host = os.environ.get('HOST', '0.0.0.0')
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    logger.info(f"Starting Quantum Mus server on {host}:{port} (debug={debug})...")
    logger.info("CORS allowed origins: " + ("* (all)" if CORS_ORIGINS == "*" else str(CORS_ORIGINS)))
    socketio.run(app, host=host, port=port, debug=debug)
