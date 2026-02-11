"""
Comprehensive Betting Test Suite
Tests all betting scenarios: reraises, team selection, proper flow
"""

import logging
from game_logic import QuantumMusGame

logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)


def test_reraise_sequence():
    """Test that reraises (counter-bets) work correctly"""
    print("\n=== TEST: Reraise Sequence ===")
    
    players = [
        {'username': 'Player0', 'id': 0, 'team': 1},
        {'username': 'Player1', 'id': 1, 'team': 2},
        {'username': 'Player2', 'id': 2, 'team': 1},
        {'username': 'Player3', 'id': 3, 'team': 2}
    ]
    
    game = QuantumMusGame('test_reraise', players, '4')
    game.deal_cards()
    game.state['currentRound'] = 'GRANDE'
    game.round_handler.grande_handler.initialize_grande_phase()
    
    print(f"Teams: team1={game.state['teams']['team1']['players']}, team2={game.state['teams']['team2']['players']}")
    
    # Player 0 (team1) bets 5
    result = game.process_action(0, 'envido', {'amount': 5})
    assert result['success'], "Initial bet should succeed"
    assert result['bet_placed'], "Bet should be placed"
    assert game.state['grandePhase']['attackingTeam'] == 'team1'
    print(f"✓ Player 0 (team1) bets 5 points")
    print(f"  Active player: {game.state['activePlayerIndex']}")
    
    # First defender (player 3, team2) raises to 10
    active = game.state['activePlayerIndex']
    result = game.process_action(active, 'envido', {'amount': 10})
    assert result['success'], "Raise should succeed"
    assert result['raised'], "Should indicate raise"
    assert game.state['grandePhase']['attackingTeam'] == 'team2', "Attacking team should switch"
    assert game.state['grandePhase']['currentBetAmount'] == 10
    print(f"✓ Player {active} (team2) raises to 10 points")
    print(f"  Active player: {game.state['activePlayerIndex']}")
    
    # Original bettor (now defender) raises again to 15
    active = game.state['activePlayerIndex']
    result = game.process_action(active, 'envido', {'amount': 15})
    assert result['success'], "Counter-raise should succeed"
    assert result['raised'], "Should indicate raise"
    assert game.state['grandePhase']['attackingTeam'] == 'team1', "Attacking team should switch back"
    assert game.state['grandePhase']['currentBetAmount'] == 15
    print(f"✓ Player {active} (team1) raises to 15 points")
    print(f"  Active player: {game.state['activePlayerIndex']}")
    
    # Second defender accepts
    active = game.state['activePlayerIndex']
    result = game.process_action(active, 'accept')
    assert result['success'], "Accept should succeed"
    assert result['round_ended'], "Round should end"
    assert result['bet_accepted'], "Bet should be accepted"
    print(f"✓ Player {active} (team2) accepts the 15-point bet")
    print(f"  Current round: {game.state['currentRound']}")
    
    print("✓ Reraise sequence works correctly")
    return True


def test_defending_team_selection():
    """Test that the correct defending team is selected"""
    print("\n=== TEST: Defending Team Selection ===")
    
    players = [
        {'username': 'Player0', 'id': 0, 'team': 1},
        {'username': 'Player1', 'id': 1, 'team': 2},
        {'username': 'Player2', 'id': 2, 'team': 1},
        {'username': 'Player3', 'id': 3, 'team': 2}
    ]
    
    game = QuantumMusGame('test_defense', players, '4')
    game.deal_cards()
    game.state['currentRound'] = 'CHICA'
    game.round_handler.chica_handler.initialize_round()
    
    print(f"Teams: team1={game.state['teams']['team1']['players']}, team2={game.state['teams']['team2']['players']}")
    
    # Player 1 (team2) bets
    game.process_action(0, 'paso')  # Mano passes
    result = game.process_action(3, 'envido', {'amount': 5})
    assert result['success'], "Bet should succeed"
    
    phase = game.state['chicaPhase']
    assert phase['attackingTeam'] == 'team2', "Team2 should be attacking"
    assert phase['defendingTeam'] == 'team1', "Team1 should be defending"
    
    # Check that next player is from defending team
    active = game.state['activePlayerIndex']
    assert active in game.state['teams']['team1']['players'], "Active player should be from defending team"
    print(f"✓ Player 3 (team2) bets, defending team is team1")
    print(f"✓ Active player {active} is from team1")
    
    # Only team1 players should be able to respond
    if active == 0:
        partner = 2
    else:
        partner = 0
    
    # First defender rejects
    result = game.process_action(active, 'paso')
    assert result['success'], "First rejection should succeed"
    assert result.get('first_rejection'), "Should indicate first rejection"
    
    # Partner must respond
    assert game.state['activePlayerIndex'] == partner, "Partner should be next"
    print(f"✓ First defender rejects, partner (Player {partner}) must respond")
    
    print("✓ Defending team selection works correctly")
    return True


