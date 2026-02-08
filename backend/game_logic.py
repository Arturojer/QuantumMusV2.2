"""
Main Game Logic - Quantum Mus Game
"""

import logging
from card_deck import QuantumDeck, get_highest_card, get_lowest_card, compare_cards
from round_handlers import RoundHandler
from quantum_collapse import QuantumCollapseManager
from entanglement_system import EntanglementSystem

logger = logging.getLogger(__name__)


class QuantumMusGame:
    """Main game class managing the Quantum Mus game state"""
    
    def __init__(self, room_id, players, game_mode='4'):
        self.room_id = room_id
        self.players = players  # List of player dicts
        self.game_mode = game_mode
        
        # Game state
        self.state = {
            'currentRound': 'MUS',
            'manoIndex': 0,
            'activePlayerIndex': 0,
            'teams': {
                'team1': {
                    'players': [0, 2],
                    'score': 0,
                    'name': 'Copenhaguen'
                },
                'team2': {
                    'players': [1, 3],
                    'score': 0,
                    'name': 'Bohmian'
                }
            },
            'currentBet': {
                'amount': 0,
                'bettingTeam': None,
                'betType': None,
                'responses': {}
            },
            'roundActions': {},
            'musPhaseActive': True,
            'cardsDiscarded': {},
            'waitingForDiscard': False,
            'allPlayersPassed': False,
            'grandePhase': None,  # Will be initialized when Grande starts
            'chicaPhase': None,    # For Chica betting
            'paresPhase': None,    # For Pares betting
            'juegoPhase': None,    # For Juego betting
            'deferredResults': []  # Store results for end-of-hand comparison
        }
        
        # Initialize deck and hands
        self.deck = QuantumDeck(game_mode)
        self.deck.shuffle()
        self.hands = {i: [] for i in range(4)}
        
        # Round handler
        self.round_handler = RoundHandler(self)
        
        # Quantum collapse manager
        self.collapse_manager = QuantumCollapseManager(self)
        
        # Entanglement system
        self.entanglement = EntanglementSystem(game_mode)
        
        # Track entanglement events this hand
        self.state['entanglement_events'] = []
        
        logger.info(f"Created game {room_id} with mode {game_mode}")
    
    def deal_cards(self):
        """Deal 4 cards to each player"""
        for player_idx in range(4):
            self.hands[player_idx] = self.deck.deal(4)
        
        logger.info(f"Dealt cards to all players in game {self.room_id}")
    
    def deal_new_cards(self):
        """Deal new cards to replace discarded ones"""
        for player_idx, card_indices in self.state['cardsDiscarded'].items():
            # Remove old cards
            for idx in sorted(card_indices, reverse=True):
                if idx < len(self.hands[player_idx]):
                    self.hands[player_idx].pop(idx)
            
            # Deal new cards
            num_new = len(card_indices)
            new_cards = self.deck.deal(num_new)
            self.hands[player_idx].extend(new_cards)
        
        # Reset discard state
        self.state['cardsDiscarded'] = {}
        self.state['waitingForDiscard'] = False
        
        logger.info(f"Dealt new cards in game {self.room_id}")
    
    def process_action(self, player_index, action, extra_data=None):
        """Process a player action"""
        logger.info(f"Player {player_index} action: {action}")
        
        if self.state['currentRound'] == 'MUS':
            return self.round_handler.handle_mus_round(player_index, action, extra_data)
        else:
            return self.round_handler.handle_betting_round(player_index, action, extra_data)
    
    def discard_cards(self, player_index, card_indices):
        """Handle card discard during MUS phase"""
        if not self.state['waitingForDiscard']:
            return {'success': False, 'error': 'Not in discard phase'}
        
        # Record discarded cards
        self.state['cardsDiscarded'][player_index] = card_indices
        
        # Check if all players have discarded
        all_discarded = len(self.state['cardsDiscarded']) == 4
        
        return {
            'success': True,
            'all_discarded': all_discarded
        }
    
    def get_public_state(self):
        """Get public game state (without card details)"""
        return {
            'room_id': self.room_id,
            'game_mode': self.game_mode,
            'state': {
                'currentRound': self.state['currentRound'],
                'activePlayerIndex': self.state['activePlayerIndex'],
                'manoIndex': self.state['manoIndex'],
                'teams': self.state['teams'],
                'currentBet': self.state['currentBet'],
                'waitingForDiscard': self.state['waitingForDiscard']
            },
            'players': self.players,
            'hand_sizes': {i: len(cards) for i, cards in self.hands.items()}
        }
    
    def get_player_state(self, player_index):
        """Get game state from a specific player's perspective"""
        state = self.get_public_state()
        
        # Add player's hand
        state['my_hand'] = [card.to_dict() for card in self.hands.get(player_index, [])]
        state['my_index'] = player_index
        
        return state
    
    def get_player_team(self, player_index):
        """Get team for a player"""
        if player_index in self.state['teams']['team1']['players']:
            return 'team1'
        return 'team2'
    
    def get_opponent_team(self, team):
        """Get opponent team"""
        return 'team2' if team == 'team1' else 'team1'
    
    def next_player(self):
        """Move to next player (counter-clockwise)"""
        self.state['activePlayerIndex'] = (self.state['activePlayerIndex'] + 3) % 4
        return self.state['activePlayerIndex']
    
    def reset_round_state(self):
        """Reset round-specific state"""
        self.state['roundActions'] = {}
        self.state['currentBet'] = {
            'amount': 0,
            'bettingTeam': None,
            'betType': None,
            'responses': {}
        }
        self.state['allPlayersPassed'] = False
    
    def move_to_next_round(self):
        """Progress to the next round"""
        round_order = ['MUS', 'GRANDE', 'CHICA', 'PARES', 'JUEGO']
        
        current_idx = round_order.index(self.state['currentRound'])
        
        if current_idx < len(round_order) - 1:
            self.state['currentRound'] = round_order[current_idx + 1]
            self.reset_round_state()
            self.state['activePlayerIndex'] = self.state['manoIndex']
            
            # Initialize Grande phase if entering Grande
            if self.state['currentRound'] == 'GRANDE':
                self.round_handler.grande_handler.initialize_grande_phase()
            
            logger.info(f"Advanced to round {self.state['currentRound']}")
            return False  # Game continues
        else:
            # All rounds complete - resolve deferred comparisons and new hand
            self._resolve_deferred_comparisons()
            self.start_new_hand()
            return True  # Hand ended
    
    def start_new_hand(self):
        """Start a new hand"""
        self.state['currentRound'] = 'MUS'
        self.state['musPhaseActive'] = True
        self.state['manoIndex'] = (self.state['manoIndex'] + 1) % 4
        self.state['activePlayerIndex'] = self.state['manoIndex']
        self.reset_round_state()
        
        # Reset phase states
        self.state['grandePhase'] = None
        self.state['chicaPhase'] = None
        self.state['paresPhase'] = None
        self.state['juegoPhase'] = None
        self.state['deferredResults'] = []
        
        # Reset entanglement for new hand
        self.reset_entanglement_for_new_hand()
        
        # Deal new cards
        self.deck = QuantumDeck(self.game_mode)
        self.deck.shuffle()
        self.deal_cards()
        
        logger.info(f"Started new hand, mano: {self.state['manoIndex']}")
    
    def _resolve_deferred_comparisons(self):
        """
        Resolve all deferred comparisons at the end of all 4 phases.
        Called after JUEGO phase completes.
        """
        logger.info("Resolving deferred comparisons for all phases...")
        
        # Resolve Grande if deferred
        if self.state['grandePhase'] and self.state['grandePhase'].get('result'):
            if self.state['grandePhase']['result'].get('comparison') == 'deferred':
                result = self.round_handler.grande_handler.compare_and_resolve_grande()
                if result:
                    logger.info(f"Grande resolved: {result['winner']} wins {result['points']} points")
        
        # TODO: Add Chica, Pares, Juego deferred comparisons when those handlers are implemented
        
        logger.info("All deferred comparisons resolved.")
    
    def check_win_condition(self):
        """Check if any team has won"""
        WIN_SCORE = 40
        
        if self.state['teams']['team1']['score'] >= WIN_SCORE:
            return {'game_ended': True, 'winner': 'team1'}
        elif self.state['teams']['team2']['score'] >= WIN_SCORE:
            return {'game_ended': True, 'winner': 'team2'}
        
        return {'game_ended': False}
    
    # ============ ENTANGLEMENT METHODS ============
    
    def play_card_and_check_entanglement(self, player_index, card_index):
        """
        Play a card and check if it triggers entanglement
        
        Returns:
            Dictionary with card info and entanglement data if applicable
        """
        if player_index >= len(self.players) or card_index >= len(self.hands.get(player_index, [])):
            return {'success': False, 'error': 'Invalid card index'}
        
        card = self.hands[player_index][card_index]
        card_dict = card.to_dict()
        
        result = {
            'success': True,
            'card': card_dict,
            'player_index': player_index,
            'entanglement': None
        }
        
        # Check if card is entangled and activate if so
        if card.is_entangled:
            entanglement_data = self.entanglement.activate_entanglement(
                card.value, card.suit, player_index
            )
            if entanglement_data:
                result['entanglement'] = entanglement_data
                # Log the entanglement event
                self.state['entanglement_events'].append({
                    'round': self.state['currentRound'],
                    'player': player_index,
                    'data': entanglement_data
                })
                logger.info(f"Entanglement activated: {entanglement_data}")
        
        return result
    
    def get_entanglement_info_for_player(self, player_index):
        """Get entanglement information for a player's cards"""
        player_hand = self.hands.get(player_index, [])
        entanglement_info = []
        
        for idx, card in enumerate(player_hand):
            if card.is_entangled:
                partner_card = self.entanglement.get_partner_card(card.value, card.suit)
                partner_player = self.entanglement.get_partner_player(player_index, card.value, card.suit)
                
                if partner_card:
                    entanglement_info.append({
                        'card_index': idx,
                        'card': card.to_dict(),
                        'partner_card': partner_card,
                        'partner_player': partner_player,
                        'pair_id': self.entanglement.card_to_pair.get((card.value, card.suit))
                    })
        
        return entanglement_info
    
    def get_full_entanglement_state(self):
        """Get current entanglement state for all pairs"""
        return {
            'pairs': self.entanglement.get_all_pairs(),
            'events': self.state.get('entanglement_events', []),
            'statistics': self.entanglement.get_statistics()
        }
    
    def reset_entanglement_for_new_hand(self):
        """Reset entanglement states for a new hand"""
        self.entanglement.reset_pair_states()
        self.state['entanglement_events'] = []
        logger.info("Entanglement states reset for new hand")
    
    def get_player_entangled_cards(self, player_index):
        """Get list of cards in player's hand that are entangled with their teammate"""
        teammate = self.state['teams']['team1']['players'][1] if player_index in self.state['teams']['team1']['players'] else self.state['teams']['team2']['players'][1]
        
        player_hand = self.hands.get(player_index, [])
        entangled_cards = []
        
        for idx, card in enumerate(player_hand):
            if card.is_entangled:
                partner_info = self.entanglement.get_partner_card(card.value, card.suit)
                if partner_info:
                    entangled_cards.append({
                        'index': idx,
                        'card': card.to_dict(),
                        'partner': partner_info,
                        'teammate_index': teammate
                    })
        
        return entangled_cards

