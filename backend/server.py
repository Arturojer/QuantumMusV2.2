try:
    import eventlet
    eventlet.monkey_patch()
except Exception:
    eventlet = None

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
import random  # Only used for non-game room codes
import time
import threading

# Directorio del frontend (para servir archivos estáticos si aplica)
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend'))

# CORS: orígenes permitidos
# En producción, especificar ALLOWED_ORIGINS con dominios explícitos
# En desarrollo, usar * para pruebas locales
CORS_ORIGINS = os.environ.get('ALLOWED_ORIGINS', '*')

# Import game modules
from game_manager import GameManager
from room_manager import RoomManager
from models import db, Game, Player, GameHistory
from Logica_cuantica.baraja import QuantumDeck
from Logica_cuantica.quantum_random import QuantumRNG
from config import get_config

# Configure
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

# Initialize Socket.IO (WebSocket) con optimizaciones para Render
socketio = SocketIO(
    app, 
    cors_allowed_origins=CORS_ORIGINS,
    async_mode='eventlet' if eventlet else 'threading',
    ping_timeout=120,  # Aumentar timeout a 2 minutos
    ping_interval=30,  # Enviar ping cada 30 segundos
    max_http_buffer_size=1e6,  # 1MB buffer para mensajes
    engineio_logger=False,  # Desactivar logs verbose de engineio en producción
    #logger=False,  # Desactivar logs verbose de socketio en producción
    allow_upgrades=True,  # Permitir upgrades de polling a WebSocket
    transports=['websocket', 'http_long_polling']  # WebSocket primero, fallback a polling
)

# Timeouts (server-authoritative for online mode)
CONFIG = get_config()
TURN_TIMEOUT = getattr(CONFIG, 'TURN_TIMEOUT', 10)
DISCARD_TIMEOUT = getattr(CONFIG, 'DISCARD_TIMEOUT', 10)

# Room -> timeout handle (eventlet GreenThread or threading.Timer)
turn_timeouts = {}
discard_timeouts = {}

# Initialize database
db.init_app(app)

# Initialize managers
room_manager = RoomManager()
game_manager = GameManager()


def _cancel_timeout(handle):
    if not handle:
        return
    try:
        handle.cancel()
        return
    except Exception:
        pass
    try:
        handle.kill()
    except Exception:
        pass


def _replace_timeout(timeout_store, room_id, handle):
    old = timeout_store.pop(room_id, None)
    _cancel_timeout(old)
    if handle:
        timeout_store[room_id] = handle


def _spawn_after(delay_seconds, callback):
    if eventlet:
        return eventlet.spawn_after(delay_seconds, callback)
    timer = threading.Timer(delay_seconds, callback)
    timer.daemon = True
    timer.start()
    return timer


def _broadcast_action_update(room_id, game, player_index, action, extra_data, result):
    socketio.emit('game_update', {
        'game_state': game.get_public_state(),
        'action': {
            'player_index': player_index,
            'action': action,
            'data': extra_data or {}
        },
        'result': result  # Include the full result in the broadcast
    }, room=room_id)

    if result.get('round_ended') and result.get('round_result') is not None:
        socketio.emit('round_ended', {
            'result': result['round_result']
        }, room=room_id)

    if result.get('hand_ended'):
        updated_state = game.get_public_state()
        updated_state['player_hands'] = {
            i: [card.to_dict() for card in game.hands.get(i, [])]
            for i in range(4)
        }
        updated_state['manoIndex'] = game.state['manoIndex']
        updated_state['entanglement'] = game.get_full_entanglement_state()
        socketio.emit('hand_started', {
            'game_state': updated_state,
            'game_mode': game.game_mode
        }, room=room_id)

    if result.get('game_ended'):
        socketio.emit('game_ended', {
            'winner': result.get('winner_team'),
            'final_scores': {
                'team1': game.state['teams']['team1']['score'],
                'team2': game.state['teams']['team2']['score']
            },
            'reason': 'ordago' if result.get('bet_type') == 'ordago' else 'score_limit'
        }, room=room_id)
    
    # If round changed to PARES or JUEGO, check for auto-declarations
    current_round = game.state.get('currentRound')
    if current_round in ['PARES', 'JUEGO']:
        _check_and_emit_auto_declaration(room_id, game, current_round)


