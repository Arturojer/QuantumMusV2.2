"""
Test Client for Quantum Mus Backend
Demonstrates WebSocket connection and game flow
"""

import socketio
import time
import json
import os

# Create a Socket.IO client
sio = socketio.Client()

# Store client state
client_state = {
    'sid': None,
    'room_id': None,
    'player_index': None,
    'game_state': None
}


# Event handlers
@sio.on('connect')
def on_connect():
    print('✓ Connected to server')
    print(f'  Session ID: {sio.sid}')
    client_state['sid'] = sio.sid


@sio.on('disconnect')
def on_disconnect():
    print('✗ Disconnected from server')


@sio.on('connected')
def on_connected(data):
    print(f'✓ Server confirmed connection: {data}')


@sio.on('room_created')
def on_room_created(data):
    print(f'✓ Room created: {json.dumps(data, indent=2)}')
    if data.get('success'):
        client_state['room_id'] = data['room']['id']


@sio.on('joined_room')
def on_joined_room(data):
    print(f'✓ Joined room: {json.dumps(data, indent=2)}')
    if data.get('success'):
        client_state['room_id'] = data['room_id']
        client_state['player_index'] = data['player_index']


@sio.on('room_updated')
def on_room_updated(data):
    print(f'ℹ Room updated: {len(data["room"]["players"])}/4 players')


@sio.on('game_started')
def on_game_started(data):
    print(f'✓ Game started!')
    print(f'  Game state: {json.dumps(data["game_state"], indent=2)}')
    client_state['game_state'] = data['game_state']


@sio.on('game_update')
def on_game_update(data):
    print(f'ℹ Game updated:')
    print(f'  Action: {data["action"]}')
    print(f'  Current round: {data["game_state"]["state"]["currentRound"]}')
    print(f'  Active player: {data["game_state"]["state"]["activePlayerIndex"]}')
    client_state['game_state'] = data['game_state']


@sio.on('cards_discarded')
def on_cards_discarded(data):
    print(f'ℹ Player {data["player_index"]} discarded {data["num_cards"]} cards')


@sio.on('new_cards_dealt')
def on_new_cards_dealt(data):
    print(f'✓ New cards dealt!')


@sio.on('round_ended')
def on_round_ended(data):
    result = data['result']
    print(f'✓ Round ended!')
    print(f'  Winner: {result["winner_team"]}')
    print(f'  Points: {result["points"]}')
    print(f'  Round: {result["round"]}')


@sio.on('game_ended')
def on_game_ended(data):
    print(f'🏆 Game ended!')
    print(f'  Winner: {data["winner"]}')
    print(f'  Final scores: {data["final_scores"]}')


@sio.on('game_error')
def on_game_error(data):
    print(f'✗ Game error: {data["error"]}')


@sio.on('game_state')
def on_game_state(data):
    print(f'ℹ Game state received:')
    print(json.dumps(data['game_state'], indent=2))
    client_state['game_state'] = data['game_state']


def test_create_room():
    """Test creating a room"""
    print('\n--- Creating Room ---')
    sio.emit('create_room', {
        'name': 'Test Room',
        'game_mode': '4'
    })
    time.sleep(1)


def test_join_room(room_id=None):
    """Test joining a room"""
    print('\n--- Joining Room ---')
    if not room_id:
        room_id = client_state['room_id']
    
    sio.emit('join_room', {
        'room_id': room_id,
        'player_name': f'TestPlayer_{sio.sid[:4]}',
        'character': 'preskill'
    })
    time.sleep(1)


def test_player_action(action='mus', extra_data=None):
    """Test sending a player action"""
    print(f'\n--- Player Action: {action} ---')
    
    if not client_state['room_id']:
        print('✗ Not in a room')
        return
    
    sio.emit('player_action', {
        'room_id': client_state['room_id'],
        'action': action,
        'player_index': client_state['player_index'],
        'data': extra_data or {}
    })
    time.sleep(1)


def test_discard_cards(card_indices=None):
    """Test discarding cards"""
    print(f'\n--- Discard Cards ---')
    
    if not client_state['room_id']:
        print('✗ Not in a room')
        return
    
    sio.emit('discard_cards', {
        'room_id': client_state['room_id'],
        'player_index': client_state['player_index'],
        'card_indices': card_indices or [0, 1]
    })
    time.sleep(1)


def main():
    """Main test flow"""
    print('='*60)
    print('  Quantum Mus Backend - Test Client')
    print('='*60)
    
    # Connect to server
    print('\n--- Connecting to Server ---')
    server_url = os.environ.get('QUANTUM_MUS_SERVER_URL', 'https://quantum-mus-backend.onrender.com')
    try:
        sio.connect(server_url)
    except Exception as e:
        print(f'✗ Failed to connect: {e}')
        return
    
    time.sleep(1)
    
    # Create a room
    test_create_room()
    
    # Join the room
    test_join_room()
    
    # Interactive mode
    print('\n' + '='*60)
    print('Connected! Available commands:')
    print('  mus       - Choose MUS')
    print('  paso      - Choose PASO')
    print('  envido    - Choose ENVIDO')
    print('  ordago    - Choose ORDAGO')
    print('  discard   - Discard cards [0,1]')
    print('  state     - Get game state')
    print('  quit      - Exit')
    print('='*60 + '\n')
    
    while True:
        try:
            cmd = input('> ').strip().lower()
            
            if cmd == 'quit':
                break
            elif cmd == 'mus':
                test_player_action('mus')
            elif cmd == 'paso':
                test_player_action('paso')
            elif cmd == 'envido':
                test_player_action('envido', {'amount': 5})
            elif cmd == 'ordago':
                test_player_action('ordago')
            elif cmd == 'discard':
                test_discard_cards([0, 1])
            elif cmd == 'state':
                sio.emit('get_game_state', {
                    'room_id': client_state['room_id'],
                    'player_index': client_state['player_index']
                })
            else:
                print(f'Unknown command: {cmd}')
        
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f'Error: {e}')
    
    # Disconnect
    print('\n--- Disconnecting ---')
    sio.disconnect()
    print('Goodbye!')


if __name__ == '__main__':
    main()
