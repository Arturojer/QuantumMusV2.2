"""
Quantum Card and Deck Management
"""

import random
import logging

logger = logging.getLogger(__name__)


class QuantumCard:
    """Represents a quantum card with entanglement and superposition"""
    
    def __init__(self, value, suit, game_mode='4'):
        self.value = value
        self.suit = suit
        self.game_mode = game_mode
        
        # Quantum properties
        self.is_entangled = False
        self.entangled_partner = None
        self.is_superposed = False
        self.superposed_value = None
        self.coefficient_a = 0
        self.coefficient_b = 0
        
        self._determine_quantum_state()
    
    def _determine_quantum_state(self):
        """Determine if card has quantum properties"""
        is_8_reyes = self.game_mode == '8'
        
        # A and K are always entangled with each other
        # In 8 reyes mode: 2 and 3 are also entangled
        if self.value in ['A', 'K']:
            self.is_entangled = True
            self.entangled_partner = 'K' if self.value == 'A' else 'A'
            self.coefficient_a = 0.7071  # sqrt(2)/2
            self.coefficient_b = 0.7071
        elif is_8_reyes and self.value in ['2', '3']:
            self.is_entangled = True
            self.entangled_partner = '3' if self.value == '2' else '2'
            self.coefficient_a = 0.7071
            self.coefficient_b = 0.7071
        else:
            # Other cards can be in superposition
            if random.random() > 0.5:
                self.is_superposed = True
                self._set_superposition()
    
    def _set_superposition(self):
        """Set superposition state with another card value"""
        card_values = ['4', '5', '6', '7', 'J', 'Q']
        
        if self.value not in card_values:
            return
        
        idx = card_values.index(self.value)
        if idx < len(card_values) - 1:
            self.superposed_value = card_values[idx + 1]
        else:
            self.superposed_value = card_values[0]
        
        # Random coefficients that sum to 1 (squared)
        alpha = random.uniform(0.5, 0.9)
        beta = (1 - alpha**2)**0.5
        
        self.coefficient_a = round(alpha, 2)
        self.coefficient_b = round(beta, 2)
    
    def to_dict(self):
        """Convert card to dictionary"""
        return {
            'value': self.value,
            'suit': self.suit,
            'is_entangled': self.is_entangled,
            'entangled_partner': self.entangled_partner,
            'is_superposed': self.is_superposed,
            'superposed_value': self.superposed_value,
            'coefficient_a': self.coefficient_a,
            'coefficient_b': self.coefficient_b
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
        """Shuffle the deck"""
        random.shuffle(self.cards)
    
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
    """Normalize card values for comparison"""
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
