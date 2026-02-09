"""
Room Manager - Handles game rooms and lobbies
"""

import uuid
import logging
import random
import string
from datetime import datetime

logger = logging.getLogger(__name__)


class RoomManager:
    """Manages game rooms and player lobbies"""
    
    def __init__(self):
        self.rooms = {}  # room_id -> room_data
        self.player_rooms = {}  # socket_id -> room_id
        self.room_codes = {}  # room_code -> room_id (for easy lookup)
    
    def _generate_room_code(self):
        """Generate a unique 4-character room code"""
        while True:
            code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
            if code not in self.room_codes:
                return code
    
    def create_room(self, name, game_mode='4', max_players=4):
        """Create a new game room"""
        room_id = str(uuid.uuid4())[:8]
        room_code = self._generate_room_code()
        
        room = {
            'id': room_id,
            'code': room_code,
            'name': name,
            'game_mode': game_mode,
            'max_players': max_players,
            'players': [],
            'status': 'waiting',  # waiting, in_progress, finished
            'created_at': datetime.utcnow().isoformat()
        }
        
        self.rooms[room_id] = room
        self.room_codes[room_code] = room_id
        logger.info(f"Created room {room_id} with code {room_code}: {name}")
        
        return room
    
    def get_room(self, room_id):
        """Get room by ID"""
        return self.rooms.get(room_id)
    
    def get_room_by_code(self, room_code):
        """Get room by code"""
        room_id = self.room_codes.get(room_code)
        if room_id:
            return self.rooms.get(room_id)
        return None
    
    def get_available_rooms(self):
        """Get list of rooms that can be joined"""
        return [
            room for room in self.rooms.values()
            if room['status'] == 'waiting' and len(room['players']) < room['max_players']
        ]
    
    def add_player(self, room_id, socket_id, player_name, character):
        """Add a player to a room"""
        room = self.rooms.get(room_id)
        
        if not room:
            return {'success': False, 'error': 'Room not found'}
        
        if len(room['players']) >= room['max_players']:
            return {'success': False, 'error': 'Room is full'}
        
        if room['status'] != 'waiting':
            return {'success': False, 'error': 'Game already in progress'}
        
        # Check if player already in room
        if any(p['socket_id'] == socket_id for p in room['players']):
            return {'success': False, 'error': 'Already in room'}
        
        player_index = len(room['players'])
        player = {
            'socket_id': socket_id,
            'name': player_name,
            'character': character,
            'index': player_index,
            'ready': False
        }
        
        room['players'].append(player)
        self.player_rooms[socket_id] = room_id
        
        logger.info(f"Player {player_name} joined room {room_id}")
        
        return {
            'success': True,
            'player_index': player_index,
            'room': room
        }
    
    def remove_player(self, room_id, socket_id):
        """Remove a player from a room"""
        room = self.rooms.get(room_id)
        
        if not room:
            return False
        
        room['players'] = [p for p in room['players'] if p['socket_id'] != socket_id]
        
        if socket_id in self.player_rooms:
            del self.player_rooms[socket_id]
        
        # Remove empty rooms
        if len(room['players']) == 0:
            del self.rooms[room_id]
            logger.info(f"Removed empty room {room_id}")
        else:
            # Reindex remaining players
            for idx, player in enumerate(room['players']):
                player['index'] = idx
        
        return True
    
    def get_player_room(self, socket_id):
        """Get room ID for a player"""
        return self.player_rooms.get(socket_id)
    
    def set_room_status(self, room_id, status):
        """Update room status"""
        room = self.rooms.get(room_id)
        if room:
            room['status'] = status
            return True
        return False
