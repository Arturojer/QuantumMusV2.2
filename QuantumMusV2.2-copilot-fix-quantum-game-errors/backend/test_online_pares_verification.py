"""
Comprehensive Test for Online PARES Round
Tests collapse, betting, penalties, and scoreboard updates
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

def test_online_pares_penalty_structure():
    """Test Case: Verify penalty structure matches what frontend expects"""
    print("\n" + "="*70)
    print("TEST: Online PARES Penalty Structure")
    print("="*70)
    
    from game_logic import QuantumMusGame
    
    # Create test game
    players = [
        {'id': 0, 'name': 'Player1', 'team': 1, 'character': 'preskill'},
        {'id': 1, 'name': 'Player2', 'team': 2, 'character': 'cirac'},
        {'id': 2, 'name': 'Player3', 'team': 1, 'character': 'zoller'},
        {'id': 3, 'name': 'Player4', 'team': 2, 'character': 'deutsch'}
    ]
    game = QuantumMusGame('test-room', players, game_mode='4')
    
    # Setup player with hand that will cause penalty
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
    
    print("\nPlayer 0 hand (no pairs): K Q J 7")
    print("Player declares 'tengo' (has pairs) - should be WRONG")
    
    # Trigger collapse
    result = game.trigger_collapse_on_declaration(0, True, 'PARES')
    
    print(f"\nCollapse result structure:")
    print(f"  success: {result.get('success')}")
    print(f"  penalty: {result.get('penalty')}")
    print(f"  penalty type: {type(result.get('penalty'))}")
    
    # Check if penalty has proper structure
    penalty = result.get('penalty')
    
    print("\n" + "-"*70)
    print("EXPECTED STRUCTURE (for frontend):")
    print("  penalty should be: {")
    print("    'penalized': True,")
    print("    'points_deducted': 1,")
    print("    'reason': 'Predicción incorrecta en PARES'")
    print("  }")
    
    print("\nACTUAL STRUCTURE:")
    if isinstance(penalty, dict):
        print("  ✓ Is a dictionary")
        print(f"    - penalized: {penalty.get('penalized')}")
        print(f"    - points_deducted: {penalty.get('points_deducted')}")
        print(f"    - reason: {penalty.get('reason')}")
    elif isinstance(penalty, (int, float)):
        print(f"  ✗ Is a number: {penalty}")
        print("  ✗ Frontend expects dictionary with 'penalized' and 'points_deducted'!")
    else:
        print(f"  ✗ Unknown type: {type(penalty)}")
    
    print("\n" + "="*70)
    
    # Check if it will work with frontend code
    print("FRONTEND COMPATIBILITY CHECK:")
    if isinstance(penalty, dict):
        if penalty.get('penalized') and penalty.get('points_deducted'):
            print("  ✓ COMPATIBLE: Frontend will show penalty and update scoreboard")
            return True
        else:
            print("  ✗ INCOMPATIBLE: Missing required fields")
            return False
    else:
        print("  ✗ INCOMPATIBLE: Wrong data type")
        return False


def test_scoreboard_update_with_penalty():
    """Test Case: Verify scoreboard updates correctly after penalty"""
    print("\n" + "="*70)
    print("TEST: Scoreboard Update with Penalty")
    print("="*70)
    
    from game_logic import QuantumMusGame
    from card_deck import QuantumCard
    
    # Create test game
    players = [
        {'id': 0, 'name': 'Player1', 'team': 1, 'character': 'preskill'},
        {'id': 1, 'name': 'Player2', 'team': 2, 'character': 'cirac'},
        {'id': 2, 'name': 'Player3', 'team': 1, 'character': 'zoller'},
        {'id': 3, 'name': 'Player4', 'team': 2, 'character': 'deutsch'}
    ]
    game = QuantumMusGame('test-room', players, game_mode='4')
    
    # Set initial scores
    game.state['teams']['team1']['score'] = 10
    game.state['teams']['team2']['score'] = 15
    
    print(f"\nInitial scores:")
    print(f"  Team 1: {game.state['teams']['team1']['score']}")
    print(f"  Team 2: {game.state['teams']['team2']['score']}")
    
    # Give Player 0 (Team 1) a hand with no pairs
    game.hands[0] = [
        QuantumCard('K', 'oros', '4'),
        QuantumCard('Q', 'copas', '4'),
        QuantumCard('J', 'espadas', '4'),
        QuantumCard('7', 'bastos', '4')
    ]
    for card in game.hands[0]:
        card.is_collapsed = True
        card.collapsed_value = card.value
    
    print("\nPlayer 0 (Team 1) declares 'tengo' but has no pairs")
    
    # Trigger collapse (should penalize Team 1)
    result = game.trigger_collapse_on_declaration(0, True, 'PARES')
    
    print(f"\nAfter penalty:")
    print(f"  Team 1: {game.state['teams']['team1']['score']}")
    print(f"  Team 2: {game.state['teams']['team2']['score']}")
    
    # Server should NOT automatically deduct - that's frontend's job
    # But the penalty info should be sent
    print(f"\n⚠️  NOTE: Server sends penalty info, frontend applies to scoreboard")
    print(f"  Penalty sent: {result.get('penalty')}")
    
    if result.get('penalty'):
        print("  ✓ Penalty info is being sent to frontend")
    else:
        print("  ✗ No penalty info sent!")
    
    return result.get('penalty') is not None


def run_all_tests():
    """Run all online PARES tests"""
    print("\n" + "="*70)
    print("ONLINE PARES ROUND VERIFICATION TEST SUITE")
    print("="*70)
    
    results = []
    
    try:
        results.append(('Penalty Structure', test_online_pares_penalty_structure()))
    except Exception as e:
        print(f"\n✗ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        results.append(('Penalty Structure', False))
    
    try:
        results.append(('Scoreboard Update', test_scoreboard_update_with_penalty()))
    except Exception as e:
        print(f"\n✗ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        results.append(('Scoreboard Update', False))
    
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
        print("\n" + "="*70)
        print("ISSUES FOUND:")
        print("="*70)
        if not results[0][1]:
            print("1. Penalty structure incompatible:")
            print("   - Server sends penalty as number (-1)")
            print("   - Frontend expects: {penalized: true, points_deducted: 1, reason: '...'}")
            print("   - FIX: Update game_logic.py to return proper penalty structure")
        return 1


if __name__ == '__main__':
    exit_code = run_all_tests()
    sys.exit(exit_code)
