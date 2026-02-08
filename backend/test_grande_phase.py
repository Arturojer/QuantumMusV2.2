"""
Test script for Grande Phase Betting Dynamics
Demonstrates the detailed Mus betting rules implementation
"""

import logging
from game_logic import QuantumMusGame

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)


def print_separator(title=""):
    """Print a visual separator"""
    if title:
        print(f"\n{'='*60}")
        print(f"  {title}")
        print(f"{'='*60}\n")
    else:
        print(f"\n{'-'*60}\n")


def print_game_state(game):
    """Print current game state"""
    state = game.state
    print(f"Current Round: {state['currentRound']}")
    print(f"Mano (Player {state['manoIndex']}): Team {game.get_player_team(state['manoIndex'])}")
    print(f"Active Player: {state['activePlayerIndex']}")
    print(f"Team 1 Score: {state['teams']['team1']['score']}")
    print(f"Team 2 Score: {state['teams']['team2']['score']}")
    
    if state.get('grandePhase'):
        gp = state['grandePhase']
        print(f"\nGrande Phase State: {gp.get('phaseState', 'N/A')}")
        if gp.get('attackingTeam'):
            print(f"Attacking Team: {gp['attackingTeam']}")
            print(f"Defending Team: {gp['defendingTeam']}")
            print(f"Current Bet: {gp['currentBetAmount']} points ({gp.get('betType', 'N/A')})")


def test_scenario_1_all_pass():
    """Test Scenario 1: All four players pass - no bet"""
    print_separator("SCENARIO 1: All Four Players Pass")
    
    players = [
        {'username': 'Player0', 'id': 0},
        {'username': 'Player1', 'id': 1},
        {'username': 'Player2', 'id': 2},
        {'username': 'Player3', 'id': 3}
    ]
    
    game = QuantumMusGame('test_room_1', players, '4')
    game.deal_cards()
    
    # Skip MUS phase - go directly to GRANDE
    game.state['currentRound'] = 'GRANDE'
    game.round_handler.grande_handler.initialize_grande_phase()
    
    print("Initial state:")
    print_game_state(game)
    
    # All players pass
    print("\n--- Player 0 (Mano) passes ---")
    result = game.process_action(0, 'paso')
    print(f"Result: {result}")
    
    print("\n--- Player 1 passes ---")
    result = game.process_action(1, 'paso')
    print(f"Result: {result}")
    
    print("\n--- Player 2 passes ---")
    result = game.process_action(2, 'paso')
    print(f"Result: {result}")
    
    print("\n--- Player 3 passes ---")
    result = game.process_action(3, 'paso')
    print(f"Result: {result}")
    
    print("\nFinal state:")
    print_game_state(game)
    
    if result.get('grande_ended'):
        print("\n✓ Grande phase ended correctly")
        print(f"✓ Comparison deferred: {result.get('comparison_deferred', False)}")
        print(f"✓ Points at stake: {result.get('points_at_stake', 0)}")


def test_scenario_2_bet_and_reject():
    """Test Scenario 2: Player 1 bets, both defenders reject"""
    print_separator("SCENARIO 2: Bet Placed, Both Defenders Reject")
    
    players = [
        {'username': 'Player0', 'id': 0},
        {'username': 'Player1', 'id': 1},
        {'username': 'Player2', 'id': 2},
        {'username': 'Player3', 'id': 3}
    ]
    
    game = QuantumMusGame('test_room_2', players, '4')
    game.deal_cards()
    
    # Skip to GRANDE
    game.state['currentRound'] = 'GRANDE'
    game.round_handler.grande_handler.initialize_grande_phase()
    
    print("Initial state:")
    print_game_state(game)
    
    # Mano (Player 0) passes
    print("\n--- Player 0 (Mano) passes ---")
    result = game.process_action(0, 'paso')
    print(f"Result: {result}")
    
    # Player 1 (Team 2) places bet
    print("\n--- Player 1 (Team 2) bets 5 points ---")
    result = game.process_action(1, 'envido', {'amount': 5})
    print(f"Result: {result}")
    print_game_state(game)
    
    # Player 2 (Team 1, first defender) rejects
    print("\n--- Player 2 (Team 1, defender) rejects ---")
    result = game.process_action(2, 'paso')
    print(f"Result: {result}")
    
    # Player 0 (Team 1, partner) must respond
    print("\n--- Player 0 (Team 1, partner) rejects ---")
    result = game.process_action(0, 'paso')
    print(f"Result: {result}")
    
    print("\nFinal state:")
    print_game_state(game)
    
    if result.get('grande_ended'):
        print("\n✓ Grande phase ended correctly")
        print(f"✓ Winner: {result.get('winner_team')}")
        print(f"✓ Points awarded: {result.get('points')}")
        print(f"✓ Reason: {result.get('reason')}")


