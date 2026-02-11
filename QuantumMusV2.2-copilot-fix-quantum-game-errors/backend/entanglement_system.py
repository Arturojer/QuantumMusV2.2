"""
Quantum Entanglement System for Quantum Mus
Manages entangled card pairs between teammates
"""

import logging
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


class EntangledPair:
    """Represents a pair of entangled cards"""
    
    def __init__(self, pair_id: str, card1_value: str, card1_suit: str,
                 card2_value: str, card2_suit: str, 
                 player1_idx: int, player2_idx: int, team: int):
        """
        Initialize an entangled pair
        
        Args:
            pair_id: Unique identifier for the pair
            card1_value: Value of first card (e.g., 'K')
            card1_suit: Suit of first card (e.g., 'oros')
            card2_value: Value of second card (e.g., 'K')
            card2_suit: Suit of second card (e.g., 'copas')
            player1_idx: Index of first player
            player2_idx: Index of second player (teammate)
            team: Team number (1 or 2)
        """
        self.id = pair_id
        self.card1 = {'value': card1_value, 'suit': card1_suit}
        self.card2 = {'value': card2_value, 'suit': card2_suit}
        self.players = [player1_idx, player2_idx]
        self.team = team
        self.state = 'superposition'  # 'superposition' | 'collapsed'
        self.activated_by = None  # Which player activated it
        self.activated_card = None  # Which card was played: 1 or 2
        
    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'card1': self.card1,
            'card2': self.card2,
            'team': self.team,
            'players': self.players,
            'state': self.state,
            'activated_by': self.activated_by,
            'activated_card': self.activated_card
        }


