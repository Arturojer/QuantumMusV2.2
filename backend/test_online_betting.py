"""
Test Online Mode Betting Dynamics
Tests that betting and corto mus work correctly in online mode up to PARES round
"""

import logging
from game_logic import QuantumMusGame

logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)


def test_corto_mus_with_paso():
    """Test cutting mus with paso (no bet)"""
    print("\n=== TEST 1: Corto Mus with PASO ===")
    
    players = [
        {'username': 'Player0', 'id': 0, 'team': 1},
        {'username': 'Player1', 'id': 1, 'team': 2},
        {'username': 'Player2', 'id': 2, 'team': 1},
        {'username': 'Player3', 'id': 3, 'team': 2}
    ]
    
    game = QuantumMusGame('test1', players, '4')
    game.deal_cards()
    
    # Player 0 cuts mus with paso
    result = game.process_action(0, 'paso')
    assert result['success'], "Corto mus with paso should succeed"
    assert game.state['currentRound'] == 'GRANDE', "Should transition to GRANDE"
    assert game.state['grandePhase']['phaseState'] == 'NO_BET', "Should have no bet"
    assert game.state['activePlayerIndex'] == 0, "Mano should be active"
    
    print("✓ Corto mus with paso works correctly")
    return True


def test_corto_mus_with_envido():
    """Test cutting mus with envido (with bet)"""
    print("\n=== TEST 2: Corto Mus with ENVIDO ===")
    
    players = [
        {'username': 'Player0', 'id': 0, 'team': 1},
        {'username': 'Player1', 'id': 1, 'team': 2},
        {'username': 'Player2', 'id': 2, 'team': 1},
        {'username': 'Player3', 'id': 3, 'team': 2}
    ]
    
    game = QuantumMusGame('test2', players, '4')
    game.deal_cards()
    
    # Player 0 cuts mus with envido
    result = game.process_action(0, 'envido', {'amount': 5})
    assert result['success'], "Corto mus with envido should succeed"
    assert game.state['currentRound'] == 'GRANDE', "Should transition to GRANDE"
    assert game.state['grandePhase']['phaseState'] == 'BET_PLACED', "Should have bet placed"
    assert game.state['grandePhase']['attackingTeam'] == 'team1', "Team1 should be attacking"
    assert game.state['grandePhase']['currentBetAmount'] == 5, "Bet should be 5"
    assert game.state['activePlayerIndex'] in [1, 3], "First defender should be active"
    
    print("✓ Corto mus with envido works correctly")
    return True


def test_grande_all_pass():
    """Test all players pass in GRANDE"""
    print("\n=== TEST 3: GRANDE All Pass ===")
    
    players = [
        {'username': 'Player0', 'id': 0, 'team': 1},
        {'username': 'Player1', 'id': 1, 'team': 2},
        {'username': 'Player2', 'id': 2, 'team': 1},
        {'username': 'Player3', 'id': 3, 'team': 2}
    ]
    
    game = QuantumMusGame('test3', players, '4')
    game.deal_cards()
    game.state['currentRound'] = 'GRANDE'
    game.round_handler.grande_handler.initialize_grande_phase()
    
    # All players pass
    game.process_action(0, 'paso')  # Mano
    game.process_action(3, 'paso')  # Next counterclockwise
    game.process_action(2, 'paso')  # Next counterclockwise
    result = game.process_action(1, 'paso')  # Last player
    
    assert result['success'], "All pass should succeed"
    assert result.get('grande_ended'), "Grande should end"
    assert result.get('all_passed'), "Should indicate all passed"
    assert game.state['currentRound'] == 'CHICA', "Should move to CHICA"
    
    print("✓ GRANDE all pass works correctly")
    return True


def test_grande_betting_accept():
    """Test betting and acceptance in GRANDE"""
    print("\n=== TEST 4: GRANDE Betting and Accept ===")
    
    players = [
        {'username': 'Player0', 'id': 0, 'team': 1},
        {'username': 'Player1', 'id': 1, 'team': 2},
        {'username': 'Player2', 'id': 2, 'team': 1},
        {'username': 'Player3', 'id': 3, 'team': 2}
    ]
    
    game = QuantumMusGame('test4', players, '4')
    game.deal_cards()
    game.state['currentRound'] = 'GRANDE'
    game.round_handler.grande_handler.initialize_grande_phase()
    
    # Player 0 bets
    result = game.process_action(0, 'envido', {'amount': 10})
    assert result['success'], "Betting should succeed"
    assert result.get('bet_placed'), "Bet should be placed"
    
    # First defender accepts
    active = game.state['activePlayerIndex']
    result = game.process_action(active, 'accept')
    assert result['success'], "Accept should succeed"
    assert result.get('grande_ended'), "Grande should end"
    assert result.get('bet_accepted'), "Bet should be accepted"
    assert game.state['currentRound'] == 'CHICA', "Should move to CHICA"
    
    print("✓ GRANDE betting and accept works correctly")
    return True


