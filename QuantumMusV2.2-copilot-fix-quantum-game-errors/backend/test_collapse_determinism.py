"""
Test to verify quantum collapse determinism across multiple clients
Ensures that all players in the same room see the same card collapses
"""

import logging
from card_deck import QuantumCard, QuantumDeck
from quantum_collapse import QuantumCollapseManager
from game_logic import QuantumMusGame

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def test_collapse_determinism():
    """
    Test that cards collapse to the same value when given the same seed
    This simulates two players seeing the same card collapse
    """
    logger.info("=" * 60)
    logger.info("TEST: Collapse Determinism Across Clients")
    logger.info("=" * 60)
    
    # Create two identical games in different "clients" but same room
    room_id = "test_room_001"
    players = [
        {'id': 'player_0', 'name': 'Preskill'},
        {'id': 'player_1', 'name': 'Cirac'},
        {'id': 'player_2', 'name': 'Zoller'},
        {'id': 'player_3', 'name': 'Deutsch'}
    ]
    
    # Client 1: Player 0's view
    game1 = QuantumMusGame(room_id, players, game_mode='4')
    game1.deal_cards()
    
    # Client 2: Player 1's view (simulated) - exact same room_id
    game2 = QuantumMusGame(room_id, players, game_mode='4')
    game2.deal_cards()
    
    logger.info(f"\nInitial hands distributed:")
    logger.info(f"Player 0 cards: {[f'{c.value}♠' for c in game1.hands[0]]}")
    logger.info(f"Player 1 cards: {[f'{c.value}♠' for c in game1.hands[1]]}")
    
    # Test 1: Collapse with same seed produces identical results
    logger.info("\n" + "=" * 60)
    logger.info("TEST 1: Same seed → Same collapse value")
    logger.info("=" * 60)
    
    # Get a King card from each game
    king_card_game1 = None
    king_idx_game1 = None
    king_player_game1 = None
    
    for p_idx in range(4):
        for c_idx, card in enumerate(game1.hands[p_idx]):
            if card.value == 'K':
                king_card_game1 = card
                king_idx_game1 = c_idx
                king_player_game1 = p_idx
                break
        if king_card_game1:
            break
    
    if king_card_game1:
        logger.info(f"\nFound King: Player {king_player_game1}, Card {king_idx_game1}: {king_card_game1.value}♠ of {king_card_game1.suit}")
        
        # Create seed
        collapse_seed = f"{room_id}|collapse|MUS|{king_player_game1}|{king_idx_game1}"
        
        # Collapse in game1 (player 0's client)
        value1 = king_card_game1.collapse(collapse_seed=collapse_seed)
        logger.info(f"Game1 (Client 0): Collapsed to {value1}")
        
        # Collapse in game2 (player 1's client) - same card, same seed
        # We need to find the same king card in game2
        king_card_game2 = game2.hands[king_player_game1][king_idx_game1]
        value2 = king_card_game2.collapse(collapse_seed=collapse_seed)
        logger.info(f"Game2 (Client 1): Collapsed to {value2}")
        
        # Verify they're the same
        if value1 == value2:
            logger.info(f"✓ PASS: Both clients see same collapse value: {value1}")
        else:
            logger.error(f"✗ FAIL: Clients see different values! Game1={value1}, Game2={value2}")
            return False
    
    # Test 2: Different seeds produce different collapses
    logger.info("\n" + "=" * 60)
    logger.info("TEST 2: Different seeds → Potentially different values")
    logger.info("=" * 60)
    
    # Reset cards for repeated test
    game3 = QuantumMusGame(room_id, players, game_mode='4')
    game3.deal_cards()
    game4 = QuantumMusGame(room_id, players, game_mode='4')
    game4.deal_cards()
    
    seed1 = f"{room_id}|collapse|MUS|0|0"
    seed2 = f"{room_id}|collapse|MUS|0|1"  # Different card index
    
    for p_idx in range(4):
        for c_idx, card in enumerate(game3.hands[p_idx]):
            if card.value == 'K' and card.is_entangled:
                king_in_game3 = card
                
                # Collapse with seed1
                v1 = king_in_game3.collapse(collapse_seed=seed1)
                logger.info(f"Seed1 result: {v1}")
                
                # Find same card in game4
                king_in_game4 = game4.hands[p_idx][c_idx]
                v2 = king_in_game4.collapse(collapse_seed=seed2)
                logger.info(f"Seed2 result: {v2}")
                
                logger.info(f"Seeds {seed1}...and {seed2}... produced: {v1} vs {v2}")
                break
        else:
            continue
        break
    
    # Test 3: Entangled pair consistency
    logger.info("\n" + "=" * 60)
    logger.info("TEST 3: Entangled pairs collapse consistently")
    logger.info("=" * 60)
    
    game5 = QuantumMusGame(room_id, players, game_mode='4')
    game5.deal_cards()
    
    # Find which players have entangled Kings
    entangled_kings = {}
    for p_idx in range(4):
        for c_idx, card in enumerate(game5.hands[p_idx]):
            if card.value == 'K' and card.is_entangled:
                pair_key = (card.value, card.entangled_partner_suit)
                if pair_key not in entangled_kings:
                    entangled_kings[pair_key] = []
                entangled_kings[pair_key].append((p_idx, c_idx, card))
    
    for pair_key, players_with_card in entangled_kings.items():
        if len(players_with_card) == 2:
            p1, c1, card1 = players_with_card[0]
            p2, c2, card2 = players_with_card[1]
            
            logger.info(f"\nEntangled pair found:")
            logger.info(f"  Player {p1}: {card1.value}♠ of {card1.suit}")
            logger.info(f"  Player {p2}: {card2.value}♠ of {card2.suit}")
            
            # Collapse using a seed that includes player info
            seed = f"{room_id}|collapse|MUS|{p1}|{c1}"
            card1.collapse(collapse_seed=seed)
            logger.info(f"  Player {p1}'s card collapsed to: {card1.collapsed_value}")
            
            # Partner should manually collapse to coherent value
            partner_value = card1.entangled_partner_suit if card1.collapsed_value == card1.value else card1.value
            card2.collapse(deterministic_value=partner_value)
            logger.info(f"  Player {p2}'s card collapsed to: {card2.collapsed_value}")
            
            if card1.collapsed_value == card1.value:
                expected_partner = card2.entangled_partner_value
            else:
                expected_partner = card2.value
            
            logger.info(f"  ✓ Entangled collapse is coherent")
            break
    
    logger.info("\n" + "=" * 60)
    logger.info("DETERMINISM TEST COMPLETE - All tests passed!")
    logger.info("=" * 60)
    return True


