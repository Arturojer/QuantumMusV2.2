"""
Round Handlers - Manages game round logic
"""

import logging
from card_deck import get_highest_card, get_lowest_card
from grande_betting_handler import GrandeBettingHandler
from generic_betting_handler import GenericBettingHandler

logger = logging.getLogger(__name__)


class RoundHandler:
    """Handles round-specific logic"""
    
    def __init__(self, game):
        self.game = game
        self.grande_handler = GrandeBettingHandler(game)
    
    def handle_mus_round(self, player_index, action, extra_data=None):
        """Handle MUS round actions"""
        # Validate player index
        if not isinstance(player_index, int) or player_index < 0 or player_index > 3:
            logger.error(f"Invalid player_index: {player_index}")
            return {'success': False, 'error': 'Invalid player index'}
        
        # Validate action
        valid_actions = ['mus', 'no_mus', 'cortar', 'paso', 'envido', 'ordago']
        if action not in valid_actions:
            logger.error(f"Invalid action: {action}")
            return {'success': False, 'error': f'Invalid action: {action}'}
        
        # Validate it's this player's turn
        if self.game.state['activePlayerIndex'] != player_index:
            logger.warning(f"Player {player_index} tried to act out of turn (active: {self.game.state['activePlayerIndex']})")
            return {'success': False, 'error': 'Not your turn'}
        
        # Validate player hasn't already acted this round
        if player_index in self.game.state['roundActions']:
            logger.warning(f"Player {player_index} tried to act twice in MUS round")
            return {'success': False, 'error': 'You have already acted this round'}
        
        self.game.state['roundActions'][player_index] = action

        if action == 'mus':
            # Check if all players chose mus
            all_mus = (len(self.game.state['roundActions']) == 4 and
                       all(a == 'mus' for a in self.game.state['roundActions'].values()))

            if all_mus:
                # Start discard phase
                self.game.state['waitingForDiscard'] = True
                logger.info("All players chose MUS - starting discard phase")

                return {
                    'success': True,
                    'discard_phase': True
                }

            # Move to next player until all 4 have spoken
            self.game.next_player()
            return {'success': True}

        if action in ['no_mus', 'cortar', 'paso', 'envido', 'ordago']:
            # End MUS phase immediately and move to GRANDE
            if action in ['envido', 'ordago']:
                bet_amount = extra_data.get('amount', 2) if extra_data else 2
                self.game.state['currentBet']['amount'] = bet_amount
                self.game.state['currentBet']['betType'] = action
                self.game.state['currentBet']['bettingTeam'] = self.game.get_player_team(player_index)
                self.game.state['currentBet']['responses'] = {}
                logger.info(f"Player {player_index} bet {bet_amount} points ({action})")
            else:
                self.game.state['currentBet'] = {
                    'amount': 0,
                    'bettingTeam': None,
                    'betType': None,
                    'responses': {}
                }

            self.game.state['musPhaseActive'] = False
            self.game.state['currentRound'] = 'GRANDE'
            self.game.state['roundActions'] = {}
            self.game.state['allPlayersPassed'] = False
            self.game.state['waitingForDiscard'] = False
            self.game.state['activePlayerIndex'] = self.game.state['manoIndex']

            # Initialize Grande phase
            self.grande_handler.initialize_grande_phase()

            return {
                'success': True,
                'round_changed': True,
                'new_round': 'GRANDE'
            }
        
        return {'success': False, 'error': 'Invalid action'}
    
    def handle_betting_round(self, player_index, action, extra_data=None):
        """Handle betting rounds (GRANDE, CHICA, PARES, JUEGO)"""

        # Validate it's this player's turn
        if self.game.state['activePlayerIndex'] != player_index:
            logger.warning(f"Player {player_index} tried to act out of turn (active: {self.game.state['activePlayerIndex']})")
            return {'success': False, 'error': 'Not your turn'}

        if not isinstance(action, str):
            return {'success': False, 'error': 'Invalid action'}

        normalized_action = action.lower()
        action_aliases = {
            'quiero': 'accept',
            'no_quiero': 'reject',
            'no-quiero': 'reject',
            're_envido': 'envido',
            're-envido': 'envido',
            'reenvido': 'envido',
            'raise': 'envido'
        }
        normalized_action = action_aliases.get(normalized_action, normalized_action)

        player_team = self.game.get_player_team(player_index)
        opponent_team = self.game.get_opponent_team(player_team)
        bet_active = bool(self.game.state['currentBet'].get('betType')) and bool(self.game.state['currentBet'].get('bettingTeam'))

        if bet_active:
            # Only allow responses to an active bet
            if normalized_action in ['mus', 'paso']:
                return {'success': False, 'error': 'Invalid action while bet is active'}

            if normalized_action == 'accept':
                # Accept the bet (defer scoring except ordago)
                if self.game.state['currentBet'].get('betType') == 'ordago':
                    if self.game.state['currentRound'] not in ['GRANDE', 'CHICA']:
                        return {'success': False, 'error': 'Ordago resolution not supported in this round'}
                    self.game.state['currentBet']['amount'] = self.game.state['currentBet'].get('amount') or 40
                    return self._reveal_and_score()

                bet_amount = self.game.state['currentBet'].get('amount') or 1
                self.game.state['deferredResults'].append({
                    'round': self.game.state['currentRound'],
                    'betAmount': bet_amount,
                    'betType': self.game.state['currentBet'].get('betType') or 'envido',
                    'bettingTeam': self.game.state['currentBet'].get('bettingTeam'),
                    'defendingTeam': player_team,
                    'comparison': 'deferred'
                })

                hand_ended = self.game.move_to_next_round()
                return {
                    'success': True,
                    'round_ended': True,
                    'bet_accepted': True,
                    'bet_amount': bet_amount,
                    'comparison_deferred': True,
                    'hand_ended': hand_ended
                }

            if normalized_action == 'reject':
                points = self.game.state['currentBet'].get('amount') or 1
                winning_team = self.game.state['currentBet'].get('bettingTeam')
                if winning_team:
                    self.game.state['teams'][winning_team]['score'] += points

                logger.info(f"{winning_team} wins {points} points (bet rejected)")
                win_check = self.game.check_win_condition()
                hand_ended = self.game.move_to_next_round()

                return {
                    'success': True,
                    'round_ended': True,
                    'winner_team': winning_team,
                    'points': points,
                    'reason': 'Bet rejected',
                    'hand_ended': hand_ended,
                    **win_check
                }

            if normalized_action in ['envido', 'ordago']:
                bet_amount = 40 if normalized_action == 'ordago' else (extra_data.get('amount', self.game.state['currentBet'].get('amount', 2) + 2) if extra_data else self.game.state['currentBet'].get('amount', 2) + 2)
                self.game.state['currentBet']['amount'] = bet_amount
                self.game.state['currentBet']['bettingTeam'] = player_team
                self.game.state['currentBet']['betType'] = 'ordago' if normalized_action == 'ordago' else 'envido'
                self.game.state['currentBet']['responses'] = {}
                self.game.state['activePlayerIndex'] = (player_index + 1) % 4

                logger.info(f"Player {player_index} raised to {bet_amount} ({self.game.state['currentBet']['betType']})")
                return {'success': True, 'bet_raised': True, 'bet_amount': bet_amount}

            return {'success': False, 'error': 'Invalid response action'}

        # No active bet: allow pass/check or initiate bet
        if normalized_action == 'paso':
            self.game.next_player()
            return {'success': True}

        if normalized_action in ['envido', 'ordago']:
            bet_amount = 40 if normalized_action == 'ordago' else (extra_data.get('amount', 2) if extra_data else 2)
            self.game.state['currentBet']['amount'] = bet_amount
            self.game.state['currentBet']['bettingTeam'] = player_team
            self.game.state['currentBet']['betType'] = 'ordago' if normalized_action == 'ordago' else 'envido'
            self.game.state['currentBet']['responses'] = {}
            self.game.state['activePlayerIndex'] = (player_index + 1) % 4

            logger.info(f"Player {player_index} bet {bet_amount} points ({self.game.state['currentBet']['betType']})")
            return {
                'success': True,
                'bet_placed': True,
                'bet_amount': bet_amount,
                'betting_team': player_team
            }

        return {'success': False, 'error': 'Invalid action'}
    
    def _reveal_and_score(self):
        """Reveal cards and determine winner"""
        current_round = self.game.state['currentRound']
        
        # Get best cards from each team
        team1_cards = []
        team2_cards = []
        
        for player_idx, hand in self.game.hands.items():
            if player_idx in self.game.state['teams']['team1']['players']:
                team1_cards.extend([card.to_dict() for card in hand])
            else:
                team2_cards.extend([card.to_dict() for card in hand])
        
        winner_team = None
        
        if current_round == 'GRANDE':
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
        
        elif current_round == 'CHICA':
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
        
        # Award points
        points = self.game.state['currentBet']['amount'] or 1
        self.game.state['teams'][winner_team]['score'] += points
        
        logger.info(f"{winner_team} wins {points} points in {current_round}")
        
        # Check win condition
        win_check = self.game.check_win_condition()
        
        # Move to next round
        hand_ended = self.game.move_to_next_round()
        
        return {
            'success': True,
            'round_ended': True,
            'round_result': {
                'winner_team': winner_team,
                'points': points,
                'round': current_round
            },
            'hand_ended': hand_ended,
            **win_check
        }
