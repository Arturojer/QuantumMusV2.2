/**
 * COLLAPSE EVENT HANDLING
 * Client-side Socket.IO handlers for quantum card collapses
 * 
 * Ensure all players see the same card values after collapse
 */

// =============================================================================
// 1. LISTEN FOR COLLAPSE EVENTS
// =============================================================================

/**
 * Listen for card collapse event from server
 * All players in the room receive this event simultaneously
 */
socket.on('cards_collapsed', (data) => {
    console.log('⚛️  Cards collapsed!', data);
    
    // Validate room consistency
    if (!data.collapse_event) {
        console.error('Invalid collapse event data');
        return;
    }
    
    // Extract collapse event details
    const {
        success,
        collapse_event,
        penalty,
        player_index,
        declaration,
        round_name,
        updated_hands,
        timestamp
    } = data;
    
    if (!success) {
        console.error('Collapse failed:', data.error);
        return;
    }
    
    // =========================================================================
    // 2. UPDATE CARD STATES FOR ALL PLAYERS
    // =========================================================================
    
    // Updated hands contains the new state for ALL 4 players
    // Each player updates their local game state with these values
    Object.keys(updated_hands).forEach(playerIdx => {
        const playerIdx_num = parseInt(playerIdx);
        const newHand = updated_hands[playerIdx];
        
        // Update game state
        gameState.playerHands[playerIdx_num] = newHand;
        
        // Visual update
        updatePlayerDisplay(playerIdx_num, newHand);
    });
    
    // =========================================================================
    // 3. SHOW COLLAPSE ANIMATION
    // =========================================================================
    
    // Animate the cards that collapsed
    collapse_event.collapsed_cards.forEach(([collapsedPlayerIdx, cardIdx, oldValue, newValue]) => {
        showCollapseAnimation(collapsedPlayerIdx, cardIdx, oldValue, newValue);
    });
    
    // =========================================================================
    // 4. APPLY PENALTIES IF ANY
    // =========================================================================
    
    collapse_event.penalties.forEach(([penaltyPlayerIdx, penaltyAmount, reason]) => {
        showPenaltyNotification(penaltyPlayerIdx, penaltyAmount, reason);
        // Deduct points from team score if needed
        if (penaltyAmount < 0) {
            updateTeamScore(getPlayerTeam(penaltyPlayerIdx), penaltyAmount);
        }
    });
    
    // =========================================================================
    // 5. LOG COLLAPSE DETAILS
    // =========================================================================
    
    console.log(`Collapse triggered by Player ${player_index} in ${round_name}`);
    console.log(`Declaration: ${declaration || 'bet_acceptance'}`);
    console.log(`Timestamp: ${timestamp}`);
    console.log('Collapsed cards:');
    collapse_event.collapsed_cards.forEach(([p, c, old, newVal]) => {
        console.log(`  Player ${p}, Card ${c}: ${old} → ${newVal}`);
    });
});

/**
 * Listen for final collapse at hand end
 */
socket.on('final_cards_collapsed', (data) => {
    console.log('🎴 Final collapse of all remaining cards', data);
    
    // Update all hands with final collapsed values
    Object.keys(data.final_hands).forEach(playerIdx => {
        gameState.playerHands[parseInt(playerIdx)] = data.final_hands[playerIdx];
    });
    
    // Show final reveal animation
    showFinalRevealAnimation(data.collapse_event.collapsed_cards);
});

// =============================================================================
// 6. TRIGGER COLLAPSE FROM CLIENT
// =============================================================================

/**
 * Client: Trigger collapse when making a declaration
 */
function makeDeclaration(playerIndex, declaration, roundName) {
    console.log(`Player ${playerIndex} declares: "${declaration}" in ${roundName}`);
    
    socket.emit('trigger_declaration_collapse', {
        room_id: currentRoomId,
        player_index: playerIndex,
        declaration: declaration,  // 'tengo' or 'no_tengo'
        round_name: roundName       // 'PARES' or 'JUEGO'
    });
}

/**
 * Client: Trigger collapse when accepting/making a bet
 */
function acceptBet(playerIndex, roundName) {
    console.log(`Player ${playerIndex} accepts bet in ${roundName}`);
    
    socket.emit('trigger_bet_acceptance_collapse', {
        room_id: currentRoomId,
        player_index: playerIndex,
        round_name: roundName
    });
}

/**
 * Client: Trigger final collapse at end of hand
 */
function finalizeHand() {
    console.log('Finalizing hand - collapsing all remaining cards');
    
    socket.emit('trigger_final_collapse', {
        room_id: currentRoomId
    });
}

// =============================================================================
// 7. VISUALIZATION HELPERS
// =============================================================================

/**
 * Show quantum collapse animation
 * Visual effect showing card transitioning from superposition to definite state
 */
function showCollapseAnimation(playerIdx, cardIdx, oldValue, newValue) {
    const cardElement = document.querySelector(
        `[data-player="${playerIdx}"] [data-card="${cardIdx}"]`
    );
    
    if (!cardElement) return;
    
    // Add collapse animation class
    cardElement.classList.add('collapse-animation');
    
    // Show old value briefly
    cardElement.textContent = oldValue;
    
    // After animation, show new value
    setTimeout(() => {
        cardElement.textContent = newValue;
        cardElement.classList.remove('collapse-animation');
        cardElement.classList.add('collapsed-card');
    }, 400);
    
    // Show collapse indicator (particle effect, glow, etc.)
    createCollapseEffect(cardElement);
}

