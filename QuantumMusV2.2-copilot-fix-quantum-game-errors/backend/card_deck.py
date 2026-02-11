"""
Quantum Card and Deck Management
"""

import logging
import hashlib
import random  # Only for deterministic seed-based collapse (multiplayer sync)
from Logica_cuantica.quantum_random import get_quantum_rng

logger = logging.getLogger(__name__)


class QuantumCard:
    """Represents a quantum card with entanglement and superposition"""
    
    def __init__(self, value, suit, game_mode='4'):
        self.value = value
        self.suit = suit
        self.game_mode = game_mode
        
        # Quantum properties
        self.is_entangled = False
        self.entangled_partner_value = None
        self.entangled_partner_suit = None
        self.is_superposed = False
        self.superposed_value = None
        self.coefficient_a = 0
        self.coefficient_b = 0
        
        # Collapse state
        self.is_collapsed = False
        self.collapsed_value = None
        self.collapse_reason = None
        
        self._determine_quantum_state()
    
    def _determine_quantum_state(self):
        """Determine if card has quantum properties based on game mode and suit pairings"""
        is_8_reyes = self.game_mode == '8'
        
        # ===== REYES (K) - Always entangled in both modes =====
        # Team 1: Rey de Oros ↔ Rey de Copas
        # Team 2: Rey de Espadas ↔ Rey de Bastos
        if self.value == 'K':
            self.is_entangled = True
            self.coefficient_a = 0.7071  # sqrt(2)/2
            self.coefficient_b = 0.7071
            
            if self.suit in ['oros', 'copas']:
                # Team 1 pairing
                self.entangled_partner_value = 'K'
                self.entangled_partner_suit = 'copas' if self.suit == 'oros' else 'oros'
            else:  # espadas, bastos
                # Team 2 pairing
                self.entangled_partner_value = 'K'
                self.entangled_partner_suit = 'bastos' if self.suit == 'espadas' else 'espadas'
        
        # ===== TRESES (3) - Entangled in 8 Kings mode only =====
        elif is_8_reyes and self.value == '3':
            self.is_entangled = True
            self.coefficient_a = 0.7071
            self.coefficient_b = 0.7071
            
            if self.suit in ['oros', 'copas']:
                # Team 1 pairing
                self.entangled_partner_value = '3'
                self.entangled_partner_suit = 'copas' if self.suit == 'oros' else 'oros'
            else:  # espadas, bastos
                # Team 2 pairing
                self.entangled_partner_value = '3'
                self.entangled_partner_suit = 'bastos' if self.suit == 'espadas' else 'espadas'
        
        # ===== DOSES (2) - Entangled in 8 Kings mode only =====
        elif is_8_reyes and self.value == '2':
            self.is_entangled = True
            self.coefficient_a = 0.7071
            self.coefficient_b = 0.7071
            
            if self.suit in ['oros', 'copas']:
                # Team 1 pairing
                self.entangled_partner_value = '2'
                self.entangled_partner_suit = 'copas' if self.suit == 'oros' else 'oros'
            else:  # espadas, bastos
                # Team 2 pairing
                self.entangled_partner_value = '2'
                self.entangled_partner_suit = 'bastos' if self.suit == 'espadas' else 'espadas'
        
        # Other cards can be in superposition unless entangled
        qrng = get_quantum_rng()
        if not self.is_entangled and qrng.random_float() > 0.5:
            self.is_superposed = True
            self._set_superposition()
    
    def _set_superposition(self):
        """Set superposition state with another card value using quantum randomness"""
        card_values = ['4', '5', '6', '7', 'J', 'Q']
        
        if self.value not in card_values:
            return
        
        idx = card_values.index(self.value)
        if idx < len(card_values) - 1:
            self.superposed_value = card_values[idx + 1]
        else:
            self.superposed_value = card_values[0]
        
        # Random coefficients that sum to 1 (squared) using quantum RNG
        qrng = get_quantum_rng()
        alpha = 0.5 + qrng.random_float() * 0.4  # Range [0.5, 0.9]
        beta = (1 - alpha**2)**0.5
        
        self.coefficient_a = round(alpha, 2)
        self.coefficient_b = round(beta, 2)
    
    def collapse(self, deterministic_value=None, collapse_seed=None):
        """
        Collapse the card to a definite value.
        
        Args:
            deterministic_value: If provided, collapse to this value
            collapse_seed: Seed for deterministic collapse (room_id + round + player info)
        
        Returns:
            The collapsed value (either original or partner value if entangled)
        """
        if self.is_collapsed:
            logger.warning(f"Card {self.value} of {self.suit} already collapsed to {self.collapsed_value}")
            return self.collapsed_value
        
        if deterministic_value:
            # Explicit collapse to a specific value
            self.collapsed_value = deterministic_value
        else:
            # Probabilistic or seeded collapse
            if collapse_seed:
                # Use seed for determinism across all clients (multiplayer sync)
                hash_obj = hashlib.sha256(str(collapse_seed).encode())
                seed_int = int(hash_obj.hexdigest(), 16)
                rng = random.Random(seed_int)
                collapse_prob = rng.random()
            else:
                # Non-deterministic quantum collapse
                qrng = get_quantum_rng()
                collapse_prob = qrng.random_float()
            
            # For entangled cards: collapse to original or partner value
            if self.is_entangled:
                if collapse_prob < 0.5:
                    self.collapsed_value = self.value
                else:
                    self.collapsed_value = self.entangled_partner_value
            # For superposed cards: collapse to original or superposed value
            elif self.is_superposed:
                if collapse_prob < (self.coefficient_a ** 2):
                    self.collapsed_value = self.value
                else:
                    self.collapsed_value = self.superposed_value
            else:
                self.collapsed_value = self.value
        
        self.is_collapsed = True
        logger.info(f"Card collapsed: {self.value}♠ ({self.suit}) → {self.collapsed_value}")
        
        return self.collapsed_value
    
    def to_dict(self):
        """Convert card to dictionary"""
        return {
            'value': self.value,
            'suit': self.suit,
            'is_entangled': self.is_entangled,
            'entangled_partner_value': self.entangled_partner_value,
            'entangled_partner_suit': self.entangled_partner_suit,
            'is_superposed': self.is_superposed,
            'superposed_value': self.superposed_value,
            'coefficient_a': self.coefficient_a,
            'coefficient_b': self.coefficient_b,
            'is_collapsed': self.is_collapsed,
            'collapsed_value': self.collapsed_value,
            'collapse_reason': self.collapse_reason
        }