def test_grande_betting_reject():
    """Test betting and rejection in GRANDE"""
    print("\n=== TEST 5: GRANDE Betting and Reject ===")
    
    players = [
        {'username': 'Player0', 'id': 0, 'team': 1},
        {'username': 'Player1', 'id': 1, 'team': 2},
        {'username': 'Player2', 'id': 2, 'team': 1},
        {'username': 'Player3', 'id': 3, 'team': 2}
    ]
    
    game = QuantumMusGame('test5', players, '4')
    game.deal_cards()
    game.state['currentRound'] = 'GRANDE'
    game.round_handler.grande_handler.initialize_grande_phase()
    
    # Player 0 passes
    game.process_action(0, 'paso')
    
    # Player 3 bets
    result = game.process_action(3, 'envido', {'amount': 5})
    assert result['success'], "Betting should succeed"
    
    # First defender (player 2) rejects
    result = game.process_action(2, 'paso')
    assert result['success'], "First rejection should succeed"
    
    # Second defender (player 0) rejects
    result = game.process_action(0, 'paso')
    assert result['success'], "Second rejection should succeed"
    assert result.get('round_ended'), "Round should end"
    assert result.get('winner_team') == 'team2', "Team2 should win"
    assert game.state['currentRound'] == 'CHICA', "Should move to CHICA"
    
    print("✓ GRANDE betting and reject works correctly")
    return True


def test_chica_all_pass():
    """Test all players pass in CHICA"""
    print("\n=== TEST 6: CHICA All Pass ===")
    
    players = [
        {'username': 'Player0', 'id': 0, 'team': 1},
        {'username': 'Player1', 'id': 1, 'team': 2},
        {'username': 'Player2', 'id': 2, 'team': 1},
        {'username': 'Player3', 'id': 3, 'team': 2}
    ]
    
    game = QuantumMusGame('test6', players, '4')
    game.deal_cards()
    game.state['currentRound'] = 'CHICA'
    game.round_handler.chica_handler.initialize_round()
    
    # All players pass
    game.process_action(0, 'paso')
    game.process_action(3, 'paso')
    game.process_action(2, 'paso')
    result = game.process_action(1, 'paso')
    
    assert result['success'], "All pass should succeed"
    assert result.get('round_ended'), "Round should end"
    assert game.state['currentRound'] == 'PARES', "Should move to PARES"
    
    print("✓ CHICA all pass works correctly")
    return True


def test_pares_all_pass():
    """Test all players pass in PARES"""
    print("\n=== TEST 7: PARES All Pass ===")
    
    players = [
        {'username': 'Player0', 'id': 0, 'team': 1},
        {'username': 'Player1', 'id': 1, 'team': 2},
        {'username': 'Player2', 'id': 2, 'team': 1},
        {'username': 'Player3', 'id': 3, 'team': 2}
    ]
    
    game = QuantumMusGame('test7', players, '4')
    game.deal_cards()
    game.state['currentRound'] = 'PARES'
    game.round_handler.pares_handler.initialize_round()
    
    # All players pass
    game.process_action(0, 'paso')
    game.process_action(3, 'paso')
    game.process_action(2, 'paso')
    result = game.process_action(1, 'paso')
    
    assert result['success'], "All pass should succeed"
    assert result.get('round_ended'), "Round should end"
    assert game.state['currentRound'] == 'JUEGO', "Should move to JUEGO"
    
    print("✓ PARES all pass works correctly")
    return True


def test_full_flow():
    """Test complete flow from MUS to PARES"""
    print("\n=== TEST 8: Full Flow MUS → GRANDE → CHICA → PARES ===")
    
    players = [
        {'username': 'Player0', 'id': 0, 'team': 1},
        {'username': 'Player1', 'id': 1, 'team': 2},
        {'username': 'Player2', 'id': 2, 'team': 1},
        {'username': 'Player3', 'id': 3, 'team': 2}
    ]
    
    game = QuantumMusGame('test8', players, '4')
    game.deal_cards()
    
    assert game.state['currentRound'] == 'MUS', "Should start in MUS"
    
    # MUS: Player 0 cuts with paso
    game.process_action(0, 'paso')
    assert game.state['currentRound'] == 'GRANDE', "Should be in GRANDE"
    
    # GRANDE: All pass
    game.process_action(0, 'paso')
    game.process_action(3, 'paso')
    game.process_action(2, 'paso')
    game.process_action(1, 'paso')
    assert game.state['currentRound'] == 'CHICA', "Should be in CHICA"
    
    # CHICA: All pass
    game.process_action(0, 'paso')
    game.process_action(3, 'paso')
    game.process_action(2, 'paso')
    game.process_action(1, 'paso')
    assert game.state['currentRound'] == 'PARES', "Should be in PARES"
    
    # PARES: All pass
    game.process_action(0, 'paso')
    game.process_action(3, 'paso')
    game.process_action(2, 'paso')
    game.process_action(1, 'paso')
    assert game.state['currentRound'] == 'JUEGO', "Should be in JUEGO"
    
    print("✓ Full flow works correctly")
    return True


def main():
    """Run all tests"""
    print("\n" + "="*70)
    print("  ONLINE MODE BETTING DYNAMICS - TEST SUITE")
    print("  Testing betting and corto mus up to PARES round")
    print("="*70)
    
    tests = [
        test_corto_mus_with_paso,
        test_corto_mus_with_envido,
        test_grande_all_pass,
        test_grande_betting_accept,
        test_grande_betting_reject,
        test_chica_all_pass,
        test_pares_all_pass,
        test_full_flow
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            if test():
                passed += 1
        except AssertionError as e:
            failed += 1
            print(f"✗ {test.__name__} FAILED: {e}")
        except Exception as e:
            failed += 1
            print(f"✗ {test.__name__} ERROR: {e}")
    
    print("\n" + "="*70)
    print(f"  RESULTS: {passed} passed, {failed} failed")
    if failed == 0:
        print("  ✓ ALL TESTS PASSED!")
    print("="*70 + "\n")
    
    return failed == 0


if __name__ == '__main__':
    import sys
    sys.exit(0 if main() else 1)