def _check_and_emit_auto_declaration(room_id, game, round_name):
    """
    Check if current active player can auto-declare and emit declaration if so.
    Recursively checks until finding a player that needs manual declaration or all are done.
    Returns True if auto-declaration was emitted, False otherwise.
    """
    if not game:
        return False
    
    current_round = game.state.get('currentRound')
    if current_round not in ['PARES', 'JUEGO']:
        return False
    
    # Only check for declaration if we're in declaration phase (not betting)
    key = 'paresDeclarations' if current_round == 'PARES' else 'juegoDeclarations'
    if key not in game.state:
        game.state[key] = {}
    
    declarations = game.state[key]
    
    # If all players have declared, we're in betting phase
    if len(declarations) >= 4:
        return False
    
    # Keep checking players until finding one that needs manual declaration
    max_checks = 4  # Prevent infinite loops
    checks = 0
    auto_declared_count = 0
    
    while checks < max_checks and len(declarations) < 4:
        checks += 1
        
        player_index = game.state.get('activePlayerIndex')
        if player_index is None:
            break
        
        # Check if this player has already declared
        if player_index in declarations:
            # This player already declared, move to next
            game.next_player()
            continue
        
        # Check if player should auto-declare
        should_auto = game.should_auto_declare(player_index, current_round)
        if not should_auto:
            # This player needs manual declaration, stop here
            break
        
        # Get the auto-declaration value
        auto_value = game.get_auto_declaration_value(player_index, current_round)
        if auto_value is None:
            # Uncertain outcome, needs manual declaration
            break
        
        # Store declaration
        declarations[player_index] = auto_value
        
        # Advance turn (auto-declarations don't require collapse)
        game.next_player()
        
        logger.info(f"Auto-declared for player {player_index} in {current_round}: {auto_value}")
        
        # Broadcast auto-declaration
        socketio.emit('declaration_made', {
            'success': True,
            'player_index': player_index,
            'declaration': auto_value,
            'round_name': current_round,
            'declarations': dict(declarations),  # Copy to avoid mutation issues
            'next_player': game.state['activePlayerIndex'],
            'is_auto_declared': True,
            'timestamp': datetime.utcnow().isoformat()
        }, room=room_id)
        
        auto_declared_count += 1
        
        # Small delay between auto-declarations for visual clarity
        if len(declarations) < 4:
            eventlet.sleep(0.5) if eventlet else None
    
    return auto_declared_count > 0


def _schedule_discard_timeout(room_id):
    game = game_manager.get_game(room_id)
    if not game:
        return
    if not game.state.get('waitingForDiscard'):
        _replace_timeout(discard_timeouts, room_id, None)
        return

    def on_timeout():
        current_game = game_manager.get_game(room_id)
        if not current_game:
            return
        if not current_game.state.get('waitingForDiscard'):
            return

        for player_idx in range(current_game.num_players):
            if player_idx in current_game.state.get('cardsDiscarded', {}):
                continue
            result = current_game.discard_cards(player_idx, [0, 1, 2, 3])
            if result.get('success'):
                socketio.emit('cards_discarded', {
                    'player_index': player_idx,
                    'num_cards': 4,
                    'game_state': current_game.get_public_state()
                }, room=room_id)

        if len(current_game.state.get('cardsDiscarded', {})) == current_game.num_players:
            deal_result = current_game.deal_new_cards()
            if deal_result and deal_result.get('success'):
                socketio.emit('new_cards_dealt', {
                    'success': True,
                    'game_state': current_game.get_public_state(),
                    'player_hands': {
                        i: [card.to_dict() for card in current_game.hands.get(i, [])]
                        for i in range(4)
                    }
                }, room=room_id)
            else:
                socketio.emit('game_error', {
                    'error': 'Failed to deal new cards'
                }, room=room_id)

        _replace_timeout(discard_timeouts, room_id, None)
        _schedule_turn_timeout(room_id)

    _replace_timeout(discard_timeouts, room_id, _spawn_after(DISCARD_TIMEOUT, on_timeout))


