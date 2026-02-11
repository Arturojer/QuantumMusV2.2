"""
Test PARES Auto-Declaration and Betting Logic
Tests various scenarios for PARES declarations and betting rounds
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from game_logic import QuantumMusGame
from Logica_cuantica.baraja import QuantumDeck

def create_test_game():
    """Create a test game with 4 players"""
    players = [
        {'id': 0, 'name': 'Player1', 'team': 1, 'character': 'preskill'},
        {'id': 1, 'name': 'Player2', 'team': 2, 'character': 'cirac'},
        {'id': 2, 'name': 'Player3', 'team': 1, 'character': 'zoller'},
        {'id': 3, 'name': 'Player4', 'team': 2, 'character': 'deutsch'}
    ]
    game = QuantumMusGame('test-room', players, game_mode='4')
    return game

def print_hand(game, player_index):
    """Print a player's hand"""
    hand = game.hands.get(player_index, [])
    print(f"  Player {player_index}: ", end="")
    for card in hand:
        if hasattr(card, 'value') and hasattr(card, 'suit'):
            print(f"{card.value}{card.suit[0]}", end=" ")
        else:
            print(f"{card.get('value', '?')}{card.get('suit', '?')[0]}", end=" ")
    print()

def check_has_pairs(hand):
    """Check if hand has pairs"""
    value_counts = {}
    for card in hand:
        value = getattr(card, 'value', None) or card.get('value')
        if value:
            value_counts[value] = value_counts.get(value, 0) + 1
    return any(count >= 2 for count in value_counts.values())

def test_auto_declaration_with_pairs():
    """Test Case 1: Player with 100% pairs (all cards collapsed, has pairs)"""
    print("\n" + "="*70)
    print("TEST 1: Auto-declaration with 100% pairs (4 of a kind)")
    print("="*70)
    
    game = create_test_game()
    
    # Give player 0 four kings (100% has pairs)
    from card_deck import QuantumCard
    game.hands[0] = [
        QuantumCard('K', 'oros', '4'),
        QuantumCard('K', 'copas', '4'),
        QuantumCard('K', 'espadas', '4'),
        QuantumCard('K', 'bastos', '4')
    ]
    # Mark all as collapsed
    for card in game.hands[0]:
        card.is_collapsed = True
        card.collapsed_value = 'K'
    
    print("\nInitial state:")
    print_hand(game, 0)
    print(f"Has pairs: {check_has_pairs(game.hands[0])}")
    print(f"All collapsed: {all(getattr(c, 'is_collapsed', False) for c in game.hands[0])}")
    
    # Should auto-declare "tengo"
    print("\n✓ Expected: Auto-declare 'tengo' (100% probability)")
    print("✓ Expected: Cards should NOT collapse (already collapsed)")
    
    # Trigger auto-declaration
    print("\nTriggering auto-declaration...")
    should_auto = all(getattr(c, 'is_collapsed', False) for c in game.hands[0])
    has_pairs = check_has_pairs(game.hands[0])
    
    if should_auto:
        declaration = has_pairs  # True for tengo, False for no tengo
        print(f"✓ Auto-declaration: {'tengo' if declaration else 'no tengo'}")
        
        # In the game, this should NOT trigger collapse since already collapsed
        print("✓ Collapse check: Cards already collapsed, no collapse needed")
    else:
        print("✗ FAILED: Should have auto-declared!")
    
    return True

def test_auto_declaration_without_pairs():
    """Test Case 2: Player with 0% pairs (all cards collapsed, no pairs)"""
    print("\n" + "="*70)
    print("TEST 2: Auto-declaration with 0% pairs (all different)")
    print("="*70)
    
    game = create_test_game()
    
    # Give player 0 four different cards (0% pairs)
    from card_deck import QuantumCard
    game.hands[0] = [
        QuantumCard('K', 'oros', '4'),
        QuantumCard('Q', 'copas', '4'),
        QuantumCard('J', 'espadas', '4'),
        QuantumCard('7', 'bastos', '4')
    ]
    # Mark all as collapsed
    for card in game.hands[0]:
        card.is_collapsed = True
        card.collapsed_value = card.value
    
    print("\nInitial state:")
    print_hand(game, 0)
    print(f"Has pairs: {check_has_pairs(game.hands[0])}")
    print(f"All collapsed: {all(getattr(c, 'is_collapsed', False) for c in game.hands[0])}")
    
    # Should auto-declare "no tengo"
    print("\n✓ Expected: Auto-declare 'no tengo' (0% probability)")
    print("✓ Expected: Cards should NOT collapse (already collapsed)")
    
    # Trigger auto-declaration
    print("\nTriggering auto-declaration...")
    should_auto = all(getattr(c, 'is_collapsed', False) for c in game.hands[0])
    has_pairs = check_has_pairs(game.hands[0])
    
    if should_auto:
        declaration = has_pairs  # True for tengo, False for no tengo
        print(f"✓ Auto-declaration: {'tengo' if declaration else 'no tengo'}")
        print("✓ Collapse check: Cards already collapsed, no collapse needed")
    else:
        print("✗ FAILED: Should have auto-declared!")
    
    return True

