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
        valid_actions = ['mus', 'paso', 'envido', 'ordago']
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
                logger.info(f"All players chose MUS - starting discard phase")
                
                return {
                    'success': True,
                    'discard_phase': True
                }
            else:
                # Move to next player
                self.game.next_player()
                return {'success': True}
        
        elif action in ['paso', 'envido', 'ordago']:
            # End MUS phase, move to GRANDE
            if action in ['envido', 'ordago']:
                bet_amount = extra_data.get('amount', 2) if extra_data else 2
                self.game.state['currentBet']['amount'] = bet_amount
                self.game.state['currentBet']['betType'] = action
                self.game.state['currentBet']['bettingTeam'] = self.game.get_player_team(player_index)
                logger.info(f"Player {player_index} bet {bet_amount} points ({action})")
            
            self.game.state['musPhaseActive'] = False
            self.game.state['currentRound'] = 'GRANDE'
            self.game.reset_round_state()
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
        
        # Use detailed Grande handler for GRANDE phase
        if self.game.state['currentRound'] == 'GRANDE':
            return self.grande_handler.handle_action(player_index, action, extra_data)
        
        # Use legacy handler for other rounds (will be updated similarly later)
        player_team = self.game.get_player_team(player_index)
        opponent_team = self.game.get_opponent_team(player_team)
        
        if action == 'paso':
            # Player passes
            self.game.state['currentBet']['responses'][player_index] = 'paso'
            
            # Check if entire opponent team passed
            opponent_players = self.game.state['teams'][opponent_team]['players']
            all_opponents_responded = all(
                p in self.game.state['currentBet']['responses']
                for p in opponent_players
            )
            
            if all_opponents_responded:
                all_passed = all(
                    self.game.state['currentBet']['responses'].get(p) == 'paso'
                    for p in opponent_players
                )
                
                if all_passed:
                    # Betting team wins
                    if self.game.state['currentBet']['bettingTeam']:
                        points = self.game.state['currentBet']['amount'] or 1
                        self.game.state['teams'][self.game.state['currentBet']['bettingTeam']]['score'] += points
                        
                        logger.info(f"{self.game.state['currentBet']['bettingTeam']} wins {points} points")
                        
                        # Move to next round
                        hand_ended = self.game.move_to_next_round()
                        
                        return {
                            'success': True,
                            'round_ended': True,
                            'winner_team': self.game.state['currentBet']['bettingTeam'],
                            'points': points,
                            'hand_ended': hand_ended
                        }
            
            # Move to next player
            self.game.next_player()
            return {'success': True}
        
        elif action == 'accept':
            # Accept bet
            self.game.state['currentBet']['responses'][player_index] = 'accept'
            
            # Check if team responded
            opponent_players = self.game.state['teams'][opponent_team]['players']
            all_responded = all(
                p in self.game.state['currentBet']['responses']
                for p in opponent_players
            )
            
            if all_responded:
                # Reveal and score
                result = self._reveal_and_score()
                return result
            else:
                self.game.next_player()
                return {'success': True}
        
        elif action == 'envido' or action == 'raise':
            # Raise bet
            bet_amount = extra_data.get('amount', 2) if extra_data else 2
            self.game.state['currentBet']['amount'] = bet_amount
            self.game.state['currentBet']['bettingTeam'] = player_team
            self.game.state['currentBet']['betType'] = 'envido'
            self.game.state['currentBet']['responses'] = {}
            
            # Opponent must respond
            opponent_players = self.game.state['teams'][opponent_team]['players']
            self.game.state['activePlayerIndex'] = opponent_players[0]
            
            logger.info(f"Player {player_index} raised to {bet_amount}")
            return {'success': True}
        
        elif action == 'ordago':
            # All-in
            self.game.state['currentBet']['betType'] = 'ordago'
            self.game.state['currentBet']['bettingTeam'] = player_team
            self.game.state['currentBet']['amount'] = 40  # Win the game
            self.game.state['currentBet']['responses'] = {}
            
            opponent_players = self.game.state['teams'][opponent_team]['players']
            self.game.state['activePlayerIndex'] = opponent_players[0]
            
            logger.info(f"Player {player_index} went ORDAGO!")
            return {'success': True}
        
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