def _schedule_turn_timeout(room_id):
    game = game_manager.get_game(room_id)
    if not game:
        return

    if game.state.get('waitingForDiscard'):
        _replace_timeout(turn_timeouts, room_id, None)
        _schedule_discard_timeout(room_id)
        return

    active_player = game.state.get('activePlayerIndex')
    current_round = game.state.get('currentRound')
    if active_player is None:
        return

    def on_timeout():
        current_game = game_manager.get_game(room_id)
        if not current_game:
            return
        if current_game.state.get('waitingForDiscard'):
            return
        if current_game.state.get('activePlayerIndex') != active_player:
            return
        if current_game.state.get('currentRound') != current_round:
            return

        if current_game.state.get('currentRound') == 'MUS':
            timeout_action = 'mus'
        else:
            timeout_action = 'paso'

        result = current_game.process_action(active_player, timeout_action, {})
        if not result.get('success'):
            logger.warning(f"Timeout action failed: {result.get('error')}")
            return

        _broadcast_action_update(room_id, current_game, active_player, timeout_action, {}, result)
        _schedule_turn_timeout(room_id)

    _replace_timeout(turn_timeouts, room_id, _spawn_after(TURN_TIMEOUT, on_timeout))

# Create tables
with app.app_context():
    db.create_all()
    logger.info("Database initialized")

# Valid characters for the game
VALID_CHARACTERS = {
    'preskill': 'John Preskill',
    'zoller': 'Peter Zoller',
    'cirac': 'Ignacio Cirac',
    'deutsch': 'David Deutsch',
    'simmons': 'Matthew Simmons',
    'broadbent': 'Anne Broadbent',
    'martinis': 'Nicole Yunger Halpern',
    'monroe': 'Karen Hallberg'
}

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
    character = data.get('character')  # Can be None initially, chosen later
    
    # Validate character if provided
    if character and character not in VALID_CHARACTERS:
        emit('joined_room', {
            'success': False,
            'error': f'Invalid character: {character}. Valid characters: {list(VALID_CHARACTERS.keys())}'
        })
        return
    
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
    """Update player's character in the room"""
    room_id = data.get('room_id')
    character = data.get('character')
    
    # Allow None (unselecting), but validate if character is provided
    if character is not None and character not in VALID_CHARACTERS:
        emit('game_error', {
            'error': f'Invalid character: {character}. Valid characters: {list(VALID_CHARACTERS.keys())}'
        })
        return
    
    # Check if another player already has this character (prevent duplicates)
    if character is not None:
        room = room_manager.get_room(room_id)
        if room:
            for player in room['players']:
                if player['socket_id'] != request.sid and player['character'] == character:
                    emit('game_error', {
                        'error': f'Character {character} is already selected by another player'
                    })
                    return
    
    team = data.get('team')  # 1 = Copenhaguen, 2 = Bohmian
    if room_manager.set_player_character(room_id, request.sid, character, team=team):
        socketio.emit('room_updated', {
            'room': room_manager.get_room(room_id)
        }, room=room_id)
    else:
        emit('game_error', {'error': 'Failed to update character'})

@socketio.on('join_room_by_code')
def handle_join_room_by_code(data):
    """Join a room using room code"""
    room_code = data.get('room_code', '').upper()
    player_name = data.get('player_name', 'Anonymous')
    
    # Look up room by code
    room = room_manager.get_room_by_code(room_code)
    
    if not room:
        emit('joined_room', {
            'success': False,
            'error': f'Room with code {room_code} not found'
        })
        return
    
    # Join the room using its ID
    result = room_manager.add_player(room['id'], request.sid, player_name, None)
    
    if result['success']:
        join_room(room['id'])
        
        # Notify player
        emit('joined_room', {
            'success': True,
            'room_id': room['id'],
            'player_index': result['player_index'],
            'room': room_manager.get_room(room['id'])
        })
        
        # Notify all players in room
        socketio.emit('room_updated', {
            'room': room_manager.get_room(room['id'])
        }, room=room['id'])
    else:
        emit('joined_room', {
            'success': False,
            'error': result.get('error', 'Failed to join room')
        })

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