def test_both_defenders_must_reject():
    """Test that both defenders must reject for bet to be lost"""
    print("\n=== TEST: Both Defenders Must Reject ===")
    
    players = [
        {'username': 'Player0', 'id': 0, 'team': 1},
        {'username': 'Player1', 'id': 1, 'team': 2},
        {'username': 'Player2', 'id': 2, 'team': 1},
        {'username': 'Player3', 'id': 3, 'team': 2}
    ]
    
    game = QuantumMusGame('test_reject', players, '4')
    game.deal_cards()
    game.state['currentRound'] = 'GRANDE'
    game.round_handler.grande_handler.initialize_grande_phase()
    
    # Team2 bets
    game.process_action(0, 'paso')
    game.process_action(3, 'envido', {'amount': 5})
    
    initial_team2_score = game.state['teams']['team2']['score']
    
    # First defender (team1) rejects
    active = game.state['activePlayerIndex']
    game.process_action(active, 'paso')
    
    # Score should not change yet (partner hasn't responded)
    assert game.state['teams']['team2']['score'] == initial_team2_score, "Score should not change after first rejection"
    print("✓ After first rejection, score unchanged")
    
    # Partner also rejects
    active = game.state['activePlayerIndex']
    result = game.process_action(active, 'paso')
    
    # Now score should change
    assert result['round_ended'], "Round should end"
    assert game.state['teams']['team2']['score'] == initial_team2_score + 1, "Team2 should gain 1 point"
    print("✓ After both defenders reject, team2 gains 1 point")
    
    print("✓ Both defenders must reject test passed")
    return True


def test_ordago_immediate_resolution():
    """Test that ordago (all-in) is resolved immediately when accepted"""
    print("\n=== TEST: Ordago Immediate Resolution ===")
    
    players = [
        {'username': 'Player0', 'id': 0, 'team': 1},
        {'username': 'Player1', 'id': 1, 'team': 2},
        {'username': 'Player2', 'id': 2, 'team': 1},
        {'username': 'Player3', 'id': 3, 'team': 2}
    ]
    
    game = QuantumMusGame('test_ordago', players, '4')
    game.deal_cards()
    game.state['currentRound'] = 'GRANDE'
    game.round_handler.grande_handler.initialize_grande_phase()
    
    # Player 0 calls ordago
    result = game.process_action(0, 'ordago')
    assert result['success'], "Ordago should succeed"
    assert game.state['grandePhase']['betType'] == 'ordago'
    assert game.state['grandePhase']['currentBetAmount'] == 40
    print("✓ Player 0 calls ordago (40 points)")
    
    # Defender accepts
    active = game.state['activePlayerIndex']
    result = game.process_action(active, 'accept')
    assert result['success'], "Accept should succeed"
    assert result['round_ended'], "Round should end"
    assert result['bet_amount'] == 40, "Bet amount should be 40"
    print(f"✓ Player {active} accepts ordago")
    print(f"✓ Round ended with 40 points at stake")
    
    print("✓ Ordago immediate resolution works correctly")
    return True


def test_chica_betting_flow():
    """Test that CHICA round has same betting dynamics as GRANDE"""
    print("\n=== TEST: CHICA Betting Flow ===")
    
    players = [
        {'username': 'Player0', 'id': 0, 'team': 1},
        {'username': 'Player1', 'id': 1, 'team': 2},
        {'username': 'Player2', 'id': 2, 'team': 1},
        {'username': 'Player3', 'id': 3, 'team': 2}
    ]
    
    game = QuantumMusGame('test_chica', players, '4')
    game.deal_cards()
    game.state['currentRound'] = 'CHICA'
    game.round_handler.chica_handler.initialize_round()
    
    # Mano passes
    game.process_action(0, 'paso')
    
    # Player 3 bets
    result = game.process_action(3, 'envido', {'amount': 7})
    assert result['success'], "Bet should succeed"
    assert game.state['chicaPhase']['currentBetAmount'] == 7
    print("✓ Betting in CHICA works")
    
    # Defender raises
    active = game.state['activePlayerIndex']
    result = game.process_action(active, 'envido', {'amount': 12})
    assert result['success'], "Raise should succeed"
    assert game.state['chicaPhase']['currentBetAmount'] == 12
    print("✓ Raising in CHICA works")
    
    # Accept
    active = game.state['activePlayerIndex']
    result = game.process_action(active, 'accept')
    assert result['success'], "Accept should succeed"
    assert game.state['currentRound'] == 'PARES'
    print("✓ CHICA transitions to PARES correctly")
    
    print("✓ CHICA betting flow works correctly")
    return True


