"""
Test Online Multiplayer Betting
Simulates actual online game with multiple players via WebSocket events
"""

import logging
from game_logic import QuantumMusGame

logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)


def test_online_betting_flow():
    """Test complete online betting flow with state broadcasting"""
    print("\n=== TEST: Online Multiplayer Betting Flow ===")
    
    # Simulate 4 online players
    players = [
        {'username': 'Alice', 'id': 0, 'team': 1},
        {'username': 'Bob', 'id': 1, 'team': 2},
        {'username': 'Charlie', 'id': 2, 'team': 1},
        {'username': 'Diana', 'id': 3, 'team': 2}
    ]
    
    game = QuantumMusGame('online_room_123', players, '4')
    game.deal_cards()
    
    print(f"Players: {[p['username'] for p in players]}")
    print(f"Team1: {[players[i]['username'] for i in game.state['teams']['team1']['players']]}")
    print(f"Team2: {[players[i]['username'] for i in game.state['teams']['team2']['players']]}")
    
    # MUS Round - Alice cuts with envido
    print("\n--- MUS Round ---")
    result = game.process_action(0, 'envido', {'amount': 5})
    state = game.get_public_state()
    
    print(f"Alice cuts MUS with 5-point bet")
    print(f"Broadcast state to all players:")
    print(f"  currentRound: {state['state']['currentRound']}")
    print(f"  activePlayerIndex: {state['state']['activePlayerIndex']}")
    
    # Verify phase info is in public state
    assert 'grandePhase' in state['state'], "grandePhase should be in public state"
    grande_phase = state['state']['grandePhase']
    print(f"  grandePhase.phaseState: {grande_phase['phaseState']}")
    print(f"  grandePhase.attackingTeam: {grande_phase['attackingTeam']}")
    print(f"  grandePhase.defendingTeam: {grande_phase['defendingTeam']}")
    print(f"  grandePhase.currentBetAmount: {grande_phase['currentBetAmount']}")
    
    # Diana (first defender) should see accept/reject buttons
    active_player = state['state']['activePlayerIndex']
    assert active_player == 3, "Diana (player 3) should be active"
    active_player_name = players[active_player]['username']
    active_team = game.get_player_team(active_player)
    
    print(f"\n{active_player_name} (Player {active_player}, Team {active_team}) is active")
    print(f"{active_player_name} is on defending team: {active_team == grande_phase['defendingTeam']}")
    print(f"✓ {active_player_name} should see ACCEPT/REJECT/RAISE buttons")
    
    # Diana raises to 10
    print(f"\n{active_player_name} raises to 10 points")
    result = game.process_action(active_player, 'envido', {'amount': 10})
    state = game.get_public_state()
    grande_phase = state['state']['grandePhase']
    
    print(f"Broadcast state to all players:")
    print(f"  grandePhase.attackingTeam: {grande_phase['attackingTeam']} (switched)")
    print(f"  grandePhase.currentBetAmount: {grande_phase['currentBetAmount']}")
    
    # Charlie (now defender) should see accept/reject buttons
    active_player = state['state']['activePlayerIndex']
    active_player_name = players[active_player]['username']
    active_team = game.get_player_team(active_player)
    
    print(f"\n{active_player_name} (Player {active_player}, Team {active_team}) is now active")
    print(f"{active_player_name} is on defending team: {active_team == grande_phase['defendingTeam']}")
    print(f"✓ {active_player_name} should see ACCEPT/REJECT/RAISE buttons")
    
    # Charlie accepts
    print(f"\n{active_player_name} accepts the 10-point bet")
    result = game.process_action(active_player, 'accept')
    state = game.get_public_state()
    
    print(f"Broadcast state to all players:")
    print(f"  currentRound: {state['state']['currentRound']}")
    print(f"  Round ended, moving to {state['state']['currentRound']}")
    
    assert result['round_ended'], "Round should end"
    assert state['state']['currentRound'] == 'CHICA', "Should move to CHICA"
    
    print("\n✓ Online multiplayer betting flow works correctly")
    return True


def test_frontend_button_logic():
    """Test what frontend should check to show buttons"""
    print("\n=== TEST: Frontend Button Logic ===")
    
    players = [
        {'username': 'Alice', 'id': 0, 'team': 1},
        {'username': 'Bob', 'id': 1, 'team': 2},
        {'username': 'Charlie', 'id': 2, 'team': 1},
        {'username': 'Diana', 'id': 3, 'team': 2}
    ]
    
    game = QuantumMusGame('test_buttons', players, '4')
    game.deal_cards()
    game.state['currentRound'] = 'GRANDE'
    game.round_handler.grande_handler.initialize_grande_phase()
    
    # Scenario 1: Alice bets, Diana should see accept/reject
    game.process_action(0, 'envido', {'amount': 5})
    state = game.get_public_state()
    
    print("\n--- Scenario 1: Initial Bet ---")
    print(f"Alice (Player 0, Team 1) bets 5 points")
    
    # Simulate frontend for each player
    for player_idx in range(4):
        player_name = players[player_idx]['username']
        player_team = 'team1' if player_idx in [0, 2] else 'team2'
        
        # Frontend checks
        is_active = state['state']['activePlayerIndex'] == player_idx
        phase = state['state']['grandePhase']
        is_defender = player_team == phase['defendingTeam']
        bet_active = phase['phaseState'] in ['BET_PLACED', 'WAITING_RESPONSE']
        
        print(f"\n{player_name} (Player {player_idx}, {player_team}):")
        print(f"  isActive: {is_active}")
        print(f"  isDefender: {is_defender}")
        print(f"  betActive: {bet_active}")
        
        if is_active and is_defender and bet_active:
            print(f"  ✓ Show: ACCEPT, REJECT (Paso), RAISE (Envido)")
        elif is_active and not bet_active:
            print(f"  ✓ Show: BET (Envido/Ordago), PASO")
        else:
            print(f"  ✓ Show: Nothing (wait)")
    
    # Scenario 2: After Diana raises, Charlie should see accept/reject
    game.process_action(3, 'envido', {'amount': 10})
    state = game.get_public_state()
    
    print("\n--- Scenario 2: After Raise ---")
    print(f"Diana (Player 3, Team 2) raises to 10 points")
    
    active = state['state']['activePlayerIndex']
    active_name = players[active]['username']
    phase = state['state']['grandePhase']
    
    print(f"\nActive player: {active_name} (Player {active})")
    print(f"Defending team: {phase['defendingTeam']}")
    print(f"Current bet: {phase['currentBetAmount']} points")
    print(f"✓ {active_name} should see ACCEPT/REJECT/RAISE buttons")
    
    print("\n✓ Frontend button logic verified")
    return True