def test_scenario_3_bet_and_accept():
    """Test Scenario 3: Player bets, opponent accepts"""
    print_separator("SCENARIO 3: Bet Placed and Accepted")
    
    players = [
        {'username': 'Player0', 'id': 0},
        {'username': 'Player1', 'id': 1},
        {'username': 'Player2', 'id': 2},
        {'username': 'Player3', 'id': 3}
    ]
    
    game = QuantumMusGame('test_room_3', players, '4')
    game.deal_cards()
    
    # Skip to GRANDE
    game.state['currentRound'] = 'GRANDE'
    game.round_handler.grande_handler.initialize_grande_phase()
    
    print("Initial state:")
    print_game_state(game)
    
    # Player 0 (Mano, Team 1) bets
    print("\n--- Player 0 (Mano, Team 1) bets 10 points ---")
    result = game.process_action(0, 'envido', {'amount': 10})
    print(f"Result: {result}")
    print_game_state(game)
    
    # Player 1 (Team 2, first defender) accepts
    print("\n--- Player 1 (Team 2, defender) accepts ---")
    result = game.process_action(1, 'accept')
    print(f"Result: {result}")
    
    print("\nFinal state:")
    print_game_state(game)
    
    if result.get('grande_ended'):
        print("\n✓ Grande phase ended correctly")
        print(f"✓ Bet accepted: {result.get('bet_accepted')}")
        print(f"✓ Bet amount: {result.get('bet_amount')} points")
        print(f"✓ Comparison deferred: {result.get('comparison_deferred')}")


def test_scenario_4_raise():
    """Test Scenario 4: Player bets, opponent raises, original bettor accepts"""
    print_separator("SCENARIO 4: Bet, Raise, Accept")
    
    players = [
        {'username': 'Player0', 'id': 0},
        {'username': 'Player1', 'id': 1},
        {'username': 'Player2', 'id': 2},
        {'username': 'Player3', 'id': 3}
    ]
    
    game = QuantumMusGame('test_room_4', players, '4')
    game.deal_cards()
    
    # Skip to GRANDE
    game.state['currentRound'] = 'GRANDE'
    game.round_handler.grande_handler.initialize_grande_phase()
    
    print("Initial state:")
    print_game_state(game)
    
    # Player 0 (Mano, Team 1) bets
    print("\n--- Player 0 (Mano, Team 1) bets 5 points ---")
    result = game.process_action(0, 'envido', {'amount': 5})
    print(f"Result: {result}")
    print_game_state(game)
    
    # Player 1 (Team 2, defender) raises
    print("\n--- Player 1 (Team 2, defender) raises to 15 points ---")
    result = game.process_action(1, 'envido', {'amount': 15})
    print(f"Result: {result}")
    print_game_state(game)
    
    # Player 0 (Team 1, now defender) accepts
    print("\n--- Player 0 (Team 1, now defender) accepts ---")
    result = game.process_action(0, 'accept')
    print(f"Result: {result}")
    
    print("\nFinal state:")
    print_game_state(game)
    
    if result.get('grande_ended'):
        print("\n✓ Grande phase ended correctly")
        print(f"✓ Bet accepted: {result.get('bet_accepted')}")
        print(f"✓ Final bet amount: {result.get('bet_amount')} points")


def test_scenario_5_ordago():
    """Test Scenario 5: Player calls Órdago, opponent accepts"""
    print_separator("SCENARIO 5: Órdago (All-in)")
    
    players = [
        {'username': 'Player0', 'id': 0},
        {'username': 'Player1', 'id': 1},
        {'username': 'Player2', 'id': 2},
        {'username': 'Player3', 'id': 3}
    ]
    
    game = QuantumMusGame('test_room_5', players, '4')
    game.deal_cards()
    
    # Skip to GRANDE
    game.state['currentRound'] = 'GRANDE'
    game.round_handler.grande_handler.initialize_grande_phase()
    
    print("Initial state:")
    print_game_state(game)
    
    # Player 0 passes
    print("\n--- Player 0 (Mano) passes ---")
    result = game.process_action(0, 'paso')
    print(f"Result: {result}")
    
    # Player 1 calls ÓRDAGO
    print("\n--- Player 1 (Team 2) calls ÓRDAGO! ---")
    result = game.process_action(1, 'ordago')
    print(f"Result: {result}")
    print_game_state(game)
    
    # Player 2 (Team 1, defender) accepts
    print("\n--- Player 2 (Team 1, defender) accepts ÓRDAGO ---")
    result = game.process_action(2, 'accept')
    print(f"Result: {result}")
    
    print("\nFinal state:")
    print_game_state(game)
    
    if result.get('grande_ended'):
        print("\n✓ Grande phase ended correctly")
        print(f"✓ Órdago accepted!")
        print(f"✓ Bet amount: {result.get('bet_amount')} points (game on the line!)")


def main():
    """Run all test scenarios"""
    print("\n")
    print("="*70)
    print("  GRANDE PHASE BETTING DYNAMICS - TEST SUITE")
    print("  Mus Rules Implementation Verification")
    print("="*70)
    
    try:
        test_scenario_1_all_pass()
        print_separator()
        
        test_scenario_2_bet_and_reject()
        print_separator()
        
        test_scenario_3_bet_and_accept()
        print_separator()
        
        test_scenario_4_raise()
        print_separator()
        
        test_scenario_5_ordago()
        print_separator()
        
        print("\n" + "="*70)
        print("  ALL TESTS COMPLETED SUCCESSFULLY!")
        print("="*70 + "\n")
        
    except Exception as e:
        logger.error(f"Test failed with error: {e}", exc_info=True)
        raise


if __name__ == '__main__':
    main()
