"""
Main Game Logic - Quantum Mus Game
"""

import logging
from Logica cuantica.baraja import QuantumDeck
from Logica cuantica.dealer import QuantumDealer
from Logica cuantica.cartas import QuantumCard
from round_handlers import RoundHandler
from quantum_collapse import QuantumCollapseManager
from entanglement_system import EntanglementSystem

logger = logging.getLogger(__name__)


class QuantumMusGame:
    """Main game class managing the Quantum Mus game state"""
    
    def __init__(self, room_id, players, game_mode='4'):
        self.room_id = room_id
        self.players = players  # List of player dicts
        
        # Validate game_mode
        if game_mode not in ['4', '8']:
            logger.warning(f"Invalid game_mode '{game_mode}', defaulting to '4'")
            game_mode = '4'
        self.game_mode = game_mode
        
        # Validate players (allow 1-4 players for demo mode and online modes)
        if len(players) < 1:
            logger.error(f"Game requires at least 1 player, got {len(players)}")
        elif len(players) > 4:
            logger.warning(f"Game designed for 4 players, got {len(players)} (extras may not have teams)")
        
        # Store actual number of players for dynamic calculations
        self.num_players = len(players)
        
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
        self.deck = QuantumDeck()
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
        """Deal 4 cards to each active player using Qiskit-based QuantumDeck"""
        cards_needed = 4 * self.num_players
        try:
            for player_idx in range(self.num_players):
                self.hands[player_idx] = self.deck.draw(4)
                if not self.hands[player_idx] or len(self.hands[player_idx]) != 4:
                    logger.error(f"Failed to deal 4 cards to player {player_idx}")
                    return {'success': False, 'error': f'Failed to deal cards to player {player_idx}'}
            for player_idx in range(self.num_players, 4):
                self.hands[player_idx] = []
            logger.info(f"[QSKIT] Dealt cards quantumly to {self.num_players} players in game {self.room_id}")
            print(f"[QSKIT] Dealt cards quantumly to {self.num_players} players in game {self.room_id}")
            return {'success': True}
        except Exception as e:
            logger.error(f"Qiskit QuantumDeck error: {e}")
            return {'success': False, 'error': str(e)}
        def collapse_entangled_cards(self, player_index):
            """Collapse all entangled cards in a player's hand using Qiskit logic"""
            hand = self.hands.get(player_index, [])
            collapsed = []
            for card in hand:
                # Only collapse if not already measured and is entangled
                if hasattr(card, 'measured_state') and card.measured_state is None:
                    # For Qiskit-based QuantumCard, collapse() will measure
                    state = card.collapse()
                    collapsed.append((card.card_id, state))
            logger.info(f"[QSKIT] Collapsed entangled cards for player {player_index}: {collapsed}")
            print(f"[QSKIT] Collapsed entangled cards for player {player_index}: {collapsed}")
            return collapsed
    
    def deal_new_cards(self):
        """Deal new cards to replace discarded ones, using leftover deck, then discards if needed"""
        if not self.state['waitingForDiscard']:
            logger.error(f"deal_new_cards called when not waiting for discard")
            return {'success': False, 'error': 'Not waiting for discard'}

        # Validate all active players have discarded
        if len(self.state['cardsDiscarded']) != self.num_players:
            logger.warning(f"deal_new_cards called with only {len(self.state['cardsDiscarded'])}/{self.num_players} players ready")
            return {'success': False, 'error': f'Not all players ready: {len(self.state["cardsDiscarded"])}' + f'/{self.num_players}'}

        # Gather all discarded cards to allow reshuffling if needed
        discarded_cards = []
        try:
            for player_idx, card_indices in self.state['cardsDiscarded'].items():
                # Validate card indices
                if not isinstance(card_indices, list) or len(card_indices) > 4:
                    logger.error(f"Invalid discard for player {player_idx}: {card_indices}")
                    return {'success': False, 'error': f'Invalid card indices for player {player_idx}'}

                # Remove old cards (in reverse order to maintain proper indices)
                player_discards = []
                for idx in sorted(card_indices, reverse=True):
                    if idx < len(self.hands[player_idx]):
                        player_discards.append(self.hands[player_idx].pop(idx))
                    else:
                        logger.warning(f"Card index {idx} out of range for player {player_idx}")
                discarded_cards.extend(player_discards)

            # Now deal new cards, using leftover deck, then discards if needed
            for player_idx, card_indices in self.state['cardsDiscarded'].items():
                num_new = len(card_indices)
                new_cards = []
                # First, deal from remaining deck
                deck_remaining = len(self.deck.cards)
                if deck_remaining >= num_new:
                    new_cards = self.deck.deal(num_new)
                else:
                    # Not enough cards: deal what remains, then reshuffle discards and deal the rest
                    if deck_remaining > 0:
                        new_cards = self.deck.deal(deck_remaining)
                    # Reshuffle discards into deck
                    if discarded_cards:
                        self.deck.cards.extend(discarded_cards)
                        self.deck.shuffle()
                        discarded_cards = []  # Only reshuffle once
                        needed = num_new - len(new_cards)
                        new_cards.extend(self.deck.deal(needed))
                if not new_cards or len(new_cards) != num_new:
                    logger.error(f"Failed to deal {num_new} cards to player {player_idx}")
                    return {'success': False, 'error': f'Insufficient cards in deck after reshuffling discards'}
                self.hands[player_idx].extend(new_cards)

            # Validate all active players still have 4 cards
            for player_idx in range(self.num_players):
                if len(self.hands[player_idx]) != 4:
                    logger.error(f"Player {player_idx} has {len(self.hands[player_idx])} cards after deal (should be 4)")
                    return {'success': False, 'error': f'Card count mismatch for player {player_idx}'}

            # Reset discard state
            self.state['cardsDiscarded'] = {}
            self.state['waitingForDiscard'] = False
            self.state['roundActions'] = {}  # Reset so MUS round starts fresh

            logger.info(f"Successfully dealt new cards in game {self.room_id}")
            return {'success': True}
        except Exception as e:
            logger.error(f"Error dealing new cards: {e}")
            return {'success': False, 'error': str(e)}
    
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
            'num_players': self.num_players,
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
        # Validate current state before resetting
        if self.state['currentRound'] not in ['MUS', 'GRANDE', 'CHICA', 'PARES', 'JUEGO']:
            logger.warning(f"Invalid round state before new hand: {self.state['currentRound']}")
        
        # Rotate mano to next player (counter-clockwise)
        old_mano = self.state['manoIndex']
        self.state['manoIndex'] = (self.state['manoIndex'] + 3) % 4  # Same as +1 but explicit
        self.state['activePlayerIndex'] = self.state['manoIndex']
        
        # Reset round state
        self.state['currentRound'] = 'MUS'
        self.state['musPhaseActive'] = True
        self.reset_round_state()
        
        # Reset phase states
        self.state['grandePhase'] = None
        self.state['chicaPhase'] = None
        self.state['paresPhase'] = None
        self.state['juegoPhase'] = None
        self.state['deferredResults'] = []
        self.state['cardsDiscarded'] = {}
        self.state['waitingForDiscard'] = False
        
        # Reset entanglement for new hand (BEFORE creating new deck)
        self.reset_entanglement_for_new_hand()
        
        # Create new deck and shuffle
        self.deck = QuantumDeck(self.game_mode)
        self.deck.shuffle()
        
        # Deal new cards
        deal_result = self.deal_cards()
        if not deal_result['success']:
            logger.error(f"Failed to deal cards for new hand: {deal_result['error']}")
            return deal_result
        
        logger.info(f"Started new hand in game {self.room_id}: mano rotated from {old_mano} to {self.state['manoIndex']}")
        return {'success': True}
    
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
    
    # ============ COLLAPSE METHODS ============
    
    def trigger_collapse_on_declaration(self, player_index, declaration, round_name):
        """
        Trigger collapse when a player makes a declaration
        Returns collapse event data suitable for Socket.IO broadcast
        """
        event, penalty = self.collapse_manager.collapse_on_declaration(
            player_index, declaration, round_name
        )
        
        if not event:
            return {'success': False, 'error': 'Failed to collapse cards'}
        
        # Build response with all hand updates for all players
        return {
            'success': True,
            'collapse_event': event.to_dict(),
            'penalty': penalty,
            'player_index': player_index,
            'declaration': declaration,
            'round_name': round_name,
            'updated_hands': {
                i: [card.to_dict() for card in self.hands.get(i, [])]
                for i in range(4)
            }
        }
    
    def trigger_collapse_on_bet_acceptance(self, player_index, round_name):
        """
        Trigger collapse when a player accepts a bet
        """
        event = self.collapse_manager.collapse_on_bet_acceptance(player_index, round_name)
        
        if not event:
            return {'success': False, 'error': 'Failed to collapse cards'}
        
        return {
            'success': True,
            'collapse_event': event.to_dict(),
            'player_index': player_index,
            'round_name': round_name,
            'updated_hands': {
                i: [card.to_dict() for card in self.hands.get(i, [])]
                for i in range(4)
            }
        }
    
    def trigger_final_collapse(self):
        """
        Trigger final collapse of all remaining entangled cards
        """
        event = self.collapse_manager.collapse_all_remaining()
        
        if not event:
            return {'success': False, 'error': 'Failed to collapse cards'}
        
        return {
            'success': True,
            'collapse_event': event.to_dict(),
            'final_hands': {
                i: [card.to_dict() for card in self.hands.get(i, [])]
                for i in range(4)
            }
        }
