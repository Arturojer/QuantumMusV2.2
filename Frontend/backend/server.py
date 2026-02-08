"""
Quantum Mus - Backend Server
Flask + Socket.IO for real-time multiplayer game
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
import logging
from datetime import datetime

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

# Enable CORS
CORS(app, resources={r"/*": {"origins": "*"}})

# Initialize Socket.IO
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

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
    
    room = room_manager.create_room(room_name, game_mode, max_players)
    
    return jsonify({
        'success': True,
        'room': room
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


# ==================== WEBSOCKET EVENTS ====================

@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    logger.info(f"Client connected: {request.sid}")
    emit('connected', {'sid': request.sid})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    logger.info(f"Client disconnected: {request.sid}")
    
    # Remove player from any rooms/games
    room_id = room_manager.get_player_room(request.sid)
    if room_id:
        handle_leave_room({'room_id': room_id})

@socketio.on('create_room')
def handle_create_room(data):
    """Create a new game room"""
    room_name = data.get('name', 'Quantum Room')
    game_mode = data.get('game_mode', '4')
    
    room = room_manager.create_room(room_name, game_mode, 4)
    
    emit('room_created', {
        'success': True,
        'room': room
    })

@socketio.on('join_room')
def handle_join_room(data):
    """Join a game room"""
    room_id = data.get('room_id')
    player_name = data.get('player_name', 'Anonymous')
    character = data.get('character', 'preskill')
    
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

@socketio.on('leave_room')
def handle_leave_room(data):
    """Leave a game room"""
    room_id = data.get('room_id')
    
    if room_manager.remove_player(room_id, request.sid):
        leave_room(room_id)
        
        # Notify player
        emit('left_room', {'success': True})
        
        # Notify remaining players
        socketio.emit('room_updated', {
            'room': room_manager.get_room(room_id)
        }, room=room_id)

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


# ==================== RUN SERVER ====================

if __name__ == '__main__':
    logger.info("Starting Quantum Mus server...")
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
