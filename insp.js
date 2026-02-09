// Quantum Mus - 4 Player Game
let gameInitialized = false;
let timerInterval = null;
let aiDecisionTimeout = null;

// Export gameInitialized so it can be reset from navigation.js
Object.defineProperty(window, 'gameInitialized', {
  get: () => gameInitialized,
  set: (value) => { gameInitialized = value; }
});

// Global game state and variables
let gameState = {};
let playerNames = [];
let localPlayerIndex = 0;

function initGame() {
  console.log('initGame called');
  
  const gameContainer = document.getElementById('game-container');
  if (!gameContainer) {
    console.error('Game container not found!');
    return;
  }

  if (gameInitialized) {
    console.log('Game already initialized, skipping');
    return;
  }

  gameInitialized = true;
  console.log('Initializing game...');

  // Initialize game state
  gameState = {
    currentRound: 'MUS',
    manoIndex: 0,
    activePlayerIndex: 0,
    playerNames: ['Preskill', 'Cirac', 'Zoller', 'Deutsch'],
    teams: {
      team1: { players: [0, 2], score: 0, name: 'Copenhague' },
      team2: { players: [1, 3], score: 0, name: 'Bohmian' }
    },
    currentBet: {
      amount: 0,
      bettingTeam: null,
      betType: null,
      responses: {}
    },
    roundActions: {},
    musPhaseActive: true,
    cardsDiscarded: {},
    waitingForDiscard: false,
    allPlayersPassed: false,
    pendingPoints: {
      team1: { GRANDE: 0, CHICA: 0, PARES: 0, JUEGO: 0 },
      team2: { GRANDE: 0, CHICA: 0, PARES: 0, JUEGO: 0 }
    },
    entanglement: {
      pairs: [],
      events: [],
      statistics: {
        total_pairs: 0,
        activated_pairs: 0,
        superposition_pairs: 0,
        game_mode: '4',
        pairs_per_team: 2
      },
      playerEntanglements: {}
    }
  };

  // Asegurar que el timer esté oculto al inicio del juego
  const timerModal = document.getElementById('timer-modal');
  if (timerModal) timerModal.style.opacity = '0';
  
  // Clear any previous content
  gameContainer.innerHTML = '';
  
  // Get players and game mode from lobby (set by initializeGame)
  const lobbyPlayers = window.currentPlayers || [];
  const gameMode = window.currentGameMode || '4';
  localPlayerIndex = window.currentLocalPlayerIndex ?? 0; // Set global local player index
  
  console.log('Game Mode:', gameMode);
  console.log('Lobby Players:', lobbyPlayers);
  console.log('Local Player Index:', localPlayerIndex);
  
  const characterNames = { preskill: 'Preskill', cirac: 'Cirac', zoller: 'Zoller', deutsch: 'Deutsch' };
  
  // Build raw players from lobby
  const rawPlayers = [
    { id: 'player1', name: 'Preskill', character: 'preskill', playerName: '', score: 0 },
    { id: 'player2', name: 'Cirac', character: 'cirac', playerName: '', score: 0 },
    { id: 'player3', name: 'Zoller', character: 'zoller', playerName: '', score: 0 },
    { id: 'player4', name: 'Deutsch', character: 'deutsch', playerName: '', score: 0 }
  ];
  
  lobbyPlayers.forEach((lp, idx) => {
    if (rawPlayers[idx]) {
      rawPlayers[idx].name = characterNames[lp.character] || rawPlayers[idx].name;
      rawPlayers[idx].character = lp.character || rawPlayers[idx].character;
      rawPlayers[idx].playerName = lp.name || '';
    }
  });
  
  // Reorder so local player is always at bottom (player1): [local, opponent, teammate, opponent]
  // Teams: (0,2) vs (1,3) - so index 2 is teammate
  const L = localPlayerIndex;
  const players = [
    rawPlayers[L],
    rawPlayers[(L + 1) % 4],
    rawPlayers[(L + 2) % 4],
    rawPlayers[(L + 3) % 4]
  ].map((p, i) => ({ ...p, id: `player${i + 1}` }));
  
  // Store player names for notifications (after reordering)
  playerNames = players.map(p => p.playerName || p.name);
  
  console.log('Player order after reordering:', playerNames);
  console.log('Local player index:', localPlayerIndex);
  
  // Add quantum gate decorations to background
  addQuantumGateDecorations();
  
  // Add famous quantum circuit to background
  addQuantumCircuitToBackground();

  players.forEach((player, index) => {
    createPlayerZone(player, index, gameMode, gameContainer);
  });

  // Hacer matching de cartas entrelazadas entre player1 y player3
  matchEntangledCards();

  // Create central scoreboard
  createScoreboard(gameContainer, gameMode);

  // Animación del reparto de cartas al inicio del turno
  playDealAnimation();

  // Start the game after deal animation completes (cards take about 2-3 seconds to deal)
  setTimeout(() => {
    console.log('Starting game - first turn');
    console.log('Mano index:', gameState.manoIndex, '(' + playerNames[gameState.manoIndex] + ')');
    console.log('Current round:', gameState.currentRound);
    gameState.activePlayerIndex = gameState.manoIndex;
    updateRoundDisplay();
    updateScoreboard();
    updateManoIndicator(); // Show mano indicator
    console.log('Active player:', gameState.activePlayerIndex, '(' + playerNames[gameState.activePlayerIndex] + ')');
    startPlayerTurnTimer(gameState.activePlayerIndex);
  }, 3000);

  // ===================== BACKGROUND DECORATIONS =====================

  function addQuantumGateDecorations() {
    const gates = [
      { type: 'H', className: 'gate-h-bg', top: '15%', left: '20%' },
      { type: 'H', className: 'gate-h-bg', top: '35%', left: '65%' },
      { type: 'H', className: 'gate-h-bg', top: '70%', left: '85%' },
      { type: '', className: 'gate-cnot-bg', top: '40%', left: '35%' },
      { type: '', className: 'gate-cnot-bg', top: '60%', left: '55%' },
      { type: 'M', className: 'gate-m-bg', top: '75%', left: '40%' },
      { type: 'M', className: 'gate-m-bg', top: '25%', left: '80%' }
    ];

    gates.forEach(gate => {
      const gateEl = document.createElement('div');
      gateEl.className = `quantum-gate-bg ${gate.className}`;
      gateEl.style.top = gate.top;
      gateEl.style.left = gate.left;
      gateEl.textContent = gate.type;
      document.body.appendChild(gateEl);
    });
  }

  function addQuantumCircuitToBackground() {
    // Create a famous quantum circuit - Bell State (Quantum Entanglement)
    const circuitSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    circuitSvg.setAttribute('viewBox', '0 0 1200 300');
    circuitSvg.setAttribute('preserveAspectRatio', 'none');
    circuitSvg.style.position = 'fixed';
    circuitSvg.style.top = '50%';
    circuitSvg.style.left = '50%';
    circuitSvg.style.transform = 'translate(-50%, -50%)';
    circuitSvg.style.width = '90vw';
    circuitSvg.style.height = '40vh';
    circuitSvg.style.zIndex = '0';
    circuitSvg.style.pointerEvents = 'none';
    circuitSvg.style.opacity = '0.15';
    
    // Quantum wires
    const wire1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    wire1.setAttribute('x1', '50');
    wire1.setAttribute('y1', '80');
    wire1.setAttribute('x2', '1150');
    wire1.setAttribute('y2', '80');
    wire1.setAttribute('stroke', '#2ec4b6');
    wire1.setAttribute('stroke-width', '2');
    circuitSvg.appendChild(wire1);
    
    const wire2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    wire2.setAttribute('x1', '50');
    wire2.setAttribute('y1', '180');
    wire2.setAttribute('x2', '1150');
    wire2.setAttribute('y2', '180');
    wire2.setAttribute('stroke', '#2ec4b6');
    wire2.setAttribute('stroke-width', '2');
    circuitSvg.appendChild(wire2);
    
    // Input labels
    const input1 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    input1.setAttribute('x', '20');
    input1.setAttribute('y', '85');
    input1.setAttribute('fill', '#2ec4b6');
    input1.setAttribute('font-size', '16');
    input1.setAttribute('font-family', 'monospace');
    input1.textContent = '|0⟩';
    circuitSvg.appendChild(input1);
    
    const input2 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    input2.setAttribute('x', '20');
    input2.setAttribute('y', '185');
    input2.setAttribute('fill', '#2ec4b6');
    input2.setAttribute('font-size', '16');
    input2.setAttribute('font-family', 'monospace');
    input2.textContent = '|0⟩';
    circuitSvg.appendChild(input2);
    
    // Hadamard gate on qubit 1
    const hadamardRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    hadamardRect.setAttribute('x', '100');
    hadamardRect.setAttribute('y', '60');
    hadamardRect.setAttribute('width', '40');
    hadamardRect.setAttribute('height', '40');
    hadamardRect.setAttribute('fill', 'none');
    hadamardRect.setAttribute('stroke', '#2ec4b6');
    hadamardRect.setAttribute('stroke-width', '2');
    circuitSvg.appendChild(hadamardRect);
    
    const hadamardText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    hadamardText.setAttribute('x', '115');
    hadamardText.setAttribute('y', '90');
    hadamardText.setAttribute('fill', '#2ec4b6');
    hadamardText.setAttribute('font-size', '20');
    hadamardText.setAttribute('font-weight', 'bold');
    hadamardText.setAttribute('text-anchor', 'middle');
    hadamardText.textContent = 'H';
    circuitSvg.appendChild(hadamardText);
    
    // Wire from hadamard
    const wire3 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    wire3.setAttribute('x1', '140');
    wire3.setAttribute('y1', '80');
    wire3.setAttribute('x2', '200');
    wire3.setAttribute('y2', '80');
    wire3.setAttribute('stroke', '#2ec4b6');
    wire3.setAttribute('stroke-width', '2');
    circuitSvg.appendChild(wire3);
    
    // CNOT gate
    // Control circle on qubit 1
    const controlCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    controlCircle.setAttribute('cx', '230');
    controlCircle.setAttribute('cy', '80');
    controlCircle.setAttribute('r', '5');
    controlCircle.setAttribute('fill', '#2ec4b6');
    circuitSvg.appendChild(controlCircle);
    
    // Vertical line connecting qubits
    const verticalLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    verticalLine.setAttribute('x1', '230');
    verticalLine.setAttribute('y1', '80');
    verticalLine.setAttribute('x2', '230');
    verticalLine.setAttribute('y2', '180');
    verticalLine.setAttribute('stroke', '#2ec4b6');
    verticalLine.setAttribute('stroke-width', '2');
    circuitSvg.appendChild(verticalLine);
    
    // Target gate (circle with cross)
    const targetCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    targetCircle.setAttribute('cx', '230');
    targetCircle.setAttribute('cy', '180');
    targetCircle.setAttribute('r', '8');
    targetCircle.setAttribute('fill', 'none');
    targetCircle.setAttribute('stroke', '#2ec4b6');
    targetCircle.setAttribute('stroke-width', '2');
    circuitSvg.appendChild(targetCircle);
    
    const targetCrossH = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    targetCrossH.setAttribute('x1', '222');
    targetCrossH.setAttribute('y1', '180');
    targetCrossH.setAttribute('x2', '238');
    targetCrossH.setAttribute('y2', '180');
    targetCrossH.setAttribute('stroke', '#2ec4b6');
    targetCrossH.setAttribute('stroke-width', '2');
    circuitSvg.appendChild(targetCrossH);
    
    const targetCrossV = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    targetCrossV.setAttribute('x1', '230');
    targetCrossV.setAttribute('y1', '172');
    targetCrossV.setAttribute('x2', '230');
    targetCrossV.setAttribute('y2', '188');
    targetCrossV.setAttribute('stroke', '#2ec4b6');
    targetCrossV.setAttribute('stroke-width', '2');
    circuitSvg.appendChild(targetCrossV);
    
    // Wires after CNOT
    const wire4 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    wire4.setAttribute('x1', '230');
    wire4.setAttribute('y1', '80');
    wire4.setAttribute('x2', '350');
    wire4.setAttribute('y2', '80');
    wire4.setAttribute('stroke', '#2ec4b6');
    wire4.setAttribute('stroke-width', '2');
    circuitSvg.appendChild(wire4);
    
    const wire5 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    wire5.setAttribute('x1', '230');
    wire5.setAttribute('y1', '180');
    wire5.setAttribute('x2', '350');
    wire5.setAttribute('y2', '180');
    wire5.setAttribute('stroke', '#2ec4b6');
    wire5.setAttribute('stroke-width', '2');
    circuitSvg.appendChild(wire5);
    
    // Measurement gates
    const measurementGates = [
      { x: '370', y: '70', wire: '80' },
      { x: '370', y: '170', wire: '180' }
    ];
    
    measurementGates.forEach(gate => {
      const measureBox = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      measureBox.setAttribute('d', `M ${gate.x} ${gate.y} L ${parseInt(gate.x) + 35} ${gate.y} L ${parseInt(gate.x) + 35} ${parseInt(gate.y) + 35} L ${parseInt(gate.x) + 17} ${parseInt(gate.y) + 50} L ${gate.x} ${parseInt(gate.y) + 35} Z`);
      measureBox.setAttribute('fill', 'none');
      measureBox.setAttribute('stroke', '#a78bfa');
      measureBox.setAttribute('stroke-width', '2');
      circuitSvg.appendChild(measureBox);
      
      const measureArrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      measureArrow.setAttribute('d', `M ${parseInt(gate.x) + 17} ${parseInt(gate.y) + 25} Q ${parseInt(gate.x) + 25} ${parseInt(gate.y) + 15} ${parseInt(gate.x) + 30} ${parseInt(gate.y) + 10}`);
      measureArrow.setAttribute('fill', 'none');
      measureArrow.setAttribute('stroke', '#a78bfa');
      measureArrow.setAttribute('stroke-width', '1.5');
      circuitSvg.appendChild(measureArrow);
    });
    
    // Output wires
    const wire6 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    wire6.setAttribute('x1', '420');
    wire6.setAttribute('y1', '80');
    wire6.setAttribute('x2', '1150');
    wire6.setAttribute('y2', '80');
    wire6.setAttribute('stroke', '#2ec4b6');
    wire6.setAttribute('stroke-width', '2');
    circuitSvg.appendChild(wire6);
    
    const wire7 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    wire7.setAttribute('x1', '420');
    wire7.setAttribute('y1', '180');
    wire7.setAttribute('x2', '1150');
    wire7.setAttribute('y2', '180');
    wire7.setAttribute('stroke', '#2ec4b6');
    wire7.setAttribute('stroke-width', '2');
    circuitSvg.appendChild(wire7);
    
    // Circuit title
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    title.setAttribute('x', '600');
    title.setAttribute('y', '30');
    title.setAttribute('fill', '#2ec4b6');
    title.setAttribute('font-size', '18');
    title.setAttribute('font-weight', 'bold');
    title.setAttribute('text-anchor', 'middle');
    title.setAttribute('font-family', 'Georgia, serif');
    title.textContent = 'Bell State Circuit (Quantum Entanglement)';
    circuitSvg.appendChild(title);
    
    document.body.appendChild(circuitSvg);
  }

  // ===================== ROUND MANAGEMENT FUNCTIONS =====================
  
  // Handle MUS round - players decide to mus or not
  function handleMusRound(playerIndex, action, extraData = {}) {
    console.log(`Player ${playerIndex + 1} chose: ${action}`);
    
    // Clear any pending timers to prevent double-execution
    if (timerInterval) {
      clearTimeout(timerInterval);
      timerInterval = null;
    }
    if (aiDecisionTimeout) {
      clearTimeout(aiDecisionTimeout);
      aiDecisionTimeout = null;
    }
    
    gameState.roundActions[playerIndex] = action;
    
    // Show action notification
    showActionNotification(playerIndex, action, extraData);
    
    if (action === 'mus') {
      // Check if all players have responded (all 4 players must decide)
      const playersWhoHaveResponded = Object.keys(gameState.roundActions).length;
      
      if (playersWhoHaveResponded === 4) {
        // All 4 players have responded - check if all said MUS
        const allMus = Object.values(gameState.roundActions).every(a => a === 'mus');
        
        if (allMus) {
          // Everyone wants mus - start discard phase
          console.log('All players chose MUS - starting discard phase');
          startDiscardPhase();
        } else {
          // This shouldn't happen because paso/envido ends MUS phase immediately
          console.warn('Unexpected state: not all MUS but 4 players responded');
        }
      } else {
        // Move to next player in COUNTER-CLOCKWISE order: 0→3→2→1
        nextPlayer();
        startPlayerTurnTimer(gameState.activePlayerIndex);
      }
    } else if (action === 'paso') {
      // Someone cut MUS with paso - move to GRANDE with NO bet
      gameState.musPhaseActive = false;
      gameState.currentRound = 'GRANDE';
      gameState.musCutterIndex = playerIndex; // Store who cut MUS
      
      // NO betting - clear bet state
      gameState.currentBet.amount = 0;
      gameState.currentBet.betType = null;
      gameState.currentBet.bettingTeam = null;
      gameState.currentBet.responses = {};
      
      console.log(`MUS cut by player ${playerIndex + 1} with PASO - moving to GRANDE with no bet`);
      moveToGrandeRound();
    } else if (action === 'envido' || action === 'ordago') {
      // Someone ended mus phase with a bet - move to Grande round with betting
      gameState.musPhaseActive = false;
      gameState.currentRound = 'GRANDE';
      gameState.currentBet.amount = extraData.amount || (action === 'ordago' ? 40 : 0);
      gameState.currentBet.betType = action;
      gameState.currentBet.bettingTeam = getPlayerTeam(playerIndex);
      gameState.musCutterIndex = playerIndex; // Store who cut MUS
      
      console.log(`Betting started by ${gameState.playerActualNames?.[playerIndex] || `Player ${playerIndex+1}`} (team ${gameState.currentBet.bettingTeam}), amount: ${gameState.currentBet.amount}`);
      
      // Reset responses and move to GRANDE round
      gameState.currentBet.responses = {};
      moveToGrandeRound();
    }
  }
  
  // Handle card discard
  function handleDiscard(playerIndex, cardIndices) {
    console.log(`Player ${playerIndex + 1} discarded ${cardIndices.length} cards`);
    gameState.cardsDiscarded[playerIndex] = cardIndices;
    
    // Check if all players have discarded
    if (Object.keys(gameState.cardsDiscarded).length === 4) {
      console.log('All players discarded - dealing new cards and restarting MUS round');
      
      // Clear the all-players timer
      if (timerInterval) {
        clearTimeout(timerInterval);
        timerInterval = null;
      }
      
      // All players discarded - deal new cards and restart mus round
      dealNewCards();
      gameState.cardsDiscarded = {};
      gameState.roundActions = {};
      gameState.waitingForDiscard = false;
      gameState.activePlayerIndex = gameState.manoIndex;
      
      // Start next turn with mano
      console.log(`Starting new MUS round with player ${gameState.activePlayerIndex + 1} as active player`);
      startPlayerTurnTimer(gameState.activePlayerIndex);
    }
  }
  
  // Handle betting round (Grande, Chica, Pares, Juego)
  function handleBettingRound(playerIndex, action, betAmount = 0) {
    console.log(`Player ${playerIndex + 1} in betting round ${gameState.currentRound}: ${action}, bet amount: ${betAmount}`);
    console.log('[handleBettingRound] Running in local mode');
    
    console.log('Current bet state:', gameState.currentBet);
    
    // Show action notification
    showActionNotification(playerIndex, action, { amount: betAmount });
    
    const playerTeam = getPlayerTeam(playerIndex);
    const opponentTeam = getOpponentTeam(playerTeam);
    
    if (action === 'paso') {
      // Player passes
      gameState.currentBet.responses[playerIndex] = 'paso';
      console.log(`Player ${playerIndex + 1} passed, responses now:`, gameState.currentBet.responses);
      
      if (gameState.currentBet.bettingTeam) {
        // Check if all defenders have passed
        const defendingPlayers = gameState.teams[playerTeam].players;
        const defendingResponses = defendingPlayers.map(p => gameState.currentBet.responses[p]);
        const allDefendersPassed = defendingResponses.length === 2 && defendingResponses.every(r => r === 'paso');
        
        if (allDefendersPassed) {
          // Betting team wins
          const points = gameState.currentBet.isRaise ? gameState.currentBet.previousAmount : 1;
          gameState.teams[gameState.currentBet.bettingTeam].score += points;
          console.log(`Team ${gameState.currentBet.bettingTeam} wins ${points} points`);
          showTeamPointsNotification(gameState.currentBet.bettingTeam, points);
          updateScoreboard();
          
          if (gameState.currentBet.betType === 'ordago') {
            freezeGameState();
            revealAllCards();
            setTimeout(() => {
              showOrdagoWinner(gameState.currentBet.bettingTeam);
            }, 3000);
            return;
          }
          
          if (gameState.teams[gameState.currentBet.bettingTeam].score >= 40) {
            freezeGameState();
            showGameOver(gameState.currentBet.bettingTeam);
            return;
          }
          
          setTimeout(() => {
            moveToNextRound();
          }, 2000);
        } else {
          // Move to next defender
          const otherDefender = getOtherOpponentPlayer(playerTeam, playerIndex);
          gameState.activePlayerIndex = otherDefender;
          startPlayerTurnTimer(gameState.activePlayerIndex);
        }
      } else {
        // No bet yet
        nextPlayer();
        if (gameState.activePlayerIndex === gameState.manoIndex && playerIndex !== gameState.manoIndex) {
          setTimeout(() => {
            moveToNextRound();
          }, 2000);
        } else {
          startPlayerTurnTimer(gameState.activePlayerIndex);
        }
      }
    } else if (action === 'accept') {
      gameState.currentBet.responses[playerIndex] = 'accept';
      
      if (gameState.currentBet.betType === 'ordago') {
        freezeGameState();
        revealAllCards();
        setTimeout(() => {
          const roundWinner = calculateRoundWinner();
          showOrdagoWinner(roundWinner);
        }, 3000);
      } else {
        const points = gameState.currentBet.amount || 1;
        gameState.pendingPoints[gameState.currentBet.bettingTeam][gameState.currentRound] = points;
        moveToNextRound();
      }
    } else if (action === 'envido' || action === 'raise') {
      console.log(`[BET] Player ${playerIndex + 1} (${playerTeam}) makes/raises bet to ${betAmount}`);
      
      const isRaise = gameState.currentBet.bettingTeam && gameState.currentBet.bettingTeam !== playerTeam;
      const previousAmount = gameState.currentBet.amount || 0;
      
      gameState.currentBet.previousAmount = previousAmount;
      gameState.currentBet.amount = betAmount;
      gameState.currentBet.bettingTeam = playerTeam;
      gameState.currentBet.betType = 'envido';
      gameState.currentBet.isRaise = isRaise;
      gameState.currentBet.responses = {};
      
      let nextOpponent;
      if (action === 'envido' && !isRaise) {
        const manoTeam = getPlayerTeam(gameState.manoIndex);
        if (manoTeam === opponentTeam) {
          nextOpponent = gameState.manoIndex;
        } else {
          nextOpponent = getFirstOpponentFromMano(opponentTeam);
        }
      } else {
        const manoTeam = getPlayerTeam(gameState.manoIndex);
        if (manoTeam === opponentTeam) {
          nextOpponent = gameState.manoIndex;
        } else {
          nextOpponent = getFirstOpponentFromMano(opponentTeam);
        }
      }
      
      gameState.activePlayerIndex = nextOpponent;
      startPlayerTurnTimer(gameState.activePlayerIndex);
      updateScoreboard();
    } else if (action === 'ordago') {
      console.log(`Player ${playerIndex + 1} declares ORDAGO!`);
      
      gameState.currentBet.amount = 40;
      gameState.currentBet.bettingTeam = playerTeam;
      gameState.currentBet.betType = 'ordago';
      gameState.currentBet.responses = {};
      
      const manoTeam = getPlayerTeam(gameState.manoIndex);
      const isRaise = gameState.currentBet.bettingTeam && gameState.currentBet.bettingTeam !== playerTeam;
      
      let nextOpponent;
      if (manoTeam === opponentTeam) {
        nextOpponent = gameState.manoIndex;
      } else {
        nextOpponent = getFirstOpponentFromMano(opponentTeam);
      }
      
      gameState.activePlayerIndex = nextOpponent;
      startPlayerTurnTimer(gameState.activePlayerIndex);
      updateScoreboard();
    }
  }
  
  // Move to the next round
  function moveToNextRound(forcedRound = null, skipReset = false) {
    const roundOrder = ['MUS', 'GRANDE', 'CHICA', 'PARES', 'JUEGO'];

    if (forcedRound) {
      gameState.currentRound = forcedRound;
    } else {
      const currentIndex = roundOrder.indexOf(gameState.currentRound);
      
      // PUNTO is a special case - it's the final betting round (alternative to JUEGO)
      if (gameState.currentRound === 'PUNTO') {
        // PUNTO betting finished - reveal cards first
        console.log('PUNTO round finished - revealing all cards');
        revealAllCards();
        
        // Then finish hand after cards are revealed
        setTimeout(() => {
          finishHand();
        }, 2000);
        return;
      } else if (currentIndex < roundOrder.length - 1) {
        gameState.currentRound = roundOrder[currentIndex + 1];
      } else {
        // End of all rounds (JUEGO finished) - reveal cards first
        console.log('JUEGO round finished - revealing all cards');
        revealAllCards();
        
        // Then finish hand after cards are revealed
        setTimeout(() => {
          finishHand();
        }, 2000);
        return;
      }
    }

    // Reset round state (clear bets and responses)
    if (!skipReset) {
      resetRoundState();
    }

    // Always start new round from mano
    gameState.activePlayerIndex = gameState.manoIndex;
    console.log(`[MOVE TO ROUND] Moving to ${gameState.currentRound}. Starting with mano (Player ${gameState.manoIndex + 1})`);
    
    updateRoundDisplay();

    // For PARES and JUEGO, start declaration phase (mano declares first)
    if (gameState.currentRound === 'PARES') {
      startParesDeclaration();
    } else if (gameState.currentRound === 'JUEGO') {
      startJuegoDeclaration();
    } else {
      // For GRANDE and CHICA, start betting from mano
      startPlayerTurnTimer(gameState.activePlayerIndex);
    }
  }
  
  // Reveal cards and score the round
  function revealAndScoreRound() {
    // Calculate winner based on current round type
    const winner = calculateRoundWinner();
    const points = gameState.currentBet.amount || 1;
    
    // Store points as pending - they will be awarded at hand end
    // Exception: Points are awarded immediately for rejected bets and ordago (handled elsewhere)
    if (gameState.currentRound !== 'MUS') {
      gameState.pendingPoints[winner][gameState.currentRound] = points;
      console.log(`Storing ${points} pending points for ${winner} in ${gameState.currentRound}`);
    }
    
    // Show result modal
    showRoundResult(winner, points);
    
    // Move to next round after delay
    setTimeout(() => {
      moveToNextRound();
    }, 3000);
  }
  
  // Calculate round winner based on card values
  function calculateRoundWinner() {
    // Get all players' cards
    const hands = {};
    for (let i = 0; i < 4; i++) {
      hands[i] = getPlayerCards(i);
    }
    
    let winningTeam = 'team1';
    
    if (gameState.currentRound === 'GRANDE') {
      // Higher cards win
      winningTeam = compareHighCards(hands);
    } else if (gameState.currentRound === 'CHICA') {
      // Lower cards win
      winningTeam = compareLowCards(hands);
    }
    
    return winningTeam;
  }
  
  // Compare hands for Grande (higher cards)
  function compareHighCards(hands) {
    // Card order for 8 reyes: K(or 3) > Q > J > 7 > 6 > 5 > 4 > 3 > 1(or 2)
    const gameMode = window.currentGameMode || '4';
    const cardOrder = gameMode === '8' 
      ? ['K', '3', 'Q', 'J', '7', '6', '5', '4', 'A', '2']
      : ['K', 'Q', 'J', '7', '6', '5', '4', '3', '2', 'A'];
    
    // Compare team hands
    const team1Best = Math.max(...[hands[0], hands[2]].map(h => getHandValue(h, cardOrder)));
    const team2Best = Math.max(...[hands[1], hands[3]].map(h => getHandValue(h, cardOrder)));
    
    return team1Best >= team2Best ? 'team1' : 'team2';
  }
  
  // Compare hands for Chica (lower cards)
  function compareLowCards(hands) {
    const gameMode = window.currentGameMode || '4';
    const cardOrder = gameMode === '8' 
      ? ['K', '3', 'Q', 'J', '7', '6', '5', '4', 'A', '2']
      : ['K', 'Q', 'J', '7', '6', '5', '4', '3', '2', 'A'];
    
    // For Chica, reverse the order (lower is better)
    const team1Best = Math.min(...[hands[0], hands[2]].map(h => getHandValue(h, cardOrder)));
    const team2Best = Math.min(...[hands[1], hands[3]].map(h => getHandValue(h, cardOrder)));
    
    return team1Best <= team2Best ? 'team1' : 'team2';
  }
  
  // Get hand value for comparison
  function getHandValue(hand, cardOrder) {
    // Find highest card in hand
    let bestValue = -1;
    hand.forEach(card => {
      const index = cardOrder.indexOf(card.value);
      if (index !== -1) {
        bestValue = Math.max(bestValue, cardOrder.length - index);
      }
    });
    return bestValue;
  }
  
  // Get player's current cards
  function getPlayerCards(playerIndex) {
    const playerId = `player${playerIndex + 1}`;
    const cards = document.querySelectorAll(`#${playerId}-zone .quantum-card`);
    return Array.from(cards).map(card => ({
      value: card.dataset.mainValue || card.dataset.value,
      suit: card.dataset.suit
    }));
  }
  
  // ===================== PARES ROUND =====================
  
  // Check if player has entangled cards that could affect PARES
  function hasEntangledCardsForPares(playerIndex) {
    const cards = getPlayerCards(playerIndex);
    const gameMode = window.currentGameMode || '4';
    const playerId = `player${playerIndex + 1}`;
    const cardElements = document.querySelectorAll(`#${playerId}-zone .quantum-card`);
    
    let hasEntangled = false;
    cardElements.forEach(card => {
      if (card.dataset.entangled === 'true') {
        hasEntangled = true;
      }
    });
    
    return hasEntangled;
  }
  
  // Auto-declare for PARES if result is certain (no ambiguity)
  function autoDeclarePares(playerIndex) {
    const cards = getPlayerCards(playerIndex);
    const playerId = `player${playerIndex + 1}`;
    const cardElements = document.querySelectorAll(`#${playerId}-zone .quantum-card`);
    const gameMode = window.currentGameMode || '4';
    
    // Get entangled card indices and their possible values
    const entangledIndices = [];
    const entangledPossibleValues = []; // Array of [mainValue, partnerValue] for each entangled card
    
    cardElements.forEach((cardEl, idx) => {
      if (cardEl.dataset.entangled === 'true') {
        entangledIndices.push(idx);
        const mainValue = cardEl.dataset.mainValue || cardEl.dataset.value;
        const partnerValue = cardEl.dataset.partner;
        entangledPossibleValues.push([mainValue, partnerValue]);
      }
    });
    
    const hasEntangled = entangledIndices.length > 0;
    
    if (!hasEntangled) {
      // No entangled cards - simple case
      const paresResult = calculatePares(cards);
      const hasPares = paresResult !== null;
      console.log(`Player ${playerIndex + 1} auto-declared PARES: ${hasPares} (no entangled cards)`);
      console.log(`  Cards: ${cards.map(c => c.value).join(', ')} | Mode: ${gameMode} | Result:`, paresResult);
      
      if (playerIndex === localPlayerIndex) {
        showAutoDeclarationMessage(hasPares ? 'TENGO PARES' : 'NO TENGO PARES');
        setTimeout(() => {
          handleParesDeclaration(playerIndex, hasPares, true);
        }, 1500);
      } else {
        setTimeout(() => {
          handleParesDeclaration(playerIndex, hasPares, true);
        }, 1000);
      }
      return true;
    }
    
    // Has entangled cards - check if outcome is certain
    console.log(`[autoDeclarePares] Player ${playerIndex + 1}: ${cards.length} cards, ${entangledIndices.length} entangled`);
    console.log(`[autoDeclarePares] All cards:`, cards.map(c => c.value));
    console.log(`[autoDeclarePares] Entangled possible values:`, entangledPossibleValues);
    
    // Check all possible combinations of entangled card values
    let canHavePares = false;
    let canNotHavePares = false;
    
    function checkCombination(combination) {
      // Rebuild full hand with non-entangled cards in place and test values for entangled positions
      const testCards = cards.map((card, idx) => {
        if (entangledIndices.includes(idx)) {
          // This is an entangled position - use test value
          const entangledPosition = entangledIndices.indexOf(idx);
          return { value: combination[entangledPosition], suit: card.suit };
        } else {
          // Not entangled - use original card
          return card;
        }
      });
      
      const result = calculatePares(testCards);
      if (result !== null) {
        canHavePares = true;
      } else {
        canNotHavePares = true;
      }
    }
    
    // Generate all combinations for entangled cards (only their specific possible values)
    function generateCombinations(depth, current) {
      if (depth === entangledIndices.length) {
        checkCombination(current);
        return;
      }
      // Use only the two possible values for this specific entangled card
      const possibleValues = entangledPossibleValues[depth];
      for (const value of possibleValues) {
        generateCombinations(depth + 1, [...current, value]);
        if (canHavePares && canNotHavePares) return; // Early exit
      }
    }
    
    generateCombinations(0, []);
    
    // If outcome is certain (all combinations give same result), auto-declare
    if (canHavePares && !canNotHavePares) {
      // Always has pares regardless of entangled values
      console.log(`Player ${playerIndex + 1} auto-declared PARES: true (certain with entangled cards)`);
      if (playerIndex === localPlayerIndex) {
        showAutoDeclarationMessage('TENGO PARES');
        setTimeout(() => {
          handleParesDeclaration(playerIndex, true, true);
        }, 1500);
      } else {
        setTimeout(() => {
          handleParesDeclaration(playerIndex, true, true);
        }, 1000);
      }
      return true;
    } else if (!canHavePares && canNotHavePares) {
      // Never has pares regardless of entangled values
      console.log(`Player ${playerIndex + 1} auto-declared PARES: false (certain with entangled cards)`);
      if (playerIndex === localPlayerIndex) {
        showAutoDeclarationMessage('NO TENGO PARES');
        setTimeout(() => {
          handleParesDeclaration(playerIndex, false, true);
        }, 1500);
      } else {
        setTimeout(() => {
          handleParesDeclaration(playerIndex, false, true);
        }, 1000);
      }
      return true;
    }
    
    // Outcome is uncertain - player must choose
    console.log(`Player ${playerIndex + 1} has entangled cards - outcome uncertain, must choose manually`);
    return false;
  }
  
  function startParesDeclaration() {
    console.log('Starting PARES declaration');
    gameState.paresDeclarations = {};
    gameState.activePlayerIndex = gameState.manoIndex;
    proceedWithParesDeclaration();
  }
  
  function proceedWithParesDeclaration() {
    // Process declarations for all players in order starting from current active player
    if (Object.keys(gameState.paresDeclarations).length === 4) {
      // All players have declared - proceed to betting or next round
      handleAllParesDeclarationsDone();
      return;
    }
    
    // Try to auto-declare for current player
    const canAutoDeclarePares = shouldAutoDeclarePares(gameState.activePlayerIndex);
    
    if (canAutoDeclarePares) {
      // Will auto-declare after a short delay
      const autoResult = getAutoParesDeclaration(gameState.activePlayerIndex);
      setTimeout(() => {
        handleParesDeclaration(gameState.activePlayerIndex, autoResult, true);
        nextPlayer();
        proceedWithParesDeclaration();
      }, 800);
    } else {
      // Player needs to manually declare
      updateScoreboard();
      startPlayerTurnTimer(gameState.activePlayerIndex);
    }
  }
  
  function shouldAutoDeclarePares(playerIndex) {
    const cards = getPlayerCards(playerIndex);
    const playerId = `player${playerIndex + 1}`;
    const cardElements = document.querySelectorAll(`#${playerId}-zone .quantum-card`);
    
    let hasEntangled = false;
    cardElements.forEach(card => {
      if (card.dataset.entangled === 'true') {
        hasEntangled = true;
      }
    });
    
    if (!hasEntangled) {
      // No entangled cards - can auto-declare
      return true;
    }
    
    // Has entangled cards - check if outcome is certain
    const entangledIndices = [];
    const entangledPossibleValues = [];
    
    cardElements.forEach((cardEl, idx) => {
      if (cardEl.dataset.entangled === 'true') {
        entangledIndices.push(idx);
        const mainValue = cardEl.dataset.mainValue || cardEl.dataset.value;
        const partnerValue = cardEl.dataset.partner;
        entangledPossibleValues.push([mainValue, partnerValue]);
      }
    });
    
    let canHavePares = false;
    let canNotHavePares = false;
    
    function checkCombination(combination) {
      const testCards = cards.map((card, idx) => {
        if (entangledIndices.includes(idx)) {
          const entangledPosition = entangledIndices.indexOf(idx);
          return { value: combination[entangledPosition], suit: card.suit };
        } else {
          return card;
        }
      });
      
      const result = calculatePares(testCards);
      if (result !== null) {
        canHavePares = true;
      } else {
        canNotHavePares = true;
      }
    }
    
    function generateCombinations(depth, current) {
      if (depth === entangledIndices.length) {
        checkCombination(current);
        return;
      }
      const possibleValues = entangledPossibleValues[depth];
      for (const value of possibleValues) {
        generateCombinations(depth + 1, [...current, value]);
        if (canHavePares && canNotHavePares) return;
      }
    }
    
    generateCombinations(0, []);
    return !(canHavePares && canNotHavePares); // Can auto-declare if outcome is certain
  }
  
  function getAutoParesDeclaration(playerIndex) {
    const cards = getPlayerCards(playerIndex);
    const playerId = `player${playerIndex + 1}`;
    const cardElements = document.querySelectorAll(`#${playerId}-zone .quantum-card`);
    
    let hasEntangled = false;
    const entangledIndices = [];
    const entangledPossibleValues = [];
    
    cardElements.forEach((cardEl, idx) => {
      if (cardEl.dataset.entangled === 'true') {
        hasEntangled = true;
        entangledIndices.push(idx);
        const mainValue = cardEl.dataset.mainValue || cardEl.dataset.value;
        const partnerValue = cardEl.dataset.partner;
        entangledPossibleValues.push([mainValue, partnerValue]);
      }
    });
    
    if (!hasEntangled) {
      const paresResult = calculatePares(cards);
      return paresResult !== null;
    }
    
    let canHavePares = false;
    let canNotHavePares = false;
    
    function checkCombination(combination) {
      const testCards = cards.map((card, idx) => {
        if (entangledIndices.includes(idx)) {
          const entangledPosition = entangledIndices.indexOf(idx);
          return { value: combination[entangledPosition], suit: card.suit };
        } else {
          return card;
        }
      });
      
      const result = calculatePares(testCards);
      if (result !== null) {
        canHavePares = true;
      } else {
        canNotHavePares = true;
      }
    }
    
    function generateCombinations(depth, current) {
      if (depth === entangledIndices.length) {
        checkCombination(current);
        return;
      }
      const possibleValues = entangledPossibleValues[depth];
      for (const value of possibleValues) {
        generateCombinations(depth + 1, [...current, value]);
        if (canHavePares && canNotHavePares) return;
      }
    }
    
    generateCombinations(0, []);
    
    if (canHavePares && !canNotHavePares) {
      return true;
    } else if (!canHavePares && canNotHavePares) {
      return false;
    }
    
    return true; // Default to tengo
  }
  
  function handleParesDeclaration(playerIndex, declaration, isAutoDeclared = false) {
    // declaration can be: true (tengo), false (no tengo), or 'puede'
    gameState.paresDeclarations[playerIndex] = declaration;
    
    // Show notification based on declaration
    const notificationType = declaration === true ? 'pares' : 
                            declaration === false ? 'no_pares' : 'puede_pares';
    showActionNotification(playerIndex, notificationType);
    
    // Trigger collapse only if declaration is TENGO (has pares) AND not auto-declared
    if (declaration === true && !isAutoDeclared) {
      collapseOnDeclaration(playerIndex, 'PARES', declaration);
    }
    
    // Check if all players declared
    if (Object.keys(gameState.paresDeclarations).length < 4) {
      // Still need more declarations
      return;
    }
    
    // All players have declared
    handleAllParesDeclarationsDone();
  }
  
  function handleAllParesDeclarationsDone() {
    // Count declarations per team
    const team1TengoCount = gameState.teams.team1.players.filter(p => gameState.paresDeclarations[p] === true).length;
    const team2TengoCount = gameState.teams.team2.players.filter(p => gameState.paresDeclarations[p] === true).length;
    
    const team1PuedeOrTengoCount = gameState.teams.team1.players.filter(p => 
      gameState.paresDeclarations[p] === true || gameState.paresDeclarations[p] === 'puede'
    ).length;
    const team2PuedeOrTengoCount = gameState.teams.team2.players.filter(p => 
      gameState.paresDeclarations[p] === true || gameState.paresDeclarations[p] === 'puede'
    ).length;
    
    console.log(`PARES declarations - Team1 tengo: ${team1TengoCount}, puede/tengo: ${team1PuedeOrTengoCount}`);
    console.log(`PARES declarations - Team2 tengo: ${team2TengoCount}, puede/tengo: ${team2PuedeOrTengoCount}`);
    
    // Determine if betting should happen
    const canBet = (team1TengoCount > 0 && team2PuedeOrTengoCount > 0) || 
                   (team2TengoCount > 0 && team1PuedeOrTengoCount > 0);
    
    if (!canBet) {
      // No betting possible - no points awarded
      console.log('Skipping PARES betting - no competition, no points awarded');
      
      // Just move to next round (no points, no cards revealed)
      setTimeout(() => moveToNextRound(), 1000);
    } else {
      // Start PARES betting (only TENGO and PUEDE players can bet)
      console.log('Starting PARES betting - both teams can compete');
      
      // Reset bet state for betting phase
      gameState.currentBet = {
        amount: 0,
        previousAmount: 0,
        bettingTeam: null,
        betType: null,
        isRaise: false,
        responses: {}
      };
      
      // Start from mano, but if mano can't bet, move to next eligible player
      gameState.activePlayerIndex = gameState.manoIndex;
      if (!canPlayerBet(gameState.activePlayerIndex)) {
        console.log(`Mano (Player ${gameState.manoIndex + 1}) cannot bet, finding next eligible player`);
        nextPlayerWhoCanBet();
      }
      
      console.log(`Starting PARES betting with Player ${gameState.activePlayerIndex + 1}`);
      
      // Force UI update to show betting buttons
      console.log('Updating UI for PARES betting phase');
      updateScoreboard();
      
      // Small delay to ensure UI updates before starting timer
      setTimeout(() => {
        console.log(`Starting timer for mano (Player ${gameState.activePlayerIndex + 1})`);
        startPlayerTurnTimer(gameState.activePlayerIndex);
      }, 100);
    }
  }
  
  function calculatePares(cards) {
    const gameMode = window.currentGameMode || '4';
    
    console.log(`[calculatePares] Mode: ${gameMode}, Cards: ${cards.map(c => c.value).join(', ')}`);
    
    // Card equivalence for PARES:
    // In "8 reyes" mode: A=2 and 3=K count as same for pairs
    // In normal mode: cards must match exactly
    const normalizePareValue = (value) => {
      if (gameMode === '8') {
        // In 8 reyes mode: A=2 are equivalent, 3=K are equivalent
        if (value === 'A' || value === '2') return 'A';
        if (value === '3' || value === 'K') return 'K';
        return value;
      } else {
        // In normal mode: NO normalization - cards must match exactly
        return value;
      }
    };
    
    const valueCounts = {};
    cards.forEach(card => {
      const normalizedValue = normalizePareValue(card.value);
      valueCounts[normalizedValue] = (valueCounts[normalizedValue] || 0) + 1;
    });
    
    console.log(`[calculatePares] Value counts:`, valueCounts);
    
    // Check for pairs, triplets, double pairs
    const counts = Object.values(valueCounts).sort((a, b) => b - a);
    const values = Object.keys(valueCounts);
    
    if (counts[0] === 3) {
      // Triplet
      const tripletValue = values.find(v => valueCounts[v] === 3);
      return { type: 'triplet', value: tripletValue, rank: 2 };
    } else if (counts[0] === 2 && counts[1] === 2) {
      // Double pair
      const pairValues = values.filter(v => valueCounts[v] === 2).sort((a, b) => {
        const order = gameMode === '8' ? ['A', '4', '5', '6', '7', 'J', 'Q', 'K'] : ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K'];
        return order.indexOf(b) - order.indexOf(a);
      });
      return { type: 'double_pair', value: pairValues[0], rank: 3 };
    } else if (counts[0] === 2) {
      // Single pair
      const pairValue = values.find(v => valueCounts[v] === 2);
      return { type: 'pair', value: pairValue, rank: 1 };
    }
    
    return null;
  }
  
  // ===================== JUEGO ROUND =====================
  
  // Check if player has entangled cards that could affect JUEGO
  function hasEntangledCardsForJuego(playerIndex) {
    const playerId = `player${playerIndex + 1}`;
    const cardElements = document.querySelectorAll(`#${playerId}-zone .quantum-card`);
    
    let hasEntangled = false;
    cardElements.forEach(card => {
      if (card.dataset.entangled === 'true') {
        hasEntangled = true;
      }
    });
    
    return hasEntangled;
  }
  
  // Auto-declare for JUEGO if result is certain (no ambiguity)
  function autoDeclareJuego(playerIndex) {
    const cards = getPlayerCards(playerIndex);
    const playerId = `player${playerIndex + 1}`;
    const cardElements = document.querySelectorAll(`#${playerId}-zone .quantum-card`);
    const gameMode = window.currentGameMode || '4';
    
    // Get entangled card indices and their possible values
    const entangledIndices = [];
    const entangledPossibleValues = []; // Array of [mainValue, partnerValue] for each entangled card
    
    cardElements.forEach((cardEl, idx) => {
      if (cardEl.dataset.entangled === 'true') {
        entangledIndices.push(idx);
        const mainValue = cardEl.dataset.mainValue || cardEl.dataset.value;
        const partnerValue = cardEl.dataset.partner;
        entangledPossibleValues.push([mainValue, partnerValue]);
      }
    });
    
    const hasEntangled = entangledIndices.length > 0;
    
    if (!hasEntangled) {
      // No entangled cards - simple case
      const juegoResult = calculateJuego(cards);
      const hasJuego = juegoResult.hasJuego;
      console.log(`Player ${playerIndex + 1} auto-declared JUEGO: ${hasJuego} (no entangled cards)`);
      
      if (playerIndex === localPlayerIndex) {
        showAutoDeclarationMessage(hasJuego ? 'JUEGO' : 'NO JUEGO');
        setTimeout(() => {
          handleJuegoDeclaration(playerIndex, hasJuego, true);
        }, 1500);
      } else {
        setTimeout(() => {
          handleJuegoDeclaration(playerIndex, hasJuego, true);
        }, 1000);
      }
      return true;
    }
    
    // Has entangled cards - calculate min/max possible sums
    const getCardPoints = (val) => {
      if (val === 'A') return 1;
      if (val === '2') return 1;
      if (val === '3') return gameMode === '8' ? 10 : 3;  // 8 reyes: 3=10, normal: 3=3
      if (val === 'J') return 10;
      if (val === 'Q') return 10;
      if (val === 'K') return 10;
      return parseInt(val) || 0;
    };
    
    // Calculate sum of non-entangled cards
    let fixedSum = 0;
    cards.forEach((card, idx) => {
      if (!entangledIndices.includes(idx)) {
        fixedSum += getCardPoints(card.value);
      }
    });
    
    // Determine min/max points from entangled cards
    // For each entangled card, only consider its two specific possible values
    let minFromEntangled = 0;
    let maxFromEntangled = 0;
    
    entangledPossibleValues.forEach(possibleValues => {
      const points = possibleValues.map(v => getCardPoints(v));
      minFromEntangled += Math.min(...points);
      maxFromEntangled += Math.max(...points);
    });
    
    const minPossibleSum = fixedSum + minFromEntangled;
    const maxPossibleSum = fixedSum + maxFromEntangled;
    
    // Check if outcome is certain
    if (minPossibleSum >= 31) {
      // Always has juego regardless of entangled values
      console.log(`Player ${playerIndex + 1} auto-declared JUEGO: true (certain with entangled, min=${minPossibleSum})`);
      if (playerIndex === localPlayerIndex) {
        showAutoDeclarationMessage('JUEGO');
        setTimeout(() => {
          handleJuegoDeclaration(playerIndex, true, true);
        }, 1500);
      } else {
        setTimeout(() => {
          handleJuegoDeclaration(playerIndex, true, true);
        }, 1000);
      }
      return true;
    } else if (maxPossibleSum < 31) {
      // Never has juego regardless of entangled values
      console.log(`Player ${playerIndex + 1} auto-declared JUEGO: false (certain with entangled, max=${maxPossibleSum})`);
      if (playerIndex === localPlayerIndex) {
        showAutoDeclarationMessage('NO JUEGO');
        setTimeout(() => {
          handleJuegoDeclaration(playerIndex, false, true);
        }, 1500);
      } else {
        setTimeout(() => {
          handleJuegoDeclaration(playerIndex, false, true);
        }, 1000);
      }
      return true;
    }
    
    // Outcome is uncertain - player must choose
    console.log(`Player ${playerIndex + 1} has entangled cards - outcome uncertain (min=${minPossibleSum}, max=${maxPossibleSum}), must choose manually`);
    return false;
  }
  
  function startJuegoDeclaration() {
    console.log('Starting JUEGO declaration');
    gameState.juegoDeclarations = {};
    gameState.activePlayerIndex = gameState.manoIndex;
    proceedWithJuegoDeclaration();
  }
  
  function proceedWithJuegoDeclaration() {
    // Process declarations for all players in order starting from current active player
    if (Object.keys(gameState.juegoDeclarations).length === 4) {
      // All players have declared - proceed to betting or next round
      handleAllJuegoDeclarationsDone();
      return;
    }
    
    // Try to auto-declare for current player
    const canAutoDeclareJuego = shouldAutoDeclareJuego(gameState.activePlayerIndex);
    
    if (canAutoDeclareJuego) {
      // Will auto-declare after a short delay
      const autoResult = getAutoJuegoDeclaration(gameState.activePlayerIndex);
      setTimeout(() => {
        handleJuegoDeclaration(gameState.activePlayerIndex, autoResult, true);
        nextPlayer();
        proceedWithJuegoDeclaration();
      }, 800);
    } else {
      // Player needs to manually declare
      updateScoreboard();
      startPlayerTurnTimer(gameState.activePlayerIndex);
    }
  }
  
  function shouldAutoDeclareJuego(playerIndex) {
    const cards = getPlayerCards(playerIndex);
    const playerId = `player${playerIndex + 1}`;
    const cardElements = document.querySelectorAll(`#${playerId}-zone .quantum-card`);
    const gameMode = window.currentGameMode || '4';
    
    let hasEntangled = false;
    const entangledIndices = [];
    const entangledPossibleValues = [];
    
    cardElements.forEach((cardEl, idx) => {
      if (cardEl.dataset.entangled === 'true') {
        hasEntangled = true;
        entangledIndices.push(idx);
        const mainValue = cardEl.dataset.mainValue || cardEl.dataset.value;
        const partnerValue = cardEl.dataset.partner;
        entangledPossibleValues.push([mainValue, partnerValue]);
      }
    });
    
    if (!hasEntangled) {
      return true;
    }
    
    const getCardPoints = (val) => {
      if (val === 'A') return 1;
      if (val === '2') return 1;
      if (val === '3') return gameMode === '8' ? 10 : 3;
      if (val === 'J') return 10;
      if (val === 'Q') return 10;
      if (val === 'K') return 10;
      return parseInt(val) || 0;
    };
    
    let fixedSum = 0;
    cards.forEach((card, idx) => {
      if (!entangledIndices.includes(idx)) {
        fixedSum += getCardPoints(card.value);
      }
    });
    
    let minFromEntangled = 0;
    let maxFromEntangled = 0;
    
    entangledPossibleValues.forEach(possibleValues => {
      const points = possibleValues.map(v => getCardPoints(v));
      minFromEntangled += Math.min(...points);
      maxFromEntangled += Math.max(...points);
    });
    
    const minPossibleSum = fixedSum + minFromEntangled;
    const maxPossibleSum = fixedSum + maxFromEntangled;
    
    return minPossibleSum >= 31 || maxPossibleSum < 31;
  }
  
  function getAutoJuegoDeclaration(playerIndex) {
    const cards = getPlayerCards(playerIndex);
    const playerId = `player${playerIndex + 1}`;
    const cardElements = document.querySelectorAll(`#${playerId}-zone .quantum-card`);
    const gameMode = window.currentGameMode || '4';
    
    let hasEntangled = false;
    const entangledIndices = [];
    const entangledPossibleValues = [];
    
    cardElements.forEach((cardEl, idx) => {
      if (cardEl.dataset.entangled === 'true') {
        hasEntangled = true;
        entangledIndices.push(idx);
        const mainValue = cardEl.dataset.mainValue || cardEl.dataset.value;
        const partnerValue = cardEl.dataset.partner;
        entangledPossibleValues.push([mainValue, partnerValue]);
      }
    });
    
    if (!hasEntangled) {
      const juegoResult = calculateJuego(cards);
      return juegoResult.hasJuego;
    }
    
    const getCardPoints = (val) => {
      if (val === 'A') return 1;
      if (val === '2') return 1;
      if (val === '3') return gameMode === '8' ? 10 : 3;
      if (val === 'J') return 10;
      if (val === 'Q') return 10;
      if (val === 'K') return 10;
      return parseInt(val) || 0;
    };
    
    let fixedSum = 0;
    cards.forEach((card, idx) => {
      if (!entangledIndices.includes(idx)) {
        fixedSum += getCardPoints(card.value);
      }
    });
    
    let minFromEntangled = 0;
    let maxFromEntangled = 0;
    
    entangledPossibleValues.forEach(possibleValues => {
      const points = possibleValues.map(v => getCardPoints(v));
      minFromEntangled += Math.min(...points);
      maxFromEntangled += Math.max(...points);
    });
    
    const minPossibleSum = fixedSum + minFromEntangled;
    const maxPossibleSum = fixedSum + maxFromEntangled;
    
    if (minPossibleSum >= 31) {
      return true;
    } else if (maxPossibleSum < 31) {
      return false;
    }
    
    return true;
  }
  
  function handleJuegoDeclaration(playerIndex, hasJuego, isAutoDeclared = false) {
    // hasJuego can be: true (juego), false (no juego), or 'puede'
    gameState.juegoDeclarations[playerIndex] = hasJuego;
    
    // Show notification based on declaration
    const notificationType = hasJuego === true ? 'juego' : 
                            hasJuego === false ? 'no_juego' : 'puede_juego';
    showActionNotification(playerIndex, notificationType);
    
    // Trigger collapse only if declaration is JUEGO (has juego) AND not auto-declared
    if (hasJuego === true && !isAutoDeclared) {
      collapseOnDeclaration(playerIndex, 'JUEGO', hasJuego);
    }
    
    // Check if all players declared
    if (Object.keys(gameState.juegoDeclarations).length < 4) {
      // Still need more declarations
      return;
    }
    
    // All players have declared
    handleAllJuegoDeclarationsDone();
  }
  
  function handleAllJuegoDeclarationsDone() {
    // Count declarations per team
    const team1JuegoCount = gameState.teams.team1.players.filter(p => gameState.juegoDeclarations[p] === true).length;
    const team2JuegoCount = gameState.teams.team2.players.filter(p => gameState.juegoDeclarations[p] === true).length;
    
    const team1PuedeOrJuegoCount = gameState.teams.team1.players.filter(p => 
      gameState.juegoDeclarations[p] === true || gameState.juegoDeclarations[p] === 'puede'
    ).length;
    const team2PuedeOrJuegoCount = gameState.teams.team2.players.filter(p => 
      gameState.juegoDeclarations[p] === true || gameState.juegoDeclarations[p] === 'puede'
    ).length;
    
    console.log(`JUEGO declarations - Team1 juego: ${team1JuegoCount}, puede/juego: ${team1PuedeOrJuegoCount}`);
    console.log(`JUEGO declarations - Team2 juego: ${team2JuegoCount}, puede/juego: ${team2PuedeOrJuegoCount}`);
    
    // Determine if betting should happen
    const canBet = (team1JuegoCount > 0 && team2PuedeOrJuegoCount > 0) || 
                   (team2JuegoCount > 0 && team1PuedeOrJuegoCount > 0);
    
    if (team1JuegoCount === 0 && team2JuegoCount === 0) {
      // No one has JUEGO - start PUNTO betting
      console.log('No one has JUEGO (all NO JUEGO or PUEDE) - starting PUNTO betting');
      gameState.currentRound = 'PUNTO';
      gameState.activePlayerIndex = gameState.manoIndex;
      gameState.currentBet.bettingTeam = null;
      
      // Reset round state for PUNTO
      resetRoundState();
      
      // If mano can't bet, move to next eligible player
      if (!canPlayerBet(gameState.activePlayerIndex)) {
        console.log(`Mano (Player ${gameState.manoIndex + 1}) cannot bet in PUNTO, finding next eligible player`);
        nextPlayerWhoCanBet();
      }
      
      // Update UI to show betting buttons
      updateScoreboard();
      updateRoundDisplay();
      
      startPlayerTurnTimer(gameState.activePlayerIndex);
    } else if (!canBet) {
      // Only one team has JUEGO - reveal cards but no points awarded
      console.log('Only one team has JUEGO - revealing cards, no points awarded');
      
      // Reveal all cards first
      revealAllCards();
      
      // No points awarded, just move to next round
      setTimeout(() => {
        moveToNextRound();
      }, 2000); // Delay to allow card reveal animation
    } else {
      // Start JUEGO betting (only JUEGO and PUEDE players can bet)
      console.log('Starting JUEGO betting - both teams can compete');
      gameState.activePlayerIndex = gameState.manoIndex;
      gameState.currentBet.bettingTeam = null;
      
      // If mano can't bet, move to next eligible player
      if (!canPlayerBet(gameState.activePlayerIndex)) {
        console.log(`Mano (Player ${gameState.manoIndex + 1}) cannot bet in JUEGO, finding next eligible player`);
        nextPlayerWhoCanBet();
      }
      
      // Update UI to show betting buttons instead of declaration buttons
      updateScoreboard();
      
      startPlayerTurnTimer(gameState.activePlayerIndex);
    }
  }
  
  function calculateJuego(cards) {
    const gameMode = window.currentGameMode || '4';
    const getCardPoints = (val) => {
      if (val === 'A') return 1;
      if (val === '2') return 1;
      if (val === '3') return gameMode === '8' ? 10 : 3;  // 8 reyes: 3=10, normal: 3=3
      if (val === 'J') return 10;
      if (val === 'Q') return 10;
      if (val === 'K') return 10;
      return parseInt(val) || 0;
    };
    
    const sum = cards.reduce((acc, card) => acc + getCardPoints(card.value), 0);
    
    return {
      sum: sum,
      hasJuego: sum >= 31,
      rank: sum >= 31 ? (sum === 31 ? 100 : (sum === 40 ? 99 : (100 - sum + 31))) : (30 - sum)
    };
  }
  
  // Finish hand - reveal all cards and award points
  function finishHand() {
    console.log('Finishing hand - awarding points');

    // Cards are already revealed at this point (done in moveToNextRound)
    
    // Award all pending points
    setTimeout(() => {
      const roundOrder = ['GRANDE', 'CHICA', 'PARES', 'JUEGO'];

      // Process pending points for each round
      roundOrder.forEach(round => {
        ['team1', 'team2'].forEach(team => {
          const points = gameState.pendingPoints[team][round];
          if (points > 0) {
            gameState.teams[team].score += points;
            console.log(`Awarding ${points} points to ${team} for ${round} round`);
          }
        });
      });

      // Update scoreboard with final scores
      updateScoreboard();

      // Check if any team reached winning score
      if (gameState.teams.team1.score >= 40) {
        freezeGameState(); // Stop all timers and interactions
        showGameOver('team1');
        return;
      } else if (gameState.teams.team2.score >= 40) {
        freezeGameState(); // Stop all timers and interactions
        showGameOver('team2');
        return;
      }

      // Reset pending points for next hand
      gameState.pendingPoints = {
        team1: { GRANDE: 0, CHICA: 0, PARES: 0, JUEGO: 0 },
        team2: { GRANDE: 0, CHICA: 0, PARES: 0, JUEGO: 0 }
      };

      showHandSummary();

      setTimeout(() => {
        startNewHand();
      }, 3000); // 3 seconds before starting new hand
    }, 1000); // Reduced delay since cards are already revealed
  }
  
  function revealAllCards() {
    // First, collapse all remaining entangled cards
    collapseAllRemaining();
    
    // Wait for collapse animations to complete before revealing
    setTimeout(() => {
      // Show all player cards
      for (let i = 0; i < 4; i++) {
        const playerId = `player${i + 1}`;
        const cards = document.querySelectorAll(`#${playerId}-zone .quantum-card`);
        
        cards.forEach(card => {
          // Remove hidden symbol and show actual cards
          const hiddenSymbol = card.querySelector('.hidden-card-symbol, .hidden-symbol-right, .hidden-symbol-left');
          if (hiddenSymbol) {
            hiddenSymbol.remove();
            
            // Add visible card content
            const value = card.dataset.value; // Use final collapsed value
            const suitColor = card.dataset.suitColor || '#2ec4b6';
            
            const topLabel = document.createElement('div');
            topLabel.className = 'dirac-label card-top';
            topLabel.style.color = suitColor;
            topLabel.innerHTML = `|${value}⟩`;
            card.appendChild(topLabel);
            
            const bottomLabel = document.createElement('div');
            bottomLabel.className = 'dirac-label card-bottom';
            bottomLabel.style.color = suitColor;
            const partner = card.dataset.partner || value;
            bottomLabel.innerHTML = `⟨${partner}|`;
            card.appendChild(bottomLabel);
          }
        });
      }
    }, 1500); // Wait for collapse animations
  }
  
  function showHandSummary() {
    const team1Score = gameState.teams.team1.score;
    const team2Score = gameState.teams.team2.score;
    
    const modal = createModal('#a78bfa');
    modal.innerHTML = `
      <div class="modal-content" style="
        background: linear-gradient(135deg, rgba(30, 41, 59, 0.98), rgba(15, 23, 42, 0.98));
        border: 3px solid #a78bfa; border-radius: 25px; padding: 45px; text-align: center;
        box-shadow: 0 15px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(167, 139, 250, 0.4);
        max-width: 550px; transform: scale(0.8); transition: transform 0.3s;
      ">
        <h2 style="color: #a78bfa; font-size: 2.2rem; margin-bottom: 20px; font-weight: 300; letter-spacing: 4px;">
          MANO COMPLETADA
        </h2>
        <div style="display: flex; justify-content: space-around; margin: 30px 0;">
          <div>
            <p style="color: #2ec4b6; font-size: 1rem;">Copenhaguen</p>
            <p style="color: #2ec4b6; font-size: 2.5rem; font-weight: bold;">${team1Score}</p>
          </div>
          <div>
            <p style="color: #ff9e6d; font-size: 1rem;">Bohmian</p>
            <p style="color: #ff9e6d; font-size: 2.5rem; font-weight: bold;">${team2Score}</p>
          </div>
        </div>
        <p style="color: var(--circuit-blueprint); font-size: 1rem;">
          Nueva mano comenzará pronto...
        </p>
      </div>
    `;
    
    document.body.appendChild(modal);
    animateModal(modal);
    
    setTimeout(() => {
      closeModal(modal);
    }, 2500); // Close modal after 2.5s (before 3s new hand delay)
  }
  
  // Start new hand
  function startNewHand() {
    console.log('Starting new hand...');
    
    // Clear all existing cards from all players
    for (let i = 1; i <= 4; i++) {
      const zone = document.querySelector(`#player${i}-zone .cards-row`);
      if (zone) {
        zone.innerHTML = ''; // Remove all cards
      }
    }
    
    // Reset game state
    gameState.currentRound = 'MUS';
    gameState.musPhaseActive = true;
    gameState.manoIndex = (gameState.manoIndex + 1) % 4; // Rotate mano counterclockwise (to the right)
    gameState.activePlayerIndex = gameState.manoIndex;
    resetRoundState();
    
    console.log(`New hand - Mano rotated to player ${gameState.manoIndex + 1} (${playerNames[gameState.manoIndex]})`);
    
    // Update mano indicator to show new mano
    updateManoIndicator();
    
    // Wait 3 seconds, then deal new cards
    setTimeout(() => {
      // Deal new cards to all players
      const gameMode = window.currentGameMode || '4';
      const cardValues = ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K'];
      const suits = ['psi', 'phi', 'delta', 'theta'];
      const suitSymbols = ['ψ', 'φ', 'δ', 'θ'];
      const suitColors = ['#2ec4b6', '#a78bfa', '#ff9e6d', '#f5c518'];
      
      for (let playerIndex = 0; playerIndex < 4; playerIndex++) {
        const playerId = `player${playerIndex + 1}`;
        const zone = document.querySelector(`#${playerId}-zone .cards-row`);
        const isCurrentPlayer = playerIndex === 0; // player1 is always current player (bottom)
        const isTeammate = playerIndex === 2; // player3 is teammate
        
        // Special card assignment for local player (player1)
        const localPlayerCards = isCurrentPlayer ? ['A', 'A', '5', '4'] : null;
        
        if (zone) {
          for (let i = 0; i < 4; i++) {
            const cardValue = localPlayerCards ? localPlayerCards[i] : cardValues[i];
            const card = createCard(
              cardValue, 
              suits[i], 
              suitSymbols[i], 
              i, 
              isCurrentPlayer, 
              isTeammate, 
              suitColors[i], 
              playerIndex, 
              gameMode
            );
            zone.appendChild(card);
          }
        }
      }
      
      // Match entangled cards between player1 and player3
      matchEntangledCards();
      
      // Play deal animation
      playDealAnimation();
      
      // Start MUS phase timer 1 second after cards are dealt
      setTimeout(() => {
        startPlayerTurnTimer(gameState.activePlayerIndex);
      }, 1000);
    }, 3000); // 3 second delay before dealing new cards
  }

  // Show ordago winner as a simple banner (doesn't block cards)
  function showOrdagoWinner(winningTeam) {
    console.log(`ÓRDAGO resolved! Winner: ${winningTeam}`);
    
    const team1Score = gameState.teams.team1.score;
    const team2Score = gameState.teams.team2.score;
    const winnerName = winningTeam === 'team1' ? gameState.teams.team1.name : gameState.teams.team2.name;
    const winnerColor = winningTeam === 'team1' ? '#2ec4b6' : '#ff9e6d';
    
    // Create a simple banner at the top
    const banner = document.createElement('div');
    banner.className = 'ordago-winner-banner';
    banner.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95));
      border: 3px solid ${winnerColor};
      border-radius: 20px;
      padding: 30px 60px;
      text-align: center;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8), 0 0 30px ${winnerColor}80;
      z-index: 5000;
      opacity: 0;
      transition: opacity 0.5s;
    `;
    
    banner.innerHTML = `
      <div style="font-size: 3rem; margin-bottom: 10px; filter: drop-shadow(0 0 10px ${winnerColor});">🏆</div>
      <h2 style="
        color: ${winnerColor};
        font-size: 2.5rem;
        margin-bottom: 15px;
        font-weight: 400;
        letter-spacing: 4px;
        text-shadow: 0 0 20px ${winnerColor}80;
      ">ÓRDAGO GANADO</h2>
      <div style="
        color: var(--paper-beige);
        font-size: 2rem;
        font-weight: 300;
        margin-bottom: 10px;
      ">${winnerName} Gana</div>
      <div style="
        color: var(--circuit-blueprint);
        font-size: 1.2rem;
        margin-top: 15px;
        margin-bottom: 20px;
      ">Revisa las cartas de todos los jugadores</div>
      <button id="ordago-exit-btn" style="
        background: linear-gradient(135deg, ${winnerColor}, ${winnerColor}90);
        color: white;
        border: none;
        padding: 12px 30px;
        border-radius: 20px;
        font-size: 1rem;
        cursor: pointer;
        font-weight: bold;
        letter-spacing: 2px;
        box-shadow: 0 5px 15px ${winnerColor}99;
        transition: all 0.3s;
        margin-top: 10px;
      ">SALIR AL LOBBY</button>
    `;
    
    document.body.appendChild(banner);
    
    // Exit button functionality
    const ordagoExitBtn = banner.querySelector('#ordago-exit-btn');
    ordagoExitBtn.addEventListener('mouseenter', () => {
      ordagoExitBtn.style.transform = 'scale(1.05)';
      ordagoExitBtn.style.boxShadow = `0 12px 35px ${winnerColor}`;
    });
    ordagoExitBtn.addEventListener('mouseleave', () => {
      ordagoExitBtn.style.transform = 'scale(1)';
      ordagoExitBtn.style.boxShadow = `0 8px 25px ${winnerColor}99`;
    });
    ordagoExitBtn.addEventListener('click', () => {
      // Remove the banner
      banner.remove();
      
      // Reset game initialization flag
      gameInitialized = false;
      
      // Return to lobby
      if (window.showScreen) {
        window.showScreen('lobby');
      } else {
        window.location.reload();
      }
    });
    
    // Animate in
    setTimeout(() => {
      banner.style.opacity = '1';
    }, 10);
    
    // Auto-transition after 30 seconds (players can also exit manually with button)
    setTimeout(() => {
      banner.style.opacity = '0';
      setTimeout(() => {
        banner.remove();
        // Now show the full game over screen
        showGameOver(winningTeam);
      }, 500);
    }, 30000); // 30 seconds to see cards
  }

  // Show game over panel with winner - discrete version
  function showGameOver(winningTeam) {
    console.log(`Game Over! Winner: ${winningTeam}`);
    
    const team1Score = gameState.teams.team1.score;
    const team2Score = gameState.teams.team2.score;
    const winnerName = winningTeam === 'team1' ? gameState.teams.team1.name : gameState.teams.team2.name;
    const winnerScore = winningTeam === 'team1' ? team1Score : team2Score;
    const loserScore = winningTeam === 'team1' ? team2Score : team1Score;
    
    const gameOverModal = document.createElement('div');
    gameOverModal.className = 'game-over-modal';
    gameOverModal.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 10000;
      opacity: 0;
      transition: opacity 0.5s;
    `;
    
    const winnerColor = winningTeam === 'team1' ? '#2ec4b6' : '#ff9e6d';
    
    gameOverModal.innerHTML = `
      <div style="
        background: linear-gradient(135deg, rgba(30, 41, 59, 0.98), rgba(15, 23, 42, 0.98));
        border: 3px solid ${winnerColor};
        border-radius: 20px;
        padding: 30px 40px;
        text-align: center;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8), 0 0 20px ${winnerColor}80;
        max-width: 400px;
        transform: scale(0.8);
        transition: transform 0.5s;
      ">
        <div style="font-size: 3rem; margin-bottom: 10px;">🏆</div>
        <h2 style="
          color: ${winnerColor};
          font-size: 1.8rem;
          margin-bottom: 15px;
          font-weight: 500;
          letter-spacing: 2px;
        ">${winnerName} Wins!</h2>
        <div style="
          display: flex;
          justify-content: center;
          gap: 20px;
          margin: 15px 0;
          font-size: 1.2rem;
          color: var(--paper-beige);
        ">
          <div style="color: ${winnerColor}; font-weight: bold;">${winnerScore}</div>
          <div>-</div>
          <div style="opacity: 0.7;">${loserScore}</div>
        </div>
        <button id="exit-game-btn" style="
          background: linear-gradient(135deg, ${winnerColor}, ${winnerColor}90);
          color: white;
          border: none;
          padding: 12px 30px;
          border-radius: 20px;
          font-size: 1rem;
          cursor: pointer;
          font-weight: bold;
          letter-spacing: 2px;
          box-shadow: 0 5px 15px ${winnerColor}99;
          transition: all 0.3s;
          margin-top: 10px;
        ">SALIR AL LOBBY</button>
      </div>
    `;
    
    document.body.appendChild(gameOverModal);
    
    // Animate in
    setTimeout(() => {
      gameOverModal.style.opacity = '1';
      const content = gameOverModal.querySelector('div');
      if (content) content.style.transform = 'scale(1)';
    }, 10);
    
    // Exit button functionality
    const exitBtn = gameOverModal.querySelector('#exit-game-btn');
    exitBtn.addEventListener('mouseenter', () => {
      exitBtn.style.transform = 'scale(1.05)';
      exitBtn.style.boxShadow = `0 12px 35px ${winnerColor}`;
    });
    exitBtn.addEventListener('mouseleave', () => {
      exitBtn.style.transform = 'scale(1)';
      exitBtn.style.boxShadow = `0 8px 25px ${winnerColor}99`;
    });
    exitBtn.addEventListener('click', () => {
      // Remove the modal
      gameOverModal.remove();
      
      // Reset game initialization flag
      gameInitialized = false;
      
      // Return to lobby
      if (window.showScreen) {
        window.showScreen('lobby');
      } else {
        window.location.reload();
      }
    });
  }
  
  // Update mano indicator for all players
  function updateManoIndicator() {
    // Remove all existing mano indicators
    document.querySelectorAll('.mano-indicator-container').forEach(container => {
      container.innerHTML = '';
    });
    
    // Add indicator to current mano player
    const manoPlayerZone = document.querySelector(`#player${gameState.manoIndex + 1}-zone`);
    if (manoPlayerZone) {
      const container = manoPlayerZone.querySelector('.mano-indicator-container');
      const avatar = manoPlayerZone.querySelector('.character-avatar');
      const characterClass = avatar.classList[1]; // Gets the character class (preskill, cirac, etc.)
      
      if (container) {
        container.innerHTML = `<div class="atom-indicator" title="Mano - Comienza el juego">${CardGenerator.generateAtomIndicator(getCharacterColorValue(characterClass))}</div>`;
      }
    }
    
    console.log(`Mano indicator updated for player ${gameState.manoIndex + 1} (${playerNames[gameState.manoIndex]})`);
  }
  
  // Update scoreboard with current round
  function updateRoundDisplay() {
    const roundElement = document.querySelector('.stat-value');
    if (roundElement) {
      roundElement.textContent = gameState.currentRound;
    }
  }

  function createPlayerZone(player, index, gameMode, gameContainer) {
    const zone = document.createElement('div');
    zone.className = 'player-zone';
    zone.id = `${player.id}-zone`;
    const isCurrentPlayer = player.id === 'player1';
    const displayName = player.playerName ? ` (${player.playerName})` : '';

    // Character Avatar
    const avatar = document.createElement('div');
    avatar.className = `character-avatar ${player.character}`;
    avatar.style.cursor = 'pointer';
    avatar.style.position = 'relative';
    
    // Character descriptions
    const characterDescriptions = {
      'Preskill': '<strong>John Preskill (1961-presente)</strong><br><br>Pionero teórico en información cuántica e informática cuántica. Preskill es el Profesor Richard P. Feynman de Física Teórica en Caltech y una autoridad destacada en corrección de errores cuánticos y el camino hacia computadoras cuánticas prácticas.<br><br><strong>Símbolo de la Carta:</strong> El código de corrección de errores (círculos anidados) representa códigos de corrección de errores cuánticos - mecanismos esenciales que protegen la información cuántica de la decoherencia y el ruido ambiental, haciendo posibles computadoras cuánticas confiables.<br><br><strong>Contribución:</strong> Desarrolló marcos fundamentales para corrección de errores cuánticos, estableció el concepto de era "NISQ" (Noisy Intermediate-Scale Quantum), y continúa guiando la realización práctica de computadoras cuánticas en el mundo real.',
      'Cirac': '<strong>Ignacio Cirac (1965-presente)</strong><br><br>Científico de información cuántica líder que revolucionó la teoría de la informática cuántica. Cirac es reconocido por desarrollar protocolos de simulación cuántica y demostrar cómo construir computadoras cuánticas usando iones atrapados.<br><br><strong>Símbolo de la Carta:</strong> La representación de trampa de iones (tres puntos dispuestos en un patrón) simboliza iones atrapados dispuestos en una configuración lineal - los componentes fundamentales para la computación cuántica en su enfoque.<br><br><strong>Contribución:</strong> Su trabajo sobre entrelazamiento cuántico y sistemas de muchos cuerpos creó el fundamento teórico para computadoras y simuladores cuánticos modernos.',
      'Zoller': '<strong>Peter Zoller (1952-presente)</strong><br><br>Distinguido físico cuántico especializado en computación cuántica con iones atrapados. Zoller desarrolló protocolos detallados para manipular y medir estados cuánticos usando iones enfriados por láser.<br><br><strong>Símbolo de la Carta:</strong> La celosía cuántica (puntos interconectados) representa la disposición geométrica de iones atrapados en una computadora cuántica, mostrando cómo los bits cuánticos individuales se comunican e se enredan entre sí.<br><br><strong>Contribución:</strong> Sus protocolos transformaron sistemas de iones atrapados en computadoras cuánticas prácticas, proporcionando instrucciones paso a paso para operaciones de puertas cuánticas que se implementan en el hardware cuántico actual.',
      'Deutsch': '<strong>David Deutsch (1953-presente)</strong><br><br>Fundador de la teoría de la computación cuántica - el primero en reconocer que las computadoras cuánticas podrían resolver problemas exponencialmente más rápido que las computadoras clásicas. Su trabajo revolucionario estableció algoritmos cuánticos como un nuevo paradigma computacional.<br><br><strong>Símbolo de la Carta:</strong> La representación de circuito cuántico (caja con círculo y punto) simboliza una puerta cuántica - las operaciones computacionales fundamentales que manipulan bits cuánticos y forman la base de algoritmos cuánticos.<br><br><strong>Contribución:</strong> Probó que el principio Church-Turing se extiende a la mecánica cuántica y creó el algoritmo de Deutsch, el primer algoritmo cuántico que demuestra ventaja computacional sobre métodos clásicos.'
    };
    
    avatar.innerHTML = `
      <div class="character-portrait" style="position: relative;">
        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; z-index: 10;">
          <div style="font-size: 2.5rem; font-weight: bold; color: var(--quantum-${getCharacterColor(player.character)}); background: rgba(0,0,0,0.4); border-radius: 8px; width: 80%; height: 80%; display: flex; align-items: center; justify-content: center;">
            ${player.name.charAt(0).toUpperCase()}
          </div>
        </div>
        ${CardGenerator.generateCharacter(player.name)}
      </div>
      <div class="character-name" style="color: var(--quantum-${getCharacterColor(player.character)})">
        ${player.name}${displayName}
      </div>
      <div class="character-score" style="color: var(--quantum-${getCharacterColor(player.character)})" data-score="0">
        (0)
      </div>
      <div class="mano-indicator-container"></div>
    `;
    
    // Add click event for character description
    avatar.addEventListener('click', () => {
      showCharacterModal(player.name, characterDescriptions[player.name]);
    });

    // Hand Container
    const handContainer = document.createElement('div');
    handContainer.className = 'hand-container';

    // Card data - Spanish deck values
    const cardValues = ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K'];
    const suits = ['psi', 'phi', 'delta', 'theta'];
    const suitSymbols = ['ψ', 'φ', 'δ', 'θ'];
    const suitColors = ['#2ec4b6', '#a78bfa', '#ff9e6d', '#f5c518'];

    const isTeammate = index === 2;


    // Timer bar (inside hand container so it aligns with cards)
    const timerBar = document.createElement('div');
    timerBar.className = `timer-bar timer-bar-player${index+1}`;
    timerBar.id = `timer-bar-player${index+1}`;
    const timerFill = document.createElement('div');
    timerFill.className = 'timer-bar-fill';
    timerFill.style.width = '0%';
    timerBar.appendChild(timerFill);


    const cardsRow = document.createElement('div');
    cardsRow.className = 'cards-row';
    
    // Special card assignment for local player (player1)
    const localPlayerCards = isCurrentPlayer ? ['A', 'A', '5', '4'] : null;
    
    for (let i = 0; i < 4; i++) {
      const cardValue = localPlayerCards ? localPlayerCards[i] : cardValues[i];
      const card = createCard(cardValue, suits[i], suitSymbols[i], i, isCurrentPlayer, isTeammate, suitColors[i], index, gameMode);
      cardsRow.appendChild(card);
    }

    // Add avatar and hand based on player position
    if (player.id === 'player1') {
      // Bottom: timer above cards
      handContainer.appendChild(timerBar);
      handContainer.appendChild(cardsRow);
      zone.appendChild(handContainer);
      zone.appendChild(avatar);
    } else if (player.id === 'player2') {
      // Right: timer above cards, avatar towards center
      handContainer.appendChild(timerBar);
      handContainer.appendChild(cardsRow);
      zone.appendChild(avatar);
      zone.appendChild(handContainer);
    } else if (player.id === 'player3') {
      // Top: cards, then timer (timer closer to scoreboard)
      handContainer.appendChild(cardsRow);
      handContainer.appendChild(timerBar);
      zone.appendChild(avatar);
      zone.appendChild(handContainer);
    } else if (player.id === 'player4') {
      // Left: cards, then timer, then avatar (so timer is between bottom card stack and character)
      handContainer.appendChild(cardsRow);
      handContainer.appendChild(timerBar);
      zone.appendChild(handContainer);
      zone.appendChild(avatar);
    }

    gameContainer.appendChild(zone);
  }

  // TIMER LOGIC
  let activePlayerIndex = 0;
  let timerInterval = null;

  function startPlayerTimer(index) {
    // Reset all timer fills
    for (let i = 0; i < 4; i++) {
      const fill = document.querySelector(`#timer-bar-player${i + 1} .timer-bar-fill`);
      if (fill) {
        fill.style.transition = 'none';
        fill.style.width = '0%';
      }
    }

    const fill = document.querySelector(`#timer-bar-player${index + 1} .timer-bar-fill`);
    if (!fill) return;

    // All timers behave the same: horizontal bar shrinking from full to empty
    fill.style.width = '100%';
    requestAnimationFrame(() => {
      fill.style.transition = 'width 10s linear';
      fill.style.width = '0%';
    });

    if (timerInterval) clearTimeout(timerInterval);
    timerInterval = setTimeout(() => {
      // Rotate turns counterclockwise around the table
      activePlayerIndex = (activePlayerIndex + 3) % 4; // equivalent to -1 mod 4
      startPlayerTimer(activePlayerIndex);
    }, 10000);
  }

  window.startPlayerTimer = startPlayerTimer;
  // Start timer at mano after deal animation
  setTimeout(() => {
    let manoIndex = 0;
    for (let i = 0; i < 4; i++) {
      if (window.startingPlayer === `player${i+1}`) manoIndex = i;
    }
    activePlayerIndex = manoIndex;
    gameState.manoIndex = manoIndex;
    gameState.activePlayerIndex = manoIndex;
    startPlayerTimer(activePlayerIndex);
  }, 3000);

  // ===================== TIMER AND UI MANAGEMENT =====================
  
  // Stop all game timers and freeze game state
  function freezeGameState() {
    console.log('Freezing game state - ÓRDAGO accepted or game over');
    
    // Clear timer interval
    if (timerInterval) {
      clearTimeout(timerInterval);
      timerInterval = null;
    }
    
    // Stop all timer bar animations
    for (let i = 0; i < 4; i++) {
      const fill = document.querySelector(`#timer-bar-player${i + 1} .timer-bar-fill`);
      if (fill) {
        fill.style.transition = 'none';
        fill.style.width = '0%';
      }
    }
    
    // Remove all player highlights
    for (let i = 0; i < 4; i++) {
      const zone = document.querySelector(`#player${i + 1}-zone`);
      if (zone) {
        zone.style.boxShadow = '';
      }
    }
    
    // Disable all buttons visually - only scoreboard buttons
    const buttons = document.querySelectorAll('.scoreboard-controls .quantum-gate');
    buttons.forEach(btn => {
      btn.style.opacity = '0.2';
      btn.style.cursor = 'not-allowed';
      btn.style.pointerEvents = 'auto';
      btn.disabled = true;
    });
  }
  
  // Start timer for a single player with callback on timeout
  function startPlayerTurnTimer(index, duration = 10, onTimeout = null) {
    console.log(`Starting turn for player ${index + 1} (${playerNames[index]}), Round: ${gameState.currentRound}`);
    
    // CRITICAL: Clear previous timer FIRST before starting new one
    if (timerInterval) {
      clearTimeout(timerInterval);
      timerInterval = null;
    }
    
    // Update visual feedback for active player
    updateActivePlayerHighlight(index);
    
    // Reset all timer fills
    for (let i = 0; i < 4; i++) {
      const fill = document.querySelector(`#timer-bar-player${i + 1} .timer-bar-fill`);
      if (fill) {
        fill.style.transition = 'none';
        fill.style.width = '0%';
      }
    }

    const fill = document.querySelector(`#timer-bar-player${index + 1} .timer-bar-fill`);
    if (!fill) return;

    fill.style.width = '100%';
    requestAnimationFrame(() => {
      fill.style.transition = `width ${duration}s linear`;
      fill.style.width = '0%';
    });

    // Set new timeout
    timerInterval = setTimeout(() => {
      console.log(`Timer expired for player ${index + 1}`);
      // Clear the interval to prevent multiple triggers
      timerInterval = null;
      // Timeout - auto action
      if (onTimeout) {
        onTimeout();
      } else {
        handleTimeout(index);
      }
    }, duration * 1000);
    
    // If AI player (not local player), make decision
    if (index !== localPlayerIndex) {
      makeAIDecision(index);
    }
  }
  
  // Update visual highlight for active player
  function updateActivePlayerHighlight(index) {
    // Remove highlight from all players
    for (let i = 0; i < 4; i++) {
      const zone = document.querySelector(`#player${i + 1}-zone`);
      if (zone) {
        zone.style.boxShadow = '';
      }
    }
    
    // Add highlight to active player
    const activeZone = document.querySelector(`#player${index + 1}-zone`);
    if (activeZone) {
      const colors = ['#2ec4b6', '#ff9e6d', '#a78bfa', '#f5c518'];
      activeZone.style.boxShadow = `0 0 30px ${colors[index]}`;
      activeZone.style.transition = 'box-shadow 0.3s';
    }
    
    // Update button states (only enable for local player)
    updateButtonStates(index === localPlayerIndex);
  }
  
  // Enable/disable buttons based on whose turn it is
  function updateButtonStates(isLocalPlayerTurn) {
    // Only select buttons from the scoreboard, not from modals or other UI elements
    const buttons = document.querySelectorAll('.scoreboard-controls .quantum-gate');
    buttons.forEach(btn => {
      // IMPORTANT: Keep pointerEvents = 'auto' ALWAYS so onclick handlers fire
      btn.style.pointerEvents = 'auto';
      if (isLocalPlayerTurn) {
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
      } else {
        btn.style.opacity = '0.5';
        btn.style.cursor = 'help';
      }
    });
  }
  
  // Start all players' timers simultaneously
  function startAllPlayersTimer(duration = 10) {
    // Clear any existing timer first
    if (timerInterval) {
      clearTimeout(timerInterval);
      timerInterval = null;
    }
    
    for (let i = 0; i < 4; i++) {
      const fill = document.querySelector(`#timer-bar-player${i + 1} .timer-bar-fill`);
      if (fill) {
        fill.style.transition = 'none';
        fill.style.width = '0%';
        
        requestAnimationFrame(() => {
          fill.style.width = '100%';
          requestAnimationFrame(() => {
            fill.style.transition = `width ${duration}s linear`;
            fill.style.width = '0%';
          });
        });
      }
    }
    
    timerInterval = setTimeout(() => {
      console.log('All players timer expired - handling all players timeout');
      timerInterval = null;
      // All timers expired - auto discard all cards for players who haven't acted
      handleAllPlayersTimeout();
    }, duration * 1000);
  }
  
  // Handle timeout for a player
  function handleTimeout(playerIndex) {
    console.log(`===== TIMEOUT for player ${playerIndex + 1} (${playerNames[playerIndex]}) =====`);
    console.log(`Current state: Round=${gameState.currentRound}, WaitingForDiscard=${gameState.waitingForDiscard}`);
    
    // Ensure timer is cleared
    if (timerInterval) {
      clearTimeout(timerInterval);
      timerInterval = null;
    }
    
    // Execute automatic action based on game state
    if (gameState.waitingForDiscard) {
      console.log(`Auto-discarding all cards`);
      handleDiscard(playerIndex, [0, 1, 2, 3]);
    } else if (gameState.currentRound === 'MUS' && gameState.roundActions[playerIndex] === undefined) {
      console.log(`Auto-choosing MUS`);
      handleMusRound(playerIndex, 'mus');
    } else if (gameState.currentRound === 'PARES' && gameState.paresDeclarations && gameState.paresDeclarations[playerIndex] === undefined) {
      console.log(`Auto-choosing PARES PUEDE`);
      handleParesDeclaration(playerIndex, 'puede');
    } else if (gameState.currentRound === 'JUEGO' && gameState.juegoDeclarations && gameState.juegoDeclarations[playerIndex] === undefined) {
      console.log(`Auto-choosing JUEGO PUEDE`);
      handleJuegoDeclaration(playerIndex, 'puede');
    } else if (gameState.currentRound !== 'MUS') {
      console.log(`Auto-choosing PASO in ${gameState.currentRound}`);
      handleBettingRound(playerIndex, 'paso');
    } else {
      console.log(`No timeout action for current state`);
    }
  }
  
  // AI player decision making
  function makeAIDecision(playerIndex) {
    console.log(`[AI DECISION] Starting decision for player ${playerIndex + 1} in round ${gameState.currentRound}`);
    
    // Clear any previous AI timeout to prevent duplicates
    if (aiDecisionTimeout) {
      clearTimeout(aiDecisionTimeout);
    }
    
    aiDecisionTimeout = setTimeout(() => {
      console.log(`[AI DECISION] Executing - Player ${playerIndex + 1} deciding in ${gameState.currentRound}`);
      
      // Verify this is still the active player (game state may have changed)
      if (gameState.activePlayerIndex !== playerIndex) {
        console.log(`[AI DECISION] Ignoring - player ${playerIndex + 1} is no longer active (current: ${gameState.activePlayerIndex + 1})`);
        aiDecisionTimeout = null;
        return;
      }
      
      if (gameState.waitingForDiscard) {
        // AI always discards all 4 cards
        console.log(`[AI] Player ${playerIndex + 1} discarding all 4 cards`);
        handleDiscard(playerIndex, [0, 1, 2, 3]);
      } else if (gameState.currentRound === 'MUS') {
        // AI always says MUS
        console.log(`[AI] Player ${playerIndex + 1} says MUS`);
        handleMusRound(playerIndex, 'mus');
      } else if (['GRANDE', 'CHICA', 'PARES', 'JUEGO', 'PUNTO'].includes(gameState.currentRound)) {
        // In betting rounds - AI always passes/responds with paso
        console.log(`[AI] Player ${playerIndex + 1} passes in ${gameState.currentRound}`);
        handleBettingRound(playerIndex, 'paso');
      } else {
        // Default to paso for unknown rounds
        console.log(`[AI] Player ${playerIndex + 1} unknown round ${gameState.currentRound}, passing`);
        handleBettingRound(playerIndex, 'paso');
      }
      aiDecisionTimeout = null; // Clear reference after execution
    }, 300); // AI responds instantly (300ms for smooth UI)
  }
  
  // Handle timeout when all players' timers expire
  function handleAllPlayersTimeout() {
    // Auto discard all cards for any player who hasn't discarded yet
    for (let i = 0; i < 4; i++) {
      if (!gameState.cardsDiscarded[i]) {
        // Discard all 4 cards on timeout
        handleDiscard(i, [0, 1, 2, 3]);
      }
    }
  }
  
  // Show discard UI for all players
  function showDiscardUI() {
    // For all players, allow card selection for discard
    for (let i = 0; i < 4; i++) {
      const playerId = `player${i + 1}`;
      const cards = document.querySelectorAll(`#${playerId}-zone .quantum-card`);

      cards.forEach((card, cardIndex) => {
        // Only make local player's cards selectable
        if (i === localPlayerIndex) {
          card.classList.add('selectable');
          card.dataset.selected = 'false';
          card.style.cursor = 'pointer';
        }
      });
    }

    // Show discard button for local player
    showDiscardButton();
  }
  
  // Toggle card selection for discard
  function toggleCardSelection(card) {
    const isSelected = card.dataset.selected === 'true';
    card.dataset.selected = isSelected ? 'false' : 'true';

    if (isSelected) {
      // Deselect
      card.style.transform = 'translateY(0)';
      card.style.border = '';
      card.style.filter = '';
      const overlay = card.querySelector('.discard-overlay');
      if (overlay) overlay.remove();
    } else {
      // Select - show big X and make gray
      card.style.transform = 'translateY(-20px)';
      card.style.border = '3px solid #2ec4b6';
      card.style.filter = 'grayscale(100%) brightness(0.3)';

      // Add big X overlay
      const overlay = document.createElement('div');
      overlay.className = 'discard-overlay';
      overlay.innerHTML = '✕';
      overlay.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 4.5rem;
        color: #888888;
        font-weight: 900;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
        pointer-events: none;
        z-index: 10;
      `;
      card.appendChild(overlay);
    }
  }
  
  // Show discard button
  function showDiscardButton() {
    // Hide the quantum gate buttons
    const controls = document.querySelector('.scoreboard-controls');
    if (controls) {
      controls.style.display = 'none';
    }
    
    // Create discard button
    const discardBtn = document.createElement('button');
    discardBtn.id = 'discard-button';
    discardBtn.className = 'quantum-gate';
    discardBtn.innerHTML = `
      <div style="font-size: 1.5rem; color: white; font-weight: bold;">✕</div>
      <div class="gate-label">DESCARTAR</div>
    `;
    discardBtn.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 100;
      padding: 20px 40px;
      font-size: 1.2rem;
      background: rgba(46, 196, 182, 0.85) !important;
      border: 2px solid rgba(46, 196, 182, 0.95) !important;
      color: white !important;
    `;
    
    discardBtn.onclick = () => {
      // Get selected cards from local player's zone
      const selectedCards = [];
      const playerZoneId = `#player${localPlayerIndex + 1}-zone`;
      const cards = document.querySelectorAll(`${playerZoneId} .quantum-card`);
      cards.forEach((card, index) => {
        if (card.dataset.selected === 'true') {
          selectedCards.push(index);
        }
      });

      // Only allow discard if at least one card is selected
      if (selectedCards.length === 0) {
        return; // Don't do anything if no cards selected
      }

      // Disable discard button
      discardBtn.disabled = true;
      discardBtn.style.opacity = '0.5';

      // Discard selected cards - keep them gray
      handleDiscard(localPlayerIndex, selectedCards);

      // Remove discard button
      discardBtn.remove();
    };
    
    document.body.appendChild(discardBtn);
  }
  
  // Deal new cards after discard
  function dealNewCards() {
    const cardValues = ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K'];
    const suits = ['psi', 'phi', 'delta', 'theta'];
    const suitSymbols = ['ψ', 'φ', 'δ', 'θ'];
    const suitColors = ['#2ec4b6', '#a78bfa', '#ff9e6d', '#f5c518'];
    
    // For each player, replace discarded cards
    for (let i = 0; i < 4; i++) {
      const playerId = `player${i + 1}`;
      const cardsToDiscard = gameState.cardsDiscarded[i] || [];
      const cardsRow = document.querySelector(`#${playerId}-zone .cards-row`);
      const cardElements = Array.from(document.querySelectorAll(`#${playerId}-zone .quantum-card`));
      
      const isCurrentPlayer = i === localPlayerIndex;
      const isTeammate = i === 2;
      
      // Mark cards to remove with fade out
      cardsToDiscard.forEach(cardIndex => {
        if (cardElements[cardIndex]) {
          cardElements[cardIndex].style.transition = 'opacity 0.5s ease-out';
          cardElements[cardIndex].style.opacity = '0';
        }
      });
      
      // After fade out, remove old cards and add new ones (1 second total)
      setTimeout(() => {
        // Build new card array
        const newCards = [];
        
        for (let cardIndex = 0; cardIndex < 4; cardIndex++) {
          if (cardsToDiscard.includes(cardIndex)) {
            // Generate random new card
            const randomValue = cardValues[Math.floor(Math.random() * cardValues.length)];
            const randomSuitIndex = Math.floor(Math.random() * suits.length);
            const randomSuit = suits[randomSuitIndex];
            const randomSymbol = suitSymbols[randomSuitIndex];
            const randomColor = suitColors[randomSuitIndex];
            
            // Create new card
            const newCard = createCard(
              randomValue, 
              randomSuit, 
              randomSymbol, 
              cardIndex, 
              isCurrentPlayer, 
              isTeammate, 
              randomColor, 
              i, 
              gameState.gameMode
            );
            
            // Start with card invisible for animation
            newCard.style.opacity = '0';
            newCard.classList.add('card-dealing');
            newCards.push(newCard);
          } else {
            // Keep existing card
            newCards.push(cardElements[cardIndex]);
          }
        }
        
        // Clear the cards row and add all cards in order
        cardsRow.innerHTML = '';
        newCards.forEach(card => {
          cardsRow.appendChild(card);
        });
        
        // Animate in new cards
        setTimeout(() => {
          const allCards = document.querySelectorAll(`#${playerId}-zone .quantum-card`);
          allCards.forEach(card => {
            if (card.classList.contains('card-dealing')) {
              card.style.transition = 'opacity 0.5s ease-in';
              card.style.opacity = '1';
              card.classList.remove('card-dealing');
              card.classList.add('card-dealt');
              
              // Clean up inline styles after animation
              setTimeout(() => {
                card.style.transition = '';
                card.style.opacity = '';
              }, 500);
            }
            
            // Clean up selection state for all cards
            card.classList.remove('selectable');
            card.dataset.selected = 'false';
            card.style.border = '';
            card.style.filter = '';
            const overlay = card.querySelector('.discard-overlay');
            if (overlay) overlay.remove();
          });
        }, 50);
      }, 1000);
    }
  }
  
  // Show round result modal
  function showRoundResult(winningTeam, points) {
    const teamName = gameState.teams[winningTeam].name;
    const color = winningTeam === 'team1' ? '#2ec4b6' : '#ff9e6d';
    
    const modal = createModal(color);
    modal.innerHTML = `
      <div class="modal-content" style="
        background: linear-gradient(135deg, rgba(30, 41, 59, 0.98), rgba(15, 23, 42, 0.98));
        border: 3px solid ${color}; border-radius: 25px; padding: 45px; text-align: center;
        box-shadow: 0 15px 50px rgba(0, 0, 0, 0.5), 0 0 30px ${color}40;
        max-width: 550px; transform: scale(0.8); transition: transform 0.3s;
      ">
        <h2 style="color: ${color}; font-size: 2.2rem; margin-bottom: 20px; font-weight: 300; letter-spacing: 4px;">
          ${teamName.toUpperCase()} GANA
        </h2>
        <p style="color: var(--circuit-blueprint); font-size: 1.5rem; margin-bottom: 30px; line-height: 1.8;">
          +${points} ${points === 1 ? 'punto' : 'puntos'}
        </p>
        <p style="color: var(--circuit-blueprint); font-size: 1rem;">
          Ronda: ${gameState.currentRound}
        </p>
      </div>
    `;
    
    document.body.appendChild(modal);
    animateModal(modal);
    
    // Auto close after 2.5 seconds
    setTimeout(() => {
      closeModal(modal);
    }, 2500);
  }

  function matchEntangledCards() {
    // Get entangled cards from player1 (my hand)
    const player1Cards = document.querySelectorAll('#player1-zone .quantum-card');
    const player1Entangled = new Set();

    player1Cards.forEach(card => {
      if (card.dataset.entangled === 'true') {
        player1Entangled.add(card.dataset.partner);
      }
    });
    
    if (player1Entangled.size === 0) return;
    
    // Teammate is at player3 (index 2, top position)
    const teammateCards = document.querySelectorAll('#player3-zone .quantum-card');
    
    teammateCards.forEach(card => {
      const mainValue = card.dataset.mainValue;
      
      // Only highlight border when entangled with one of mine
      if (card.classList.contains('entangled-candidate')) {
        if (mainValue && player1Entangled.has(mainValue)) {
          card.classList.remove('entangled-candidate');
          card.classList.add('entangled-card');
          card.style.setProperty('--entangle-color', card.dataset.suitColor);
        } else {
          card.classList.remove('entangled-candidate');
        }
      }
    });
  }

  function getCharacterColor(characterKey) {
    const characterColors = {
      'preskill': 'teal',
      'cirac': 'coral',
      'zoller': 'lavender',
      'deutsch': 'gold'
    };
    return characterColors[characterKey] || 'teal';
  }

  function getCharacterColorValue(characterKey) {
    const characterColorValues = {
      'preskill': '#2ec4b6',  // teal
      'cirac': '#ff9e6d',     // coral
      'zoller': '#a78bfa',    // lavender
      'deutsch': '#f5c518'    // gold
    };
    return characterColorValues[characterKey] || '#2ec4b6';
  }

  function getPlayerColor(index) {
    const colors = ['teal', 'coral', 'lavender', 'gold'];
    return colors[index];
  }

  function getPlayerColorValue(index) {
    const colorValues = {
      0: '#2ec4b6',  // teal
      1: '#ff9e6d',  // coral
      2: '#a78bfa',  // lavender
      3: '#f5c518'   // gold
    };
    return colorValues[index] || '#2ec4b6';
  }

  function createCard(value, suit, suitSymbol, index, isCurrentPlayer, isTeammate, suitColor, playerIndex, gameMode = '4') {
    const card = document.createElement('div');
    const isLateralPlayer = playerIndex === 1 || playerIndex === 3;
    card.className = `quantum-card card-${suit} card-dealing${isLateralPlayer ? ' card-lateral' : ''}${playerIndex === 3 ? ' card-left' : ''}`;
    card.dataset.dealOrder = String(playerIndex * 4 + index);
    card.dataset.value = value;
    card.dataset.suit = suit;
    
    const rotation = (Math.random() - 0.5) * 6;
    // Rotar cartas de jugadores laterales (2 y 4 = índices 1 y 3)
    let cardRotation = rotation;
    if (isLateralPlayer) {
      cardRotation = rotation + 90; // Rotar 90 grados para jugadores de los lados
      if (playerIndex === 3) {
        cardRotation = rotation + 270; // Rotar 270 grados (90 + 180) para jugador izquierdo
      }
    }
    card.style.setProperty('--rotation', `${cardRotation}deg`);

    // Determine if card is entangled
    let isEntangled = false;
    
    // Entanglement follows the equivalence rules:
    // Normal mode (4 reyes): A entangled with K
    // 8 reyes mode: A entangled with 2, K entangled with 3
    const is8Reyes = gameMode === '8';
    
    if (is8Reyes) {
      // In 8 reyes: A↔2 and K↔3
      if (value === 'A' || value === '2' || value === 'K' || value === '3') {
        isEntangled = true;
      }
    } else {
      // In normal mode: A↔K
      if (value === 'A' || value === 'K') {
        isEntangled = true;
      }
    }
    
    const cardValues = ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K'];
    let entangledPartner = '';
    let coefficientA = 0;
    let coefficientB = 0;
    
    if (isEntangled) {
      // A and K are always entangled with each other
      if (value === 'A') {
        entangledPartner = 'K';
      } else if (value === 'K') {
        entangledPartner = 'A';
      }
      // In 8 reyes mode: 2 and 3 are also entangled
      else if (is8Reyes && value === '2') {
        entangledPartner = '3';
      } else if (is8Reyes && value === '3') {
        entangledPartner = '2';
      }
      
      // Entangled cards are always 50-50
      coefficientA = 0.7071; // sqrt(2)/2 ≈ 0.707
      coefficientB = 0.7071; // sqrt(2)/2 ≈ 0.707
      
      // Solo agregar glow entrelazado si:
      // 1. Es el jugador actual (player1), O
      // 2. Es el compañero (player3, top) Y será verificado después
      if (isCurrentPlayer) {
        card.classList.add('entangled-card');
        card.style.setProperty('--entangle-color', suitColor);
      } else if (isTeammate) {
        card.classList.add('entangled-candidate');
      }
      card.dataset.entangled = 'true';
      card.dataset.mainValue = value;
      card.dataset.partner = entangledPartner;
      card.dataset.playerIndex = playerIndex;
      card.dataset.suitColor = suitColor;
    }

    // Solo el jugador actual ve el contenido de sus cartas; compañero y oponentes ven ψ
    const showCardContent = isCurrentPlayer;
    
    if (!showCardContent) {
      // Compañero y oponentes: boca abajo (ψ). El compañero tendrá glow en el borde si está entrelazada (en matchEntangledCards).
      const hiddenLabel = document.createElement('div');
      let hiddenClass = 'hidden-card-symbol';
      if (playerIndex === 1) hiddenClass += ' hidden-symbol-right';
      if (playerIndex === 3) hiddenClass += ' hidden-symbol-left';
      hiddenLabel.className = hiddenClass;
      hiddenLabel.innerHTML = 'ψ';
      hiddenLabel.style.fontSize = '3rem';
      hiddenLabel.style.opacity = '0.9';
      card.appendChild(hiddenLabel);
    } else {
      // Cartas visibles del jugador actual - todas con dos números en esquinas
      
      // Top right label
      const topLabel = document.createElement('div');
      topLabel.className = `dirac-label card-top${(playerIndex === 1 || playerIndex === 3) ? ' label-flipped' : ''}`;
      topLabel.style.color = suitColor;
      topLabel.innerHTML = `|${value}⟩`;
      card.appendChild(topLabel);

      // Bottom left label
      const bottomLabel = document.createElement('div');
      bottomLabel.className = `dirac-label card-bottom${(playerIndex === 1 || playerIndex === 3) ? ' label-flipped' : ''}`;
      bottomLabel.style.color = suitColor;
      
      if (isEntangled && entangledPartner) {
        // For entangled: show the partner
        bottomLabel.innerHTML = `|${entangledPartner}⟩`;
      } else {
        // For normal cards: show the same value
        bottomLabel.innerHTML = `|${value}⟩`;
      }
      card.appendChild(bottomLabel);

      // Suit symbol
      const suitIcon = document.createElement('div');
      let suitClass = `suit-icon suit-${suit}`;
      if (playerIndex === 1) suitClass += ' suit-icon-right';
      if (playerIndex === 3) suitClass += ' suit-icon-left';
      suitIcon.className = suitClass;
      suitIcon.innerHTML = suitSymbol;
      suitIcon.style.color = suitColor;
      card.appendChild(suitIcon);

      // Bloch sphere
      const bloch = document.createElement('div');
      bloch.className = 'bloch-sphere';
      let state = 'superposition';
      
      if (isEntangled) {
        state = 'entangled';
        bloch.innerHTML = CardGenerator.generateBlochSphere(state, true, value, entangledPartner, 0, 0, suitColor);
      } else {
        // Non-entangled: random up or down
        state = Math.random() > 0.5 ? 'up' : 'down';
        bloch.innerHTML = CardGenerator.generateBlochSphere(state, false, '0', '1', 0, 0, suitColor);
      }
      card.appendChild(bloch);

      // Quantum decoration
      const decoration = document.createElement('div');
      decoration.className = 'quantum-decoration';
      decoration.textContent = value;
      card.appendChild(decoration);
    }

    // Card click interaction
    card.addEventListener('click', () => {
      if (card.classList.contains('selectable')) {
        // In discard phase - toggle selection
        toggleCardSelection(card);
      } else {
        // Normal card details
        showCardDetails(value, suit, suitSymbol, isCurrentPlayer, suitColor, isEntangled, entangledPartner);
      }
    });

    return card;
  }

  function createScoreboard(gameContainer, gameMode) {
    const scoreboard = document.createElement('div');
    scoreboard.className = 'scoreboard';
    
    // Get individual player scores (from data-score or parse text like "(0)")
    const getScore = (sel) => {
      const el = document.querySelector(sel + ' .character-score');
      if (!el) return 0;
      const ds = el.dataset?.score;
      if (ds !== undefined) return parseInt(ds, 10) || 0;
      return parseInt((el.textContent || '').replace(/[^0-9-]/g, ''), 10) || 0;
    };
    const player1Score = getScore('#player1-zone');
    const player2Score = getScore('#player2-zone');
    const player3Score = getScore('#player3-zone');
    const player4Score = getScore('#player4-zone');
    
    // Calculate team scores from gameState
    const team1Score = gameState.teams.team1.score;
    const team2Score = gameState.teams.team2.score;
    
    // Calculate probabilities for player 1
    const player1Cards = document.querySelectorAll('#player1-zone .quantum-card');
    const cardValues = [];
    const entangledInfo = []; // Track entangled cards that are NOT collapsed
    
    player1Cards.forEach((card, idx) => {
      // Check if card is collapsed
      const isCollapsed = card.dataset.collapsed === 'true';
      
      if (isCollapsed) {
        // For collapsed cards, use the final value
        const finalValue = card.dataset.value;
        cardValues.push(finalValue);
      } else {
        // For non-collapsed cards
        const decoration = card.querySelector('.quantum-decoration');
        if (decoration) {
          const value = decoration.textContent.trim();
          cardValues.push(value);
          
          // Check if card is entangled AND not collapsed
          if (card.dataset.entangled === 'true') {
            entangledInfo.push({
              index: cardValues.length - 1, // Index in cardValues array
              value1: card.dataset.mainValue || value,
              value2: card.dataset.partner
            });
          }
        }
      }
    });
    
    const paresProb = calculateParesProbability(cardValues, entangledInfo);
    const juegoProb = calculateJuegoProbability(cardValues, entangledInfo, gameMode);
    
    scoreboard.innerHTML = `
      <div class="scoreboard-title">Marcador Cuántico</div>
      <div class="scoreboard-teams">
        <div class="team-score">
          <div class="team-label">Cirac-Zoller<br><small>(Cirac + Zoller)</small></div>
          <div class="team-points">${team1Score}</div>
        </div>
        <div class="team-vs">VS</div>
        <div class="team-score">
          <div class="team-label">Bohmian<br><small>(Preskill + Deutsch)</small></div>
          <div class="team-points">${team2Score}</div>
        </div>
      </div>
      <div class="scoreboard-stats">
        <div class="stat-item">
          <div class="stat-label">Ronda</div>
          <div class="stat-value">${gameState.currentRound}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Manos</div>
          <div class="stat-value">12</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Pares %</div>
          <div class="stat-value">${paresProb}%</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Juego %</div>
          <div class="stat-value">${juegoProb}%</div>
        </div>
      </div>
      <div class="scoreboard-controls">
        <button class="quantum-gate m-gate" title="Mus: Medir Qubits">
          M
          <div class="gate-label">MUS</div>
        </button>
        <button class="quantum-gate" title="Envido: Aplicar Puerta Hadamard">
          H
          <div class="gate-label">ENVIDO</div>
        </button>
        <button class="quantum-gate i-gate" title="Paso: Puerta Identidad">
          I
          <div class="gate-label">PASO</div>
        </button>
        <button class="quantum-gate accept-gate" title="Aceptar: Acepta la apuesta">
          ✓
          <div class="gate-label">ACEPTA</div>
        </button>
        <button class="quantum-gate cx-gate" title="CNOT: Entrelazamiento Máximo">
          CX
          <div class="gate-label">CX</div>
        </button>
      </div>
    `;
    gameContainer.appendChild(scoreboard);

    // Add button interactions - now integrated with round system
    const buttons = scoreboard.querySelectorAll('.quantum-gate');
    console.log(`[BUTTONS] Found ${buttons.length} buttons in scoreboard`);
    console.log('[BUTTONS] Button elements:', buttons);
    
    // Initially dim all buttons - they'll be highlighted when it's your turn
    buttons.forEach((btn, idx) => {
      btn.style.opacity = '0.5';
      btn.style.cursor = 'help';
      btn.style.pointerEvents = 'auto';
      console.log(`[BUTTON ${idx}] Configured - text: "${btn.textContent.trim()}"`);
    });
    
    // Button 1 - MUS/TENGO/JUEGO button
    buttons[0].addEventListener('click', (e) => {
      try {
        console.log('[BUTTON 1 CLICK] Button 1 clicked!', e);
        console.log('[BUTTON 1] activePlayerIndex:', gameState.activePlayerIndex, 'localPlayerIndex:', localPlayerIndex);
        console.log('[BUTTON 1] currentRound:', gameState.currentRound);
        console.log('[BUTTON 1] roundActions:', gameState.roundActions);
        console.log('[BUTTON 1] paresDeclarations:', gameState.paresDeclarations);
        
        if (gameState.activePlayerIndex === localPlayerIndex) {
          console.log('[BUTTON 1] Es mi turno - proceeding with action');
          if (gameState.currentRound === 'MUS' && gameState.roundActions[localPlayerIndex] === undefined) {
            console.log('[BUTTON 1] Calling handleMusRound with mus');
            handleMusRound(localPlayerIndex, 'mus');
          } else if (gameState.currentRound === 'PARES' && gameState.paresDeclarations[localPlayerIndex] === undefined) {
            console.log('[BUTTON 1] Calling handleParesDeclaration with true');
            handleParesDeclaration(localPlayerIndex, true); // TENGO
          } else if (gameState.currentRound === 'JUEGO' && gameState.juegoDeclarations && gameState.juegoDeclarations[localPlayerIndex] === undefined) {
            console.log('[BUTTON 1] Calling handleJuegoDeclaration with true');
            handleJuegoDeclaration(localPlayerIndex, true);
          } else {
            console.log('[BUTTON 1] No action matched - round:', gameState.currentRound, 'roundActions[0]:', gameState.roundActions[localPlayerIndex]);
          }
        } else {
          console.log('[BUTTON 1] No es mi turno - mostrando descripción');
          showQuantumGateDescription('M', 'Puerta de Medida (MUS)', 'Aplica medición cuántica para colapsar la función de onda. En la fase MUS, esta puerta permite solicitar nuevas cartas, creando superposición cuántica de posibles manos.');
        }
      } catch (err) {
        console.error('[BUTTON 1 ERROR]', err, err.stack);
      }
    });
    
    // Button 2 - ENVIDO/NO TENGO button
    buttons[1].addEventListener('click', (e) => {
      try {
        console.log('[BUTTON 2 CLICK] Button 2 clicked!', e);
        console.log(`[BUTTON 2 CLICK] Active player: ${gameState.activePlayerIndex}, Local player: ${localPlayerIndex}, Is my turn: ${gameState.activePlayerIndex === localPlayerIndex}`);
        console.log(`[BUTTON 2 CLICK] Current round: ${gameState.currentRound}`);
        
        if (gameState.activePlayerIndex === localPlayerIndex) {
          // Check PARES declaration first (highest priority)
          if (gameState.currentRound === 'PARES' && gameState.paresDeclarations && gameState.paresDeclarations[localPlayerIndex] === undefined) {
            console.log('[BUTTON 2] Calling handleParesDeclaration with false');
            handleParesDeclaration(localPlayerIndex, false); // NO TENGO
          }
          // Check JUEGO declaration
          else if (gameState.currentRound === 'JUEGO' && gameState.juegoDeclarations && gameState.juegoDeclarations[localPlayerIndex] === undefined) {
            console.log('[BUTTON 2] Calling handleJuegoDeclaration with false');
            handleJuegoDeclaration(localPlayerIndex, false);
          }
          // MUS phase envido
          else if (gameState.currentRound === 'MUS' && gameState.roundActions && gameState.roundActions[localPlayerIndex] === undefined) {
            console.log('[BUTTON 2] Showing envido modal for MUS');
            showEnvidoModal((amount) => {
              gameState.currentBet.amount = amount;
              handleMusRound(localPlayerIndex, 'envido', { amount: amount });
            });
          }
          // Betting rounds (only after declarations are done)
          else if ((gameState.currentRound === 'GRANDE' || gameState.currentRound === 'CHICA') ||
                   (gameState.currentRound === 'PARES' && gameState.paresDeclarations && Object.keys(gameState.paresDeclarations).length >= 4) ||
                   (gameState.currentRound === 'JUEGO' && gameState.juegoDeclarations && Object.keys(gameState.juegoDeclarations).length >= 4)) {
            console.log(`[BUTTON 2] Showing envido modal for betting`);
            showEnvidoModal((amount) => {
              const action = gameState.currentBet.bettingTeam ? 'raise' : 'envido';
              console.log(`[BUTTON 2 ENVIDO CALLBACK] Action: ${action}, Amount: ${amount}`);
              handleBettingRound(localPlayerIndex, action, amount);
            });
          } else {
            console.log('[BUTTON 2] No action matched for button 2');
          }
        } else {
          console.log('[BUTTON 2] No es mi turno - mostrando descripción');
          showQuantumGateDescription('H', 'Puerta Hadamard (ENVIDO)', 'Aplica transformación Hadamard para crear superposición cuántica. Esta puerta inicia o sube una apuesta, entrelazando tu estado cuántico con tus oponentes.');
        }
      } catch (err) {
        console.error('[BUTTON 2 ERROR]', err, err.stack);
      }
    });
    
    // Button 3 - PASO/PUEDE button - pass in any round or PUEDE in PARES/JUEGO
    buttons[2].onclick = (e) => {
      console.log('[BUTTON 3 CLICK] Button 3 clicked!', e);
      if (gameState.activePlayerIndex === localPlayerIndex) {
        if (gameState.currentRound === 'PARES' && gameState.paresDeclarations[localPlayerIndex] === undefined) {
          handleParesDeclaration(localPlayerIndex, 'puede'); // PUEDE
        } else if (gameState.currentRound === 'JUEGO' && gameState.juegoDeclarations && gameState.juegoDeclarations[localPlayerIndex] === undefined) {
          handleJuegoDeclaration(localPlayerIndex, 'puede'); // PUEDE
        } else if (gameState.currentRound === 'MUS' && gameState.roundActions[localPlayerIndex] === undefined) {
          handleMusRound(localPlayerIndex, 'paso');
        } else if (gameState.currentRound !== 'MUS') {
          handleBettingRound(localPlayerIndex, 'paso');
        }
      } else {
        showQuantumGateDescription('I', 'Puerta Identidad (PASO)', 'Aplica operación identidad - sin cambios al estado cuántico. Pasa tu turno sin acción, manteniendo tu superposición actual y rechazando apostar o subir.');
      }
    };
    
    // Button 4 - ACCEPT/QUIERO button - accept the bet (only in betting phase, not declarations)
    buttons[3].onclick = (e) => {
      console.log('[BUTTON 4 CLICK] Button 4 clicked!', e);
      if (gameState.activePlayerIndex === localPlayerIndex) {
        // Only allow accepting bets, not during declaration phase
        const inDeclaration = (gameState.currentRound === 'PARES' && gameState.paresDeclarations && Object.keys(gameState.paresDeclarations).length < 4) ||
                             (gameState.currentRound === 'JUEGO' && gameState.juegoDeclarations && Object.keys(gameState.juegoDeclarations).length < 4);
        
        if (!inDeclaration && (gameState.currentRound === 'GRANDE' || gameState.currentRound === 'CHICA' || 
            gameState.currentRound === 'PARES' || gameState.currentRound === 'JUEGO')) {
          handleBettingRound(localPlayerIndex, 'accept');
        }
      } else {
        showQuantumGateDescription('✓', 'Puerta Aceptar (QUIERO)', 'Confirma el entrelazamiento cuántico. Acepta la apuesta del oponente y acuerda resolver la medición cuántica al nivel de apuesta actual.');
      }
    };
    
    // ORDAGO button - all-in bet
    buttons[4].onclick = (e) => {
      console.log('[BUTTON 5 CLICK] Button 5 clicked!', e);
      if (gameState.activePlayerIndex === localPlayerIndex) {
        if (gameState.currentRound === 'MUS' && gameState.roundActions[localPlayerIndex] === undefined) {
          handleMusRound(localPlayerIndex, 'ordago');
        } else if (gameState.currentRound !== 'MUS') {
          handleBettingRound(localPlayerIndex, 'ordago');
        }
      } else {
        showQuantumGateDescription('CX', 'Puerta CNOT (ÓRDAGO)', 'Puerta controlada-NOT - la puerta fundamental de entrelazamiento de dos qubits. Crea entrelazamiento cuántico máximo, iniciando una apuesta total donde todos los puntos están en juego.');
      }
    };
    
    // Initialize button visibility - hide ACCEPT button initially (MUS round)
    buttons[3].style.display = 'none';
    
    // Function to debug buttons
    window.debugButtons = () => {
      const buttons = document.querySelectorAll('.scoreboard-controls .quantum-gate');
      console.log('=== BUTTON DEBUG ===');
      console.log(`Total buttons found: ${buttons.length}`);
      buttons.forEach((btn, idx) => {
        console.log(`Button ${idx}: display=${btn.style.display}, opacity=${btn.style.opacity}, pointerEvents=${btn.style.pointerEvents}, text="${btn.textContent.trim()}", offsetParent=${btn.offsetParent}, computed display=${window.getComputedStyle(btn).display}`);
      });
      console.log('Button 0 click listeners:', window.getEventListeners ? window.getEventListeners(buttons[0]) : 'N/A');
    };
    
    console.log('[SCOREBOARD CREATED] Buttons ready. Call window.debugButtons() to check state');
    
    // Global click logger for debugging
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('quantum-gate') || e.target.closest('.quantum-gate')) {
        const btn = e.target.classList.contains('quantum-gate') ? e.target : e.target.closest('.quantum-gate');
        const allButtons = document.querySelectorAll('.scoreboard-controls .quantum-gate');
        const btnIndex = Array.from(allButtons).indexOf(btn);
        console.log(`[GLOBAL CLICK LOG] Clicked quantum-gate button! Index: ${btnIndex}, Text: "${btn.textContent.trim()}"`);
      }
    }, true); // Use capture phase to catch clicks before they reach handlers
  }

  // Update scoreboard with current game state
  // Helper function to calculate and return current probabilities
  function recalculateProbabilities() {
    try {
      const player1Cards = document.querySelectorAll('#player1-zone .quantum-card');
      const cardValues = [];
      const entangledInfo = [];
      
      player1Cards.forEach((card, idx) => {
        const isCollapsed = card.dataset.collapsed === 'true';
        
        if (isCollapsed) {
          const finalValue = card.dataset.value;
          cardValues.push(finalValue);
        } else {
          const decoration = card.querySelector('.quantum-decoration');
          if (decoration) {
            const value = decoration.textContent.trim();
            cardValues.push(value);
            
            if (card.dataset.entangled === 'true') {
              entangledInfo.push({
                index: cardValues.length - 1,
                value1: card.dataset.mainValue || value,
                value2: card.dataset.partner
              });
            }
          }
        }
      });
      
      const gameMode = window.currentGameMode || '4';
      const paresProb = calculateParesProbability(cardValues, entangledInfo);
      const juegoProb = calculateJuegoProbability(cardValues, entangledInfo, gameMode);
      return { paresProb, juegoProb };
    } catch (err) {
      console.error('[PROBABILITY CALC ERROR]', err, err.stack);
      return { paresProb: 0, juegoProb: 0 };
    }
  }

  function updateScoreboard() {
    try {
      const team1ScoreEl = document.querySelector('.team-score:first-child .team-points');
      const team2ScoreEl = document.querySelector('.team-score:last-child .team-points');
      const roundEl = document.querySelector('.stat-item:first-child .stat-value');
      
      if (team1ScoreEl) team1ScoreEl.textContent = gameState.teams.team1.score;
      if (team2ScoreEl) team2ScoreEl.textContent = gameState.teams.team2.score;
      if (roundEl) roundEl.textContent = gameState.currentRound;
      
      // Update probabilities without recreating DOM
      const { paresProb, juegoProb } = recalculateProbabilities();
      const statItems = document.querySelectorAll('.stat-item .stat-value');
      if (statItems.length >= 4) {
        statItems[2].textContent = `${paresProb}%`; // Pares probability
        statItems[3].textContent = `${juegoProb}%`; // Juego probability
      }
      
      // Update button labels and visibility based on current round
      const buttons = document.querySelectorAll('.scoreboard-controls .quantum-gate');
      console.log(`[UPDATE SCOREBOARD] Found ${buttons.length} buttons`);
      if (buttons.length >= 5) {
      const button1Label = buttons[0].querySelector('.gate-label');
      const button2Label = buttons[1].querySelector('.gate-label');
      const button3Label = buttons[2].querySelector('.gate-label'); // PASO/NO QUIERO button
      const button4Label = buttons[3].querySelector('.gate-label'); // ACCEPT/QUIERO button
      const acceptButton = buttons[3]; // ACCEPT button
      
      // Check if we're in a declaration phase
      const inParesDeclaration = gameState.currentRound === 'PARES' && 
        (!gameState.paresDeclarations || Object.keys(gameState.paresDeclarations).length < 4);
      const inJuegoDeclaration = gameState.currentRound === 'JUEGO' && 
        (!gameState.juegoDeclarations || Object.keys(gameState.juegoDeclarations).length < 4);
      
      // Check if there's an active bet
      const hasActiveBet = gameState.currentBet && gameState.currentBet.bettingTeam;
      const localPlayerTeam = getPlayerTeam(0);
      const isOpponentsBet = hasActiveBet && gameState.currentBet.bettingTeam !== localPlayerTeam;
      
      if (inParesDeclaration) {
        // In PARES declaration phase - show TENGO, NO TENGO, PUEDE
        if (button1Label) button1Label.textContent = 'TENGO';
        if (button2Label) button2Label.textContent = 'NO TENGO';
        if (button3Label) button3Label.textContent = 'PUEDE';
        buttons[0].style.display = 'inline-flex'; // Show TENGO
        buttons[1].style.display = 'inline-flex'; // Show NO TENGO
        buttons[2].style.display = 'inline-flex'; // Show PUEDE
        acceptButton.style.display = 'none'; // Hide ACCEPT during declaration
        buttons[4].style.display = 'none'; // Hide ÓRDAGO during declaration
      } else if (inJuegoDeclaration) {
        // In JUEGO declaration phase - show JUEGO, NO JUEGO, PUEDE
        if (button1Label) button1Label.textContent = 'JUEGO';
        if (button2Label) button2Label.textContent = 'NO JUEGO';
        if (button3Label) button3Label.textContent = 'PUEDE';
        buttons[0].style.display = 'inline-flex'; // Show JUEGO
        buttons[1].style.display = 'inline-flex'; // Show NO JUEGO
        buttons[2].style.display = 'inline-flex'; // Show PUEDE
        acceptButton.style.display = 'none'; // Hide ACCEPT during declaration
        buttons[4].style.display = 'none'; // Hide ÓRDAGO during declaration
      } else if (hasActiveBet && isOpponentsBet) {
        // There's an active bet from the opponent team
        const isOrdagoBet = gameState.currentBet.betType === 'ordago';
        
        if (isOrdagoBet) {
          // ÓRDAGO bet - only allow PASO (reject) or QUIERO (accept)
          if (button2Label) button2Label.textContent = 'ENVIDO';
          if (button3Label) button3Label.textContent = 'PASO';
          if (button4Label) button4Label.textContent = 'QUIERO';
          buttons[0].style.display = 'none'; // Hide MUS
          buttons[1].style.display = 'none'; // Hide ENVIDO (can't counter-raise ÓRDAGO)
          buttons[2].style.display = 'inline-flex'; // Show PASO (reject)
          buttons[3].style.display = 'inline-flex'; // Show QUIERO (accept)
          buttons[4].style.display = 'none'; // Hide ÓRDAGO button itself
        } else {
          // Normal bet - show ENVIDO, PASO, QUIERO, and ÓRDAGO
          if (button1Label) button1Label.textContent = 'MUS';
          if (button2Label) button2Label.textContent = 'ENVIDO';
          if (button3Label) button3Label.textContent = 'PASO';
          if (button4Label) button4Label.textContent = 'QUIERO';
          buttons[0].style.display = 'none'; // Hide MUS when responding to bet
          buttons[1].style.display = 'inline-flex'; // Show ENVIDO (counter-raise)
          buttons[2].style.display = 'inline-flex'; // Show PASO (reject bet)
          buttons[3].style.display = 'inline-flex'; // Show QUIERO (accept)
          buttons[4].style.display = 'inline-flex'; // Show ÓRDAGO
        }
      } else {
        // Default labels (no active bet or it's our team's bet)
        if (button1Label) button1Label.textContent = 'MUS';
        if (button2Label) button2Label.textContent = 'ENVIDO';
        if (button3Label) button3Label.textContent = 'PASO';
        if (button4Label) button4Label.textContent = 'ACEPTA';
        // Show MUS button only during MUS round
        const showMus = gameState.currentRound === 'MUS';
        console.log(`[UPDATE SCOREBOARD] Round: ${gameState.currentRound}, Show MUS: ${showMus}`);
        buttons[0].style.display = showMus ? 'inline-flex' : 'none';
        buttons[1].style.display = 'inline-flex';
        buttons[2].style.display = 'inline-flex';
        buttons[4].style.display = 'inline-flex';
        console.log(`[UPDATE SCOREBOARD] Button displays: [0]=${buttons[0].style.display}, [1]=${buttons[1].style.display}, [2]=${buttons[2].style.display}, [4]=${buttons[4].style.display}`);
        
        // Hide ACCEPT button when there's no opponent bet to respond to
        acceptButton.style.display = 'none';
      }
      
      // Visual feedback for turn state
      const isMyTurn = gameState.activePlayerIndex === localPlayerIndex;
      buttons.forEach(button => {
        // CRITICAL: Keep pointerEvents = 'auto' ALWAYS so onclick handlers fire
        button.style.pointerEvents = 'auto';
        button.disabled = false; // Never disable - onclick handlers check turn
        
        if (isMyTurn) {
          button.style.opacity = '1';
          button.style.cursor = 'pointer';
        } else {
          button.style.opacity = '0.5';
          button.style.cursor = 'help';
        }
      });
      
      console.log(`[UPDATE SCOREBOARD DONE] Round=${gameState.currentRound}, IsMyTurn=${isMyTurn}, Buttons shown:`, Array.from(buttons).map((b, i) => `[${i}]=${b.style.display}`).join(', '));
    }
    } catch (err) {
      console.error('[UPDATE SCOREBOARD ERROR]', err, err.stack);
    }
  }
  
  // Show quantum gate description when clicked while not in turn
  // Map gate symbols to their colors
  function getGateColor(symbol) {
    const colors = {
      'M': '#a78bfa',   // lavender
      'H': '#2ec4b6',   // teal
      'I': '#f5c518',   // gold
      '✓': '#ff9e6d',   // coral
      'CX': '#ff6b6b'   // red/danger
    };
    return colors[symbol] || '#2ec4b6';
  }

  function showQuantumGateDescription(symbol, title, description) {
    const color = getGateColor(symbol);
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: linear-gradient(135deg, rgba(30, 41, 59, 0.98), rgba(15, 23, 42, 0.98));
      border: 3px solid ${color};
      border-radius: 20px;
      padding: 30px 40px;
      max-width: 500px;
      z-index: 3000;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(10px);
    `;
    
    // Helper to convert hex to rgba for hover effects
    const hexToRgba = (hex, alpha) => {
      const r = parseInt(hex.slice(1,3), 16);
      const g = parseInt(hex.slice(3,5), 16);
      const b = parseInt(hex.slice(5,7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };
    
    modal.innerHTML = `
      <div style="text-align: center;">
        <div style="
          font-size: 4rem;
          color: ${color};
          margin-bottom: 15px;
          text-shadow: 0 0 20px ${hexToRgba(color, 0.5)};
        ">${symbol}</div>
        <div style="
          font-size: 1.5rem;
          font-weight: bold;
          color: ${color};
          margin-bottom: 20px;
          letter-spacing: 2px;
        ">${title}</div>
        <div style="
          font-size: 1rem;
          color: ${color};
          line-height: 1.6;
          margin-bottom: 25px;
          text-align: left;
          opacity: 0.9;
        ">${description}</div>
        <button style="
          background: linear-gradient(135deg, ${hexToRgba(color, 0.3)}, ${hexToRgba(color, 0.1)});
          border: 2px solid ${color};
          color: ${color};
          padding: 12px 30px;
          font-size: 1rem;
          font-weight: bold;
          border-radius: 25px;
          cursor: pointer;
          transition: all 0.3s;
        " onmouseover="this.style.background='linear-gradient(135deg, ${hexToRgba(color, 0.5)}, ${hexToRgba(color, 0.2)})'"
           onmouseout="this.style.background='linear-gradient(135deg, ${hexToRgba(color, 0.3)}, ${hexToRgba(color, 0.1)})'"
           onclick="this.parentElement.parentElement.remove()">
          ENTENDIDO
        </button>
      </div>
    `;
    
    // Click outside to close
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    };
    
    document.body.appendChild(modal);
  }
  
  // Make showQuantumGateDescription globally accessible for portada screen
  window.showQuantumGateDescription = showQuantumGateDescription;
  
  // Show auto-declaration message for local player
  function showAutoDeclarationMessage(message) {
    // Remove any existing auto-declaration message
    const existingMessage = document.querySelector('.auto-declaration-message');
    if (existingMessage) {
      existingMessage.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = 'auto-declaration-message';
    notification.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: linear-gradient(135deg, rgba(46, 196, 182, 0.95), rgba(30, 41, 59, 0.95));
      border: 3px solid #2ec4b6;
      border-radius: 20px;
      padding: 30px 50px;
      color: white;
      font-size: 2rem;
      font-weight: bold;
      z-index: 3000;
      box-shadow: 0 20px 60px rgba(46, 196, 182, 0.4), 0 0 100px rgba(46, 196, 182, 0.2);
      opacity: 0;
      transition: opacity 0.3s;
      text-align: center;
    `;
    
    notification.innerHTML = `
      <div style="margin-bottom: 10px; font-size: 1rem; opacity: 0.8;">Auto-declaración</div>
      <div>${message}</div>
    `;
    document.body.appendChild(notification);
    
    // Fade in
    setTimeout(() => {
      notification.style.opacity = '1';
    }, 10);
    
    // Fade out and remove
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 600);
  }
  
  // Show team points notification
  function showTeamPointsNotification(team, points) {
    const teamName = gameState.teams[team].name;
    const color = team === 'team1' ? '#2ec4b6' : '#ff9e6d';
    
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95));
      border: 2px solid ${color};
      border-radius: 15px;
      padding: 15px 30px;
      color: ${color};
      font-size: 1.3rem;
      font-weight: bold;
      z-index: 2001;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px ${color}40;
      opacity: 0;
      transition: opacity 0.3s;
    `;
    
    notification.textContent = `${teamName}: +${points} ${points === 1 ? 'punto' : 'puntos'}`;
    document.body.appendChild(notification);
    
    // Fade in
    setTimeout(() => {
      notification.style.opacity = '1';
    }, 10);
    
    // Fade out and remove
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 2500);
  }

  // Show action notification
  function showActionNotification(playerIndex, action, extraData = {}) {
    // Use the actual player names from the reordered array
    const playerName = playerNames[playerIndex] || `Player ${playerIndex + 1}`;
    const amount = extraData.amount || gameState.currentBet.amount || '';
    const actionTexts = {
      'mus': 'MUS',
      'paso': 'PASO',
      'envido': `ENVIDO ${amount}`,
      'ordago': 'CX',
      'accept': 'QUIERO',
      'raise': `SUBE A ${amount}`,
      'pares': 'TENGO PARES',
      'no_pares': 'NO TENGO PARES',
      'puede_pares': 'PUEDE',
      'juego': 'JUEGO',
      'no_juego': 'NO JUEGO',
      'puede_juego': 'PUEDE'
    };
    
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95));
      border: 2px solid #2ec4b6;
      border-radius: 15px;
      padding: 15px 30px;
      color: #2ec4b6;
      font-size: 1.2rem;
      font-weight: bold;
      z-index: 2000;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      opacity: 0;
      transition: opacity 0.3s;
    `;
    
    notification.textContent = `${playerName}: ${actionTexts[action] || action.toUpperCase()}`;
    document.body.appendChild(notification);
    
    // Fade in
    setTimeout(() => {
      notification.style.opacity = '1';
    }, 10);
    
    // Fade out and remove
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 2000);
  }

  function playDealAnimation() {
    const cards = document.querySelectorAll('#game-container .quantum-card.card-dealing');
    const DEAL_DELAY_MS = 55;
    cards.forEach((card, i) => {
      const order = parseInt(card.dataset.dealOrder, 10) || i;
      setTimeout(() => {
        card.classList.remove('card-dealing');
        card.classList.add('card-dealt');
        card.classList.add('float-animation');
        card.style.animationDelay = `${order * 0.15}s`;
      }, order * DEAL_DELAY_MS);
    });
  }

  function calculateParesProbability(cardValues, entangledInfo = []) {
    const gameMode = window.currentGameMode || '4';
    
    // Normalize values for PARES counting (in 8 reyes: A=2, K=3)
    const normalizePareValue = (value) => {
      if (gameMode === '8') {
        if (value === 'A' || value === '2') return 'A';
        if (value === '3' || value === 'K') return 'K';
        return value;
      } else {
        return value;
      }
    };
    
    // If no entangled cards, it's simple
    if (entangledInfo.length === 0) {
      const valueCounts = {};
      cardValues.forEach(val => {
        const normalized = normalizePareValue(val);
        valueCounts[normalized] = (valueCounts[normalized] || 0) + 1;
      });
      
      for (let val in valueCounts) {
        if (valueCounts[val] >= 2) {
          return '100'; // Has pairs
        }
      }
      return '0'; // No pairs
    }
    
    // If there are entangled cards, calculate all possible combinations
    const cardValuesWithoutEntangled = cardValues.filter((_, idx) => {
      return !entangledInfo.some(e => e.index === idx);
    });
    
    // Get indices of entangled cards
    const entangledIndices = entangledInfo.map(e => e.index);
    
    // Generate all possible combinations of entangled card collapse
    const numEntangled = entangledInfo.length;
    const totalCombinations = Math.pow(2, numEntangled);
    let combinationsWithPairs = 0;
    
    for (let combination = 0; combination < totalCombinations; combination++) {
      const testValues = [...cardValuesWithoutEntangled];
      
      // For each entangled card, add its value according to the combination
      entangledInfo.forEach((entangled, idx) => {
        const bit = (combination >> idx) & 1;
        const value = bit === 0 ? entangled.value1 : entangled.value2;
        testValues.push(value);
      });
      
      // Count cards in this combination WITH normalization
      const valueCounts = {};
      testValues.forEach(val => {
        const normalized = normalizePareValue(val);
        valueCounts[normalized] = (valueCounts[normalized] || 0) + 1;
      });
      
      // Check if this combination has pairs
      let hasPair = false;
      for (let val in valueCounts) {
        if (valueCounts[val] >= 2) {
          hasPair = true;
          break;
        }
      }
      
      if (hasPair) {
        combinationsWithPairs++;
      }
    }
    
    // Calculate percentage
    const probability = Math.round((combinationsWithPairs / totalCombinations) * 100);
    return probability.toString();
  }

  function calculateJuegoProbability(cardValues, entangledInfo = [], gameMode = '4') {
    // In normal mode, 3s are worth 3 points; in 8 reyes mode they're worth 10
    const getCardPoints = (val) => {
      if (val === 'A') return 1;
      if (val === '2') return 1;
      if (val === '3') return gameMode === '8' ? 10 : 3;  // 8 reyes: 3=10, normal: 3=3
      if (val === 'J') return 10;
      if (val === 'Q') return 10;
      if (val === 'K') return 10;
      return parseInt(val) || 0;
    };
    
    // If no entangled cards, calculate simple probability
    if (entangledInfo.length === 0) {
      const sum = cardValues.reduce((acc, val) => acc + getCardPoints(val), 0);
      return calculateProbabilityFromSum(sum).toFixed(0);
    }
    
    // For entangled cards: calculate probability that at least one configuration gives Juego
    // We need to consider all possible combinations
    let successfulCombinations = 0;
    let totalCombinations = Math.pow(2, entangledInfo.length);
    
    // Generate all possible combinations
    for (let i = 0; i < totalCombinations; i++) {
      let sum = 0;
      
      // Add points from non-entangled cards
      for (let j = 0; j < cardValues.length; j++) {
        const isEntangled = entangledInfo.some(e => e.index === j);
        if (!isEntangled) {
          sum += getCardPoints(cardValues[j]);
        }
      }
      
      // Add points from entangled cards based on this combination
      entangledInfo.forEach((entangled, bitIndex) => {
        const bit = (i >> bitIndex) & 1;
        const value = bit === 0 ? entangled.value1 : entangled.value2;
        sum += getCardPoints(value);
      });
      
      // Check if this combination results in Juego (sum >= 31)
      if (sum >= 31) {
        successfulCombinations++;
      }
    }
    
    // Calculate probability as percentage of successful combinations
    const probability = (successfulCombinations / totalCombinations) * 100;
    return probability.toFixed(0);
  }
  
  function calculateProbabilityFromSum(sum) {
    // Pure probability calculation based on final sum
    if (sum >= 31) {
      const excess = sum - 31;
      if (excess === 0) return 100;
      if (excess <= 9) return 95 - (excess * 2);
      return 50;
    } else {
      const deficit = 31 - sum;
      if (deficit === 0) return 100;
      if (deficit <= 5) return 90 - (deficit * 5);
      if (deficit <= 10) return 65 - (deficit * 3);
      if (deficit <= 15) return 35 - (deficit * 2);
      return 10;
    }
  }

  function showCharacterModal(characterName, description) {
    // Remove existing modal if any
    const existingModal = document.querySelector('.character-modal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.className = 'character-modal';
    modal.innerHTML = `
      <div class="character-modal-content">
        <div class="character-modal-header">
          <h2>${characterName}</h2>
          <button class="character-modal-close">✕</button>
        </div>
        <div class="character-modal-body">
          <p>${description}</p>
        </div>
      </div>
    `;
    
    const closeBtn = modal.querySelector('.character-modal-close');
    closeBtn.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
    
    document.body.appendChild(modal);
  }

  function showCardDetails(value, suit, symbol, isCurrentPlayer, suitColor, isEntangled, entangledPartner) {
    if (!isCurrentPlayer) {
      // Cannot reveal hidden cards
      return;
    }
    
    const modal = createModal('#2ec4b6');
    
    let cardInfo = '';
    let stateLabel = '';
    let stateColor = '#2ec4b6';
    
    if (isEntangled) {
      stateLabel = 'Entrelazada';
      stateColor = '#ff9e6d';
      cardInfo = `<div style="color: var(--paper-beige); font-size: 1rem; margin-bottom: 20px;">
        <strong>Estado Entrelazado:</strong><br>
        |${value}⟩/|${entangledPartner}⟩<br>
        <strong>Estatus:</strong> Entrelazada
      </div>`;
    } else {
      stateLabel = 'Estado Definido';
      stateColor = '#4338ca';
      cardInfo = `<div style="color: var(--paper-beige); font-size: 1rem; margin-bottom: 20px;">
        <strong>Palo:</strong> ${suit.toUpperCase()}
      </div>`;
    }
    
    modal.innerHTML = `
      <div class="modal-content" style="
        background: linear-gradient(135deg, rgba(30, 41, 59, 0.98), rgba(15, 23, 42, 0.98));
        border: 3px solid ${stateColor};
        border-radius: 25px;
        padding: 40px;
        text-align: center;
        box-shadow: 0 15px 50px rgba(0, 0, 0, 0.5), 0 0 30px ${stateColor}66;
        max-width: 500px;
        transform: scale(0.8);
        transition: transform 0.3s;
      ">
        <div style="font-size: 5rem; margin-bottom: 20px; filter: drop-shadow(0 0 10px ${stateColor});">
          ${symbol}
        </div>
        <h2 style="color: ${stateColor}; font-size: 2.5rem; margin-bottom: 15px; font-weight: 300; letter-spacing: 3px;">
          CARTA: ${value}
        </h2>
        <div style="color: ${stateColor}; font-size: 1.1rem; margin-bottom: 20px; font-weight: 600;">
          ${stateLabel}
        </div>
        ${cardInfo}
        <button id="close-modal" style="
          background: linear-gradient(135deg, ${stateColor}, ${stateColor}90); color: white; border: none;
          padding: 14px 35px; border-radius: 25px; font-size: 1rem; cursor: pointer;
          font-weight: bold; letter-spacing: 2px; box-shadow: 0 5px 20px ${stateColor}99; transition: all 0.3s;
        ">CERRAR</button>
      </div>
    `;
    
    document.body.appendChild(modal);
    animateModal(modal);
  }

  function showEnvidoModal(callback = null) {
    const modal = createModal('#a78bfa');
    modal.innerHTML = `
      <div class="modal-content" style="
        background: linear-gradient(135deg, rgba(30, 41, 59, 0.98), rgba(15, 23, 42, 0.98));
        border: 3px solid #a78bfa;
        border-radius: 25px;
        padding: 40px;
        text-align: center;
        box-shadow: 0 15px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(167, 139, 250, 0.4);
        max-width: 500px;
        transform: scale(0.8);
        transition: transform 0.3s;
      ">
        <h2 style="color: #a78bfa; font-size: 2.5rem; margin-bottom: 30px; font-weight: 300; letter-spacing: 4px;">
          ENVIDO
        </h2>
        <p style="color: var(--circuit-blueprint); font-size: 1.1rem; margin-bottom: 25px; line-height: 1.6;">
          Elige tu apuesta:
        </p>
        
        <div style="display: flex; flex-direction: column; gap: 20px; margin-bottom: 30px;">
          <!-- Opción de Envido 2 -->
          <button class="envido-option" data-value="2" style="
            background: linear-gradient(135deg, rgba(167, 139, 250, 0.2), rgba(167, 139, 250, 0.08));
            border: 2px solid #a78bfa;
            color: #a78bfa;
            padding: 12px 20px;
            border-radius: 12px;
            font-size: 1rem;
            cursor: pointer;
            font-weight: bold;
            transition: all 0.3s;
          ">Envido: 2 puntos</button>
          
          <!-- Deslizador de 2 a 30 -->
          <div class="envido-slider-wrap">
            <p style="color: var(--circuit-blueprint); font-size: 0.9rem; margin-bottom: 10px;">
              O desliza para elegir entre 2 y 30:
            </p>
            <input type="range" id="envido-slider" class="envido-slider" min="2" max="30" value="15">
            <p style="color: #a78bfa; font-size: 1.3rem; margin-top: 10px; font-weight: bold;">
              <span id="slider-value">15</span> puntos
            </p>
          </div>
          
          <button class="envido-option slider-confirm" data-type="slider" style="
            background: linear-gradient(135deg, rgba(167, 139, 250, 0.2), rgba(167, 139, 250, 0.08));
            border: 2px solid #a78bfa;
            color: #a78bfa;
            padding: 12px 20px;
            border-radius: 12px;
            font-size: 1rem;
            cursor: pointer;
            font-weight: bold;
            transition: all 0.3s;
          ">Confirmar Envido</button>
        </div>
        
        <button id="close-modal" style="
          background: linear-gradient(135deg, #a78bfa, rgba(167, 139, 250, 0.9));
          color: white;
          border: none;
          padding: 12px 30px;
          border-radius: 12px;
          font-size: 0.9rem;
          cursor: pointer;
          font-weight: bold;
          letter-spacing: 2px;
          box-shadow: 0 5px 20px rgba(167, 139, 250, 0.6);
          transition: all 0.3s;
        ">CANCELAR</button>
      </div>
    `;
    
    document.body.appendChild(modal);
    animateModal(modal);
    
    // Slider functionality
    const slider = modal.querySelector('#envido-slider');
    const sliderValue = modal.querySelector('#slider-value');
    slider.addEventListener('input', (e) => {
      sliderValue.textContent = e.target.value;
    });
    
    // Add click handlers for envido options
    const envidoButtons = modal.querySelectorAll('.envido-option');
    envidoButtons.forEach(btn => {
      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'linear-gradient(135deg, rgba(167, 139, 250, 0.35), rgba(167, 139, 250, 0.15))';
        btn.style.transform = 'scale(1.05)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'linear-gradient(135deg, rgba(167, 139, 250, 0.2), rgba(167, 139, 250, 0.08))';
        btn.style.transform = 'scale(1)';
      });
      btn.addEventListener('click', () => {
        console.log(`[MODAL BUTTON CLICK] Type: ${btn.dataset.type}, Value: ${btn.dataset.value}`);
        if (btn.dataset.type === 'slider') {
          const value = parseInt(slider.value);
          console.log(`[MODAL SLIDER] Selected value: ${value}`);
          closeModal(modal);
          if (callback) {
            console.log(`[MODAL SLIDER] Calling callback with ${value}`);
            callback(value);
          } else {
            applyQuantumGate('Envido', `¡Has cantado envido por ${value} puntos!`, '#a78bfa');
          }
        } else {
          const value = parseInt(btn.dataset.value);
          console.log(`[MODAL BUTTON] Selected value: ${value}`);
          closeModal(modal);
          if (callback) {
            console.log(`[MODAL BUTTON] Calling callback with ${value}`);
            callback(value);
          } else {
            applyQuantumGate('Envido', `¡Has cantado envido por ${value} puntos!`, '#a78bfa');
          }
        }
      });
    });
  }

  function applyQuantumGate(gateName, message, color) {
    const modal = createModal(color);
    modal.innerHTML = `
      <div class="modal-content" style="
        background: linear-gradient(135deg, rgba(30, 41, 59, 0.98), rgba(15, 23, 42, 0.98));
        border: 3px solid ${color}; border-radius: 25px; padding: 45px; text-align: center;
        box-shadow: 0 15px 50px rgba(0, 0, 0, 0.5), 0 0 30px ${color}40;
        max-width: 550px; transform: scale(0.8); transition: transform 0.3s;
      ">
        <div style="
          width: 80px; height: 80px; margin: 0 auto 25px; border: 4px solid ${color};
          border-radius: 50%; display: flex; align-items: center; justify-content: center;
          font-size: 2.5rem; color: ${color}; font-family: 'Courier New', monospace;
          font-weight: bold; box-shadow: 0 0 20px ${color}60, inset 0 0 20px ${color}20;
        ">${gateName.charAt(0)}</div>
        <h2 style="color: ${color}; font-size: 2.2rem; margin-bottom: 20px; font-weight: 300; letter-spacing: 4px;">
          PUERTA ${gateName.toUpperCase()}
        </h2>
        <p style="color: ${color}; opacity: 0.9; font-size: 1.2rem; margin-bottom: 30px; line-height: 1.8;">
          ${message}
        </p>
        <button id="close-modal" style="
          background: linear-gradient(135deg, ${color}, ${color}90); color: white; border: none;
          padding: 14px 40px; border-radius: 25px; font-size: 1rem; cursor: pointer;
          font-weight: bold; letter-spacing: 2px; box-shadow: 0 5px 20px ${color}60; transition: all 0.3s;
        ">CONTINUAR</button>
      </div>
    `;
    
    document.body.appendChild(modal);
    animateModal(modal);
  }

  function createModal(color) {
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.background = 'rgba(15, 23, 42, 0.92)';
    modal.style.backdropFilter = 'blur(8px)';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.zIndex = '1000';
    modal.style.opacity = '0';
    modal.style.transition = 'opacity 0.3s';
    return modal;
  }

  function animateModal(modal) {
    setTimeout(() => {
      modal.style.opacity = '1';
      const content = modal.querySelector('.modal-content');
      if (content) content.style.transform = 'scale(1)';
    }, 10);
    
    const closeBtn = modal.querySelector('#close-modal');
    if (closeBtn) {
      closeBtn.onclick = () => closeModal(modal);
      closeBtn.onmouseenter = () => {
        closeBtn.style.transform = 'scale(1.05)';
      };
      closeBtn.onmouseleave = () => {
        closeBtn.style.transform = 'scale(1)';
      };
    }
    
    modal.onclick = (e) => {
      if (e.target === modal) closeModal(modal);
    };
  }

  function closeModal(modal) {
    modal.style.opacity = '0';
    const content = modal.querySelector('.modal-content');
    if (content) content.style.transform = 'scale(0.8)';
    setTimeout(() => {
      if (modal.parentNode) document.body.removeChild(modal);
    }, 300);
  }
 // END OF initGame()

  /**
   * Collapse cards when a player makes a declaration (TENGO/NO TENGO)
   * @param {number} playerIndex - Player who made the declaration
   * @param {string} roundName - 'PARES' or 'JUEGO'
   * @param {boolean} declaration - true (tengo) or false (no tengo)
   */
  function collapseOnDeclaration(playerIndex, roundName, declaration) {
    const playerId = `player${playerIndex + 1}`;
    const cardElements = document.querySelectorAll(`#${playerId}-zone .quantum-card`);
    const cardsToCollapse = [];
    
    // Find all entangled cards that haven't collapsed yet
    cardElements.forEach((cardEl, idx) => {
      if (cardEl.dataset.entangled === 'true' && cardEl.dataset.collapsed !== 'true') {
        // Randomly determine which value to collapse to
        const mainValue = cardEl.dataset.mainValue || cardEl.dataset.value;
        const partnerValue = cardEl.dataset.partner;
        const finalValue = Math.random() < 0.5 ? mainValue : partnerValue;
        
        cardsToCollapse.push({ cardElement: cardEl, finalValue, cardIndex: idx });
      }
    });
    
    if (cardsToCollapse.length === 0) {
      return; // No entangled cards to collapse
    }
    
    // Trigger collapse animation
    window.quantumCollapse.collapseMultipleCards(cardsToCollapse, () => {
      // After collapse, check if prediction was correct
      checkPredictionPenalty(playerIndex, roundName, declaration);
      
      // Also collapse partner cards in other players' hands
      collapsePartnerCards(cardsToCollapse, playerIndex);
      
      // Update scoreboard to reflect new probabilities
      if (playerIndex === 0) {
        updateScoreboard();
      }
    });
  }
  
  /**
   * Collapse cards when a player accepts/makes a bet after saying "puede"
   * @param {number} playerIndex - Player who accepted/made the bet
   * @param {string} roundName - 'PARES' or 'JUEGO'
   */
  function collapseOnBetAcceptance(playerIndex, roundName) {
    const playerId = `player${playerIndex + 1}`;
    const cardElements = document.querySelectorAll(`#${playerId}-zone .quantum-card`);
    const cardsToCollapse = [];
    
    // Find all entangled cards that haven't collapsed yet
    cardElements.forEach((cardEl, idx) => {
      if (cardEl.dataset.entangled === 'true' && cardEl.dataset.collapsed !== 'true') {
        const mainValue = cardEl.dataset.mainValue || cardEl.dataset.value;
        const partnerValue = cardEl.dataset.partner;
        const finalValue = Math.random() < 0.5 ? mainValue : partnerValue;
        
        cardsToCollapse.push({ cardElement: cardEl, finalValue, cardIndex: idx });
      }
    });
    
    if (cardsToCollapse.length === 0) {
      return; // No entangled cards to collapse
    }
    
    // Trigger collapse animation (NO penalty in this case)
    window.quantumCollapse.collapseMultipleCards(cardsToCollapse, () => {
      // Collapse partner cards in other players' hands
      collapsePartnerCards(cardsToCollapse, playerIndex);
      
      // Update scoreboard to reflect new probabilities
      if (playerIndex === 0) {
        updateScoreboard();
      }
    });
  }
  
  /**
   * Collapse all remaining entangled cards at the end
   */
  function collapseAllRemaining() {
    const allCardsToCollapse = [];
    
    for (let i = 0; i < 4; i++) {
      const playerId = `player${i + 1}`;
      const cardElements = document.querySelectorAll(`#${playerId}-zone .quantum-card`);
      
      cardElements.forEach((cardEl, idx) => {
        if (cardEl.dataset.entangled === 'true' && cardEl.dataset.collapsed !== 'true') {
          const mainValue = cardEl.dataset.mainValue || cardEl.dataset.value;
          const partnerValue = cardEl.dataset.partner;
          const finalValue = Math.random() < 0.5 ? mainValue : partnerValue;
          
          allCardsToCollapse.push({ cardElement: cardEl, finalValue });
        }
      });
    }
    
    if (allCardsToCollapse.length > 0) {
      window.quantumCollapse.collapseMultipleCards(allCardsToCollapse, () => {
        // Update scoreboard after all collapses
        updateScoreboard();
      });
    }
  }
  
  /**
   * Collapse partner cards of the collapsed cards
   * @param {Array} collapsedCards - Array of {cardElement, finalValue, cardIndex}
   * @param {number} originPlayerIndex - Player who triggered the collapse
   */
  function collapsePartnerCards(collapsedCards, originPlayerIndex) {
    const gameMode = window.currentGameMode || '4';
    
    collapsedCards.forEach(({ finalValue, cardElement }) => {
      const mainValue = cardElement.dataset.mainValue;
      const partnerValue = cardElement.dataset.partner;
      
      // Determine the partner's collapsed value (opposite of this card)
      const partnerCollapsedValue = finalValue === mainValue ? partnerValue : mainValue;
      
      // Find and collapse the partner card in other players' hands
      for (let i = 0; i < 4; i++) {
        if (i === originPlayerIndex) continue;
        
        const playerId = `player${i + 1}`;
        const cardElements = document.querySelectorAll(`#${playerId}-zone .quantum-card`);
        
        cardElements.forEach(cardEl => {
          if (cardEl.dataset.entangled === 'true' && 
              cardEl.dataset.collapsed !== 'true' &&
              (cardEl.dataset.mainValue === mainValue || cardEl.dataset.mainValue === partnerValue)) {
            
            // This is the partner card - collapse it to the opposite value
            window.quantumCollapse.triggerCollapseEffect(cardEl, partnerCollapsedValue);
          }
        });
      }
    });
  }
  
  /**
   * Check if prediction was correct and apply penalty if wrong
   * @param {number} playerIndex - Player who made the declaration
   * @param {string} roundName - 'PARES' or 'JUEGO'
   * @param {boolean} declaration - true (tengo) or false (no tengo)
   */
  function checkPredictionPenalty(playerIndex, roundName, declaration) {
    const cards = getPlayerCards(playerIndex);
    let actuallyHas = false;
    
    if (roundName === 'PARES') {
      const paresResult = calculatePares(cards);
      actuallyHas = paresResult.pares > 0;
    } else if (roundName === 'JUEGO') {
      const juegoResult = calculateJuego(cards);
      actuallyHas = juegoResult.hasJuego;
    }
    
    // Check if prediction was wrong
    const predictionWrong = (declaration === true && !actuallyHas) || 
                            (declaration === false && actuallyHas);
    
    if (predictionWrong) {
      // Apply -1 point penalty silently
      const playerTeam = getPlayerTeam(playerIndex);
      gameState.teams[playerTeam].score -= 1;
      
      console.log(`Player ${playerIndex + 1} incurred -1 penalty for wrong ${roundName} prediction`);
    }
  }
  
  /**
   * Show penalty notification
   */
  function showPenaltyNotification(playerIndex, roundName) {
    const notification = document.createElement('div');
    notification.className = 'penalty-notification';
    notification.innerHTML = `
      <div class="penalty-icon">⚠️</div>
      <div class="penalty-text">
        <strong>Predicción Incorrecta</strong><br>
        <span>Jugador ${playerIndex + 1} - ${roundName}</span><br>
        <span style="color: #ff4444;">-1 Punto</span>
      </div>
    `;
    
    notification.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0);
      background: linear-gradient(135deg, rgba(30, 41, 59, 0.98), rgba(15, 23, 42, 0.98));
      border: 3px solid #ff4444;
      border-radius: 20px;
      padding: 30px;
      text-align: center;
      box-shadow: 0 15px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(255, 68, 68, 0.4);
      z-index: 1000;
      color: white;
      font-family: 'Courier New', monospace;
      animation: penalty-appear 0.5s ease-out forwards;
    `;
    
    document.body.appendChild(notification);
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes penalty-appear {
        0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
        50% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
        100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
      }
      .penalty-notification .penalty-icon {
        font-size: 3rem;
        margin-bottom: 15px;
      }
      .penalty-notification .penalty-text {
        font-size: 1.1rem;
        line-height: 1.6;
      }
    `;
    document.head.appendChild(style);
    
    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = 'penalty-appear 0.5s ease-in reverse';
      setTimeout(() => {
        if (notification.parentNode) notification.parentNode.removeChild(notification);
        if (style.parentNode) style.parentNode.removeChild(style);
      }, 500);
    }, 3000);
  }
  
  /**
   * Trigger quantum collapse visual effect on a card
   * @param {HTMLElement} cardElement - The card element to collapse
   * @param {string} finalValue - The value the card collapsed to
   * @param {Function} onComplete - Callback when animation completes
   */
  function triggerCollapseEffect(cardElement, finalValue, onComplete) {
    if (!cardElement) return;
    
    // Play whoosh sound (if available)
    playCollapseSound();
    
    // Add collapse animation class
    cardElement.classList.add('collapsing');
    
    // Sequence of visual effects (1-2 seconds total)
    
    // 1. Intense vibration (200ms)
    vibrateCard(cardElement, 200);
    
    setTimeout(() => {
      // 2. White flash from center (300ms)
      createFlashEffect(cardElement);
    }, 200);
    
    setTimeout(() => {
      // 3. Ripple waves (400ms)
      createRippleEffect(cardElement);
    }, 500);
    
    setTimeout(() => {
      // 4. Particle explosion (500ms)
      createParticleExplosion(cardElement);
    }, 700);
    
    setTimeout(() => {
      // 5. Converge superposed images to final value
      convergeSuperpositionToFinal(cardElement, finalValue);
    }, 900);
    
    setTimeout(() => {
      // 6. Solidify effect - card becomes stable
      solidifyCard(cardElement, finalValue);
      
      // Remove collapse class and mark as collapsed
      cardElement.classList.remove('collapsing');
      cardElement.classList.add('collapsed');
      cardElement.dataset.collapsed = 'true';
      cardElement.dataset.value = finalValue;
      
      // Callback
      if (onComplete) onComplete();
    }, 1500);
  }
  
  /**
   * Vibrate card intensely
   */
  function vibrateCard(cardElement, duration) {
    const originalTransform = cardElement.style.transform || '';
    let startTime = Date.now();
    
    const vibrate = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > duration) {
        cardElement.style.transform = originalTransform;
        return;
      }
      
      const intensity = 3 * (1 - elapsed / duration); // Decrease intensity over time
      const offsetX = (Math.random() - 0.5) * intensity;
      const offsetY = (Math.random() - 0.5) * intensity;
      const rotate = (Math.random() - 0.5) * intensity * 2;
      
      cardElement.style.transform = `${originalTransform} translate(${offsetX}px, ${offsetY}px) rotate(${rotate}deg)`;
      requestAnimationFrame(vibrate);
    };
    
    vibrate();
  }
  
  /**
   * Create white flash effect from center
   */
  function createFlashEffect(cardElement) {
    const flash = document.createElement('div');
    flash.className = 'collapse-flash';
    flash.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      width: 10px;
      height: 10px;
      background: radial-gradient(circle, white, transparent);
      border-radius: 50%;
      transform: translate(-50%, -50%) scale(0);
      pointer-events: none;
      z-index: 10;
      opacity: 1;
    `;
    
    cardElement.style.position = 'relative';
    cardElement.appendChild(flash);
    
    // Animate flash expansion
    flash.animate([
      { transform: 'translate(-50%, -50%) scale(0)', opacity: 1 },
      { transform: 'translate(-50%, -50%) scale(20)', opacity: 0 }
    ], {
      duration: 300,
      easing: 'ease-out'
    }).onfinish = () => {
      if (flash.parentNode) flash.parentNode.removeChild(flash);
    };
  }
  
  /**
   * Create ripple wave effects
   */
  function createRippleEffect(cardElement) {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const ripple = document.createElement('div');
        ripple.className = 'collapse-ripple';
        ripple.style.cssText = `
          position: absolute;
          top: 50%;
          left: 50%;
          width: 20px;
          height: 20px;
          border: 2px solid rgba(100, 200, 255, 0.8);
          border-radius: 50%;
          transform: translate(-50%, -50%) scale(0);
          pointer-events: none;
          z-index: 9;
        `;
        
        cardElement.appendChild(ripple);
        
        // Animate ripple expansion
        ripple.animate([
          { transform: 'translate(-50%, -50%) scale(0)', opacity: 0.8 },
          { transform: 'translate(-50%, -50%) scale(15)', opacity: 0 }
        ], {
          duration: 400,
          easing: 'ease-out'
        }).onfinish = () => {
          if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
        };
      }, i * 100);
    }
  }
  
  /**
   * Create particle explosion effect
   */
  function createParticleExplosion(cardElement) {
    const particleCount = 20;
    const rect = cardElement.getBoundingClientRect();
    
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'collapse-particle';
      
      const angle = (Math.PI * 2 * i) / particleCount;
      const speed = 50 + Math.random() * 50;
      const size = 3 + Math.random() * 4;
      
      particle.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        width: ${size}px;
        height: ${size}px;
        background: radial-gradient(circle, rgba(100, 200, 255, 1), rgba(100, 200, 255, 0));
        border-radius: 50%;
        pointer-events: none;
        z-index: 11;
      `;
      
      cardElement.appendChild(particle);
      
      const endX = Math.cos(angle) * speed;
      const endY = Math.sin(angle) * speed;
      
      particle.animate([
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${endX}px), calc(-50% + ${endY}px)) scale(0)`, opacity: 0 }
      ], {
        duration: 500,
        easing: 'ease-out'
      }).onfinish = () => {
        if (particle.parentNode) particle.parentNode.removeChild(particle);
      };
    }
  }
  
  /**
   * Converge superposed images to final value
   */
  function convergeSuperpositionToFinal(cardElement, finalValue) {
    const dualValue = cardElement.querySelector('.dual-value');
    if (dualValue) {
      // Fade out dual value display
      dualValue.style.transition = 'opacity 0.3s';
      dualValue.style.opacity = '0';
      setTimeout(() => {
        if (dualValue.parentNode) dualValue.parentNode.removeChild(dualValue);
      }, 300);
    }
    
    // Get card color
    const suit = cardElement.dataset.suit || 'oros';
    const suitColors = {
      'oros': '#f5c518',
      'copas': '#ff6b6b',
      'espadas': '#a78bfa',
      'bastos': '#2ec4b6'
    };
    const suitColor = suitColors[suit] || '#2ec4b6';
    
    // Update labels to show single collapsed value (both top and bottom same)
    const cardTop = cardElement.querySelector('.card-top');
    const cardBottom = cardElement.querySelector('.card-bottom');
    if (cardTop) {
      cardTop.innerHTML = `|${finalValue}⟩`;
      cardTop.style.color = suitColor;
    }
    if (cardBottom) {
      cardBottom.innerHTML = `|${finalValue}⟩`;
      cardBottom.style.color = suitColor;
    }
    
    // Update Bloch sphere to collapsed state (no rotation)
    const blochSphere = cardElement.querySelector('.bloch-sphere');
    if (blochSphere) {
      const suit = cardElement.dataset.suit || 'oros';
      const suitColors = {
        'oros': '#f5c518',
        'copas': '#ff6b6b',
        'espadas': '#a78bfa',
        'bastos': '#2ec4b6'
      };
      const suitColor = suitColors[suit] || '#2ec4b6';
      
      // Generate static Bloch sphere showing collapsed value
      blochSphere.innerHTML = CardGenerator.generateBlochSphere('up', false, finalValue, finalValue, 0, 0, suitColor);
      blochSphere.style.transition = 'opacity 0.3s';
      blochSphere.style.opacity = '0';
      setTimeout(() => {
        blochSphere.style.opacity = '1';
      }, 300);
    }
    
    // Update card display to show only final value
    const quantumDecoration = cardElement.querySelector('.quantum-decoration');
    if (quantumDecoration) {
      quantumDecoration.textContent = finalValue;
      quantumDecoration.style.opacity = '0';
      quantumDecoration.style.transform = 'scale(0.5)';
      setTimeout(() => {
        quantumDecoration.style.transition = 'all 0.3s ease-out';
        quantumDecoration.style.opacity = '1';
        quantumDecoration.style.transform = 'scale(1)';
      }, 50);
    }
  }
  
  /**
   * Solidify card - make it stable and non-quantum
   */
  function solidifyCard(cardElement, finalValue) {
    // Remove entanglement glow
    cardElement.classList.remove('entangled-card', 'entangled-candidate');
    
    // Add solidified glow effect
    cardElement.style.boxShadow = '0 0 20px rgba(50, 255, 150, 0.6), 0 4px 8px rgba(0, 0, 0, 0.3)';
    cardElement.style.transition = 'box-shadow 0.5s ease-out';
    
    // Fade out the special glow after a moment
    setTimeout(() => {
      cardElement.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
    }, 1000);
  }
  
  /**
   * Play collapse sound effect
   */
  function playCollapseSound() {
    // Create AudioContext for synthesized sound
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Whoosh sound
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.3);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
      
      // Resonant tone
      setTimeout(() => {
        const oscillator2 = audioContext.createOscillator();
        const gainNode2 = audioContext.createGain();
        
        oscillator2.connect(gainNode2);
        gainNode2.connect(audioContext.destination);
        
        oscillator2.type = 'sine';
        oscillator2.frequency.setValueAtTime(440, audioContext.currentTime);
        
        gainNode2.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator2.start(audioContext.currentTime);
        oscillator2.stop(audioContext.currentTime + 0.5);
      }, 200);
      
    } catch (e) {
      console.log('Audio not supported:', e);
    }
  }
  
  /**
   * Collapse multiple cards simultaneously
   */
  function collapseMultipleCards(cardsData, onAllComplete) {
    let completed = 0;
    const total = cardsData.length;
    
    cardsData.forEach(({ cardElement, finalValue }, index) => {
      // Stagger the start of each collapse slightly for visual effect
      setTimeout(() => {
        triggerCollapseEffect(cardElement, finalValue, () => {
          completed++;
          if (completed === total && onAllComplete) {
            onAllComplete();
          }
        });
      }, index * 100);
    });
  }
  
  // Export collapse functions for use in other parts of the code
  window.quantumCollapse = {
    triggerCollapseEffect,
    collapseMultipleCards,
    vibrateCard,
    playCollapseSound
  };
}

// Export initGame globally so navigation.js can call it
window.initGame = initGame;

// Listen for game screen entry (from lobby "Iniciar partida")
window.addEventListener('enterGameScreen', initGame);