@socketio.on('return_to_lobby')
def handle_return_to_lobby(data):
    """Return to lobby after game ends - cleanup game but keep room"""
    room_id = data.get('room_id')
    
    try:
        logger.info(f"Player {request.sid} returning to lobby for room {room_id}")
        
        # Remove the game instance but keep the room
        game = game_manager.get_game(room_id)
        if game:
            game_manager.remove_game(room_id)
            logger.info(f"Removed game for room {room_id}")
        
        # Get room info
        room = room_manager.get_room(room_id)
        if room:
            # Emit to all players in room that game ended and they're back in lobby
            socketio.emit('returned_to_lobby', {
                'success': True,
                'room': room,
                'message': 'Game ended. Ready to start a new game!'
            }, room=room_id)
            logger.info(f"All players in room {room_id} returned to lobby")
        else:
            emit('game_error', {'error': 'Room not found'})
    except Exception as e:
        logger.error(f"Error returning to lobby for room {room_id}: {e}", exc_info=True)
        emit('game_error', {'error': 'Failed to return to lobby'})

@socketio.on('start_game')
def handle_start_game(data):
    """Start the game in a room"""
    room_id = data.get('room_id')
    
    room = room_manager.get_room(room_id)
    if not room or len(room['players']) < 1:
        emit('game_error', {'error': 'Need at least 1 player to start'})
        return

    # Require exactly 4 ready players before starting
    if len(room['players']) != 4:
        emit('game_error', {'error': f'Need 4 players to start ({len(room["players"])}/4)'} )
        return

    not_ready = [p for p in room['players'] if not p.get('character')]
    if not_ready:
        emit('game_error', {'error': 'All players must select a character before starting'})
        return

    room_manager.set_room_status(room_id, 'in_progress')
    
    # Create game instance
    game = game_manager.create_game(room_id, room['players'], room['game_mode'])
    # Server-authoritative mano for all clients - use quantum randomness
    qrng = QuantumRNG()
    game.state['manoIndex'] = qrng.random_int(0, game.num_players - 1)
    game.state['activePlayerIndex'] = game.state['manoIndex']
    
    # Deal initial cards
    deal_result = game.deal_cards()
    if not deal_result['success']:
        emit('game_error', {'error': deal_result.get('error', 'Failed to deal cards')})
        game_manager.remove_game(room_id)
        return
    
    # Build comprehensive game state with all player hands
    game_state = game.get_public_state()
    
    # Add player-specific hands for each player
    game_state['player_hands'] = {
        i: [card.to_dict() for card in game.hands.get(i, [])]
        for i in range(4)
    }
    
    # Add mano index explicitly
    game_state['manoIndex'] = game.state['manoIndex']
    
    # Add initial entanglement state
    game_state['entanglement'] = game.get_full_entanglement_state()
    
    # Log game start
    logger.info(f"Game started in room {room_id}, mode: {room['game_mode']}, mano: {game.state['manoIndex']}")
    
    # Notify all players with complete initial state
    socketio.emit('game_started', {
        'success': True,
        'game_state': game_state,
        'game_mode': room['game_mode']
    }, room=room_id)

    _schedule_turn_timeout(room_id)

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
        _broadcast_action_update(room_id, game, player_index, action, extra_data, result)

        if result.get('game_ended'):
            _replace_timeout(turn_timeouts, room_id, None)
            _replace_timeout(discard_timeouts, room_id, None)
        else:
            _schedule_turn_timeout(room_id)
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
        logger.error(f"Game not found for room {room_id}")
        emit('game_error', {'error': 'Game not found'})
        return
    
    # Validate player index
    if not isinstance(player_index, int) or player_index < 0 or player_index > 3:
        logger.error(f"Invalid player_index in discard: {player_index}")
        emit('game_error', {'error': 'Invalid player index'})
        return
    
    # Validate not in discard phase
    if not game.state['waitingForDiscard']:
        logger.warning(f"Player {player_index} tried to discard outside discard phase")
        emit('game_error', {'error': 'Not in discard phase'})
        return
    
    # Validate card indices (must be 0-4 cards)
    if not isinstance(card_indices, list):
        logger.error(f"Invalid card_indices format for player {player_index}")
        emit('game_error', {'error': 'Invalid card indices format'})
        return
    
    if len(card_indices) > 4:
        logger.warning(f"Player {player_index} tried to discard {len(card_indices)} cards (max 4)")
        emit('game_error', {'error': 'Cannot discard more than 4 cards'})
        return
    
    if any(not isinstance(idx, int) or idx < 0 or idx > 3 for idx in card_indices):
        logger.error(f"Invalid card index in list for player {player_index}")
        emit('game_error', {'error': 'Invalid card index'})
        return
    
    # Validate player hasn't already discarded
    if player_index in game.state['cardsDiscarded']:
        logger.warning(f"Player {player_index} tried to discard twice")
        emit('game_error', {'error': 'You have already discarded'})
        return
    
    # Process discard
    result = game.discard_cards(player_index, card_indices)
    
    if result['success']:
        logger.info(f"Player {player_index} discarded {len(card_indices)} cards in room {room_id}")
        
        # Notify all players with card dealer info (num cards only, not indices)
        socketio.emit('cards_discarded', {
            'player_index': player_index,
            'num_cards': len(card_indices),
            'game_state': game.get_public_state()
        }, room=room_id)
        
        # If all players discarded, deal new cards and send to all
        if result.get('all_discarded'):
            logger.info(f"All players discarded in room {room_id} - dealing new cards")
            deal_result = game.deal_new_cards()
            if deal_result and deal_result.get('success'):
                # Send new game state to all players (includes new cards)
                socketio.emit('new_cards_dealt', {
                    'success': True,
                    'game_state': game.get_public_state(),
                    'player_hands': {
                        i: [card.to_dict() for card in game.hands.get(i, [])]
                        for i in range(4)
                    }
                }, room=room_id)
                _replace_timeout(discard_timeouts, room_id, None)
                _schedule_turn_timeout(room_id)
            else:
                logger.error(f"Failed to deal new cards in room {room_id}")
                socketio.emit('game_error', {'error': 'Failed to deal new cards'}, room=room_id)
    else:
        logger.error(f"Discard failed for player {player_index}: {result.get('error')}")
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

