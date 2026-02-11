"""
Main Game Logic - Quantum Mus Game
"""

import logging
from Logica_cuantica.baraja import QuantumDeck
from Logica_cuantica.dealer import QuantumDealer
from Logica_cuantica.cartas import QuantumCard
from round_handlers import RoundHandler
from quantum_collapse import QuantumCollapseManager
from entanglement_system import EntanglementSystem

logger = logging.getLogger(__name__)


class QuantumMusGame:
    """Main game class managing the Quantum Mus game state"""
    
    def __init__(self, room_id, players, game_mode='4', teams=None):
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
        
        # Seating plan: interleave teams so teammates face each other
        # Team 1 (Copenhagen): Preskill, Zoller, Broadbent, Yunger Halpern
        # Team 2 (Bohmian): Cirac, Deutsch, Simmons, Hallberg
        team1_players = [p for p in self.players if p.get('team') == 1]
        team2_players = [p for p in self.players if p.get('team') == 2]
        unassigned_players = [p for p in self.players if p.get('team') not in (1, 2)]

        # Interleave: Team1, Team2, Team1, Team2 so teammates face each other
        if team1_players and team2_players:
            interleaved_players = []
            max_len = max(len(team1_players), len(team2_players))
            for idx in range(max_len):
                if idx < len(team1_players):
                    interleaved_players.append(team1_players[idx])
                if idx < len(team2_players):
                    interleaved_players.append(team2_players[idx])
            if unassigned_players:
                interleaved_players.extend(unassigned_players)
            self.players = interleaved_players
        
        # Store actual number of players for dynamic calculations
        self.num_players = len(self.players)
        
        # Build teams from the interleaved player positions
        # After interleaving, positions are: Team1, Team2, Team1, Team2, ...
        # So Team1 gets even indices [0, 2] and Team2 gets odd indices [1, 3]
        if teams is None:
            teams = {
                'team1': {'players': [], 'score': 0, 'name': 'Copenhaguen'},
                'team2': {'players': [], 'score': 0, 'name': 'Bohmian'}
            }

        # Assign indices based on actual team membership after interleaving
        team1_indices = []
        team2_indices = []
        for i in range(self.num_players):
            player_team = self.players[i].get('team')
            if player_team == 1:
                team1_indices.append(i)
            elif player_team == 2:
                team2_indices.append(i)
            # If no team assigned, default to even/odd assignment
            elif i % 2 == 0:
                team1_indices.append(i)
            else:
                team2_indices.append(i)
        
        teams = {
            'team1': {
                'players': team1_indices,
                'score': teams.get('team1', {}).get('score', 0),
                'name': teams.get('team1', {}).get('name', 'Copenhaguen')
            },
            'team2': {
                'players': team2_indices,
                'score': teams.get('team2', {}).get('score', 0),
                'name': teams.get('team2', {}).get('name', 'Bohmian')
            }
        }
        logger.info(f"Teams for room {room_id}: team1={teams['team1']['players']}, team2={teams['team2']['players']}")
        logger.info(f"Player order: {[p.get('character', 'unknown') for p in self.players]}")
        
        # Game state
        self.state = {
            'currentRound': 'MUS',
            'manoIndex': 0,
            'activePlayerIndex': 0,
            'teams': teams,
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
            'deferredResults': [],  # Store results for end-of-hand comparison
            'paresDeclarations': {},  # Player declarations for PARES round
            'juegoDeclarations': {}   # Player declarations for JUEGO round
        }
        
        # Initialize deck and hands
        self.deck = QuantumDeck()
        self.deck.shuffle()
        self.hands = {i: [] for i in range(4)}
        self.discard_pile = []
        
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
        # Always reset deck to 40 cards at the start of a new hand/game
        self.deck = QuantumDeck()
        self.deck.shuffle()
        self.discard_pile = []
        cards_needed = 4 * self.num_players
        try:
            for player_idx in range(self.num_players):
                self.hands[player_idx] = self.deck.draw(4)
                if not self.hands[player_idx] or len(self.hands[player_idx]) != 4:
                    logger.error(f"Failed to deal 4 cards to player {player_idx}")
                    return {'success': False, 'error': f'Failed to deal cards to player {player_idx}'}
            print(f"DEBUG: Repartiendo cartas. Manos generadas: {self.hands}")
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

        try:
            def _draw_from_deck(num_cards):
                if num_cards <= 0:
                    return []
                try:
                    return self.deck.draw(num_cards)
                except Exception:
                    if not self.discard_pile:
                        return []
                    remaining = self.deck.cards[self.deck.deck_index:]
                    self.deck.cards = remaining + self.discard_pile
                    self.deck.shuffle()
                    self.discard_pile.clear()
                    try:
                        return self.deck.draw(num_cards)
                    except Exception:
                        return []

            # Now deal new cards, using leftover deck, then discards if needed
            for player_idx, card_indices in self.state['cardsDiscarded'].items():
                num_new = len(card_indices)
                new_cards = _draw_from_deck(num_new)
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
            self.state['activePlayerIndex'] = self.state['manoIndex']  # Restart with mano

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

        if player_index in self.state['cardsDiscarded']:
            return {'success': False, 'error': 'Player already discarded'}

        if not isinstance(card_indices, list) or len(card_indices) > 4:
            return {'success': False, 'error': 'Invalid discard indices'}

        player_hand = self.hands.get(player_index, [])
        if any(not isinstance(idx, int) or idx < 0 or idx >= len(player_hand) for idx in card_indices):
            return {'success': False, 'error': 'Discard index out of range'}

        player_discards = []
        for idx in sorted(card_indices, reverse=True):
            player_discards.append(player_hand.pop(idx))
        self.discard_pile.extend(player_discards)
        
        # Record discarded cards
        self.state['cardsDiscarded'][player_index] = card_indices
        
        # Check if all players have discarded
        all_discarded = len(self.state['cardsDiscarded']) == self.num_players
        
        return {
            'success': True,
            'all_discarded': all_discarded
        }
    
    def get_public_state(self):
        """Get public game state (without card details)"""
        # Sync currentBet with the appropriate phase state
        current_round = self.state['currentRound']
        phase_key = f'{current_round.lower()}Phase'
        
        if current_round in ['GRANDE', 'CHICA', 'PARES', 'JUEGO'] and self.state.get(phase_key):
            phase = self.state[phase_key]
            # Update currentBet to reflect the phase state
            if phase['phaseState'] in ['BET_PLACED', 'WAITING_RESPONSE']:
                self.state['currentBet'] = {
                    'amount': phase['currentBetAmount'],
                    'bettingTeam': phase['attackingTeam'],
                    'betType': phase['betType'],
                    'responses': {}
                }
            elif phase['phaseState'] == 'NO_BET':
                self.state['currentBet'] = {
                    'amount': 0,
                    'bettingTeam': None,
                    'betType': None,
                    'responses': {}
                }
        
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
        print(f"DEBUG: Enviando estado a jugador {player_index}. Datos de mano: {state.get('my_hand')}")
        return state
    
    def get_player_team(self, player_index):
        """Get team for a player"""
        if player_index in self.state['teams']['team1']['players']:
            return 'team1'
        return 'team2'
    
    def get_opponent_team(self, team):
        """Get opponent team"""
        return 'team2' if team == 'team1' else 'team1'
    
    def get_next_player_index(self, current_index=None):
        """Get next player index (counterclockwise/right in seating order)."""
        if current_index is None:
            current_index = self.state['activePlayerIndex']
        return (current_index - 1) % self.num_players

    def next_player(self):
        """Move to next player (counterclockwise/right in seating order)."""
        self.state['activePlayerIndex'] = self.get_next_player_index()
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
            
            # Initialize the appropriate betting handler for each round
            if self.state['currentRound'] == 'GRANDE':
                self.round_handler.grande_handler.initialize_grande_phase()
            elif self.state['currentRound'] == 'CHICA':
                self.round_handler.chica_handler.initialize_round()
            elif self.state['currentRound'] == 'PARES':
                self.round_handler.pares_handler.initialize_round()
            elif self.state['currentRound'] == 'JUEGO':
                self.round_handler.juego_handler.initialize_round()
            
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
        
        # Rotate mano to next player (counterclockwise/right)
        old_mano = self.state['manoIndex']
        self.state['manoIndex'] = self.get_next_player_index(self.state['manoIndex'])
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
        result = self.calculate_final_scores()
        logger.info("All deferred comparisons resolved.")
        return result

    def calculate_final_scores(self):
        """
        Resolve pending bets in order: Grande -> Chica -> Pares -> Juego -> Punto.
        Pares/Juego only score teams with at least one player who declared yes.
        """
        from card_deck import get_highest_card, get_lowest_card, compare_cards

        results = []
        deferred = self.state.get('deferredResults') or []

        def get_pending_bet(round_name):
            for item in deferred:
                if item.get('round') == round_name and not item.get('resolved'):
                    item['resolved'] = True
                    return item.get('betAmount', 1)

            phase_key = {
                'GRANDE': 'grandePhase',
                'CHICA': 'chicaPhase',
                'PARES': 'paresPhase',
                'JUEGO': 'juegoPhase'
            }.get(round_name)
            phase = self.state.get(phase_key)
            if phase and phase.get('result'):
                phase_result = phase['result']
                if phase_result.get('comparison') == 'deferred' and not phase_result.get('resolved'):
                    phase_result['resolved'] = True
                    return phase_result.get('betAmount', 1)

            return None

        def get_team_cards(team_players):
            cards = []
            for player_idx in team_players:
                cards.extend([card.to_dict() for card in self.hands.get(player_idx, [])])
            return cards

        def get_declarations(round_name):
            key = 'paresDeclarations' if round_name == 'PARES' else 'juegoDeclarations'
            return self.state.get(key) or {}

        def eligible_team_players(round_name, team):
            declarations = get_declarations(round_name)
            team_players = self.state['teams'][team]['players']
            eligible = [p for p in team_players if declarations.get(p) is True]
            return eligible

        def calculate_pares(cards):
            game_mode = self.game_mode
            value_counts = {}
            for card in cards:
                value = card['value']
                value_counts[value] = value_counts.get(value, 0) + 1

            counts = sorted(value_counts.values(), reverse=True)
            values = list(value_counts.keys())

            if len(counts) > 0 and counts[0] == 3:
                triplet_value = next(v for v in values if value_counts[v] == 3)
                return {'rank': 2, 'values': [triplet_value]}
            if len(counts) > 1 and counts[0] == 2 and counts[1] == 2:
                order = ['A', '2', '4', '5', '6', '7', 'J', 'Q', 'K'] if game_mode == '8' else ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K']
                pair_values = [v for v in values if value_counts[v] == 2]
                pair_values.sort(key=lambda x: order.index(x) if x in order else -1, reverse=True)
                return {'rank': 3, 'values': pair_values}
            if len(counts) > 0 and counts[0] == 2:
                pair_value = next(v for v in values if value_counts[v] == 2)
                return {'rank': 1, 'values': [pair_value]}

            return {'rank': 0, 'values': []}

        def calculate_juego(cards):
            def get_card_points(val):
                if val == 'A':
                    return 1
                if val == '2':
                    return 1
                if val == '3':
                    return 3 if self.game_mode == '4' else 10
                if val in ['J', 'Q', 'K']:
                    return 10
                try:
                    return int(val)
                except ValueError:
                    return 0

            sum_points = sum(get_card_points(card['value']) for card in cards)
            return {'sum': sum_points, 'hasJuego': sum_points >= 31}

        def award_points(winner_team, points, round_name):
            if winner_team:
                self.state['teams'][winner_team]['score'] += points
                results.append({'round': round_name, 'winner': winner_team, 'points': points})

        # GRANDE
        bet_amount = get_pending_bet('GRANDE') or 1
        team1_cards = get_team_cards(self.state['teams']['team1']['players'])
        team2_cards = get_team_cards(self.state['teams']['team2']['players'])
        team1_best = get_highest_card(team1_cards, self.game_mode)
        team2_best = get_highest_card(team2_cards, self.game_mode)
        result = compare_cards(
            team1_best['value'] if team1_best else 'A',
            team2_best['value'] if team2_best else 'A',
            self.game_mode
        )
        if result > 0:
            award_points('team1', bet_amount, 'GRANDE')
        elif result < 0:
            award_points('team2', bet_amount, 'GRANDE')
        else:
            award_points(self.get_player_team(self.state['manoIndex']), bet_amount, 'GRANDE')

        # CHICA
        bet_amount = get_pending_bet('CHICA') or 1
        team1_best = get_lowest_card(team1_cards, self.game_mode)
        team2_best = get_lowest_card(team2_cards, self.game_mode)
        result = compare_cards(
            team1_best['value'] if team1_best else 'K',
            team2_best['value'] if team2_best else 'K',
            self.game_mode,
            lower_wins=True
        )
        if result > 0:
            award_points('team1', bet_amount, 'CHICA')
        elif result < 0:
            award_points('team2', bet_amount, 'CHICA')
        else:
            award_points(self.get_player_team(self.state['manoIndex']), bet_amount, 'CHICA')

        # PARES
        bet_amount = get_pending_bet('PARES') or 1
        team1_eligible = eligible_team_players('PARES', 'team1')
        team2_eligible = eligible_team_players('PARES', 'team2')
        if team1_eligible or team2_eligible:
            team1_pares = calculate_pares(get_team_cards(team1_eligible))
            team2_pares = calculate_pares(get_team_cards(team2_eligible))
            if team1_pares['rank'] > team2_pares['rank']:
                award_points('team1', bet_amount, 'PARES')
            elif team2_pares['rank'] > team1_pares['rank']:
                award_points('team2', bet_amount, 'PARES')
            else:
                team1_high = max(team1_pares['values']) if team1_pares['values'] else ''
                team2_high = max(team2_pares['values']) if team2_pares['values'] else ''
                if team1_high > team2_high:
                    award_points('team1', bet_amount, 'PARES')
                elif team2_high > team1_high:
                    award_points('team2', bet_amount, 'PARES')
                else:
                    award_points(self.get_player_team(self.state['manoIndex']), bet_amount, 'PARES')

        # JUEGO or PUNTO
        bet_amount = get_pending_bet('JUEGO') or 1
        team1_eligible = eligible_team_players('JUEGO', 'team1')
        team2_eligible = eligible_team_players('JUEGO', 'team2')
        if team1_eligible or team2_eligible:
            if team1_eligible and not team2_eligible:
                award_points('team1', bet_amount, 'JUEGO')
            elif team2_eligible and not team1_eligible:
                award_points('team2', bet_amount, 'JUEGO')
            else:
                team1_juego = calculate_juego(get_team_cards(team1_eligible))
                team2_juego = calculate_juego(get_team_cards(team2_eligible))
                if team1_juego['sum'] > team2_juego['sum']:
                    award_points('team1', bet_amount, 'JUEGO')
                elif team2_juego['sum'] > team1_juego['sum']:
                    award_points('team2', bet_amount, 'JUEGO')
                else:
                    award_points(self.get_player_team(self.state['manoIndex']), bet_amount, 'JUEGO')
        else:
            # Punto: no team declared juego
            bet_amount = get_pending_bet('PUNTO') or 1
            team1_punto = calculate_juego(team1_cards)
            team2_punto = calculate_juego(team2_cards)
            if team1_punto['sum'] > team2_punto['sum']:
                award_points('team1', bet_amount, 'PUNTO')
            elif team2_punto['sum'] > team1_punto['sum']:
                award_points('team2', bet_amount, 'PUNTO')
            else:
                award_points(self.get_player_team(self.state['manoIndex']), bet_amount, 'PUNTO')

        win_check = self.check_win_condition()
        return {
            'results': results,
            **win_check
        }
    
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