class QuantumDeck:
    """Manages the quantum deck of cards"""
    
    SUITS = ['oros', 'copas', 'espadas', 'bastos']
    
    def __init__(self, game_mode='4'):
        self.game_mode = game_mode
        self.cards = []
        self._initialize_deck()
    
    def _initialize_deck(self):
        """Initialize Spanish deck"""
        if self.game_mode == '4':
            # 4 reyes mode: A, 2, 3, 4, 5, 6, 7, J (10), Q (11), K (12)
            values = ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K']
        else:
            # 8 reyes mode: Same values but K and 3 are equivalent
            values = ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K']
        
        self.cards = []
        for suit in self.SUITS:
            for value in values:
                card = QuantumCard(value, suit, self.game_mode)
                self.cards.append(card)
        
        logger.info(f"Initialized {self.game_mode} reyes deck with {len(self.cards)} cards")
    
    def shuffle(self):
        """Shuffle the deck using quantum randomness"""
        qrng = get_quantum_rng()
        self.cards = qrng.shuffle(self.cards)
    
    def deal(self, num_cards):
        """Deal cards from the deck"""
        if len(self.cards) < num_cards:
            logger.warning(f"Not enough cards in deck. Requested: {num_cards}, Available: {len(self.cards)}")
            # Reinitialize and shuffle
            self._initialize_deck()
            self.shuffle()
        
        dealt_cards = []
        for _ in range(num_cards):
            if self.cards:
                dealt_cards.append(self.cards.pop())
        
        return dealt_cards
    
    def remaining(self):
        """Get number of remaining cards"""
        return len(self.cards)


def get_card_order(game_mode='4'):
    """Get card order for comparison (higher index = better card)"""
    if game_mode == '8':
        # 8 reyes: K(or 3) > Q > J > 7 > 6 > 5 > 4 > A(or 2)
        # Note: 3 is equivalent to K, 2 is equivalent to A
        return ['A', '2', '4', '5', '6', '7', 'J', 'Q', 'K', '3']
    else:
        # 4 reyes: normal order
        return ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K']


def normalize_card_value(value, game_mode='4'):
    """Normalize card values for comparison
    
    Handles both letter format (J, Q, K) and numeric format (10, 11, 12)
    from the Logica_cuantica module
    """
    # Convert numeric values to letter format
    if value == 10 or value == '10':
        value = 'J'
    elif value == 11 or value == '11':
        value = 'Q'
    elif value == 12 or value == '12':
        value = 'K'
    elif value == 1 or value == '1':
        value = 'A'
    
    # Convert to string if numeric
    value = str(value)
    
    if game_mode == '8':
        # In 8 reyes mode: 3 = K, 2 = A
        if value == '3':
            return 'K'
        if value == '2':
            return 'A'
    return value


def compare_cards(card1_value, card2_value, game_mode='4', lower_wins=False):
    """
    Compare two cards
    Returns: 1 if card1 wins, -1 if card2 wins, 0 if tie
    """
    order = get_card_order(game_mode)
    
    val1 = normalize_card_value(card1_value, game_mode)
    val2 = normalize_card_value(card2_value, game_mode)
    
    try:
        idx1 = order.index(val1)
        idx2 = order.index(val2)
        
        if lower_wins:
            # Lower cards win (reverse comparison)
            if idx1 < idx2:
                return 1
            elif idx1 > idx2:
                return -1
        else:
            # Higher cards win
            if idx1 > idx2:
                return 1
            elif idx1 < idx2:
                return -1
        
        return 0
    except ValueError:
        logger.error(f"Invalid card values: {val1}, {val2}")
        return 0


def get_highest_card(cards, game_mode='4'):
    """Get the highest card from a list"""
    if not cards:
        return None
    
    best_card = cards[0]
    for card in cards[1:]:
        if compare_cards(card['value'], best_card['value'], game_mode) > 0:
            best_card = card
    
    return best_card


def get_lowest_card(cards, game_mode='4'):
    """Get the lowest card from a list"""
    if not cards:
        return None
    
    best_card = cards[0]
    for card in cards[1:]:
        if compare_cards(card['value'], best_card['value'], game_mode, lower_wins=True) > 0:
            best_card = card
    
    return best_card