@socketio.on('player_declaration')
def handle_player_declaration(data):
    """Handle player declaration in PARES/JUEGO rounds (tengo/no tengo/puede)"""
    room_id = data.get('room_id')
    player_index = data.get('player_index')
    declaration = data.get('declaration')  # true (tengo), false (no tengo), or 'puede'
    round_name = data.get('round_name')  # 'PARES' or 'JUEGO'
    
    game = game_manager.get_game(room_id)
    if not game:
        emit('game_error', {'error': 'Game not found'})
        logger.error(f"Game not found for room {room_id} in declaration event")
        return
    
    if player_index != game.state['activePlayerIndex']:
        emit('game_error', {'error': 'Not your turn'})
        return
    
    # Check if this is an auto-declaration (indicated by client)
    is_auto_declared = data.get('is_auto_declared', False)
    
    # Store declaration in game state
    key = 'paresDeclarations' if round_name == 'PARES' else 'juegoDeclarations'
    if key not in game.state:
        game.state[key] = {}
    game.state[key][player_index] = declaration
    
    logger.info(f"Player {player_index} declared '{declaration}' in {round_name} for room {room_id} (auto: {is_auto_declared})")
    
    # Advance turn for 'puede' declarations OR auto-declarations
    # (manual tengo/no tengo will wait for collapse event to advance)
    advance_turn = (declaration == 'puede') or is_auto_declared
    if advance_turn:
        game.next_player()
    
    # Broadcast declaration to all players
    socketio.emit('declaration_made', {
        'success': True,
        'player_index': player_index,
        'declaration': declaration,
        'round_name': round_name,
        'declarations': game.state[key],
        'next_player': game.state['activePlayerIndex'] if advance_turn else None,
        'is_auto_declared': is_auto_declared,
        'timestamp': datetime.utcnow().isoformat()
    }, room=room_id)
    
    # After declaration, check if next player can auto-declare
    if advance_turn and len(game.state[key]) < 4:
        _check_and_emit_auto_declaration(room_id, game, round_name)


