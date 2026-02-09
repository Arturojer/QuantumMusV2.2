import socketio
import eventlet
import eventlet.wsgi
from Logica_cuantica.baraja import QuantumDeck
from Logica_cuantica.dealer import QuantumDealer
from Logica_cuantica.cartas import QuantumCard
from flask import Flask
import time

sio = socketio.Server(cors_allowed_origins='*', async_mode='eventlet')
app = Flask(__name__)
app.wsgi_app = socketio.WSGIApp(sio, app.wsgi_app)

@sio.event
def connect(sid, environ):
    print(f'[MOCK] Client connected: {sid}')
    sio.emit('connected', {'sid': sid}, to=sid)

@sio.event
def disconnect(sid):
    print(f'[MOCK] Client disconnected: {sid}')

@sio.on('create_room')
def on_create_room(sid, data):
    print('[MOCK] create_room', data)
    room = {'id': 'mockroom1', 'players': []}
    sio.emit('room_created', {'success': True, 'room': room}, to=sid)

@sio.on('join_room')
def on_join_room(sid, data):
    print('[MOCK] join_room', data)
    room_id = data.get('room_id') or 'mockroom1'
    player_index = 0
    sio.emit('joined_room', {'success': True, 'room_id': room_id, 'player_index': player_index, 'room': {'id': room_id, 'players': [sid]}}, to=sid)

@sio.on('start_game')
def on_start_game(sid, data):
    print('[MOCK] start_game', data)
    game_state = {'state': {'currentRound': 'MUS', 'activePlayerIndex': 0}, 'player_hands': {0: [],1:[],2:[],3:[]}}
    sio.emit('game_started', {'success': True, 'game_state': game_state}, to=sid)

@sio.on('player_action')
def on_player_action(sid, data):
    print('[MOCK] player_action received:', data)
    room_id = data.get('room_id')
    action = data.get('action')
    player_index = data.get('player_index')
    # Broadcast a grande_phase_update to simulate server processing
    grande_phase = {
        'currentBet': {'amount': data.get('data', {}).get('amount', 0), 'betType': action},
        'currentRound': 'GRANDE',
        'activePlayerIndex': (player_index + 1) % 4
    }
    sio.emit('grande_phase_update', {'grande_phase': grande_phase}, room=None)
    sio.emit('game_update', {'game_state': {'state': {'currentRound': 'GRANDE', 'activePlayerIndex': (player_index + 1) % 4}}}, room=None)
    return {'success': True}

if __name__ == '__main__':
    print('Starting mock Socket.IO server on http://0.0.0.0:5001')
    eventlet.wsgi.server(eventlet.listen(('0.0.0.0', 5001)), app)