def test_pares_betting_flow():
    """Test that PARES round has same betting dynamics"""
    print("\n=== TEST: PARES Betting Flow ===")
    
    players = [
        {'username': 'Player0', 'id': 0, 'team': 1},
        {'username': 'Player1', 'id': 1, 'team': 2},
        {'username': 'Player2', 'id': 2, 'team': 1},
        {'username': 'Player3', 'id': 3, 'team': 2}
    ]
    
    game = QuantumMusGame('test_pares', players, '4')
    game.deal_cards()
    game.state['currentRound'] = 'PARES'
    game.round_handler.pares_handler.initialize_round()
    
    # Test betting in PARES
    result = game.process_action(0, 'envido', {'amount': 4})
    assert result['success'], "Bet should succeed"
    print("✓ Betting in PARES works")
    
    # Accept
    active = game.state['activePlayerIndex']
    result = game.process_action(active, 'accept')
    assert result['success'], "Accept should succeed"
    assert game.state['currentRound'] == 'JUEGO'
    print("✓ PARES transitions to JUEGO correctly")
    
    print("✓ PARES betting flow works correctly")
    return True


def test_active_player_tracking():
    """Test that active player is correctly tracked through betting"""
    print("\n=== TEST: Active Player Tracking ===")
    
    players = [
        {'username': 'Player0', 'id': 0, 'team': 1},
        {'username': 'Player1', 'id': 1, 'team': 2},
        {'username': 'Player2', 'id': 2, 'team': 1},
        {'username': 'Player3', 'id': 3, 'team': 2}
    ]
    
    game = QuantumMusGame('test_active', players, '4')
    game.deal_cards()
    game.state['currentRound'] = 'GRANDE'
    game.round_handler.grande_handler.initialize_grande_phase()
    
    # Track sequence of active players
    sequence = [game.state['activePlayerIndex']]
    
    # All pass
    for _ in range(4):
        active = game.state['activePlayerIndex']
        result = game.process_action(active, 'paso')
        if result.get('next_player') is not None:
            sequence.append(result['next_player'])
    
    # Should follow counterclockwise order: 0 -> 3 -> 2 -> 1
    print(f"Active player sequence: {sequence}")
    assert sequence[0] == 0, "Should start with mano"
    assert sequence[1] == 3, "Next should be 3 (counterclockwise)"
    assert sequence[2] == 2, "Next should be 2"
    assert sequence[3] == 1, "Next should be 1"
    print("✓ Active player follows counterclockwise order")
    
    print("✓ Active player tracking works correctly")
    return True


def test_wrong_player_cannot_act():
    """Test that players cannot act out of turn"""
    print("\n=== TEST: Wrong Player Cannot Act ===")
    
    players = [
        {'username': 'Player0', 'id': 0, 'team': 1},
        {'username': 'Player1', 'id': 1, 'team': 2},
        {'username': 'Player2', 'id': 2, 'team': 1},
        {'username': 'Player3', 'id': 3, 'team': 2}
    ]
    
    game = QuantumMusGame('test_turn', players, '4')
    game.deal_cards()
    game.state['currentRound'] = 'GRANDE'
    game.round_handler.grande_handler.initialize_grande_phase()
    
    # Active player is 0 (mano)
    assert game.state['activePlayerIndex'] == 0
    
    # Try to have player 1 act (not their turn)
    result = game.process_action(1, 'paso')
    assert not result['success'], "Out-of-turn action should fail"
    assert 'error' in result, "Should have error message"
    print(f"✓ Player 1 cannot act (active is Player {game.state['activePlayerIndex']})")
    
    # Try to have player 2 act (not their turn)
    result = game.process_action(2, 'envido', {'amount': 5})
    assert not result['success'], "Out-of-turn action should fail"
    print("✓ Player 2 cannot act out of turn")
    
    # Correct player acts
    result = game.process_action(0, 'paso')
    assert result['success'], "In-turn action should succeed"
    print("✓ Player 0 (correct player) can act")
    
    print("✓ Turn enforcement works correctly")
    return True


def main():
    """Run all comprehensive tests"""
    print("\n" + "="*70)
    print("  COMPREHENSIVE BETTING TEST SUITE")
    print("  Testing reraises, team selection, proper flow")
    print("="*70)
    
    tests = [
        test_reraise_sequence,
        test_defending_team_selection,
        test_both_defenders_must_reject,
        test_ordago_immediate_resolution,
        test_chica_betting_flow,
        test_pares_betting_flow,
        test_active_player_tracking,
        test_wrong_player_cannot_act
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
        print("  ✓ ALL COMPREHENSIVE TESTS PASSED!")
    print("="*70 + "\n")
    
    return failed == 0


if __name__ == '__main__':
    import sys
    sys.exit(0 if main() else 1)