@socketio.on('trigger_declaration_collapse')
def handle_trigger_declaration_collapse(data):
    """Handle card collapse when player makes a declaration"""
    room_id = data.get('room_id')
    player_index = data.get('player_index')
    declaration = data.get('declaration')  # 'tengo' or 'no_tengo'
    round_name = data.get('round_name')  # 'PARES' or 'JUEGO'
    
    game = game_manager.get_game(room_id)
    if not game:
        emit('game_error', {'error': 'Game not found'})
        logger.error(f"Game not found for room {room_id} in collapse event")
        return
    
    if player_index != game.state['activePlayerIndex']:
        emit('game_error', {'error': 'Not your turn'})
        return
    
    # Trigger collapse
    collapse_result = game.trigger_collapse_on_declaration(player_index, declaration, round_name)
    
    if collapse_result['success']:
        # Advance turn after successful collapse
        game.next_player()
        next_player_index = game.state['activePlayerIndex']
        
        # Broadcast collapse event to ALL players in the room
        socketio.emit('cards_collapsed', {
            'success': True,
            'collapse_event': collapse_result['collapse_event'],
            'penalty': collapse_result['penalty'],
            'player_index': player_index,
            'declaration': declaration,
            'round_name': round_name,
            'updated_hands': collapse_result['updated_hands'],
            'next_player': next_player_index,
            'timestamp': datetime.utcnow().isoformat()
        }, room=room_id)
        
        logger.info(f"Collapse broadcast in room {room_id}: Player {player_index} made declaration '{declaration}' in {round_name}, next player: {next_player_index}")
        
        # Check if next player can auto-declare
        key = 'paresDeclarations' if round_name == 'PARES' else 'juegoDeclarations'
        if len(game.state.get(key, {})) < 4:
            _check_and_emit_auto_declaration(room_id, game, round_name)
    else:
        socketio.emit('game_error', {'error': collapse_result.get('error', 'Failed to collapse cards')}, room=room_id)

@socketio.on('trigger_bet_collapse')
def handle_trigger_bet_collapse(data):
    """Handle card collapse when player places/accepts a bet"""
    room_id = data.get('room_id')
    player_index = data.get('player_index')
    round_name = data.get('round_name')  # 'PARES', 'JUEGO', or 'PUNTO'
    
    game = game_manager.get_game(room_id)
    if not game:
        emit('game_error', {'error': 'Game not found'})
        logger.error(f"Game not found for room {room_id} in bet collapse event")
        return
    
    # Trigger collapse
    collapse_result = game.trigger_collapse_on_bet_acceptance(player_index, round_name)
    
    if collapse_result['success']:
        # Broadcast collapse event to ALL players in the room
        socketio.emit('bet_collapse_completed', {
            'success': True,
            'collapse_event': collapse_result['collapse_event'],
            'player_index': player_index,
            'round_name': round_name,
            'updated_hands': collapse_result['updated_hands'],
            'timestamp': datetime.utcnow().isoformat()
        }, room=room_id)
        
        logger.info(f"Bet collapse broadcast in room {room_id}: Player {player_index} in {round_name}")
    else:
        socketio.emit('game_error', {'error': collapse_result.get('error', 'Failed to collapse cards')}, room=room_id)

@socketio.on('trigger_final_collapse')
def handle_trigger_final_collapse(data):
    """Handle final collapse of all remaining entangled cards at hand end"""
    room_id = data.get('room_id')
    
    game = game_manager.get_game(room_id)
    if not game:
        emit('game_error', {'error': 'Game not found'})
        return
    
    # Trigger final collapse
    collapse_result = game.trigger_final_collapse()
    
    if collapse_result['success']:
        # Broadcast final collapse to ALL players
        socketio.emit('final_cards_collapsed', {
            'success': True,
            'collapse_event': collapse_result['collapse_event'],
            'final_hands': collapse_result['final_hands'],
            'timestamp': datetime.utcnow().isoformat()
        }, room=room_id)
        
        logger.info(f"Final collapse broadcast in room {room_id}: All remaining cards collapsed")
    else:
        socketio.emit('game_error', {'error': collapse_result.get('error', 'Failed to collapse cards')}, room=room_id)


# ==================== RUN SERVER ====================

if __name__ == '__main__':
    host = os.environ.get('HOST', '0.0.0.0')
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    
    # Log configuración inicial
    logger.info(f"Starting Quantum Mus server on {host}:{port} (debug={debug})...")
    logger.info(f"Environment: {'Render' if os.environ.get('RENDER') == 'true' else 'Local/Other'}")
    logger.info("CORS allowed origins: " + ("* (all)" if CORS_ORIGINS == "*" else str(CORS_ORIGINS)))
    
    # socketio.run() manejará la configuración a través de gunicorn en producción
    socketio.run(app, host=host, port=port, debug=debug, allow_unsafe_werkzeug=True)