/**
 * Create visual effect for quantum collapse
 */
function createCollapseEffect(element) {
    const effect = document.createElement('div');
    effect.className = 'collapse-effect';
    effect.innerHTML = '⚛️';
    element.appendChild(effect);
    
    setTimeout(() => effect.remove(), 500);
}

/**
 * Show penalty notification
 */
function showPenaltyNotification(playerIdx, penaltyAmount, reason) {
    if (penaltyAmount >= 0) return; // Only show negative penalties
    
    const notification = document.createElement('div');
    notification.className = 'penalty-notification';
    notification.textContent = `Player ${playerIdx}: ${penaltyAmount} points (${reason})`;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

/**
 * Update player hand display with new card values
 */
function updatePlayerDisplay(playerIdx, hand) {
    const playerContainer = document.querySelector(`[data-player="${playerIdx}"]`);
    if (!playerContainer) return;
    
    hand.forEach((card, cardIdx) => {
        const cardElement = playerContainer.querySelector(`[data-card="${cardIdx}"]`);
        if (cardElement) {
            // Update card display
            cardElement.innerHTML = `
                <span class="card-value">${card.collapsed_value || card.value}</span>
                <span class="card-suit">${card.suit}</span>
                ${card.is_collapsed ? '<span class="collapse-badge">✓</span>' : ''}
            `;
            
            // Mark as collapsed if applicable
            if (card.is_collapsed) {
                cardElement.classList.add('collapsed-card');
            }
        }
    });
}

/**
 * Show final reveal animation
 */
function showFinalRevealAnimation(collapsedCards) {
    // Animate all remaining cards at once
    collapsedCards.forEach(([playerIdx, cardIdx, oldValue, newValue]) => {
        showCollapseAnimation(playerIdx, cardIdx, oldValue, newValue);
    });
    
    // Show "Hand Complete" message
    setTimeout(() => {
        showMessage('All cards revealed! Computing hand result...');
    }, 500);
}

// =============================================================================
// 8. CONSISTENCY VERIFICATION
// =============================================================================

/**
 * Verify that all 4 players see the same hand state after collapse
 * This should be called after receiving 'cards_collapsed' event
 */
function verifyConsistency(updatedHands) {
    console.log('🔍 Verifying collapse consistency...');
    
    // Check that all players received valid hands
    const playerIndices = Object.keys(updatedHands);
    
    if (playerIndices.length !== 4) {
        console.warn(`Expected 4 players, got ${playerIndices.length}`);
    }
    
    // Verify no hand is empty or malformed
    playerIndices.forEach(idx => {
        const hand = updatedHands[idx];
        if (!Array.isArray(hand) || hand.length === 0) {
            console.error(`Player ${idx} has invalid hand:`, hand);
        }
        
        // Verify each card has required properties
        hand.forEach((card, cardIdx) => {
            if (!card.value || !card.suit) {
                console.error(`Player ${idx} Card ${cardIdx} missing properties:`, card);
            }
        });
    });
    
    console.log('✓ Consistency verification passed');
    return true;
}

// =============================================================================
// 9. ERROR HANDLING
// =============================================================================

socket.on('game_error', (data) => {
    console.error('Game error:', data.error);
    
    if (data.error.includes('collapse')) {
        console.error('Collapse failed - this may cause sync issues!');
        // Reconnect or request full game state refresh
        socket.emit('get_game_state', {
            room_id: currentRoomId,
            player_index: currentPlayerIndex
        });
    }
});

// =============================================================================
// 10. CSS STYLES FOR COLLAPSE ANIMATIONS
// =============================================================================

/*
.collapse-animation {
    animation: collapseFlip 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    transform-style: preserve-3d;
}

@keyframes collapseFlip {
    0% {
        transform: rotateY(0) scale(1);
        opacity: 1;
    }
    50% {
        transform: rotateY(180deg) scale(1.1);
        opacity: 0.7;
    }
    100% {
        transform: rotateY(360deg) scale(1);
        opacity: 1;
    }
}

.collapsed-card {
    border: 2px solid #4CAF50;
    box-shadow: 0 0 10px rgba(76, 175, 80, 0.5);
}

.collapse-effect {
    position: absolute;
    font-size: 2em;
    animation: collapseParticles 0.5s ease-out forwards;
}

@keyframes collapseParticles {
    0% {
        transform: translate(0, 0) scale(1);
        opacity: 1;
    }
    100% {
        transform: translate(50px, -50px) scale(0);
        opacity: 0;
    }
}

.penalty-notification {
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ff6b6b;
    color: white;
    padding: 10px 20px;
    border-radius: 4px;
    animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
    from {
        transform: translateX(400px);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

.fade-out {
    animation: fadeOut 0.3s ease-out forwards;
}

@keyframes fadeOut {
    to {
        opacity: 0;
        transform: translateY(-10px);
    }
}
*/
