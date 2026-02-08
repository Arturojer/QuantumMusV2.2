"""
Game Manager - Handles active game instances
"""

import logging
from game_logic import QuantumMusGame

logger = logging.getLogger(__name__)


class GameManager:
    """Manages all active game instances"""
    
    def __init__(self):
        self.games = {}  # room_id -> QuantumMusGame
    
    def create_game(self, room_id, players, game_mode='4'):
        """Create a new game instance"""
        if room_id in self.games:
            logger.warning(f"Game already exists for room {room_id}")
            return self.games[room_id]
        
        game = QuantumMusGame(room_id, players, game_mode)
        self.games[room_id] = game
        
        logger.info(f"Created game for room {room_id} with {len(players)} players")
        return game
    
    def get_game(self, room_id):
        """Get game instance by room ID"""
        return self.games.get(room_id)
    
    def remove_game(self, room_id):
        """Remove a game instance"""
        if room_id in self.games:
            del self.games[room_id]
            logger.info(f"Removed game for room {room_id}")
            return True
        return False
    
    def get_active_games(self):
        """Get list of all active games"""
        return {
            room_id: game.get_public_state()
            for room_id, game in self.games.items()
        }
