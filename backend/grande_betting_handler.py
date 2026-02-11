"""
Grande Phase Betting Handler - Implements detailed Mus betting dynamics
Following traditional Mus "Grande" phase rules with precise turn order and betting logic
"""

import logging

logger = logging.getLogger(__name__)


class GrandeBettingHandler:
    """
    Handles the Grande phase betting according to Mus rules:
    - Sequential turn-based betting (counterclockwise/right)
    - Team-based attack/defense dynamics
    - Rejection, acceptance, raise, and órdago logic
    - Deferred hand comparison (after all 4 phases)
    """
    
    def __init__(self, game):
        self.game = game
    
    def initialize_grande_phase(self):
        """
        Initialize the Grande phase.
        Mano speaks first. No bet exists yet.
        """
        self.game.state['grandePhase'] = {
            'phaseState': 'NO_BET',  # NO_BET, BET_PLACED, WAITING_RESPONSE, RESOLVED
            'attackingTeam': None,
            'defendingTeam': None,
            'currentBetAmount': 0,
            'betType': None,  # 'envido', 'ordago'
            'lastBettingTeam': None,
            'defendersResponded': [],  # List of defender player indices who responded
            'allPassed': True,  # Track if all players pass
            'result': None,  # Will store: {'winner': team, 'points': X, 'comparison': 'deferred'}
            'previousBetAmount': 0,  # Track bet amount before the current raise
            'isFirstBet': True  # Track if this is the first bet (for 1pt rejection rule)
        }
        
        # Active player is Mano
        self.game.state['activePlayerIndex'] = self.game.state['manoIndex']
        
        logger.info(f"Grande phase initialized. Mano (Player {self.game.state['manoIndex']}) speaks first.")
    
    def handle_action(self, player_index, action, extra_data=None):
        """
        Handle a player's action during Grande phase.
        
        Actions:
        - 'paso' (pass/check when no bet, or reject when bet exists)
        - 'envido' (place bet or raise)
        - 'ordago' (all-in)
        - (acceptance is implicit when not rejecting)
        
        Returns dict with success, phase updates, and next actions
        """
        
        # Validate turn
        if player_index != self.game.state['activePlayerIndex']:
            phase = self.game.state.get('grandePhase', {})
            logger.warning(
                f"[GRANDE] Player {player_index} tried to act but it's Player {self.game.state['activePlayerIndex']}'s turn. "
                f"Phase: {phase.get('phaseState')}, AttackingTeam: {phase.get('attackingTeam')}, "
                f"DefendingTeam: {phase.get('defendingTeam')}, DefendersResponded: {phase.get('defendersResponded', [])}"
            )
            return {'success': False, 'error': f"Not your turn (active player: {self.game.state['activePlayerIndex']})"}
        
        phase = self.game.state['grandePhase']
        player_team = self.game.get_player_team(player_index)
        
        logger.info(f"[GRANDE] Player {player_index} (Team {player_team}) action: {action} (Phase: {phase['phaseState']})")
        
        # Route to appropriate handler based on phase state
        if phase['phaseState'] == 'NO_BET':
            return self._handle_no_bet_action(player_index, player_team, action, extra_data)
        
        elif phase['phaseState'] in ['BET_PLACED', 'WAITING_RESPONSE']:
            return self._handle_response_to_bet(player_index, player_team, action, extra_data)
        
        else:
            logger.error(f"[GRANDE] Invalid phase state: {phase['phaseState']}")
            return {'success': False, 'error': 'Invalid phase state'}
    
    def _handle_no_bet_action(self, player_index, player_team, action, extra_data):
        """
        Handle action when NO_BET has been placed yet.
        Players can: pass (check) or place a bet (envido/órdago)
        """
        phase = self.game.state['grandePhase']
        
        if action == 'paso':
            # Player passes (checks)
            logger.info(f"Player {player_index} passes (no bet)")
            
            # Move to next player counterclockwise/right
            next_player = self._get_next_player_clockwise(player_index)
            
            # Check if we've completed a full circle (back to mano)
            if next_player == self.game.state['manoIndex'] and player_index != self.game.state['manoIndex']:
                # All 4 players have acted
                if phase['allPassed']:
                    # All passed - Grande ends with no bet, defer to scoring
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
        phase = self.game.state['grandePhase']
        
        phase['phaseState'] = 'BET_PLACED'
        phase['attackingTeam'] = betting_team
        phase['defendingTeam'] = self.game.get_opponent_team(betting_team)
        phase['currentBetAmount'] = bet_amount
        phase['betType'] = bet_type
        phase['lastBettingTeam'] = betting_team
        phase['defendersResponded'] = []
        phase['isFirstBet'] = False  # No longer the first bet
        
        logger.info(f"Player {player_index} ({betting_team}) placed {bet_type} bet: {bet_amount} points")
        
        # Find first defender to respond (closest to Mano counterclockwise/right who is on defending team)
        first_defender = self._get_next_defender_clockwise(player_index)
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
        phase = self.game.state['grandePhase']
        
        # Verify this player is on the defending team
        if player_team != phase['defendingTeam']:
            return {'success': False, 'error': 'Only defending team can respond to bet'}
        
        defending_team = phase['defendingTeam']
        defending_players = self.game.state['teams'][defending_team]['players']
        
        if action == 'paso':
            # Reject the bet
            logger.info(f"Player {player_index} (Team {player_team}) rejects the bet")
            
            # Add to responded list if not already there
            if player_index not in phase['defendersResponded']:
                phase['defendersResponded'].append(player_index)
            
            # Check if both defenders have rejected
            if len(phase['defendersResponded']) >= 2:
                # Both defenders rejected - attacking team wins 1 point
                logger.info(f"Both defenders rejected. {phase['lastBettingTeam']} wins 1 point.")
                return self._resolve_rejection(phase['lastBettingTeam'])
            
            # First defender rejected, check partner
            partner_index = self._get_partner(player_index)
            logger.info(f"First defender (Player {player_index}) rejected. Partner is Player {partner_index}.")
            
            if partner_index not in phase['defendersResponded']:
                # Partner hasn't responded yet, give them a chance
                # Keep phase state as WAITING_RESPONSE to indicate we're waiting for partner
                phase['phaseState'] = 'WAITING_RESPONSE'
                self.game.state['activePlayerIndex'] = partner_index
                logger.info(f"Setting active player to partner (Player {partner_index}) - they must respond now.")
                
                return {
                    'success': True,
                    'first_rejection': True,
                    'next_player': partner_index,
                    'partner_must_respond': True,
                    'defending_team': defending_team,
                    'waiting_for_player': partner_index
                }
            else:
                # Partner already rejected - both rejected
                logger.info(f"Partner (Player {partner_index}) already rejected. Both defenders rejected.")
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
        phase = self.game.state['grandePhase']
        
        # Save current bet amount as previous (before this raise)
        phase['previousBetAmount'] = phase['currentBetAmount']
        logger.info(f"Saving previous bet amount: {phase['currentBetAmount']}")
        
        # Update bet
        phase['currentBetAmount'] = new_bet_amount
        phase['betType'] = 'ordago' if is_ordago else 'envido'
        
        # Switch roles: raising team becomes attacking, other becomes defending
        old_attacking_team = phase['attackingTeam']
        phase['attackingTeam'] = raising_team
        phase['defendingTeam'] = old_attacking_team
        phase['lastBettingTeam'] = raising_team
        phase['defendersResponded'] = []  # Reset defenders list for new bet
        phase['phaseState'] = 'BET_PLACED'  # New bet placed, waiting for response
        
        logger.info(f"Player {player_index} (Team {raising_team}) raises to {new_bet_amount} ({'ÓRDAGO' if is_ordago else 'ENVIDO'})")
        
        # Find first defender from new defending team (closest counterclockwise/right from raiser)
        first_defender = self._get_next_defender_clockwise(player_index)
        self.game.state['activePlayerIndex'] = first_defender
        logger.info(f"After raise, first defender is Player {first_defender} (Team {old_attacking_team})")
        
        return {
            'success': True,
            'raised': True,
            'new_bet_amount': new_bet_amount,
            'bet_type': 'ordago' if is_ordago else 'envido',
            'attacking_team': raising_team,
            'defending_team': old_attacking_team,
            'next_player': first_defender,
            'waiting_for_defense': True
        }
    
    def _resolve_rejection(self, winning_team):
        """
        Both defenders rejected the bet.
        Points awarded depend on the bet sequence:
        - First bet rejected (no raises): 1 point
        - Bet raised, then rejected: award previous bet amount (before the last raise)
        Grande phase ends.
        """
        phase = self.game.state['grandePhase']
        phase['phaseState'] = 'RESOLVED'
        
        # Determine points to award based on bet history
        if phase.get('isFirstBet', True):
            # First bet rejected with no raises: award 1 point
            points_awarded = 1
            logger.info(f"First bet rejected - awarding 1 point")
        else:
            # Bet was raised, then rejected: award the bet amount BEFORE the last raise
            points_awarded = phase.get('previousBetAmount', 1)
            if points_awarded == 0:
                points_awarded = 1  # Safety fallback
            logger.info(f"Bet rejected after raise - awarding previous bet amount: {points_awarded}")
        
        phase['result'] = {
            'winner': winning_team,
            'points': points_awarded,
            'reason': 'rejection',
            'comparison': None
        }
        
        # Award points immediately
        self.game.state['teams'][winning_team]['score'] += points_awarded
        
        logger.info(f"{winning_team} wins {points_awarded} points (both defenders rejected)")
        
        return {
            'success': True,
            'round_ended': True,
            'grande_ended': True,
            'winner_team': winning_team,
            'points': points_awarded,
            'reason': 'Both defenders rejected',
            'move_to_next_round': True
        }
    
    def _resolve_acceptance(self):
        """
        A defender accepted the bet.
        - If ordago (40 points): Game ends immediately, cards collapse, winner determined
        - If normal bet: Grande phase ends, hand comparison is DEFERRED until after all 4 phases.
        """
        from card_deck import get_highest_card, compare_cards
        
        phase = self.game.state['grandePhase']
        phase['phaseState'] = 'RESOLVED'
        
        # Check if this is an ordago (all-in bet)
        is_ordago = phase['betType'] == 'ordago'
        
        if is_ordago:
            # ORDAGO: Immediate resolution - game ends now
            # Get best cards from each team for Grande
            team1_cards = []
            team2_cards = []
            
            for player_idx, hand in self.game.hands.items():
                if player_idx in self.game.state['teams']['team1']['players']:
                    team1_cards.extend([card.to_dict() for card in hand])
                else:
                    team2_cards.extend([card.to_dict() for card in hand])
            
            team1_best = get_highest_card(team1_cards, self.game.game_mode)
            team2_best = get_highest_card(team2_cards, self.game.game_mode)
            
            # Default to 'A' (Ace) if no cards found - shouldn't happen in normal gameplay
            # but provides safe fallback for edge cases
            result = compare_cards(
                team1_best['value'] if team1_best else 'A',
                team2_best['value'] if team2_best else 'A',
                self.game.game_mode
            )
            
            # Determine winner (ties go to Mano's team)
            if result > 0:
                winner_team = 'team1'
            elif result < 0:
                winner_team = 'team2'
            else:
                # Tie - Mano's team wins
                mano_team = self.game.get_player_team(self.game.state['manoIndex'])
                winner_team = mano_team
                logger.info(f"Grande (ordago) tied. Mano's team ({mano_team}) wins.")
            
            # Award 40 points immediately (ordago value)
            self.game.state['teams'][winner_team]['score'] += 40
            
            phase['result'] = {
                'winner': winner_team,
                'points': 40,
                'betType': 'ordago',
                'comparison': 'immediate',
                'resolved': True
            }
            
            logger.info(f"ORDAGO accepted! {winner_team} wins 40 points immediately. Game over!")
            
            return {
                'success': True,
                'round_ended': True,
                'grande_ended': True,
                'bet_accepted': True,
                'bet_amount': 40,
                'bet_type': 'ordago',
                'attacking_team': phase['attackingTeam'],
                'defending_team': phase['defendingTeam'],
                'reveal_cards': True,
                'collapse_all_cards': True,
                'card_info': {
                    'team1_best': team1_best,
                    'team2_best': team2_best
                },
                'winner_team': winner_team,
                'points': 40,
                'game_ended': True,  # Signal that game is over
                'comparison_immediate': True
            }
        else:
            # Normal bet: Store the bet for later comparison (deferred)
            phase['result'] = {
                'attackingTeam': phase['attackingTeam'],
                'defendingTeam': phase['defendingTeam'],
                'betAmount': phase['currentBetAmount'],
                'betType': phase['betType'],
                'comparison': 'deferred',
                'resolved': False
            }
            
            # Get card information for display
            team1_cards = []
            team2_cards = []
            
            for player_idx, hand in self.game.hands.items():
                if player_idx in self.game.state['teams']['team1']['players']:
                    team1_cards.extend([card.to_dict() for card in hand])
                else:
                    team2_cards.extend([card.to_dict() for card in hand])
            
            team1_best = get_highest_card(team1_cards, self.game.game_mode)
            team2_best = get_highest_card(team2_cards, self.game.game_mode)
            
            logger.info(f"Bet accepted. {phase['currentBetAmount']} points at stake. Comparison deferred.")
            
            return {
                'success': True,
                'round_ended': True,
                'grande_ended': True,
                'bet_accepted': True,
                'bet_amount': phase['currentBetAmount'],
                'attacking_team': phase['attackingTeam'],
                'defending_team': phase['defendingTeam'],
                'reveal_cards': True,
                'card_info': {
                    'team1_best': team1_best,
                    'team2_best': team2_best
                },
                'comparison_deferred': True,
                'move_to_next_round': True
            }
    
    def _resolve_all_pass(self):
        """
        All four players passed without betting.
        Grande is played with no bet (1 point to winner).
        Comparison is deferred.
        """
        from card_deck import get_highest_card
        
        phase = self.game.state['grandePhase']
        phase['phaseState'] = 'RESOLVED'
        phase['result'] = {
            'betAmount': 1,
            'comparison': 'deferred',
            'allPassed': True,
            'resolved': False
        }
        
        # Get card information for display
        team1_cards = []
        team2_cards = []
        
        for player_idx, hand in self.game.hands.items():
            if player_idx in self.game.state['teams']['team1']['players']:
                team1_cards.extend([card.to_dict() for card in hand])
            else:
                team2_cards.extend([card.to_dict() for card in hand])
        
        team1_best = get_highest_card(team1_cards, self.game.game_mode)
        team2_best = get_highest_card(team2_cards, self.game.game_mode)
        
        logger.info("All players passed. Grande will be compared for 1 point.")
        
        return {
            'success': True,
            'round_ended': True,
            'grande_ended': True,
            'all_passed': True,
            'points_at_stake': 1,
            'reveal_cards': True,
            'card_info': {
                'team1_best': team1_best,
                'team2_best': team2_best
            },
            'comparison_deferred': True,
            'move_to_next_round': True
        }
    
    # Helper methods
    
    def _get_next_player_clockwise(self, current_player):
        """Get next player in counterclockwise/right order (current - 1) mod 4"""
        return (current_player - 1) % 4
    
    def _get_next_defender_clockwise(self, current_player):
        """
        Get the next defender counterclockwise/right from current player.
        Search counterclockwise/right until we find a player on the defending team.
        """
        phase = self.game.state['grandePhase']
        defending_team = phase['defendingTeam']
        defending_players = self.game.state['teams'][defending_team]['players']
        
        # Start from next player counterclockwise/right
        check_player = self._get_next_player_clockwise(current_player)
        
        # Find first defender
        for _ in range(4):
            if check_player in defending_players:
                return check_player
            check_player = self._get_next_player_clockwise(check_player)
        
        # Fallback (shouldn't happen)
        return defending_players[0]
    
    def _get_first_team_member_from_mano(self, team):
        """
        Get the first team member counterclockwise/right from Mano.
        Used when finding who should respond after a raise.
        """
        team_players = self.game.state['teams'][team]['players']
        mano = self.game.state['manoIndex']
        
        # Check in counterclockwise/right order starting from mano
        for offset in range(4):
            player = (mano - offset) % 4
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
    
    def compare_and_resolve_grande(self):
        """
        Compare Grande hands and determine winner.
        Called after all 4 phases (Grande, Chica, Pares, Juego) complete.
        """
        phase = self.game.state['grandePhase']
        
        if phase['result']['resolved']:
            return None  # Already resolved
        
        if phase['result'].get('reason') == 'rejection':
            return None  # Already scored
        
        # Get best cards from each team for Grande
        from card_deck import get_highest_card, compare_cards
        
        team1_cards = []
        team2_cards = []
        
        for player_idx, hand in self.game.hands.items():
            if player_idx in self.game.state['teams']['team1']['players']:
                team1_cards.extend([card.to_dict() for card in hand])
            else:
                team2_cards.extend([card.to_dict() for card in hand])
        
        team1_best = get_highest_card(team1_cards, self.game.game_mode)
        team2_best = get_highest_card(team2_cards, self.game.game_mode)
        
        result = compare_cards(
            team1_best['value'] if team1_best else 'A',
            team2_best['value'] if team2_best else 'A',
            self.game.game_mode
        )
        
        # Determine winner (ties go to Mano's team)
        if result > 0:
            winner_team = 'team1'
        elif result < 0:
            winner_team = 'team2'
        else:
            # Tie - Mano's team wins
            mano_team = self.game.get_player_team(self.game.state['manoIndex'])
            winner_team = mano_team
            logger.info(f"Grande tied. Mano's team ({mano_team}) wins.")
        
        # Award points
        points = phase['result'].get('betAmount', 1)
        self.game.state['teams'][winner_team]['score'] += points
        
        phase['result']['winner'] = winner_team
        phase['result']['points'] = points
        phase['result']['resolved'] = True
        
        logger.info(f"{winner_team} wins {points} points in Grande")
        
        return {
            'winner': winner_team,
            'points': points,
            'team1_best': team1_best,
            'team2_best': team2_best
        }
