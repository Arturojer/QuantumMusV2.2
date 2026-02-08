"""
Generic Betting Handler - Handles betting dynamics for all rounds
Following traditional Mus betting rules with precise turn order and betting logic (counterclockwise/antihorario)
"""

import logging

logger = logging.getLogger(__name__)


class GenericBettingHandler:
    """
    Handles betting for CHICA, PARES, and JUEGO rounds.
    Following traditional Mus betting rules with precise turn order and betting logic.
    Uses counterclockwise (antihorario) movement.
    """

    def __init__(self, game, round_type):
        self.game = game
        self.round_type = round_type  # 'GRANDE', 'CHICA', 'PARES', 'JUEGO'

    def initialize_round(self):
        """
        Initialize the round betting phase.
        Mano speaks first. No bet exists yet.
        """
        round_key = self.round_type.lower()
        self.game.state[f'{round_key}Phase'] = {
            'phaseState': 'NO_BET',  # NO_BET, BET_PLACED, WAITING_RESPONSE, RESOLVED
            'attackingTeam': None,
            'defendingTeam': None,
            'currentBetAmount': 0,
            'betType': None,  # 'envido', 'ordago'
            'lastBettingTeam': None,
            'defendersResponded': [],  # List of defender player indices who responded
            'allPassed': True,  # Track if all players pass
            'result': None  # Will store: {'winner': team, 'points': X, 'comparison': 'deferred'}
        }

        # Active player is Mano
        self.game.state['activePlayerIndex'] = self.game.state['manoIndex']

        logger.info(f"{self.round_type} phase initialized. Mano (Player {self.game.state['manoIndex']}) speaks first.")

    def handle_action(self, player_index, action, extra_data=None):
        """
        Handle a player's action during the round.

        Actions:
        - 'paso' (pass/check when no bet, or reject when bet exists)
        - 'envido' (place bet or raise)
        - 'ordago' (all-in)
        - 'accept' (accept the bet - implicit when not rejecting)

        Returns dict with success, phase updates, and next actions
        """

        if player_index != self.game.state['activePlayerIndex']:
            return {'success': False, 'error': 'Not your turn'}

        phase = self.game.state[f'{self.round_type.lower()}Phase']
        player_team = self.game.get_player_team(player_index)

        # Route to appropriate handler based on phase state
        if phase['phaseState'] == 'NO_BET':
            return self._handle_no_bet_action(player_index, player_team, action, extra_data)

        elif phase['phaseState'] in ['BET_PLACED', 'WAITING_RESPONSE']:
            return self._handle_response_to_bet(player_index, player_team, action, extra_data)

        else:
            return {'success': False, 'error': 'Invalid phase state'}

    def _handle_no_bet_action(self, player_index, player_team, action, extra_data):
        """
        Handle action when NO_BET has been placed yet.
        Players can: pass (check) or place a bet (envido/órdago)
        """
        phase = self.game.state[f'{self.round_type.lower()}Phase']

        if action == 'paso':
            # Player passes (checks)
            logger.info(f"Player {player_index} passes (no bet)")

            # Move to next player counterclockwise (antihorario)
            next_player = self._get_next_player_counterclockwise(player_index)

            # Check if we've completed a full circle (back to mano)
            if next_player == self.game.state['manoIndex'] and player_index != self.game.state['manoIndex']:
                # All 4 players have acted
                if phase['allPassed']:
                    # All passed - round ends with no bet, defer to scoring
                    return self._resolve_all_pass()

            self.game.state['activePlayerIndex'] = next_player
            return {'success': True, 'next_player': next_player}

        elif action == 'envido':
            # Place first bet
            bet_amount = extra_data.get('amount', 2) if extra_data else 2
            phase['allPassed'] = False

            return self._place_bet(player_index, player_team, 'envido', bet_amount)

        elif action == 'ordago':
            # Place órdago bet
            phase['allPassed'] = False
            return self._place_bet(player_index, player_team, 'ordago', 40)

        else:
            return {'success': False, 'error': 'Invalid action for NO_BET state'}

    def _place_bet(self, player_index, betting_team, bet_type, bet_amount):
        """
        Place a bet (first bet or raise).
        The betting team becomes the attacking team.
        """
        phase = self.game.state[f'{self.round_type.lower()}Phase']

        phase['phaseState'] = 'BET_PLACED'
        phase['attackingTeam'] = betting_team
        phase['defendingTeam'] = self.game.get_opponent_team(betting_team)
        phase['currentBetAmount'] = bet_amount
        phase['betType'] = bet_type
        phase['lastBettingTeam'] = betting_team
        phase['defendersResponded'] = []

        logger.info(f"Player {player_index} ({betting_team}) placed {bet_type} bet: {bet_amount} points")

        # Find first defender to respond (closest counterclockwise from betting player)
        first_defender = self._get_next_defender_counterclockwise(player_index)
        self.game.state['activePlayerIndex'] = first_defender

        return {
            'success': True,
            'bet_placed': True,
            'betting_team': betting_team,
            'bet_type': bet_type,
            'bet_amount': bet_amount,
            'next_player': first_defender,
            'waiting_for_defense': True
        }

    def _handle_response_to_bet(self, player_index, player_team, action, extra_data):
        """
        Handle a defender's response to a bet.
        Defender can: reject (paso), accept (implicit), raise (envido), or órdago
        """
        phase = self.game.state[f'{self.round_type.lower()}Phase']

        # Verify this player is on the defending team
        if player_team != phase['defendingTeam']:
            return {'success': False, 'error': 'Only defending team can respond to bet'}

        defending_team = phase['defendingTeam']
        defending_players = self.game.state['teams'][defending_team]['players']

        if action == 'paso':
            # Reject the bet
            logger.info(f"Player {player_index} rejects the bet")
            phase['defendersResponded'].append(player_index)

            # Check if both defenders have rejected
            if len(phase['defendersResponded']) >= 2:
                # Both defenders rejected - attacking team wins 1 point
                return self._resolve_rejection(phase['lastBettingTeam'])

            # First defender rejected, check partner
            partner_index = self._get_partner(player_index)

            if partner_index not in phase['defendersResponded']:
                # Partner hasn't responded yet, give them a chance
                self.game.state['activePlayerIndex'] = partner_index
                logger.info(f"First defender rejected. Partner (Player {partner_index}) must respond.")

                return {
                    'success': True,
                    'first_rejection': True,
                    'next_player': partner_index,
                    'partner_must_respond': True
                }
            else:
                # Partner already rejected - both rejected
                return self._resolve_rejection(phase['lastBettingTeam'])

        elif action == 'accept':
            # Accept the bet
            logger.info(f"Player {player_index} accepts the bet")
            return self._resolve_acceptance()

        elif action == 'envido':
            # Raise the bet
            new_bet_amount = extra_data.get('amount', phase['currentBetAmount'] + 2) if extra_data else phase['currentBetAmount'] + 2
            return self._handle_raise(player_index, player_team, new_bet_amount)

        elif action == 'ordago':
            # Raise to órdago
            return self._handle_raise(player_index, player_team, 40, is_ordago=True)

        else:
            return {'success': False, 'error': 'Invalid response action'}

    def _handle_raise(self, player_index, raising_team, new_bet_amount, is_ordago=False):
        """
        Handle a raise (re-envido or órdago response).
        Control switches back to the original betting team.
        """
        phase = self.game.state[f'{self.round_type.lower()}Phase']

        # Update bet
        phase['currentBetAmount'] = new_bet_amount
        phase['betType'] = 'ordago' if is_ordago else 'envido'

        # Switch roles: raising team becomes attacking, other becomes defending
        old_attacking_team = phase['attackingTeam']
        phase['attackingTeam'] = raising_team
        phase['defendingTeam'] = old_attacking_team
        phase['lastBettingTeam'] = raising_team
        phase['defendersResponded'] = []

        logger.info(f"Player {player_index} raises to {new_bet_amount} ({'ÓRDAGO' if is_ordago else 'ENVIDO'})")

        # Find first defender from new defending team (counterclockwise from raiser)
        first_defender = self._get_next_defender_counterclockwise(player_index)
        self.game.state['activePlayerIndex'] = first_defender

        return {
            'success': True,
            'raised': True,
            'new_bet_amount': new_bet_amount,
            'bet_type': 'ordago' if is_ordago else 'envido',
            'attacking_team': raising_team,
            'defending_team': old_attacking_team,
            'next_player': first_defender
        }

    def _resolve_rejection(self, winning_team):
        """
        Both defenders rejected the bet.
        Attacking/betting team wins 1 point.
        Round phase ends.
        """
        phase = self.game.state[f'{self.round_type.lower()}Phase']
        phase['phaseState'] = 'RESOLVED'
        phase['result'] = {
            'winner': winning_team,
            'points': 1,
            'reason': 'rejection',
            'comparison': None
        }

        # Award point immediately
        self.game.state['teams'][winning_team]['score'] += 1

        logger.info(f"{winning_team} wins 1 point (both defenders rejected)")

        return {
            'success': True,
            'round_ended': True,
            'winner_team': winning_team,
            'points': 1,
            'reason': 'Both defenders rejected',
            'move_to_next_round': True
        }

    def _resolve_acceptance(self):
        """
        A defender accepted the bet.
        Round phase ends, but hand comparison is DEFERRED until after all 4 phases.
        """
        phase = self.game.state[f'{self.round_type.lower()}Phase']
        phase['phaseState'] = 'RESOLVED'

        # Store the bet for later comparison
        phase['result'] = {
            'attackingTeam': phase['attackingTeam'],
            'defendingTeam': phase['defendingTeam'],
            'betAmount': phase['currentBetAmount'],
            'betType': phase['betType'],
            'comparison': 'deferred',
            'resolved': False
        }

        # Get card information for revelation (without determining winner yet)
        card_info = self._get_round_card_info()

        logger.info(f"Bet accepted. {phase['currentBetAmount']} points at stake. Comparison deferred.")

        return {
            'success': True,
            'round_ended': True,
            'bet_accepted': True,
            'bet_amount': phase['currentBetAmount'],
            'attacking_team': phase['attackingTeam'],
            'defending_team': phase['defendingTeam'],
            'comparison_deferred': True,
            'move_to_next_round': True,
            'reveal_cards': True,
            'card_info': card_info
        }

    def _resolve_all_pass(self):
        """
        All four players passed without betting.
        Round is played with no bet (1 point to winner).
        Comparison is deferred.
        """
        phase = self.game.state[f'{self.round_type.lower()}Phase']
        phase['phaseState'] = 'RESOLVED'
        phase['result'] = {
            'betAmount': 1,
            'comparison': 'deferred',
            'allPassed': True,
            'resolved': False
        }

        # Get card information for revelation
        card_info = self._get_round_card_info()

        logger.info(f"All players passed in {self.round_type}. Comparison deferred for 1 point.")

        return {
            'success': True,
            'round_ended': True,
            'all_passed': True,
            'points_at_stake': 1,
            'comparison_deferred': True,
            'move_to_next_round': True,
            'reveal_cards': True,
            'card_info': card_info
        }

    # Helper methods

    def _get_next_player_counterclockwise(self, current_player):
        """Get next player in counterclockwise order (antihorario) (current - 1) mod 4"""
        return (current_player - 1) % 4

    def _get_next_defender_counterclockwise(self, current_player):
        """
        Get the next defender counterclockwise (antihorario) from current player.
        Search counterclockwise until we find a player on the defending team.
        """
        phase = self.game.state[f'{self.round_type.lower()}Phase']
        defending_team = phase['defendingTeam']
        defending_players = self.game.state['teams'][defending_team]['players']

        # Start from next player counterclockwise
        check_player = self._get_next_player_counterclockwise(current_player)

        # Find first defender
        for _ in range(4):
            if check_player in defending_players:
                return check_player
            check_player = self._get_next_player_counterclockwise(check_player)

        # Fallback (shouldn't happen)
        return defending_players[0]

    def _get_first_team_member_from_mano(self, team):
        """
        Get the first team member clockwise from Mano.
        Used when finding who should respond after a raise.
        """
        team_players = self.game.state['teams'][team]['players']
        mano = self.game.state['manoIndex']

        # Check in clockwise order starting from mano
        for offset in range(4):
            player = (mano + offset) % 4
            if player in team_players:
                return player

        # Fallback
        return team_players[0]

    def _get_partner(self, player_index):
        """Get the partner of a player (same team, different player)"""
        player_team = self.game.get_player_team(player_index)
        team_players = self.game.state['teams'][player_team]['players']

        for p in team_players:
            if p != player_index:
                return p

        return None

    def _get_round_card_info(self):
        """Get card information for the current round type"""
        from card_deck import get_highest_card, get_lowest_card
        
        team1_cards = []
        team2_cards = []
        
        for player_idx, hand in self.game.hands.items():
            if player_idx in self.game.state['teams']['team1']['players']:
                team1_cards.extend([card.to_dict() for card in hand])
            else:
                team2_cards.extend([card.to_dict() for card in hand])
        
        if self.round_type == 'CHICA':
            # Lower cards win in CHICA
            team1_best = get_lowest_card(team1_cards, self.game.game_mode)
            team2_best = get_lowest_card(team2_cards, self.game.game_mode)
        elif self.round_type == 'GRANDE':
            # Higher cards win in GRANDE (shouldn't happen here, but included for completeness)
            team1_best = get_highest_card(team1_cards, self.game.game_mode)
            team2_best = get_highest_card(team2_cards, self.game.game_mode)
        else:
            # For PARES and JUEGO, return all cards
            return {
                'team1_cards': team1_cards,
                'team2_cards': team2_cards
            }
        
        return {
            'team1_best': team1_best,
            'team2_best': team2_best
        }

    def compare_and_resolve_round(self):
        """
        Compare hands and determine winner for this round.
        Called after all 4 phases (Grande, Chica, Pares, Juego) complete.
        """
        phase = self.game.state[f'{self.round_type.lower()}Phase']

        if phase['result']['resolved']:
            return None  # Already resolved

        if phase['result'].get('reason') == 'rejection':
            return None  # Already scored

        # Get best cards from each team for this round
        from card_deck import get_highest_card, get_lowest_card

        team1_cards = []
        team2_cards = []

        for player_idx, hand in self.game.hands.items():
            if player_idx in self.game.state['teams']['team1']['players']:
                team1_cards.extend([card.to_dict() for card in hand])
            else:
                team2_cards.extend([card.to_dict() for card in hand])

        winner_team = None

        if self.round_type == 'GRANDE':
            # Higher cards win
            team1_best = get_highest_card(team1_cards, self.game.game_mode)
            team2_best = get_highest_card(team2_cards, self.game.game_mode)

            from card_deck import compare_cards
            result = compare_cards(
                team1_best['value'] if team1_best else 'A',
                team2_best['value'] if team2_best else 'A',
                self.game.game_mode
            )

            winner_team = 'team1' if result >= 0 else 'team2'

        elif self.round_type == 'CHICA':
            # Lower cards win
            team1_best = get_lowest_card(team1_cards, self.game.game_mode)
            team2_best = get_lowest_card(team2_cards, self.game.game_mode)

            from card_deck import compare_cards
            result = compare_cards(
                team1_best['value'] if team1_best else 'K',
                team2_best['value'] if team2_best else 'K',
                self.game.game_mode,
                lower_wins=True
            )

            winner_team = 'team1' if result >= 0 else 'team2'

        elif self.round_type == 'PARES':
            # Pairs scoring
            winner_team = self._compare_pares_hands()

        elif self.round_type == 'JUEGO':
            # Points scoring (31+)
            winner_team = self._compare_juego_hands()

        # Award points
        points = phase['result'].get('betAmount', 1)
        self.game.state['teams'][winner_team]['score'] += points

        phase['result']['winner'] = winner_team
        phase['result']['points'] = points
        phase['result']['resolved'] = True

        logger.info(f"{winner_team} wins {points} points in {self.round_type}")

        return {
            'winner': winner_team,
            'points': points,
            'round': self.round_type
        }

    def _compare_pares_hands(self):
        """Compare PARES hands between teams"""
        # Get pairs for each team
        team1_pairs = self._get_team_pares('team1')
        team2_pairs = self._get_team_pares('team2')

        # Compare pair ranks
        if team1_pairs['rank'] > team2_pairs['rank']:
            return 'team1'
        elif team2_pairs['rank'] > team1_pairs['rank']:
            return 'team2'
        else:
            # Tie - compare highest cards in pairs
            team1_high = max(team1_pairs['values']) if team1_pairs['values'] else 0
            team2_high = max(team2_pairs['values']) if team2_pairs['values'] else 0

            if team1_high > team2_high:
                return 'team1'
            elif team2_high > team1_high:
                return 'team2'
            else:
                # Complete tie - Mano's team wins
                mano_team = self.game.get_player_team(self.game.state['manoIndex'])
                return mano_team

    def _get_team_pares(self, team):
        """Get the best PARES for a team"""
        team_players = self.game.state['teams'][team]['players']
        all_cards = []

        for player_idx in team_players:
            all_cards.extend([card.to_dict() for card in self.game.hands[player_idx]])

        # Calculate pairs
        pares_result = self._calculate_pares(all_cards)
        return pares_result

    def _calculate_pares(self, cards):
        """Calculate PARES from cards"""
        game_mode = self.game.game_mode

        # For PARES, do NOT normalize values - cards must match physically
        # A 3 and a K are different cards (even though 3=K for GRANDE/CHICA)
        # An A and a 2 are different cards
        value_counts = {}
        for card in cards:
            value = card['value']  # Use actual card value, no normalization
            value_counts[value] = value_counts.get(value, 0) + 1

        # Sort counts in descending order
        counts = sorted(value_counts.values(), reverse=True)
        values = list(value_counts.keys())

        if len(counts) > 0 and counts[0] == 3:
            # Triplet
            triplet_value = next(v for v in values if value_counts[v] == 3)
            return {'type': 'triplet', 'value': triplet_value, 'rank': 2, 'values': [triplet_value]}
        elif len(counts) > 1 and counts[0] == 2 and counts[1] == 2:
            # Double pair
            order = ['A', '2', '4', '5', '6', '7', 'J', 'Q', 'K'] if game_mode == '8' else ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K']
            pair_values = [v for v in values if value_counts[v] == 2]
            pair_values.sort(key=lambda x: order.index(x) if x in order else -1, reverse=True)
            return {'type': 'double_pair', 'value': pair_values[0], 'rank': 3, 'values': pair_values}
        elif len(counts) > 0 and counts[0] == 2:
            # Single pair
            pair_value = next(v for v in values if value_counts[v] == 2)
            return {'type': 'pair', 'value': pair_value, 'rank': 1, 'values': [pair_value]}

        return {'type': 'none', 'rank': 0, 'values': []}

    def _compare_juego_hands(self):
        """Compare JUEGO hands between teams"""
        # Get juego points for each team
        team1_juego = self._get_team_juego('team1')
        team2_juego = self._get_team_juego('team2')

        # Compare total points
        if team1_juego['sum'] > team2_juego['sum']:
            return 'team1'
        elif team2_juego['sum'] > team1_juego['sum']:
            return 'team2'
        else:
            # Tie - Mano's team wins
            mano_team = self.game.get_player_team(self.game.state['manoIndex'])
            return mano_team

    def _get_team_juego(self, team):
        """Get the JUEGO points for a team"""
        team_players = self.game.state['teams'][team]['players']
        all_cards = []

        for player_idx in team_players:
            all_cards.extend([card.to_dict() for card in self.game.hands[player_idx]])

        # Calculate juego
        juego_result = self._calculate_juego(all_cards)
        return juego_result

    def _calculate_juego(self, cards):
        """Calculate JUEGO points from cards"""
        game_mode = self.game.game_mode

        def get_card_points(val):
            if val == 'A':
                return 1
            elif val == '2':
                return 1
            elif val == '3':
                return 3 if game_mode == '4' else 10
            elif val in ['J', 'Q', 'K']:
                return 10
            else:
                try:
                    return int(val)
                except ValueError:
                    return 0

        sum_points = sum(get_card_points(card['value']) for card in cards)

        has_juego = sum_points >= 31
        if has_juego:
            if sum_points == 31:
                rank = 100
            elif sum_points == 40:
                rank = 99
            else:
                rank = 100 - sum_points + 31
        else:
            rank = 30 - sum_points

        return {
            'sum': sum_points,
            'hasJuego': has_juego,
            'rank': rank
        }