class EntanglementSystem:
    """Manages quantum entanglement for the game"""
    
    def __init__(self, game_mode: str = '4'):
        """
        Initialize the entanglement system
        
        Args:
            game_mode: '4' for 4 Kings (classic) or '8' for 8 Kings (advanced)
        """
        self.game_mode = game_mode
        self.entangled_pairs: Dict[str, EntangledPair] = {}
        self.card_to_pair: Dict[tuple, str] = {}  # Maps (value, suit) to pair_id
        self._initialize_entangled_pairs()
        
        logger.info(f"Initialized entanglement system with mode {game_mode}")
    
    def _initialize_entangled_pairs(self):
        """
        Set up entangled pairs based on game mode.
        
        ENTRELAZAMIENTO CORRECTO:
        - Rey (K/12) ↔ As (A/1) del MISMO palo
        - Dos (2) ↔ Tres (3) del MISMO palo (solo en modo 8)
        
        Cada palo tiene su propio par entrelazado.
        """
        pair_counter = 0
        
        # ===== REY ↔ AS - Siempre entrelazados en todos los palos =====
        for suit_spanish, suit_english in [('Oro', 'oros'), ('Copa', 'copas'), 
                                            ('Espada', 'espadas'), ('Basto', 'bastos')]:
            pair_id = f'pair_rey_as_{suit_english}'
            pair = EntangledPair(
                pair_id, 
                'K', suit_english,  # Rey
                'A', suit_english,  # As
                None, None, None    # No team assignment (same suit entanglement)
            )
            self.entangled_pairs[pair_id] = pair
            self.card_to_pair[('K', suit_english)] = pair_id
            self.card_to_pair[('A', suit_english)] = pair_id
            pair_counter += 1
        
        # ===== DOS ↔ TRES - Entrelazados en modo 8 solamente =====
        if self.game_mode == '8':
            for suit_spanish, suit_english in [('Oro', 'oros'), ('Copa', 'copas'), 
                                                ('Espada', 'espadas'), ('Basto', 'bastos')]:
                pair_id = f'pair_dos_tres_{suit_english}'
                pair = EntangledPair(
                    pair_id,
                    '2', suit_english,  # Dos
                    '3', suit_english,  # Tres
                    None, None, None    # No team assignment (same suit entanglement)
                )
                self.entangled_pairs[pair_id] = pair
                self.card_to_pair[('2', suit_english)] = pair_id
                self.card_to_pair[('3', suit_english)] = pair_id
                pair_counter += 1
    
    def is_card_entangled(self, value: str, suit: str) -> bool:
        """Check if a card is part of an entangled pair"""
        return (value, suit) in self.card_to_pair
    
    def get_entangled_pair_by_card(self, value: str, suit: str) -> Optional[EntangledPair]:
        """Get the entangled pair that contains this card"""
        pair_id = self.card_to_pair.get((value, suit))
        if pair_id:
            return self.entangled_pairs[pair_id]
        return None
    
    def get_partner_card(self, value: str, suit: str) -> Optional[Dict]:
        """Get the partner card of an entangled pair"""
        pair = self.get_entangled_pair_by_card(value, suit)
        if pair:
            # Check which card this is and return the other
            if pair.card1['value'] == value and pair.card1['suit'] == suit:
                return pair.card2
            else:
                return pair.card1
        return None
    
    def get_partner_player(self, player_idx: int, value: str, suit: str) -> Optional[int]:
        """Get the teammate of a player when they play an entangled card"""
        pair = self.get_entangled_pair_by_card(value, suit)
        if pair and player_idx in pair.players:
            # Return the other player in the pair
            return pair.players[1] if pair.players[0] == player_idx else pair.players[0]
        return None
    
    def activate_entanglement(self, value: str, suit: str, player_idx: int) -> Optional[Dict]:
        """
        Activate an entangled pair when a card is played
        
        Returns:
            Dictionary with entanglement data or None if not entangled
        """
        pair = self.get_entangled_pair_by_card(value, suit)
        if not pair:
            return None
        
        # Mark the pair as activated
        pair.state = 'collapsed'
        pair.activated_by = player_idx
        pair.activated_card = 1 if (pair.card1['value'] == value and pair.card1['suit'] == suit) else 2
        
        # Get partner info
        partner_card = self.get_partner_card(value, suit)
        partner_player = self.get_partner_player(player_idx, value, suit)
        
        return {
            'pair_id': pair.id,
            'activated_by_player': player_idx,
            'card_played': {'value': value, 'suit': suit},
            'partner_card': partner_card,
            'partner_player': partner_player,
            'team': pair.team,
            'effect': 'quantum_sync',
            'animation': 'particle_beam'
        }
    
    def reset_pair_states(self):
        """Reset all pairs to superposition at the start of a new hand"""
        for pair in self.entangled_pairs.values():
            pair.state = 'superposition'
            pair.activated_by = None
            pair.activated_card = None
    
    def get_all_pairs(self) -> List[Dict]:
        """Get all entangled pairs as dictionaries"""
        return [pair.to_dict() for pair in self.entangled_pairs.values()]
    
    def get_pairs_for_player(self, player_idx: int) -> List[Dict]:
        """Get all entangled pairs involving a specific player"""
        return [
            pair.to_dict() 
            for pair in self.entangled_pairs.values() 
            if player_idx in pair.players
        ]
    
    def get_pairs_for_team(self, team: int) -> List[Dict]:
        """Get all entangled pairs for a specific team"""
        return [
            pair.to_dict() 
            for pair in self.entangled_pairs.values() 
            if pair.team == team
        ]
    
    def get_statistics(self) -> Dict:
        """Get statistics about entanglement usage"""
        total_pairs = len(self.entangled_pairs)
        activated_pairs = sum(
            1 for pair in self.entangled_pairs.values() 
            if pair.state == 'collapsed'
        )
        
        return {
            'total_pairs': total_pairs,
            'activated_pairs': activated_pairs,
            'superposition_pairs': total_pairs - activated_pairs,
            'game_mode': self.game_mode,
            'pairs_per_team': 2 if self.game_mode == '4' else 6
        }