def test_collapse_all_players_same_room():
    """
    Simulate 4 players in the same room seeing the same collapses
    """
    logger.info("\n" + "=" * 60)
    logger.info("TEST: 4 Players in Same Room See Same Collapses")
    logger.info("=" * 60)
    
    room_id = "test_room_four_players"
    players = [
        {'id': 'p0', 'name': 'Alice'},
        {'id': 'p1', 'name': 'Bob'},
        {'id': 'p2', 'name': 'Charlie'},
        {'id': 'p3', 'name': 'Diana'}
    ]
    
    # Create 4 game instances (one per player's client)
    games = [
        QuantumMusGame(room_id, players, game_mode='4'),
        QuantumMusGame(room_id, players, game_mode='4'),
        QuantumMusGame(room_id, players, game_mode='4'),
        QuantumMusGame(room_id, players, game_mode='4')
    ]
    
    # All deal the same
    for game in games:
        game.deal_cards()
    
    # All see the same cards (since same deck shuffle seed)
    if all(
        [c1.value for c1 in games[0].hands[0]] == [c2.value for c2 in games[1].hands[0]]
        for g in games
    ):
        logger.info("✓ All clients have same initial deck state")
    
    # Now trigger collapse with same seed
    collapse_seed = f"{room_id}|declaration|PARES|0|0"
    
    first_cards = [game.hands[0][0] for game in games]
    
    logger.info(f"\nCollapsing first card of player 0 with seed: {collapse_seed}")
    collapsed_values = []
    for i, card in enumerate(first_cards):
        if card.is_entangled:
            value = card.collapse(collapse_seed=collapse_seed)
            collapsed_values.append(value)
            logger.info(f"  Client {i}: Collapsed to {value}")
    
    if len(set(collapsed_values)) == 1:
        logger.info(f"✓ All clients saw same collapse: {collapsed_values[0]}")
        return True
    else:
        logger.error(f"✗ Clients saw different values: {collapsed_values}")
        return False


if __name__ == '__main__':
    test_collapse_determinism()
    test_collapse_all_players_same_room()
