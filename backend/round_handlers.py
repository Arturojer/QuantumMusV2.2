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
        self.chica_handler = GenericBettingHandler(game, 'CHICA')
        self.pares_handler = GenericBettingHandler(game, 'PARES')
        self.juego_handler = GenericBettingHandler(game, 'JUEGO')

    def _player_has_pares(self, player_index):
        hand = self.game.hands.get(player_index, [])
        value_counts = {}
        for card in hand:
            value = getattr(card, 'value', None)
            if value is None and isinstance(card, dict):
                value = card.get('value')
            if value is None:
                continue
            value_counts[value] = value_counts.get(value, 0) + 1
        return any(count >= 2 for count in value_counts.values())

    def _is_player_eligible_for_round(self, player_index):
        if self.game.state['currentRound'] != 'PARES':
            return True
        return self._player_has_pares(player_index)

    def _get_next_player_in_turn(self, start_index, team=None, require_eligible=False, skipped=None):
        skipped = skipped or set()
        current_index = start_index
        for _ in range(self.game.num_players):
            current_index = self.game.get_next_player_index(current_index)
            if team and current_index not in self.game.state['teams'][team]['players']:
                continue
            if require_eligible and not self._is_player_eligible_for_round(current_index):
                continue
            if current_index in skipped:
                continue
            return current_index
        return None
    
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
                self.game.state['roundActions'] = {}
                logger.info("All players chose MUS - starting discard phase")

                return {
                    'success': True,
                    'discard_phase': True,
                    'waiting_for_discard': True
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
        
        current_round = self.game.state['currentRound']
        
        # Route to the appropriate betting handler based on the current round
        if current_round == 'GRANDE':
            handler = self.grande_handler
        elif current_round == 'CHICA':
            handler = self.chica_handler
        elif current_round == 'PARES':
            handler = self.pares_handler
        elif current_round == 'JUEGO':
            handler = self.juego_handler
        else:
            logger.error(f"Invalid round for betting: {current_round}")
            return {'success': False, 'error': f'Invalid round: {current_round}'}
        
        # Call the appropriate handler's handle_action method
        result = handler.handle_action(player_index, action, extra_data)
        
        # Check if we need to move to the next round
        if result.get('success') and result.get('move_to_next_round'):
            # Clear the move_to_next_round flag before moving
            result.pop('move_to_next_round', None)
            
            # Move to next round
            hand_ended = self.game.move_to_next_round()
            result['hand_ended'] = hand_ended
            
            # Check win condition
            if not hand_ended:
                win_check = self.game.check_win_condition()
                result.update(win_check)
        
        return result
