"""
Quantum Collapse System for Quantum Mus
Handles the collapse of entangled cards and associated penalties
"""

import logging
import hashlib

logger = logging.getLogger(__name__)


class CollapseEvent:
    """Represents a collapse event"""
    
    def __init__(self, trigger_type, player_index, round_name):
        """
        trigger_type: 'declaration', 'bet_acceptance', 'final_reveal'
        player_index: Player who triggered the collapse
        round_name: 'PARES' or 'JUEGO' or 'FINAL'
        """
        self.trigger_type = trigger_type
        self.player_index = player_index
        self.round_name = round_name
        self.collapsed_cards = []  # List of (player_idx, card_idx, old_value, new_value)
        self.penalties = []  # List of (player_idx, penalty_amount, reason)
    
    def to_dict(self):
        return {
            'trigger_type': self.trigger_type,
            'player_index': self.player_index,
            'round_name': self.round_name,
            'collapsed_cards': self.collapsed_cards,
            'penalties': self.penalties
        }


class QuantumCollapseManager:
    """Manages quantum collapse events in the game"""
    
    def __init__(self, game):
        self.game = game
        self.collapse_history = []  # Track all collapses
    
    def find_entangled_card_in_hand(self, player_index, original_value, partner_value):
        """Find an entangled card in a player's hand"""
        hand = self.game.hands[player_index]
        for idx, card in enumerate(hand):
            if (card.is_entangled and 
                not card.is_collapsed and
                card.value in [original_value, partner_value]):
                return idx, card
        return None, None
    
    def collapse_entangled_pair(self, player_index, card_index, chosen_value=None):
        """
        Collapse a card and its entangled partner
        Returns: CollapseEvent object
        """
        card = self.game.hands[player_index][card_index]
        
        if not card.is_entangled or card.is_collapsed:
            return None
        
        # Generate deterministic seed for this collapse
        # This ensures all clients in the game collapse the same way
        collapse_seed = f"{self.game.room_id}|collapse|{self.game.state['currentRound']}|{player_index}|{card_index}"
        
        # Determine which value this card will collapse to
        if chosen_value:
            collapsed_value = chosen_value
            partner_collapsed_value = card.entangled_partner_value if chosen_value == card.value else card.value
        else:
            # Use deterministic collapse with seed
            collapsed_value = card.collapse(collapse_seed=collapse_seed)
            partner_collapsed_value = card.entangled_partner_value if collapsed_value == card.value else card.value
        
        # Set collapse reason
        card.collapse_reason = 'player_declaration'
        
        old_value = card.value
        event = CollapseEvent('manual', player_index, self.game.state['currentRound'])
        event.collapsed_cards.append((player_index, card_index, old_value, collapsed_value))
        
        # Find and collapse the entangled partner in other players' hands
        for other_player in range(4):
            if other_player == player_index:
                continue
            
            partner_idx, partner_card = self.find_entangled_card_in_hand(
                other_player,
                card.value,
                card.entangled_partner_value
            )
            
            if partner_card:
                old_partner_value = partner_card.value
                # Partner must collapse to the opposite value (quantum entanglement)
                partner_card.collapse(deterministic_value=partner_collapsed_value)
                partner_card.collapse_reason = 'entanglement_with_player_' + str(player_index)
                event.collapsed_cards.append((other_player, partner_idx, old_partner_value, partner_collapsed_value))
                logger.info(f"Collapsed partner card: Player {other_player}, Card {partner_idx}: {old_partner_value} -> {partner_collapsed_value}")
                break
        
        self.collapse_history.append(event)
        return event
    
    def collapse_on_declaration(self, player_index, declaration, round_name):
        """
        Collapse all entangled cards when player makes a declaration
        declaration: 'tengo' or 'no_tengo'
        round_name: 'PARES' or 'JUEGO'
        Returns: (CollapseEvent, penalty_points)
        """
        event = CollapseEvent('declaration', player_index, round_name)
        penalty_points = 0
        
        hand = self.game.hands[player_index]
        
        # Collapse all entangled cards in this player's hand
        for idx, card in enumerate(hand):
            if card.is_entangled and not card.is_collapsed:
                # Generate deterministic seed for this collapse
                collapse_seed = f"{self.game.room_id}|declaration|{round_name}|{player_index}|{idx}"
                
                old_value = card.value
                new_value = card.collapse(collapse_seed=collapse_seed)
                card.collapse_reason = f'declaration_{declaration}_in_{round_name}'
                event.collapsed_cards.append((player_index, idx, old_value, new_value))
                
                # Find and collapse partner
                for other_player in range(4):
                    if other_player == player_index:
                        continue
                    
                    partner_idx, partner_card = self.find_entangled_card_in_hand(
                        other_player,
                        card.value,
                        card.entangled_partner_value
                    )
                    
                    if partner_card:
                        old_partner = partner_card.value
                        # Partner collapses to the opposite value
                        partner_value = card.entangled_partner_value if new_value == old_value else old_value
                        partner_card.collapse(deterministic_value=partner_value)
                        partner_card.collapse_reason = f'entanglement_with_declaration'
                        event.collapsed_cards.append((other_player, partner_idx, old_partner, partner_value))
                        break
        
        # Check if prediction was correct
        has_what_predicted = self._check_hand_after_collapse(player_index, round_name)
        
        if declaration == 'tengo' and not has_what_predicted:
            penalty_points = -1
            event.penalties.append((player_index, -1, f"Predicción incorrecta en {round_name}"))
            logger.info(f"Player {player_index} incurred -1 penalty for wrong {round_name} prediction")
        elif declaration == 'no_tengo' and has_what_predicted:
            penalty_points = -1
            event.penalties.append((player_index, -1, f"Predicción incorrecta en {round_name}"))
            logger.info(f"Player {player_index} incurred -1 penalty for wrong {round_name} prediction")
        
        self.collapse_history.append(event)
        return event, penalty_points
    
    def collapse_on_bet_acceptance(self, player_index, round_name):
        """
        Collapse when a player accepts/makes a bet after saying 'puede'
        No penalty in this case
        """
        event = CollapseEvent('bet_acceptance', player_index, round_name)
        hand = self.game.hands[player_index]
        
        # Collapse all entangled cards
        for idx, card in enumerate(hand):
            if card.is_entangled and not card.is_collapsed:
                # Generate deterministic seed
                collapse_seed = f"{self.game.room_id}|bet_acceptance|{round_name}|{player_index}|{idx}"
                
                old_value = card.value
                new_value = card.collapse(collapse_seed=collapse_seed)
                card.collapse_reason = f'bet_acceptance_in_{round_name}'
                event.collapsed_cards.append((player_index, idx, old_value, new_value))
                
                # Find and collapse partner
                for other_player in range(4):
                    if other_player == player_index:
                        continue
                    
                    partner_idx, partner_card = self.find_entangled_card_in_hand(
                        other_player,
                        card.value,
                        card.entangled_partner_value
                    )
                    
                    if partner_card:
                        old_partner = partner_card.value
                        partner_value = card.entangled_partner_value if new_value == old_value else old_value
                        partner_card.collapse(deterministic_value=partner_value)
                        partner_card.collapse_reason = f'entanglement_with_bet'
                        event.collapsed_cards.append((other_player, partner_idx, old_partner, partner_value))
                        break
        
        self.collapse_history.append(event)
        return event
    
    def collapse_all_remaining(self):
        """
        Collapse all remaining entangled cards at the end of the hand
        """
        event = CollapseEvent('final_reveal', -1, 'FINAL')
        
        for player_idx in range(4):
            hand = self.game.hands[player_idx]
            for idx, card in enumerate(hand):
                if card.is_entangled and not card.is_collapsed:
                    # Generate deterministic seed for final collapse
                    collapse_seed = f"{self.game.room_id}|final_reveal|{self.game.state['manoIndex']}|{player_idx}|{idx}"
                    
                    old_value = card.value
                    new_value = card.collapse(collapse_seed=collapse_seed)
                    card.collapse_reason = 'final_reveal'
                    event.collapsed_cards.append((player_idx, idx, old_value, new_value))
        
        self.collapse_history.append(event)
        return event
    
    def _check_hand_after_collapse(self, player_index, round_name):
        """
        Check if player has what they declared after collapse
        round_name: 'PARES' or 'JUEGO'
        """
        hand = self.game.hands[player_index]
        card_values = [card.value for card in hand]
        
        if round_name == 'PARES':
            return self._has_pares(card_values)
        elif round_name == 'JUEGO':
            return self._has_juego(card_values)
        
        return False
    
    def _has_pares(self, card_values):
        """Check if hand has pares (pairs)"""
        value_counts = {}
        for value in card_values:
            value_counts[value] = value_counts.get(value, 0) + 1
        
        # Pares = at least one pair
        return any(count >= 2 for count in value_counts.values())
    
    def _has_juego(self, card_values):
        """Check if hand has juego (31 or more points)"""
        points = 0
        for value in card_values:
            if value == 'K':
                points += 10
            elif value == 'Q':
                points += 10
            elif value == 'J':
                points += 10
            elif value in ['A', '2', '3']:
                points += 1
            else:
                try:
                    points += int(value)
                except:
                    points += 0
        
        return points >= 31