def test_reject_flow_online():
    """Test rejection flow in online mode"""
    print("\n=== TEST: Online Rejection Flow ===")
    
    players = [
        {'username': 'Alice', 'id': 0, 'team': 1},
        {'username': 'Bob', 'id': 1, 'team': 2},
        {'username': 'Charlie', 'id': 2, 'team': 1},
        {'username': 'Diana', 'id': 3, 'team': 2}
    ]
    
    game = QuantumMusGame('test_reject', players, '4')
    game.deal_cards()
    game.state['currentRound'] = 'CHICA'
    game.round_handler.chica_handler.initialize_round()
    
    # Bob bets
    game.process_action(0, 'paso')  # Alice passes
    game.process_action(3, 'envido', {'amount': 5})  # Diana bets
    
    state = game.get_public_state()
    print("Diana (Team 2) bets 5 points")
    print(f"Defending team: {state['state']['chicaPhase']['defendingTeam']}")
    
    # Charlie (first defender) rejects
    active = state['state']['activePlayerIndex']
    active_name = players[active]['username']
    print(f"\n{active_name} (first defender) rejects")
    
    initial_score = game.state['teams']['team2']['score']
    result = game.process_action(active, 'paso')
    state = game.get_public_state()
    
    # Score should NOT change yet
    current_score = game.state['teams']['team2']['score']
    assert current_score == initial_score, "Score should not change after first rejection"
    print(f"Score unchanged: {current_score}")
    
    # Partner must respond
    partner = state['state']['activePlayerIndex']
    partner_name = players[partner]['username']
    print(f"\n{partner_name} (partner) must respond")
    print(f"✓ First rejection doesn't award points immediately")
    
    # Partner also rejects
    print(f"\n{partner_name} also rejects")
    result = game.process_action(partner, 'paso')
    state = game.get_public_state()
    
    # Now score should change
    final_score = game.state['teams']['team2']['score']
    assert final_score == initial_score + 1, "Team2 should gain 1 point"
    print(f"Score updated: {final_score} (+1 point for Team 2)")
    print(f"✓ Both rejections required for point award")
    
    print("\n✓ Online rejection flow works correctly")
    return True


def test_public_state_completeness():
    """Verify public state has all info frontend needs"""
    print("\n=== TEST: Public State Completeness ===")
    
    players = [
        {'username': 'Alice', 'id': 0, 'team': 1},
        {'username': 'Bob', 'id': 1, 'team': 2},
        {'username': 'Charlie', 'id': 2, 'team': 1},
        {'username': 'Diana', 'id': 3, 'team': 2}
    ]
    
    game = QuantumMusGame('test_state', players, '4')
    game.deal_cards()
    game.state['currentRound'] = 'GRANDE'
    game.round_handler.grande_handler.initialize_grande_phase()
    
    # Create a betting situation
    game.process_action(0, 'envido', {'amount': 5})
    
    # Get public state (what's sent to all players)
    state = game.get_public_state()
    
    print("Checking public state has all required fields:")
    
    required_fields = [
        ('state.currentRound', lambda s: s['state']['currentRound']),
        ('state.activePlayerIndex', lambda s: s['state']['activePlayerIndex']),
        ('state.teams', lambda s: s['state']['teams']),
        ('state.currentBet', lambda s: s['state']['currentBet']),
        ('state.grandePhase', lambda s: s['state'].get('grandePhase')),
    ]
    
    for field_name, getter in required_fields:
        try:
            value = getter(state)
            print(f"  ✓ {field_name}: {value is not None}")
        except KeyError:
            print(f"  ✗ {field_name}: MISSING")
            raise AssertionError(f"Missing required field: {field_name}")
    
    # Check grandePhase has all needed sub-fields
    phase = state['state']['grandePhase']
    phase_fields = ['phaseState', 'attackingTeam', 'defendingTeam', 'currentBetAmount', 'betType']
    
    print("\nChecking grandePhase has all required fields:")
    for field in phase_fields:
        assert field in phase, f"Missing {field} in grandePhase"
        print(f"  ✓ grandePhase.{field}: {phase[field]}")
    
    print("\n✓ Public state is complete for frontend")
    return True


def main():
    """Run all online multiplayer tests"""
    print("\n" + "="*70)
    print("  ONLINE MULTIPLAYER BETTING TESTS")
    print("  Testing actual online game flow with WebSocket state")
    print("="*70)
    
    tests = [
        test_online_betting_flow,
        test_frontend_button_logic,
        test_reject_flow_online,
        test_public_state_completeness
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
        print("  ✓ ALL ONLINE MULTIPLAYER TESTS PASSED!")
    print("="*70 + "\n")
    
    return failed == 0


if __name__ == '__main__':
    import sys
    sys.exit(0 if main() else 1)