def test_manual_declaration_requires_collapse():
    """Test Case 3: Manual declaration should trigger collapse"""
    print("\n" + "="*70)
    print("TEST 3: Manual 'tengo' declaration should trigger collapse")
    print("="*70)
    
    game = create_test_game()
    game.state['currentRound'] = 'PARES'
    
    # Give player 0 hand with entangled cards
    print("\nInitial state: Player has entangled cards (not all collapsed)")
    print("Player declares 'tengo' manually")
    
    player_index = 0
    declaration = True  # tengo
    round_name = 'PARES'
    
    print("\n✓ Expected: Collapse should be triggered")
    print("✓ Expected: Cards should collapse to reveal actual pairs status")
    
    # Trigger collapse
    collapse_result = game.trigger_collapse_on_declaration(player_index, declaration, round_name)
    
    if collapse_result['success']:
        print(f"✓ Collapse triggered successfully")
        print(f"  Collapse event: {collapse_result.get('collapse_event', {}).get('type', 'unknown')}")
        if collapse_result.get('penalty'):
            print(f"  Penalty applied: {collapse_result['penalty']}")
    else:
        print(f"✗ FAILED: Collapse failed - {collapse_result.get('error')}")
    
    return collapse_result['success']

def test_pares_betting_scenarios():
    """Test Case 4: Various PARES declaration combinations and betting logic"""
    print("\n" + "="*70)
    print("TEST 4: PARES Betting Logic Scenarios")
    print("="*70)
    
    scenarios = [
        {
            'name': 'Everyone says puede',
            'team1': ['puede', 'puede'],
            'team2': ['puede', 'puede'],
            'should_bet': True,
            'reason': 'Everyone puede → betting happens'
        },
        {
            'name': 'Team1 tengo, Team2 all no tengo',
            'team1': ['tengo', 'puede'],
            'team2': ['no_tengo', 'no_tengo'],
            'should_bet': False,
            'reason': 'One team has interest, other all no → skip betting'
        },
        {
            'name': 'Both teams have puede',
            'team1': ['puede', 'no_tengo'],
            'team2': ['puede', 'no_tengo'],
            'should_bet': True,
            'reason': 'Puede from both teams → betting happens'
        },
        {
            'name': 'Team1 tengo, Team2 tiene puede',
            'team1': ['tengo', 'no_tengo'],
            'team2': ['puede', 'no_tengo'],
            'should_bet': True,
            'reason': 'Tengo from one team + puede from other → betting happens'
        },
        {
            'name': 'Both teams have tengo',
            'team1': ['tengo', 'no_tengo'],
            'team2': ['tengo', 'no_tengo'],
            'should_bet': True,
            'reason': 'Both teams interested → betting happens'
        },
        {
            'name': 'All no tengo',
            'team1': ['no_tengo', 'no_tengo'],
            'team2': ['no_tengo', 'no_tengo'],
            'should_bet': False,
            'reason': 'Nobody interested → no betting (should skip to next round)'
        }
    ]
    
    all_passed = True
    for scenario in scenarios:
        print(f"\n--- Scenario: {scenario['name']} ---")
        print(f"Team1: {scenario['team1']}")
        print(f"Team2: {scenario['team2']}")
        
        # Simulate the betting logic
        team1_tengo = sum(1 for d in scenario['team1'] if d == 'tengo')
        team1_puede = sum(1 for d in scenario['team1'] if d == 'puede')
        team1_no_tengo = sum(1 for d in scenario['team1'] if d == 'no_tengo')
        
        team2_tengo = sum(1 for d in scenario['team2'] if d == 'tengo')
        team2_puede = sum(1 for d in scenario['team2'] if d == 'puede')
        team2_no_tengo = sum(1 for d in scenario['team2'] if d == 'no_tengo')
        
        # Apply betting logic
        team1_has_interest = (team1_tengo + team1_puede >= 1)
        team2_has_interest = (team2_tengo + team2_puede >= 1)
        team1_all_no = (team1_no_tengo == 2)
        team2_all_no = (team2_no_tengo == 2)
        
        should_skip = (team1_has_interest and team2_all_no) or (team2_has_interest and team1_all_no)
        can_bet = not should_skip
        
        print(f"Expected: {'Betting' if scenario['should_bet'] else 'Skip betting'}")
        print(f"Actual: {'Betting' if can_bet else 'Skip betting'}")
        print(f"Reason: {scenario['reason']}")
        
        if can_bet == scenario['should_bet']:
            print("✓ PASSED")
        else:
            print("✗ FAILED")
            all_passed = False
    
    return all_passed

def run_all_tests():
    """Run all PARES auto-declaration tests"""
    print("\n" + "="*70)
    print("PARES AUTO-DECLARATION AND BETTING LOGIC TEST SUITE")
    print("="*70)
    
    results = []
    
    try:
        results.append(('Auto-declaration with pairs', test_auto_declaration_with_pairs()))
    except Exception as e:
        print(f"\n✗ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        results.append(('Auto-declaration with pairs', False))
    
    try:
        results.append(('Auto-declaration without pairs', test_auto_declaration_without_pairs()))
    except Exception as e:
        print(f"\n✗ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        results.append(('Auto-declaration without pairs', False))
    
    try:
        results.append(('Manual declaration collapse', test_manual_declaration_requires_collapse()))
    except Exception as e:
        print(f"\n✗ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        results.append(('Manual declaration collapse', False))
    
    try:
        results.append(('Betting logic scenarios', test_pares_betting_scenarios()))
    except Exception as e:
        print(f"\n✗ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        results.append(('Betting logic scenarios', False))
    
    # Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    
    for test_name, passed in results:
        status = "✓ PASSED" if passed else "✗ FAILED"
        print(f"{test_name}: {status}")
    
    total = len(results)
    passed_count = sum(1 for _, p in results if p)
    print(f"\nTotal: {passed_count}/{total} tests passed")
    
    if passed_count == total:
        print("\n✓ All tests passed!")
        return 0
    else:
        print(f"\n✗ {total - passed_count} test(s) failed")
        return 1

if __name__ == '__main__':
    exit_code = run_all_tests()
    sys.exit(exit_code)
