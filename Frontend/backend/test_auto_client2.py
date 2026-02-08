import socketio
import time
import json

sio = socketio.Client()

client_state = {'room_id': None, 'player_index': None, 'sid': None}

@sio.on('connect')
def on_connect():
    print('[CLIENT] Connected', sio.sid)
    client_state['sid'] = sio.sid

@sio.on('connected')
def on_connected(data):
    print('[CLIENT] server connected event:', data)

@sio.on('room_created')
def on_room_created(data):
    print('[CLIENT] room_created:', data)
    if data.get('success'):
        client_state['room_id'] = data['room']['id']

@sio.on('joined_room')
def on_joined_room(data):
    print('[CLIENT] joined_room:', data)
    if data.get('success'):
        client_state['room_id'] = data['room_id']
        client_state['player_index'] = data['player_index']

@sio.on('game_started')
def on_game_started(data):
    print('[CLIENT] game_started')
    print(json.dumps(data['game_state'], indent=2))

@sio.on('grande_phase_update')
def on_grande(data):
    print('[CLIENT] grande_phase_update:', data)

@sio.on('game_update')
def on_game_update(data):
    print('[CLIENT] game_update:', data)

@sio.on('game_error')
def on_game_error(data):
    print('[CLIENT] game_error:', data)

@sio.on('game_state')
def on_game_state(data):
    print('[CLIENT] game_state:', data)


def main():
    print('Auto test client v2 connecting to mock server...')
    try:
        sio.connect('http://localhost:5001')
    except Exception as e:
        print('Failed to connect:', e)
        return

    time.sleep(1)
    # create room
    sio.emit('create_room', {'name': 'AutoTest', 'game_mode': '4'})
    time.sleep(0.5)

    # join room
    sio.emit('join_room', {'room_id': client_state.get('room_id'), 'player_name': 'AutoTester', 'character': 'preskill'})
    time.sleep(0.5)

    # start game
    sio.emit('start_game', {'room_id': client_state.get('room_id')})
    time.sleep(0.5)

    # send player action
    sio.emit('player_action', {'room_id': client_state.get('room_id'), 'action': 'envido', 'player_index': client_state.get('player_index', 0), 'data': {'amount': 5}})

    time.sleep(1)
    print('Client done, disconnecting')
    sio.disconnect()

if __name__ == '__main__':
    main()
