// Quantum Mus - 4 Player Game with Character Avatars
// Only initialize when entering the game screen (after lobby)
let gameInitialized = false;
let timerInterval = null; // Global timer reference
let aiDecisionTimeout = null; // Track AI decision timeout to prevent duplicates

// Export gameInitialized so it can be reset from navigation.js
Object.defineProperty(window, 'gameInitialized', {
  get: () => gameInitialized,
  set: (value) => { gameInitialized = value; }
});

// ===================== GAME STATE MANAGER =====================
const gameState = {
  currentRound: 'MUS', // MUS, GRANDE, CHICA, PARES, JUEGO
  manoIndex: 0, // Player who starts (mano)
  activePlayerIndex: 0, // Current player making decision
  playerNames: ['Preskill', 'Cirac', 'Zoller', 'Deutsch'], // Player character names
  handsPlayed: 0, // Counter for hands played in the game
  teams: {
    team1: { players: [0, 2], score: 0, name: 'Copenhague' }, // Preskill + Zoller
    team2: { players: [1, 3], score: 0, name: 'Bohmian' } // Cirac + Deutsch
  },
  currentBet: {
    amount: 0,
    bettingTeam: null, // 'team1' or 'team2'
    betType: null, // 'envido', 'ordago'
    responses: {} // Track each player's response
  },
  roundActions: {}, // Track what each player has done this round
  musPhaseActive: true,
  cardsDiscarded: {}, // Track discarded cards per player
  waitingForDiscard: false,
  allPlayersPassed: false,
  pendingPoints: { // Points to be awarded at hand end
    team1: { GRANDE: 0, CHICA: 0, PARES: 0, JUEGO: 0 },
    team2: { GRANDE: 0, CHICA: 0, PARES: 0, JUEGO: 0 }
  },
  entanglement: {
    pairs: [], // All entangled pairs in the game
    events: [], // Entanglement activation events this hand
    statistics: {
      total_pairs: 0,
      activated_pairs: 0,
      superposition_pairs: 0,
      game_mode: '4',
      pairs_per_team: 2
    },
    playerEntanglements: {} // Map of player index to their entangled cards info
  }

};

function showPuntoModal(callback = null) {
    const modal = createModal('#f97316');
    modal.innerHTML = `
      <div class="modal-content" style="
        background: linear-gradient(135deg, rgba(30, 41, 59, 0.98), rgba(15, 23, 42, 0.98));
        border: 3px solid #f97316;
        border-radius: 25px;
        padding: 40px;
        text-align: center;
        box-shadow: 0 15px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(249, 115, 22, 0.4);
        max-width: 500px;
        transform: scale(0.8);
        transition: transform 0.3s;
      ">
        <h2 style="color: #f97316; font-size: 2.5rem; margin-bottom: 30px; font-weight: 300; letter-spacing: 4px;">
          PUNTO
        </h2>
        <p style="color: var(--circuit-blueprint); font-size: 1.1rem; margin-bottom: 25px; line-height: 1.6;">
          Elige tu apuesta (4 a 30):
        </p>
        <div style="display: flex; flex-direction: column; gap: 20px; margin-bottom: 30px;">
          <div style="display:flex; flex-direction:column; gap:10px; align-items:center;">
            <input type="range" id="punto-slider" class="punto-slider" min="4" max="30" value="30">
            <p style="color: #f97316; font-size: 1.3rem; margin-top: 10px; font-weight: bold;">
              <span id="punto-slider-value">30</span> puntos
            </p>
          </div>
          <button class="envido-option slider-confirm" data-type="slider" style="
            background: linear-gradient(135deg, rgba(249, 115, 22, 0.12), rgba(249, 115, 22, 0.06));
            border: 2px solid #f97316;
            color: #f97316;
            padding: 12px 20px;
            border-radius: 12px;
            font-size: 1rem;
            cursor: pointer;
            font-weight: bold;
            transition: all 0.3s;
          ">Confirmar PUNTO</button>
        </div>
        <button id="close-modal" style="
          background: linear-gradient(135deg, #f97316, rgba(249, 115, 22, 0.9));
          color: white;
          border: none;
          padding: 12px 30px;
          border-radius: 12px;
          font-size: 0.9rem;
          cursor: pointer;
          font-weight: bold;
          letter-spacing: 2px;
          box-shadow: 0 5px 20px rgba(249, 115, 22, 0.6);
          transition: all 0.3s;
        ">CANCELAR</button>
      </div>
    `;

    document.body.appendChild(modal);
    animateModal(modal);

    const slider = modal.querySelector('#punto-slider');
    const sliderValue = modal.querySelector('#punto-slider-value');
    slider.addEventListener('input', (e) => {
      sliderValue.textContent = e.target.value;
    });

    const confirmBtn = modal.querySelector('.slider-confirm');
    confirmBtn.addEventListener('click', () => {
      const value = parseInt(slider.value);
      closeModal(modal);
      if (callback) callback(value);
    });
  }

// Get team for a player index
function getPlayerTeam(playerIndex) {
  if (gameState.teams.team1.players.includes(playerIndex)) return 'team1';
  if (gameState.teams.team2.players.includes(playerIndex)) return 'team2';
  return null;
}

// Get team mate of a player
function getTeammate(playerIndex) {
  const team = getPlayerTeam(playerIndex);
  if (!team) return null;
  const teammates = gameState.teams[team].players;
  return teammates.find(p => p !== playerIndex);
}

// Get opponent team
function getOpponentTeam(team) {
  return team === 'team1' ? 'team2' : 'team1';
}

// Stop all game timers and freeze game state (fallback implementation)
function freezeGameState() {
  console.log('Freezing game state (game.js fallback)');

  // Clear main timer
  if (typeof timerInterval !== 'undefined' && timerInterval) {
    try { clearTimeout(timerInterval); } catch (e) {}
    timerInterval = null;
  }

  // Clear AI decision timeout
  if (typeof aiDecisionTimeout !== 'undefined' && aiDecisionTimeout) {
    try { clearTimeout(aiDecisionTimeout); } catch (e) {}
    aiDecisionTimeout = null;
  }

  // Stop all timer bar animations and reset widths
  for (let i = 0; i < 4; i++) {
    const fill = document.querySelector(`#timer-bar-player${i + 1} .timer-bar-fill`);
    if (fill) {
      fill.style.transition = 'none';
      fill.style.width = '0%';
    }
  }

  // Disable interactive buttons
  const btns = document.querySelectorAll('button, .quantum-gate');
  btns.forEach(b => {
    try { b.disabled = true; } catch (e) {}
  });

  // Remove player highlights
  for (let i = 0; i < 4; i++) {
    const zone = document.querySelector(`#player${i + 1}-zone`);
    if (zone) zone.style.boxShadow = '';
  }
}

// Reset round state
function resetRoundState() {
  gameState.roundActions = {};
  gameState.currentBet = {
    amount: 0,
    bettingTeam: null,
    betType: null,
    responses: {}
  };
  gameState.allPlayersPassed = false;

}

// Move to next player (counter-clockwise)
function nextPlayer() {
  gameState.activePlayerIndex = (gameState.activePlayerIndex + 3) % 4; // -1 mod 4 = +3 mod 4
  return gameState.activePlayerIndex;
}

// Get next player from opponent team in counter-clockwise order
function getNextOpponentPlayer(fromPlayerIndex, opponentTeam) {
  const opponentPlayers = gameState.teams[opponentTeam].players;
  let current = fromPlayerIndex;
  
  // Move counter-clockwise until we find an opponent team player
  for (let i = 0; i < 4; i++) {
    current = (current + 3) % 4; // Move counter-clockwise
    if (opponentPlayers.includes(current)) {
      return current;
    }
  }
  return opponentPlayers[0]; // Fallback
}

// Get teammate of opponent who hasn't responded yet
function getOtherOpponentPlayer(opponentTeam, respondedPlayer) {
  const opponentPlayers = gameState.teams[opponentTeam].players;
  return opponentPlayers.find(p => p !== respondedPlayer);
}

// Check if all players in a team have responded
function teamHasResponded(team) {
  const teamPlayers = gameState.teams[team].players;
  return teamPlayers.every(p => gameState.currentBet.responses[p] !== undefined);
}

// Get first opponent from mano in counter-clockwise order
function getFirstOpponentFromMano(opponentTeam) {
  const opponentPlayers = gameState.teams[opponentTeam].players;
  let current = gameState.manoIndex;
  
  // Move counter-clockwise from mano until we find an opponent team player
  for (let i = 0; i < 4; i++) {
    current = (current + 3) % 4; // Move counter-clockwise
    if (opponentPlayers.includes(current)) {
      console.log(`[First Opponent] From mano ${gameState.manoIndex + 1}, first opponent (${opponentTeam}) is Player ${current + 1}`);
      return current;
    }
  }
  return opponentPlayers[0]; // Fallback
}

// Get next defender in counter-clockwise order after the current player
function getNextDefender(defendingTeam, currentPlayerIndex) {
  const defenders = gameState.teams[defendingTeam].players;
  let current = currentPlayerIndex;
  
  // Move counter-clockwise until we find the next defender on the same team
  for (let i = 0; i < 4; i++) {
    current = (current + 3) % 4; // Move counter-clockwise
    if (defenders.includes(current) && current !== currentPlayerIndex) {
      console.log(`[Next Defender] After player ${currentPlayerIndex + 1}, next defender (${defendingTeam}) is Player ${current + 1}`);
      return current;
    }
  }
  // If we can't find another, return the other team member
  return defenders.find(p => p !== currentPlayerIndex);
}

// Get the other opponent player who hasn't responded
function getOtherOpponentPlayer(opponentTeam, respondedPlayer) {
  const opponentPlayers = gameState.teams[opponentTeam].players;
  return opponentPlayers.find(p => p !== respondedPlayer);
}

// ================= ENTANGLEMENT UTILITIES =================

// Get entangled cards for a player
function getPlayerEntangledCards(playerIndex) {
  return gameState.entanglement.playerEntanglements[playerIndex] || [];
}

// Check if a card is entangled
function isCardEntangled(playerIndex, cardIndex) {
  const entangled = getPlayerEntangledCards(playerIndex);
  return entangled.some(e => e.card_index === cardIndex);
}

// Get partner player for an entangled card
function getEntangledPartnerPlayer(playerIndex, cardIndex) {
  const entangled = getPlayerEntangledCards(playerIndex);
  const pair = entangled.find(e => e.card_index === cardIndex);
  return pair ? pair.partner_player : null;
}

// Update entanglement state from server
function updateEntanglementState(entanglementData) {
  if (!entanglementData) return;
  
  gameState.entanglement.pairs = entanglementData.pairs || [];
  gameState.entanglement.events = entanglementData.events || [];
  gameState.entanglement.statistics = entanglementData.statistics || gameState.entanglement.statistics;
  
  // Update player entanglement maps
  for (let playerIdx = 0; playerIdx < 4; playerIdx++) {
    gameState.entanglement.playerEntanglements[playerIdx] = getPlayerEntangledCardsFromPairs(playerIdx);
  }
}

// Helper to build player entanglement map from pairs
function getPlayerEntangledCardsFromPairs(playerIndex) {
  const entangled = [];
  
  // This will be populated from the hand data when cards are dealt/updated
  // We'll need to cross-reference with the actual cards in the player's hand
  return entangled;
}

// Reset entanglement for new hand
function resetEntanglementForNewHand() {
  gameState.entanglement.events = [];
  gameState.entanglement.playerEntanglements = {};
}

function initGame() {
  console.log('initGame called, gameInitialized:', gameInitialized);

  // If the client set a start timestamp, compute and log the client-side init latency
  try {
    const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    const start = window._create_start_ts;
    if (start) {
      const deltaMs = Math.round(now - start);
      console.log(`[client] initGame started after ${deltaMs}ms from startGame click`);
      // Expose last measured client init latency
      window._last_client_init_ms = deltaMs;
    }
  } catch (e) {
    // ignore
  }
  
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
  
  // Asegurar que el timer esté oculto al inicio del juego
  const timerModal = document.getElementById('timer-modal');
  if (timerModal) timerModal.style.opacity = '0';
  
  // Clear any previous content
  gameContainer.innerHTML = '';

  // Quick loading overlay to improve perceived responsiveness
  try {
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'game-loading-overlay';
    loadingOverlay.style.position = 'absolute';
    loadingOverlay.style.top = '0';
    loadingOverlay.style.left = '0';
    loadingOverlay.style.width = '100%';
    loadingOverlay.style.height = '100%';
    loadingOverlay.style.display = 'flex';
    loadingOverlay.style.alignItems = 'center';
    loadingOverlay.style.justifyContent = 'center';
    loadingOverlay.style.background = 'rgba(0,0,0,0.35)';
    loadingOverlay.style.zIndex = '9999';
    loadingOverlay.innerHTML = '<div style="color:#fff;font-size:18px;padding:12px 18px;border-radius:8px;background:rgba(0,0,0,0.6);">Cargando partida…</div>';
    gameContainer.appendChild(loadingOverlay);
    // Remove overlay after expected deal animation completes (~3.5s)
    setTimeout(() => { try { loadingOverlay.remove(); } catch (e) {} }, 3500);
  } catch (e) {
    // ignore failures in diagnostics code
  }
  
  // Get players and game mode from lobby (set by initializeGame)
  const lobbyPlayers = window.currentPlayers || [];
  const gameMode = window.currentGameMode || '4';
  let localPlayerIndex = window.currentLocalPlayerIndex ?? 0;
  
  // Validate game mode
  if (!['4', '8'].includes(gameMode)) {
    console.error('Invalid game mode:', gameMode);
    return;
  }
  
  // Validate players count
  if (lobbyPlayers.length !== 4) {
    console.error('Expected 4 players, got', lobbyPlayers.length);
    return;
  }
  
  // Validate local player index
  if (!Number.isInteger(localPlayerIndex) || localPlayerIndex < 0 || localPlayerIndex > 3) {
    console.error('Invalid local player index:', localPlayerIndex);
    localPlayerIndex = 0;
  }
  
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
  
  // Store player actual names for action notifications
  gameState.playerActualNames = players.map(p => p.playerName || p.name);
  // Store character keys so UI helpers can access character color values later
  gameState.playerCharacters = players.map(p => p.character);
  
  // Reset game state counters
  gameState.handsPlayed = 0;
  gameState.teams.team1.score = 0;
  gameState.teams.team2.score = 0;
  // Initialize mano index - will be synced from server for online games
  gameState.manoIndex = 0;
  window.startingPlayer = `player1`;
  gameState.currentRound = 'MUS';
  gameState.musPhaseActive = true;
  gameState.activePlayerIndex = gameState.manoIndex;
  // Store local player index globally for all game functions
  window.localPlayerIndex = localPlayerIndex;
  // Clear transient round state to ensure dynamics start clean
  gameState.roundActions = {};
  gameState.currentBet = { amount: 0, bettingTeam: null, betType: null, responses: {} };
  gameState.cardsDiscarded = {};
  gameState.waitingForDiscard = false;
  gameState.paresDeclarations = undefined;
  gameState.juegoDeclarations = undefined;
  gameState.preJuegoDeclarations = null;
  gameState.pendingPoints = { team1: { GRANDE: 0, CHICA: 0, PARES: 0, JUEGO: 0 }, team2: { GRANDE: 0, CHICA: 0, PARES: 0, JUEGO: 0 } };
  console.log('Mano set to player index:', gameState.manoIndex, '(', `player${gameState.manoIndex + 1}`, ')');
  
  // Add quantum gate decorations to background
  addQuantumGateDecorations();
  
  // Add famous quantum circuit to background
  addQuantumCircuitToBackground();

  players.forEach((player, index) => {
    createPlayerZone(player, index, gameMode);
  });

  // Hacer matching de cartas entrelazadas entre player1 y player3
  matchEntangledCards();

  // Create central scoreboard
  createScoreboard();

  // Function to initialize local deck and deal cards (for demo mode)
  function initializeLocalGameDeck() {
    const values = ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K'];
    const suits = ['oros', 'copas', 'espadas', 'bastos'];
    
    // Create deck
    const deck = [];
    suits.forEach(suit => {
      values.forEach(value => {
        deck.push({ value, suit });
      });
    });
    
    // Shuffle deck
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    
    // Deal 4 cards to player 1 (local player)
    const player1Hand = deck.slice(0, 4);
    
    // Update player 1 cards display
    const handContainer = document.querySelector('#player1-zone .cards-row');
    if (handContainer) {
      handContainer.innerHTML = '';
      const suitMap = { oros: ['theta', 'θ', '#f5c518'], copas: ['phi', 'φ', '#ff6b6b'], espadas: ['delta', 'δ', '#a78bfa'], bastos: ['psi', 'ψ', '#2ec4b6'] };
      player1Hand.forEach((c, i) => {
        const s = suitMap[c.suit] || suitMap.oros;
        const card = createCard(c.value, s[0], s[1], i, true, false, s[2], 0, gameMode);
        if (card) handContainer.appendChild(card);
      });
    }
    
    return deck;
  }

  if (isOnline && window.QuantumMusSocket && window.QuantumMusOnlineRoom) {
    const socket = window.QuantumMusSocket;
    const roomId = window.QuantumMusOnlineRoom;
    
    // Listen for game start with initial cards and state from server
    socket.once('game_started', (data) => {
      console.log('[INIT] Received game_started event');
      
      if (!data.success) {
        console.error('Game start failed:', data.error || 'Unknown error');
        return;
      }
      
      const gameStateData = data.game_state || {};
      
      // Sync mano index from server
      if (typeof gameStateData.manoIndex === 'number') {
        gameState.manoIndex = gameStateData.manoIndex;
        gameState.activePlayerIndex = gameState.manoIndex;
        console.log('[INIT] Synced mano index from server:', gameState.manoIndex);
      }
      
      // Update entanglement state if available
      if (gameStateData.entanglement) {
        updateEntanglementState(gameStateData.entanglement);
      }
      
      // Display player's initial hand
      if (gameStateData.player_hands && gameStateData.player_hands[localPlayerIndex]) {
        const handContainer = document.querySelector('#player1-zone .cards-row');
        if (handContainer) {
          handContainer.innerHTML = '';
          const suitMap = { oros: ['theta', 'θ', '#f5c518'], copas: ['phi', 'φ', '#ff6b6b'], espadas: ['delta', 'δ', '#a78bfa'], bastos: ['psi', 'ψ', '#2ec4b6'] };
          gameStateData.player_hands[localPlayerIndex].forEach((c, i) => {
            const s = suitMap[c.suit] || suitMap.oros;
            const card = createCard(c.value, s[0], s[1], i, true, false, s[2], 0, gameMode);
            if (card) handContainer.appendChild(card);
          });
          console.log('[INIT] Dealt initial cards to local player');
        }
      }
    });
    socket.on('game_update', (data) => {
      const gs = data.game_state || {};
      const st = gs.state || gs;
      if (st) {
        gameState.currentRound = st.currentRound || gameState.currentRound;
        gameState.activePlayerIndex = ((st.activePlayerIndex ?? 0) - localPlayerIndex + 4) % 4;
        if (st.teams) {
          gameState.teams.team1.score = st.teams.team1?.score ?? 0;
          gameState.teams.team2.score = st.teams.team2?.score ?? 0;
        }
        gameState.currentBet = st.currentBet || gameState.currentBet;
        updateRoundDisplay();
        updateScoreboard();
        startPlayerTurnTimer(gameState.activePlayerIndex);
      }
    });

    // Server broadcasts updates specific to the GRANDE betting phase
    socket.on('grande_phase_update', (data) => {
      console.log('[SOCKET] grande_phase_update', data);
      const gp = data.grande_phase || data;
      if (!gp) return;
      gameState.currentBet = gp.currentBet || gameState.currentBet;
      gameState.currentRound = gp.currentRound || gameState.currentRound;
      if (typeof gp.activePlayerIndex === 'number') {
        gameState.activePlayerIndex = ((gp.activePlayerIndex ?? 0) - localPlayerIndex + 4) % 4;
      }
      updateRoundDisplay();
      updateScoreboard();
      startPlayerTurnTimer(gameState.activePlayerIndex);
    });
    socket.on('game_ended', (data) => {
      if (data.winner && typeof window.showGameOver === 'function') {
        const winnerTeam = data.winner === 'team1' ? 1 : 2;
        const fs = data.final_scores || {};
        window.showGameOver(winnerTeam, { team1: fs.team1 || 0, team2: fs.team2 || 0 }, { rounds: 0 });
      }
    });
    // Listen for new cards after all players have discarded
    socket.on('new_cards_dealt', (data) => {
      console.log('[INIT] Received new_cards_dealt event');
      if (!data.success) {
        console.error('New cards deal failed:', data.error || 'Unknown error');
        return;
      }
      // Update entanglement state if available
      if (data.entanglement_state) {
        updateEntanglementState(data.entanglement_state);
        console.log('[INIT] Synced entanglement state after discard');
      }
      // Update all player hands with new cards
      if (data.player_hands) {
        // Update local player's visible hand
        if (data.player_hands[localPlayerIndex]) {
          const handContainer = document.querySelector('#player1-zone .cards-row');
          if (handContainer) {
            handContainer.innerHTML = '';
            const suitMap = { oros: ['theta', 'θ', '#f5c518'], copas: ['phi', 'φ', '#ff6b6b'], espadas: ['delta', 'δ', '#a78bfa'], bastos: ['psi', 'ψ', '#2ec4b6'] };
            data.player_hands[localPlayerIndex].forEach((c, i) => {
              const s = suitMap[c.suit] || suitMap.oros;
              const card = createCard(c.value, s[0], s[1], i, true, false, s[2], 0, gameMode);
              if (card) handContainer.appendChild(card);
            });
            console.log('[INIT] Updated local player cards after discard');
          }
        }
        // Other players' hands are managed by server-side card system
        gameState.waitingForDiscard = false;
        gameState.musPhaseActive = true;
      }
    });
  } else {
    // Mode local (demo): Initialize local game deck
    initializeLocalGameDeck();
  }

  // Animación del reparto de cartas al inicio del turno
  playDealAnimation();

  // Start the game after deal animation completes (cards take about 2-3 seconds to deal)
  setTimeout(() => {
    console.log('Starting game - first turn');
    console.log('Mano index:', gameState.manoIndex);
    console.log('Current round:', gameState.currentRound);
    gameState.activePlayerIndex = gameState.manoIndex;
    updateRoundDisplay();
    updateScoreboard();
    console.log('Active player:', gameState.activePlayerIndex);
    
    // Add 1 second courtesy before mus round timer starts
    if (gameState.currentRound === 'MUS') {
      setTimeout(() => {
        startPlayerTurnTimer(gameState.activePlayerIndex);
      }, 1000);
    } else {
      startPlayerTurnTimer(gameState.activePlayerIndex);
    }
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
  
  // Helper function to clean inline styles from cards (for hover to work properly)
  function cleanCardStyles() {
    const allCards = document.querySelectorAll('.quantum-card');
    allCards.forEach(card => {
      // Remove transition style to let CSS take over
      if (card.style.transition === 'opacity 0.5s ease-in' || 
          card.style.transition === 'opacity 0.4s ease-out, transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)') {
        card.style.transition = '';
      }
      // Ensure card is not stuck with inline transform
      if (!card.classList.contains('card-dealt') && !card.classList.contains('card-dealing')) {
        card.style.transform = '';
      }
    });
  }

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
    // Clear any per-AI autodiscard fallback for this player
    try {
      if (gameState.autoDiscardTimeouts && gameState.autoDiscardTimeouts[playerIndex]) {
        clearTimeout(gameState.autoDiscardTimeouts[playerIndex]);
        delete gameState.autoDiscardTimeouts[playerIndex];
      }
    } catch (e) { console.warn('Failed to clear autoDiscardTimeout for player', playerIndex, e); }
    
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
      
      // ORDAGO cards only collapse when ACCEPTED, not when declared
      console.log(`Betting started by ${gameState.playerActualNames?.[playerIndex] || `Player ${playerIndex+1}`} (team ${gameState.currentBet.bettingTeam}), amount: ${gameState.currentBet.amount}`);
      
      // Reset responses and move to GRANDE round
      gameState.currentBet.responses = {};
      moveToGrandeRound();
    }
  }
  
  // Move to Grande round after MUS phase
  function moveToGrandeRound() {
    console.log('[moveToGrandeRound] Moving to GRANDE round');
    console.log(`[moveToGrandeRound] Betting team: ${gameState.currentBet.bettingTeam}, Amount: ${gameState.currentBet.amount}, Type: ${gameState.currentBet.betType}`);
    
    // If there is an active bet, the defending team must respond first.
    // Determine the first responder among defenders based on Mano position.
    if (gameState.currentBet && gameState.currentBet.bettingTeam) {
      const defendingTeam = getOpponentTeam(gameState.currentBet.bettingTeam);
      const manoTeam = getPlayerTeam(gameState.manoIndex);

      if (manoTeam === defendingTeam) {
        // Mano belongs to defending team -> mano responds first
        gameState.activePlayerIndex = gameState.manoIndex;
        console.log(`[moveToGrandeRound] Betting exists - Mano is on defending team, Mano (Player ${gameState.activePlayerIndex + 1}) responds first`);
      } else {
        // Mano is on betting team -> first defender counter-clockwise from mano responds
        gameState.activePlayerIndex = getFirstOpponentFromMano(defendingTeam);
        console.log(`[moveToGrandeRound] Betting exists - first defender counter-clockwise from Mano starts: Player ${gameState.activePlayerIndex + 1}`);
      }
    } else {
      // No active bet: Determine who speaks first in GRANDE based on who cut MUS
      if (gameState.musCutterIndex !== undefined) {
        if (gameState.musCutterIndex === gameState.manoIndex) {
          // Mano cut - next player starts GRANDE (counter-clockwise from mano)
          gameState.activePlayerIndex = (gameState.manoIndex + 3) % 4;
          console.log(`[moveToGrandeRound] Mano cut, next player (${gameState.activePlayerIndex + 1}) starts GRANDE`);
        } else {
          // Non-mano cut - mano starts GRANDE
          gameState.activePlayerIndex = gameState.manoIndex;
          console.log(`[moveToGrandeRound] Non-mano cut, mano (${gameState.activePlayerIndex + 1}) starts GRANDE`);
        }
      } else {
        // Fallback: mano starts
        gameState.activePlayerIndex = gameState.manoIndex;
        console.log(`[moveToGrandeRound] Fallback: mano (${gameState.activePlayerIndex + 1}) starts GRANDE`);
      }
    }
    
    // Preserve betting team/amount/type if set, or keep clean if no bet
    console.log(`[moveToGrandeRound] GRANDE START - BettingTeam: ${gameState.currentBet.bettingTeam}, Amount: ${gameState.currentBet.amount}, Type: ${gameState.currentBet.betType}`);
    console.log(`[moveToGrandeRound] Starting timer for player ${gameState.activePlayerIndex + 1}`);
    
    updateScoreboard();
    updateRoundDisplay();
    startPlayerTurnTimer(gameState.activePlayerIndex);
  }
  
  // Start discard phase - all players discard simultaneously
  function startDiscardPhase() {
    gameState.waitingForDiscard = true;
    
    // Show discard UI for all players
    showDiscardUI();
    
    // Start all timers simultaneously (10 seconds)
    startAllPlayersTimer(10);
  }
  
  // Handle card discard
  function handleDiscard(playerIndex, cardIndices) {
    console.log(`[HANDLE DISCARD] Player ${playerIndex + 1} discarding cards:`, cardIndices);
    
    // Prevent double-discard
    if (gameState.cardsDiscarded[playerIndex]) {
      console.log(`[HANDLE DISCARD] Player ${playerIndex + 1} has already discarded, ignoring`);
      return;
    }
    
    // Clear any pending timers to prevent double-execution
    if (timerInterval) {
      clearTimeout(timerInterval);
      timerInterval = null;
    }
    if (aiDecisionTimeout) {
      clearTimeout(aiDecisionTimeout);
      aiDecisionTimeout = null;
    }
    
    // Visual feedback: mark discarded cards immediately
    const playerId = `player${playerIndex + 1}`;
    const playerZone = document.getElementById(`${playerId}-zone`);
    if (playerZone) {
      const cards = playerZone.querySelectorAll('.quantum-card');
      cardIndices.forEach(cardIndex => {
        if (cards[cardIndex]) {
          // Apply discard visual effect
          cards[cardIndex].style.transform = 'translateY(-15px) scale(0.95)';
          cards[cardIndex].style.filter = 'grayscale(100%) brightness(0.3)';
          cards[cardIndex].style.transition = 'all 0.3s ease-out';
          
          // Add X overlay
          let overlay = cards[cardIndex].querySelector('.discard-overlay');
          if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'discard-overlay';
            overlay.style.cssText = `
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              font-size: 4rem;
              color: #888888;
              font-weight: 900;
              text-shadow: 0 0 10px rgba(0, 0, 0, 0.6);
              z-index: 10;
              pointer-events: none;
              animation: fadeInX 0.3s ease-out;
            `;
            overlay.textContent = '✕';
            cards[cardIndex].appendChild(overlay);
          }
        }
      });
      
      // Hide player's timer bar
      hideTimerBar(playerIndex);
    }
    
    gameState.cardsDiscarded[playerIndex] = cardIndices;
    console.log(`[HANDLE DISCARD] Discard state:`, Object.keys(gameState.cardsDiscarded).length, '/ 4 players');
    
    // Emit discard to server for multiplayer sync
    if (isOnline && window.QuantumMusSocket && window.QuantumMusOnlineRoom) {
      const socket = window.QuantumMusSocket;
      const roomId = window.QuantumMusOnlineRoom;
      console.log(`[HANDLE DISCARD] Emitting discard_cards to server for player ${playerIndex}`, cardIndices);
      socket.emit('discard_cards', {
        room_id: roomId,
        player_index: playerIndex,
        card_indices: cardIndices
      });
    }
    
    // Check if all players have discarded
    if (Object.keys(gameState.cardsDiscarded).length === 4) {
      console.log('[HANDLE DISCARD] All players have discarded - dealing new cards');
      // All players discarded - deal new cards and restart mus round
      dealNewCards();
      gameState.cardsDiscarded = {};
      gameState.roundActions = {}; // Reset so all players must decide again
      gameState.musPhaseActive = true; // Restart MUS phase
      gameState.waitingForDiscard = false;
      gameState.activePlayerIndex = gameState.manoIndex;
      
      // Wait for cards to be dealt before starting next turn
      setTimeout(() => {
        startPlayerTurnTimer(gameState.activePlayerIndex);
      }, 2000);
    }
  }
  
  // Handle betting round (Grande, Chica, Pares, Juego)
  function handleBettingRound(playerIndex, action, betAmount = 0) {
    console.log(`Player ${playerIndex + 1} in betting round ${gameState.currentRound}: ${action}, bet amount: ${betAmount}`);
    console.log(`[handleBettingRound] Handling locally`);
    
    // Clear any pending timers to prevent double-execution
    if (timerInterval) {
      clearTimeout(timerInterval);
      timerInterval = null;
    }
    if (aiDecisionTimeout) {
      clearTimeout(aiDecisionTimeout);
      aiDecisionTimeout = null;
    }
    
    // Hide current player's timer bar immediately
    hideTimerBar(playerIndex);

    // Prevent players who declared NO TENGO (or otherwise aren't eligible)
    // from performing any betting action other than PASO.
    if (action !== 'paso' && !canPlayerBet(playerIndex)) {
      console.log(`[handleBettingRound] Player ${playerIndex + 1} is not eligible to bet in ${gameState.currentRound}; forcing PASO`);
      // Force a pass instead of proceeding with the requested action
      action = 'paso';
      betAmount = 0;
    }

    console.log('Current bet state:', gameState.currentBet);

    // Show action notification
    showActionNotification(playerIndex, action, { amount: betAmount });
    
    const playerTeam = getPlayerTeam(playerIndex);
    const opponentTeam = getOpponentTeam(playerTeam);
    
    if (action === 'paso') {
      // Player passes
      gameState.currentBet.responses[playerIndex] = 'paso';
      console.log(`Player ${playerIndex + 1} passed, responses now:`, gameState.currentBet.responses);
      
      // Clear current timeout to avoid double-execution
      if (timerInterval) clearTimeout(timerInterval);
      
      if (gameState.currentBet.bettingTeam) {
        // There's an active bet - defending team must respond
        const defendingTeam = getOpponentTeam(gameState.currentBet.bettingTeam);
        const defendingPlayers = gameState.teams[defendingTeam].players;
        const defendingResponses = defendingPlayers.map(p => gameState.currentBet.responses[p]);
        const allDefendersPassed = defendingResponses.length === 2 && defendingResponses.every(r => r === 'paso');
        
        console.log(`[PASO] Defending team: ${defendingTeam}, responses: ${JSON.stringify(defendingResponses)}`);
        
        if (allDefendersPassed) {
          // Both defenders passed - bet rejected
          // PUNTO: 2 points, GRANDE/CHICA/PARES/JUEGO: 1 point or previous bet amount
          let points;
          if (gameState.currentRound === 'PUNTO') {
            points = 2; // PUNTO rejection always gives 2 points
          } else {
            points = gameState.currentBet.isRaise ? gameState.currentBet.previousAmount : 1;
          }
          gameState.teams[gameState.currentBet.bettingTeam].score += points;
          console.log(`Team ${gameState.currentBet.bettingTeam} wins ${points} points (bet rejected in ${gameState.currentRound})`);
          showTeamPointsNotification(gameState.currentBet.bettingTeam, points);
          updateScoreboard();
          
          // Check for game over
          if (gameState.teams[gameState.currentBet.bettingTeam].score >= 40) {
            freezeGameState();
            showGameOver(gameState.currentBet.bettingTeam);
            return;
          }
          
          // Move to next round after bet rejection (applies to both regular bets and ORDAGO)
          setTimeout(() => {
            // After PARES betting finishes, ensure we move into JUEGO declaration
            if (gameState.currentRound === 'PARES') moveToNextRound('JUEGO');
            else moveToNextRound();
          }, 2000);
        } else {
          // Move to next defender in counter-clockwise order
          // For PARES, skip defenders who cannot bet
          if (gameState.currentRound === 'PARES') {
            const eligibleDefenders = defendingPlayers.filter(p => canPlayerBet(p));
            if (eligibleDefenders.length === 0) {
              // No defender can respond -> treat as both passed
              let points = gameState.currentBet.isRaise ? gameState.currentBet.previousAmount : 1;
              gameState.teams[gameState.currentBet.bettingTeam].score += points;
              showTeamPointsNotification(gameState.currentBet.bettingTeam, points);
              updateScoreboard();
              setTimeout(() => {
                if (gameState.currentRound === 'PARES') moveToNextRound('JUEGO');
                else moveToNextRound();
              }, 2000);
              return;
            }
            // Pick first eligible who hasn't responded yet
            const nextDefender = eligibleDefenders.find(p => gameState.currentBet.responses[p] === undefined) || eligibleDefenders[0];
            gameState.activePlayerIndex = nextDefender;
            console.log(`Moving to next eligible defender: player ${nextDefender + 1}`);
            startPlayerTurnTimer(gameState.activePlayerIndex);
          } else {
            const nextDefender = getNextDefender(defendingTeam, playerIndex);
            gameState.activePlayerIndex = nextDefender;
            console.log(`Moving to next defender: player ${nextDefender + 1}`);
            startPlayerTurnTimer(gameState.activePlayerIndex);
          }
        }
      } else {
        // No bet yet - check if all players have passed
        const allResponses = Object.values(gameState.currentBet.responses);
        const allPassed = allResponses.length === 4 && allResponses.every(r => r === 'paso');
        
        if (allPassed) {
          console.log('All 4 players passed with no bet - moving to next round');
          setTimeout(() => {
            if (gameState.currentRound === 'PARES') moveToNextRound('JUEGO');
            else moveToNextRound();
          }, 2000);
        } else {
          // Move to next player (skip ineligible players during PARES)
          if (gameState.currentRound === 'PARES') {
            nextPlayerWhoCanBet();
          } else {
            nextPlayer();
          }
          console.log(`No active bet - moving to next player: ${gameState.activePlayerIndex + 1}`);
          startPlayerTurnTimer(gameState.activePlayerIndex);
        }
      }
    } else if (action === 'accept') {
      gameState.currentBet.responses[playerIndex] = 'accept';
      
      // Collapse cards immediately when accepting bet in PARES or JUEGO rounds
      const isParesBetting = gameState.currentRound === 'PARES' && gameState.paresDeclarations;
      const isJuegoBetting = (gameState.currentRound === 'JUEGO') && gameState.juegoDeclarations;
      
      if (isParesBetting) {
        // Player is accepting bet in PARES - collapse cards with animation
        console.log(`[BET ACCEPT] Player ${playerIndex + 1} accepting in PARES - collapsing cards`);
        collapseOnBetAcceptance(playerIndex, 'PARES');
        
        // If they said "puede", check penalty after collapse
        if (gameState.paresDeclarations[playerIndex] === 'puede') {
          setTimeout(() => {
            checkPredictionPenalty(playerIndex, 'PARES', true);
          }, 100);
        }
      } else if (isJuegoBetting) {
        // Player is accepting bet in JUEGO/PUNTO - collapse cards with animation
        console.log(`[BET ACCEPT] Player ${playerIndex + 1} accepting in JUEGO - collapsing cards`);
        collapseOnBetAcceptance(playerIndex, 'JUEGO');
        
        // If they said "puede", check penalty after collapse
        if (gameState.juegoDeclarations[playerIndex] === 'puede') {
          setTimeout(() => {
            checkPredictionPenalty(playerIndex, 'JUEGO', true);
          }, 100);
        }
      }
      
      if (gameState.currentBet.betType === 'ordago') {
        // ORDAGO accepted - collapse all remaining cards, determine winner, end game
        console.log(`[ORDAGO ACCEPT] Player ${playerIndex + 1} accepted ORDAGO - collapsing all cards`);
        freezeGameState();
        // Collapse all remaining cards and wait for animations to finish
          collapseAllRemaining().then(() => {
            revealAllCards(true);
          setTimeout(() => {
            const roundWinner = calculateRoundWinner();
            console.log(`[ORDAGO] ${roundWinner} wins ${gameState.currentRound} round - game over!`);
            // Set winning team's score to 40+ to trigger victory
            gameState.teams[roundWinner].score = 40;
            showGameOver(roundWinner);
          }, 2000);
        });
      } else {
        const points = gameState.currentBet.amount || 1;
        gameState.pendingPoints[gameState.currentBet.bettingTeam][gameState.currentRound] = points;
        setTimeout(() => {
          if (gameState.currentRound === 'PARES') moveToNextRound('JUEGO');
          else moveToNextRound();
        }, 500);
      }
    } else if (action === 'envido' || action === 'raise') {
      console.log(`[BET] Player ${playerIndex + 1} (${playerTeam}) makes/raises bet to ${betAmount}`);
      
      // Collapse cards immediately when placing bet in PARES or JUEGO rounds
      const isParesBetting = gameState.currentRound === 'PARES' && gameState.paresDeclarations;
      const isJuegoBetting = (gameState.currentRound === 'JUEGO') && gameState.juegoDeclarations;
      
      if (isParesBetting) {
        // Player is placing bet in PARES - collapse cards with animation
        console.log(`[BET PLACE] Player ${playerIndex + 1} betting in PARES - collapsing cards`);
        collapseOnBetAcceptance(playerIndex, 'PARES');
        
        // If they said "puede", check penalty after collapse
        if (gameState.paresDeclarations[playerIndex] === 'puede') {
          setTimeout(() => {
            checkPredictionPenalty(playerIndex, 'PARES', true);
          }, 100);
        }
      } else if (isJuegoBetting) {
        // Player is placing bet in JUEGO/PUNTO - collapse cards with animation
        console.log(`[BET PLACE] Player ${playerIndex + 1} betting in JUEGO - collapsing cards`);
        collapseOnBetAcceptance(playerIndex, 'JUEGO');
        
        // If they said "puede", check penalty after collapse
        if (gameState.juegoDeclarations[playerIndex] === 'puede') {
          setTimeout(() => {
            checkPredictionPenalty(playerIndex, 'JUEGO', true);
          }, 100);
        }
      }
      
      const isRaise = gameState.currentBet.bettingTeam && gameState.currentBet.bettingTeam !== playerTeam;
      const previousAmount = gameState.currentBet.amount || 0;
      
      gameState.currentBet.previousAmount = previousAmount;
      gameState.currentBet.amount = betAmount;
      gameState.currentBet.bettingTeam = playerTeam;
      gameState.currentBet.betType = 'envido';
      gameState.currentBet.isRaise = isRaise;
      gameState.currentBet.responses = {};

      // Mark that a bet was placed this round (used later at CONTEO to decide 1pt)
      gameState.roundHadBetHistory = gameState.roundHadBetHistory || {};
      gameState.roundHadBetHistory[gameState.currentRound] = true;
      
      // Turn goes to defending team, starting with closest to mano
      const manoTeam = getPlayerTeam(gameState.manoIndex);
      let nextOpponent;
      if (manoTeam === opponentTeam) {
        // Mano is on defending team - mano responds first
        nextOpponent = gameState.manoIndex;
        console.log(`[BET] Mano (player ${gameState.manoIndex + 1}) is on defending team, responds first`);
      } else {
        // Mano is on betting team - first defender counter-clockwise from mano responds
        nextOpponent = getFirstOpponentFromMano(opponentTeam);
        console.log(`[BET] First defender counter-clockwise from mano is player ${nextOpponent + 1}`);
      }
      
      // If this is PARES, ensure the selected opponent can actually bet;
      // otherwise find an eligible defender or award points if none.
      if (gameState.currentRound === 'PARES') {
        const defenders = gameState.teams[opponentTeam].players;
        const eligible = defenders.filter(p => canPlayerBet(p));
        if (eligible.length === 0) {
          // No eligible defenders -> betting team wins immediately
          let points = gameState.currentBet.isRaise ? gameState.currentBet.previousAmount : 1;
          gameState.teams[gameState.currentBet.bettingTeam].score += points;
          showTeamPointsNotification(gameState.currentBet.bettingTeam, points);
          updateScoreboard();
          setTimeout(() => moveToNextRound(), 2000);
          return;
        }
        if (!canPlayerBet(nextOpponent)) {
          nextOpponent = eligible.find(p => p !== nextOpponent) || eligible[0];
          console.log(`[BET] Adjusted first defender to eligible player ${nextOpponent + 1}`);
        }
      }

      gameState.activePlayerIndex = nextOpponent;
      startPlayerTurnTimer(gameState.activePlayerIndex);
      updateScoreboard();
    } else if (action === 'ordago') {
      console.log(`Player ${playerIndex + 1} declares ORDAGO!`);
      
      // ORDAGO declaration - only collapse cards in PARES/JUEGO, not in GRANDE/CHICA
      const isParesBetting = gameState.currentRound === 'PARES' && gameState.paresDeclarations;
      const isJuegoBetting = (gameState.currentRound === 'JUEGO') && gameState.juegoDeclarations;
      
      if (isParesBetting || isJuegoBetting) {
        console.log(`[ORDAGO DECLARE] Player ${playerIndex + 1} declaring ORDAGO in ${gameState.currentRound} - collapsing their cards`);
        const roundName = isParesBetting ? 'PARES' : 'JUEGO';
        collapseOnBetAcceptance(playerIndex, roundName);
      } else {
        console.log(`[ORDAGO DECLARE] Player ${playerIndex + 1} declaring ORDAGO in ${gameState.currentRound} (GRANDE/CHICA) - no collapse on declaration`);
      }
      
      gameState.currentBet.amount = 40;
      gameState.currentBet.bettingTeam = playerTeam;
      gameState.currentBet.betType = 'ordago';
      gameState.currentBet.responses = {};
      
      // Turn goes to defending team, starting with closest to mano
      const manoTeam = getPlayerTeam(gameState.manoIndex);
      let nextOpponent;
      if (manoTeam === opponentTeam) {
        // Mano is on defending team - mano responds first
        nextOpponent = gameState.manoIndex;
        console.log(`[ORDAGO] Mano (player ${gameState.manoIndex + 1}) is on defending team, responds first`);
      } else {
        // Mano is on betting team - first defender counter-clockwise from mano responds
        nextOpponent = getFirstOpponentFromMano(opponentTeam);
        console.log(`[ORDAGO] First defender counter-clockwise from mano is player ${nextOpponent + 1}`);
      }
      
      gameState.activePlayerIndex = nextOpponent;
      startPlayerTurnTimer(gameState.activePlayerIndex);
      updateScoreboard();
    }
  }
  
  // Move to the next round
  function moveToNextRound(forcedRound = null, skipReset = false) {
    // Guard: if we just entered PUNTO, block any premature calls to
    // moveToNextRound that were scheduled before the PUNTO phase started.
    if (!forcedRound && gameState._puntoStartGuard) {
      console.log('[moveToNextRound] Skipping premature round advance during PUNTO startup');
      return;
    }
    const roundOrder = ['MUS', 'GRANDE', 'CHICA', 'PARES', 'JUEGO'];

    // Clear any pending timers to prevent stale timeouts
    if (timerInterval) {
      clearTimeout(timerInterval);
      timerInterval = null;
    }
    if (aiDecisionTimeout) {
      clearTimeout(aiDecisionTimeout);
      aiDecisionTimeout = null;
    }

    if (forcedRound) {
      gameState.currentRound = forcedRound;
    } else {
      const currentIndex = roundOrder.indexOf(gameState.currentRound);
      
      // PUNTO is a special case - it's the final betting round (alternative to JUEGO)
      if (gameState.currentRound === 'PUNTO') {
        // PUNTO betting finished - go to CONTEO phase
        console.log('PUNTO round finished - starting CONTEO');
        gameState.currentRound = 'CONTEO';
        updateRoundDisplay();
        updateScoreboard(); // This will hide all buttons
        
        // Reveal cards and then finish hand after delay
        revealAllCards();
        setTimeout(() => {
          finishHand();
        }, 2000);
        return;
      } else if (currentIndex < roundOrder.length - 1) {
        gameState.currentRound = roundOrder[currentIndex + 1];
      } else {
        // End of all rounds (JUEGO finished) - go to CONTEO phase
        console.log('JUEGO round finished - starting CONTEO');
        gameState.currentRound = 'CONTEO';
        updateRoundDisplay();
        updateScoreboard(); // This will hide all buttons
        
        // Reveal cards and then finish hand after delay
        revealAllCards();
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
      // Ensure declarations map is reset but preserve any preJuegoDeclarations
      gameState.juegoDeclarations = {};
      startJuegoDeclaration();
    } else {
      // For GRANDE and CHICA, start betting from mano
      updateScoreboard(); // Update buttons for betting rounds
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
    } else if (gameState.currentRound === 'PARES') {
      // Best pares win
      const paresResults = {};
      for (let i = 0; i < 4; i++) {
        paresResults[i] = calculatePares(hands[i]);
      }
      
      const team1Best = [paresResults[0], paresResults[2]].filter(p => p !== null).sort((a, b) => b.rank - a.rank)[0];
      const team2Best = [paresResults[1], paresResults[3]].filter(p => p !== null).sort((a, b) => b.rank - a.rank)[0];
      
      if (team1Best && !team2Best) {
        winningTeam = 'team1';
      } else if (team2Best && !team1Best) {
        winningTeam = 'team2';
      } else if (team1Best && team2Best) {
        if (team1Best.rank > team2Best.rank) {
          winningTeam = 'team1';
        } else if (team2Best.rank > team1Best.rank) {
          winningTeam = 'team2';
        }
      }
    } else if (gameState.currentRound === 'JUEGO' || gameState.currentRound === 'PUNTO') {
      // Best juego/punto (highest sum) wins
      const juegoResults = {};
      for (let i = 0; i < 4; i++) {
        juegoResults[i] = calculateJuego(hands[i]);
      }
      
      const team1Best = [juegoResults[0], juegoResults[2]].sort((a, b) => b.sum - a.sum)[0];
      const team2Best = [juegoResults[1], juegoResults[3]].sort((a, b) => b.sum - a.sum)[0];
      
      winningTeam = team1Best.sum >= team2Best.sum ? 'team1' : 'team2';
    }
    
    return winningTeam;
  }
  
  // Compare hands for Grande (higher cards)
  function compareHighCards(hands) {
    const gameMode = window.currentGameMode || '4';
    // High cards: 4 reyes = K, 8 reyes = K and 3
    const highCards = gameMode === '8' ? ['K', '3'] : ['K'];
    const cardOrder = gameMode === '8' 
      ? ['K', '3', 'Q', 'J', '7', '6', '5', '4', 'A', '2']
      : ['K', 'Q', 'J', '7', '6', '5', '4', '3', '2', 'A'];
    
    // Get best hand from each team
    const team1Hands = [hands[0], hands[2]];
    const team2Hands = [hands[1], hands[3]];
    
    let team1BestHand = team1Hands[0];
    let team1BestPlayer = 0;
    let team2BestHand = team2Hands[0];
    let team2BestPlayer = 1;
    
    if (compareGrandeHands(team1Hands[1], team1BestHand, cardOrder) > 0) {
      team1BestHand = team1Hands[1];
      team1BestPlayer = 2;
    }
    if (compareGrandeHands(team2Hands[1], team2BestHand, cardOrder) > 0) {
      team2BestHand = team2Hands[1];
      team2BestPlayer = 3;
    }
    
    // Compare best hands
    const comparison = compareGrandeHands(team1BestHand, team2BestHand, cardOrder);
    if (comparison > 0) return 'team1';
    if (comparison < 0) return 'team2';
    
    // Tie - closer to mano counterclockwise wins
    return getCloserToMano(team1BestPlayer, team2BestPlayer);
  }
  
  // Compare two hands for GRANDE (returns >0 if hand1 better, <0 if hand2 better, 0 if tie)
  function compareGrandeHands(hand1, hand2, cardOrder) {
    // Sort both hands by value (highest first)
    const sorted1 = hand1.map(c => c.value).sort((a, b) => cardOrder.indexOf(a) - cardOrder.indexOf(b));
    const sorted2 = hand2.map(c => c.value).sort((a, b) => cardOrder.indexOf(a) - cardOrder.indexOf(b));
    
    // Compare card by card
    for (let i = 0; i < 4; i++) {
      const idx1 = cardOrder.indexOf(sorted1[i]);
      const idx2 = cardOrder.indexOf(sorted2[i]);
      if (idx1 < idx2) return 1;  // hand1 better
      if (idx1 > idx2) return -1; // hand2 better
    }
    return 0; // Complete tie
  }
  
  // Compare hands for Chica (lower cards)
  function compareLowCards(hands) {
    const gameMode = window.currentGameMode || '4';
    // Low cards: 4 reyes = A, 8 reyes = A and 2
    const cardOrder = gameMode === '8' 
      ? ['K', '3', 'Q', 'J', '7', '6', '5', '4', 'A', '2']
      : ['K', 'Q', 'J', '7', '6', '5', '4', '3', '2', 'A'];
    
    // Get best hand from each team
    const team1Hands = [hands[0], hands[2]];
    const team2Hands = [hands[1], hands[3]];
    
    let team1BestHand = team1Hands[0];
    let team1BestPlayer = 0;
    let team2BestHand = team2Hands[0];
    let team2BestPlayer = 1;
    
    if (compareChicaHands(team1Hands[1], team1BestHand, cardOrder) > 0) {
      team1BestHand = team1Hands[1];
      team1BestPlayer = 2;
    }
    if (compareChicaHands(team2Hands[1], team2BestHand, cardOrder) > 0) {
      team2BestHand = team2Hands[1];
      team2BestPlayer = 3;
    }
    
    // Compare best hands
    const comparison = compareChicaHands(team1BestHand, team2BestHand, cardOrder);
    if (comparison > 0) return 'team1';
    if (comparison < 0) return 'team2';
    
    // Tie - closer to mano counterclockwise wins
    return getCloserToMano(team1BestPlayer, team2BestPlayer);
  }
  
  // Compare two hands for CHICA (returns >0 if hand1 better, <0 if hand2 better, 0 if tie)
  function compareChicaHands(hand1, hand2, cardOrder) {
    // Sort both hands by value (lowest first for CHICA)
    const sorted1 = hand1.map(c => c.value).sort((a, b) => cardOrder.indexOf(b) - cardOrder.indexOf(a));
    const sorted2 = hand2.map(c => c.value).sort((a, b) => cardOrder.indexOf(b) - cardOrder.indexOf(a));
    
    // Compare card by card (lower is better)
    for (let i = 0; i < 4; i++) {
      const idx1 = cardOrder.indexOf(sorted1[i]);
      const idx2 = cardOrder.indexOf(sorted2[i]);
      if (idx1 > idx2) return 1;  // hand1 better (lower card)
      if (idx1 < idx2) return -1; // hand2 better (lower card)
    }
    return 0; // Complete tie
  }
  
  // Determine which player is closer to mano counterclockwise
  function getCloserToMano(player1, player2) {
    const mano = gameState.manoIndex;
    const dist1 = (player1 - mano + 4) % 4;
    const dist2 = (player2 - mano + 4) % 4;
    const team1 = getPlayerTeam(player1);
    return dist1 < dist2 ? team1 : getPlayerTeam(player2);
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
    return Array.from(cards).map(card => {
      // If card is collapsed, read the final value from the display
      const isCollapsed = card.dataset.collapsed === 'true';
      let value;
      
      if (isCollapsed) {
        // Card has collapsed - read the final displayed value
        const cardTop = card.querySelector('.card-top');
        if (cardTop && cardTop.textContent.includes('⟩')) {
          // Extract value from |value⟩ format
          const match = cardTop.textContent.match(/\|(\w+)⟩/);
          value = match ? match[1] : (card.dataset.mainValue || card.dataset.value);
        } else {
          const decoration = card.querySelector('.quantum-decoration');
          value = decoration ? decoration.textContent.trim() : (card.dataset.mainValue || card.dataset.value);
        }
      } else {
        // Card not collapsed - read original value
        value = card.dataset.mainValue || card.dataset.value;
      }
      
      return {
        value: value,
        suit: card.dataset.suit
      };
    });
  }
  
  // ===================== PARES ROUND =====================
  
  // Check if player can bet. For GRANDE/CHICA anyone may bet; for PARES/JUEGO
  // eligibility depends on their declarations (tengo/puede/no tengo) and
  // potentially on the actual collapsed cards.
  function canPlayerBet(playerIndex) {
    // PUNTO is special: anyone can bet
    if (gameState.currentRound === 'PUNTO') return true;

    // For GRANDE and CHICA, players are eligible by default
    if (gameState.currentRound === 'GRANDE' || gameState.currentRound === 'CHICA') {
      return true;
    }

    // For PARES/JUEGO, inspect the player's declaration for eligibility
    const declaration = gameState.currentRound === 'PARES'
      ? gameState.paresDeclarations?.[playerIndex]
      : gameState.juegoDeclarations?.[playerIndex];

    // If they declared NO TENGO (false), they can't bet
    if (declaration === false) return false;

    // Check whether their cards have collapsed; if collapsed, verify they
    // actually have the required hand (pares or juego) before allowing bet
    const playerId = `player${playerIndex + 1}`;
    const cardElements = document.querySelectorAll(`#${playerId}-zone .quantum-card`);
    let allCollapsed = true;
    cardElements.forEach(card => {
      if (card.dataset.entangled === 'true' && card.dataset.collapsed !== 'true') {
        allCollapsed = false;
      }
    });

    if (allCollapsed) {
      const cards = getPlayerCards(playerIndex);
      if (gameState.currentRound === 'PARES') {
        const paresResult = calculatePares(cards);
        return paresResult !== null;
      } else if (gameState.currentRound === 'JUEGO') {
        const juegoResult = calculateJuego(cards);
        return !!(juegoResult && juegoResult.hasJuego);
      }
    }

    // If not all collapsed, allow betting if they declared TENGO or PUEDE
    return declaration === true || declaration === 'puede';
  }
  
  // Get next player who can bet in current round
  function nextPlayerWhoCanBet() {
    let attempts = 0;
    while (attempts < 4) {
      nextPlayer();
      if (canPlayerBet(gameState.activePlayerIndex)) {
        return;
      }
      attempts++;
    }
    // If no one can bet, just continue with current player
    console.warn('No player can bet, using current player');
  }
  
  function startParesDeclaration() {
    console.log('Starting PARES declaration');
    gameState.paresDeclarations = {};
    gameState.activePlayerIndex = gameState.manoIndex;
    // Show declaration banner then proceed
    showDeclarationBanner('PARES', proceedWithParesDeclaration);
  }
  
  function proceedWithParesDeclaration() {
      // Process declarations for all players in order starting from current active player
      if (Object.keys(gameState.paresDeclarations).length === 4) {
        // All players have declared - proceed to betting or next round
        handleAllParesDeclarationsDone();
        return;
      }

      // Skip players who already declared
      while (gameState.paresDeclarations.hasOwnProperty(gameState.activePlayerIndex)) {
        nextPlayer();
        // If all declared, break
        if (Object.keys(gameState.paresDeclarations).length === 4) {
          handleAllParesDeclarationsDone();
          return;
        }
      }

      // Try to auto-declare for current player
      const canAutoDeclarePares = shouldAutoDeclarePares(gameState.activePlayerIndex);

      if (canAutoDeclarePares) {
        // Will auto-declare after a 2s delay to match declaration pacing
        const autoResult = getAutoParesDeclaration(gameState.activePlayerIndex);
        setTimeout(() => {
          handleParesDeclaration(gameState.activePlayerIndex, autoResult, true);
          nextPlayer();
          proceedWithParesDeclaration();
        }, 2000);
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
    return getAutoParesDeclaration(playerIndex) !== null;
  }
  
  function getAutoParesDeclaration(playerIndex) {
    const cards = getPlayerCards(playerIndex);
    const playerId = `player${playerIndex + 1}`;
    const cardElements = document.querySelectorAll(`#${playerId}-zone .quantum-card`);
    const gameMode = window.currentGameMode || '4';
    
    console.log(`[AUTO PARES] Player ${playerIndex + 1}, Mode: ${gameMode}, Cards:`, cards.map(c => c.value));
    console.log(`[AUTO PARES] Raw card data:`, Array.from(cardElements).map(el => ({
      mainValue: el.dataset.mainValue,
      value: el.dataset.value,
      entangled: el.dataset.entangled,
      partner: el.dataset.partner
    })));
    
    // Get entangled card indices and their possible values
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
    
    const hasEntangled = entangledIndices.length > 0;
    console.log(`[AUTO PARES] Has entangled: ${hasEntangled}, Count: ${entangledIndices.length}`);
    
    if (!hasEntangled) {
      // No entangled cards - simple case
      const paresResult = calculatePares(cards);
      const hasPares = paresResult !== null;
      console.log(`[AUTO PARES] No entanglement - Has pares: ${hasPares}`, paresResult);
      return hasPares;
    }
    
    // Has entangled cards - check if outcome is certain
    let canHavePares = false;
    let canNotHavePares = false;
    const testedCombinations = [];
    
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
      const cardValues = testCards.map(c => c.value).join(', ');
      testedCombinations.push({ values: cardValues, hasPares: result !== null, result });
      
      if (result !== null) {
        canHavePares = true;
        console.log(`[AUTO PARES] ✓ Combination [${cardValues}] HAS PARES:`, result);
      } else {
        canNotHavePares = true;
        console.log(`[AUTO PARES] ✗ Combination [${cardValues}] no pares`);
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
        if (canHavePares && canNotHavePares) return; // Early exit
      }
    }
    
    console.log(`[AUTO PARES] Testing entangled combinations...`);
    console.log(`[AUTO PARES] Entangled indices: ${entangledIndices.join(', ')}, Possible values:`, entangledPossibleValues);
    generateCombinations(0, []);
    
    console.log(`[AUTO PARES] Summary - Can have: ${canHavePares}, Cannot have: ${canNotHavePares}`);
    
    // If outcome is certain, return the result
    if (canHavePares && !canNotHavePares) {
      return true;
    } else if (!canHavePares && canNotHavePares) {
      return false;
    }
    
    // Outcome uncertain - return null to indicate manual declaration needed
    return null;
  }
  
  function handleParesDeclaration(playerIndex, declaration, isAutoDeclared = false) {
    // declaration can be: true (tengo), false (no tengo), or 'puede'
    gameState.paresDeclarations[playerIndex] = declaration;
    
    // Show notification based on declaration
    const notificationType = declaration === true ? 'pares' : 
                            declaration === false ? 'no_pares' : 'puede_pares';
    showActionNotification(playerIndex, notificationType);
    
    // Collapse cards if declaration is manual and TENGO or NO TENGO (with animation)
    if (!isAutoDeclared && (declaration === true || declaration === false)) {
      console.log(`[PARES DECLARATION] Player ${playerIndex + 1} declared ${declaration ? 'TENGO' : 'NO TENGO'} - collapsing cards`);
      collapseOnDeclaration(playerIndex, 'PARES', declaration);
    }
    
    // Check if all players declared
    if (Object.keys(gameState.paresDeclarations).length < 4) {
      // Still need more declarations - move to next player
      if (!isAutoDeclared) {
        // Manual declaration - continue to next player after 2s to match pacing
        setTimeout(() => {
          nextPlayer();
          proceedWithParesDeclaration();
        }, 2000);
      }
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

    // Three possible outcomes after declaration:
    // 1) Betting possible -> start PARES betting
    // 2) Nobody has PARES/PUEDE -> start PUNTO betting
    // 3) Only one team has TENGO/PUEDE -> advance to CONTEO (end of hand)

    if (canBet) {
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

    } else {
      // In all other cases (nobody has PARES or only one team), proceed to JUEGO declaration
      console.log('Proceeding to JUEGO declaration phase after PARES');

      // Ensure juego declarations are reset and preserve any preJuegoDeclarations
      gameState.currentRound = 'JUEGO';
      gameState.juegoDeclarations = {};
      gameState.activePlayerIndex = gameState.manoIndex;

      // Reset bet state to avoid stray bets
      resetRoundState();

      // Update UI and start JUEGO declaration
      updateScoreboard();
      updateRoundDisplay();
      setTimeout(() => {
        startJuegoDeclaration();
      }, 100);
    }
  }
  
  function calculatePares(cards) {
    const gameMode = window.currentGameMode || '4';
    // Normalize values for PARES (pair equivalence):
    // 4 reyes: A, 2, 3, K are all INDEPENDENT - no equivalences
    // 8 reyes: A=2 (can form pair together), 3=K (can form pair together)
    // J and Q are NEVER equivalent to anything
    const normalizeValue = (val) => {
      if (gameMode === '8') {
        if (val === 'A') return '2';  // A and 2 can form pair
        if (val === '3') return 'K';  // 3 and K can form pair
      }
      // All other values (including J, Q) remain unchanged
      return val;
    };
    
    const valueCounts = {};
    cards.forEach(card => {
      const normalized = normalizeValue(card.value);
      valueCounts[normalized] = (valueCounts[normalized] || 0) + 1;
    });
    
    console.log(`[CALC PARES] Input: [${cards.map(c => c.value).join(', ')}], Normalized counts:`, valueCounts);
    
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
        const order = gameMode === '8' ? ['A', '2', '4', '5', '6', '7', 'J', 'Q', 'K'] : ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K'];
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
      return hasJuego;
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
      return true;
    } else if (maxPossibleSum < 31) {
      // Never has juego regardless of entangled values
      console.log(`Player ${playerIndex + 1} auto-declared JUEGO: false (certain with entangled, max=${maxPossibleSum})`);
      return false;
    }
    
    // Outcome is uncertain - player must choose (some entangled combinations MAY produce JUEGO)
    console.log(`Player ${playerIndex + 1} has entangled cards - outcome uncertain (min=${minPossibleSum}, max=${maxPossibleSum}), must choose manually`);
    return null;
  }
  
  function startJuegoDeclaration() {
    console.log('Starting JUEGO declaration');
    console.log('[TRACE] startJuegoDeclaration - currentRound:', gameState.currentRound, 'mano:', gameState.manoIndex);
    gameState.juegoDeclarations = {};
    // Don't clear preJuegoDeclarations here - use them in proceedWithJuegoDeclaration
    gameState.activePlayerIndex = gameState.manoIndex;
    // Show JUEGO declaration banner then proceed
    showDeclarationBanner('JUEGO', proceedWithJuegoDeclaration);
  }

  // Debug helper: simulate all players declaring NO TENGO for JUEGO
  function debugForceAllNoJuego() {
    gameState.juegoDeclarations = { 0: false, 1: false, 2: false, 3: false };
    console.log('[DEBUG] Forced all players NO TENGO for JUEGO');
    handleAllJuegoDeclarationsDone();
  }
  window.debugForceAllNoJuego = debugForceAllNoJuego;
  
  function proceedWithJuegoDeclaration() {
    console.log('[TRACE] proceedWithJuegoDeclaration - activePlayerIndex:', gameState.activePlayerIndex, 'preJuego:', gameState.preJuegoDeclarations);
    // Process declarations for all players in order starting from current active player
    if (Object.keys(gameState.juegoDeclarations).length === 4) {
      // All players have declared - proceed to betting or next round
      handleAllJuegoDeclarationsDone();
      return;
    }

    // Skip players who already declared
    while (gameState.juegoDeclarations.hasOwnProperty(gameState.activePlayerIndex)) {
      nextPlayer();
      if (Object.keys(gameState.juegoDeclarations).length === 4) {
        handleAllJuegoDeclarationsDone();
        return;
      }
    }

    const playerIdx = gameState.activePlayerIndex;
    let autoResult = null;

    // Use any pre-declaration from PARES if present
    if (gameState.preJuegoDeclarations && gameState.preJuegoDeclarations[playerIdx] !== undefined) {
      autoResult = gameState.preJuegoDeclarations[playerIdx];
      console.log(`[PRE-DECLARE] Using pre-declaration for player ${playerIdx + 1}: ${autoResult}`);
    } else {
      // Try to auto-declare for current player
      autoResult = autoDeclareJuego(playerIdx);
    }

    // If autoResult is still unknown, check visible cards for this player; if all collapsed and sum < 31, force NO TENGO
    if (autoResult === null) {
      const cards = getPlayerCards(playerIdx);
      let allCollapsed = true;
      let sum = 0;
      cards.forEach(card => {
        const playerId = `player${playerIdx + 1}`;
        const cardEls = document.querySelectorAll(`#${playerId}-zone .quantum-card`);
        const cardEl = Array.from(cardEls).find(el => (el.dataset.value === card.value || el.dataset.mainValue === card.value));
        if (!cardEl || cardEl.dataset.collapsed !== 'true') {
          allCollapsed = false;
        }
        let val = card.value;
        if (val === 'A' || val === '2') val = 1;
        else if (val === '3') val = (window.currentGameMode === '8' ? 10 : 3);
        else if (['J','Q','K'].includes(val)) val = 10;
        else val = parseInt(val) || 0;
        sum += val;
      });
      if (allCollapsed && sum < 31) {
        autoResult = false;
        console.log(`[AUTO-PATCH] Player ${playerIdx + 1}: all visible cards collapsed and sum < 31, auto-declaring NO TENGO in JUEGO`);
      }
    }

    if (autoResult !== null) {
      // Can auto-declare (short delay to match insp.js pacing)
      // Show auto-declare message for local player
      const localPlayerIndex = window.currentLocalPlayerIndex ?? 0;
      if (playerIdx === localPlayerIndex) {
        try { showAutoDeclarationMessage(autoResult ? 'JUEGO' : 'NO JUEGO'); } catch (e) { /* ignore */ }
      }
      setTimeout(() => {
        console.log(`[TRACE] Auto-declaring JUEGO for player ${playerIdx + 1}:`, autoResult);
        handleJuegoDeclaration(playerIdx, autoResult, true);
        nextPlayer();
        proceedWithJuegoDeclaration();
      }, 800);
    } else {
      // Player needs to manually declare
      console.log(`[TRACE] Manual JUEGO declaration needed for player ${playerIdx + 1}`);
      updateScoreboard();
      startPlayerTurnTimer(playerIdx);
    }
  }

  // Small animated banner to indicate a declaration phase (PARES/JUEGO)
  function showDeclarationBanner(roundName, cb) {
    const banner = document.createElement('div');
    banner.className = 'declaration-banner';
    banner.style.cssText = `
      position: fixed; top: 20%; left: 50%; transform: translate(-50%, -50%) scale(0.8);
      background: rgba(15,23,42,0.95); color: white; padding: 30px 50px; z-index: 6000;
      border-radius: 18px; border: 3px solid #a78bfa; text-align: center; font-size: 1.8rem;
      box-shadow: 0 10px 40px rgba(0,0,0,0.6);
      opacity: 0; transition: all 240ms ease-out;
    `;
    banner.innerHTML = `<div style="font-weight:300;opacity:0.95">DECLARACIÓN</div><div style="font-size:2.2rem;margin-top:8px;">${roundName}</div>`;
    document.body.appendChild(banner);
    requestAnimationFrame(() => { banner.style.opacity = '1'; banner.style.transform = 'translate(-50%, -50%) scale(1)'; });
    setTimeout(() => {
      banner.style.opacity = '0'; banner.style.transform = 'translate(-50%, -50%) scale(0.9)';
      setTimeout(() => { if (banner.parentNode) banner.parentNode.removeChild(banner); if (cb) cb(); }, 260);
    }, 900);
  }

  // Show auto-declaration message for local player (copied from insp.js)
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
  
  function handleJuegoDeclaration(playerIndex, hasJuego, isAutoDeclared = false) {
    // hasJuego can be: true (tengo), false (no tengo), or 'puede'
    gameState.juegoDeclarations[playerIndex] = hasJuego;
    
    // Show notification based on declaration
    const notificationType = hasJuego === true ? 'juego' : 
                            hasJuego === false ? 'no_juego' : 'puede_juego';
    showActionNotification(playerIndex, notificationType);
    
    // Collapse cards on manual declaration (same as PARES behavior)
    // Trigger collapse for manual TENGO or NO TENGO declarations
    if ((hasJuego === true || hasJuego === false) && !isAutoDeclared) {
      collapseOnDeclaration(playerIndex, 'JUEGO', hasJuego);
    }

    // Check if all players declared
    if (Object.keys(gameState.juegoDeclarations).length < 4) {
      // Still need more declarations - do not auto-advance here (insp.js parity)
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
      // Only one team has JUEGO - follow reference: reveal cards then advance to next round
      console.log('Only one team has JUEGO - revealing cards, no points awarded');
      revealAllCards();
      // After reveal, advance to next round (moveToNextRound will move to CONTEO when appropriate)
      setTimeout(() => {
        moveToNextRound();
      }, 2000);
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
    // Valores de PUNTO (no pares):
    // A = 1 punto (siempre)
    // 2 = 2 puntos (4 reyes) o 1 punto (8 reyes)
    // 3 = 3 puntos (4 reyes) o 10 puntos (8 reyes)
    // J, Q, K = 10 puntos
    const getCardPoints = (val) => {
      if (val === 'A') return 1;
      if (val === '2') return gameMode === '4' ? 2 : 1;
      if (val === '3') return gameMode === '4' ? 3 : 10;
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
  
  // Show ordago winner as a simple banner
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

      // If an initializeLobby helper exists, call it so lobby UI is prepared
      if (typeof window.initializeLobby === 'function') {
        try { window.initializeLobby(); } catch (e) { console.warn('initializeLobby() failed', e); }
      }

      // Return to lobby (fallback to reload)
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
  
  // Finish hand - reveal all cards and award points
  function finishHand() {
    console.log('Finishing hand - awarding points via CONTEO');

    // Cards are already revealed at this point (done in moveToNextRound)
    
    // Wait 7 seconds before showing point panel (user request)
    setTimeout(() => {
      // Calculate actual scores for each round based on conteo rules
      const hands = {};
      for (let i = 0; i < 4; i++) {
        hands[i] = getPlayerCards(i);
      }
      
      // Track scoring details for summary
      const scoringDetails = {
        GRANDE: null,
        CHICA: null,
        PARES: null,
        JUEGO: null
      };
      
      // GRANDE scoring
      scoringDetails.GRANDE = scoreGrandeRound(hands);
      
      // CHICA scoring
      scoringDetails.CHICA = scoreChicaRound(hands);
      
      // PARES scoring
      scoringDetails.PARES = scoreParesRound(hands);
      
      // JUEGO/PUNTO scoring
      scoringDetails.JUEGO = scoreJuegoRound(hands);

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

      // Clear puntoPlayed flag after scoring
      gameState.puntoPlayed = false;

      showHandSummary(scoringDetails);

      setTimeout(() => {
        startNewHand();
      }, 5000); // 5 seconds before starting new hand (allow score panel to fade)
    }, 7000); // 7 seconds delay before showing point panel (user request)
  }
  
  // Score GRANDE round
  function scoreGrandeRound(hands) {
    const betAmount = gameState.pendingPoints.team1.GRANDE || gameState.pendingPoints.team2.GRANDE;
    const winner = compareHighCards(hands);
    let pointsAwarded = 0;
    let description = '';
    
    if (betAmount > 0) {
      // Bet was placed - award to winner
      gameState.teams[winner].score += betAmount;
      pointsAwarded = betAmount;
      description = `${betAmount}pts apuesta`;
      console.log(`GRANDE: ${winner} wins ${betAmount} points (bet accepted)`);
    } else if (gameState.roundHadBetHistory && gameState.roundHadBetHistory.GRANDE) {
      // There was at least one bet attempt this round but it was rejected - no 1pt at CONTEO
      description = 'Apuesta rechazada';
    } else {
      // No bet (all paso) - 1 point to winning team
      gameState.teams[winner].score += 1;
      pointsAwarded = 1;
      description = '1pt (paso)';
      console.log(`GRANDE: ${winner} wins 1 point (no bet)`);
    }
    
    return { winner, points: pointsAwarded, description };
  }
  
  // Score CHICA round
  function scoreChicaRound(hands) {
    const betAmount = gameState.pendingPoints.team1.CHICA || gameState.pendingPoints.team2.CHICA;
    const winner = compareLowCards(hands);
    let pointsAwarded = 0;
    let description = '';
    
    if (betAmount > 0) {
      // Bet was placed - award to winner
      gameState.teams[winner].score += betAmount;
      pointsAwarded = betAmount;
      description = `${betAmount}pts apuesta`;
      console.log(`CHICA: ${winner} wins ${betAmount} points (bet accepted)`);
    } else if (gameState.roundHadBetHistory && gameState.roundHadBetHistory.CHICA) {
      // There was at least one bet attempt this round but it was rejected - no 1pt at CONTEO
      description = 'Apuesta rechazada';
    } else {
      // No bet (all paso) - 1 point to winning team
      gameState.teams[winner].score += 1;
      pointsAwarded = 1;
      description = '1pt (paso)';
      console.log(`CHICA: ${winner} wins 1 point (no bet)`);
    }
    
    return { winner, points: pointsAwarded, description };
  }
  
  // Score PARES round
  function scoreParesRound(hands) {
    const betAmount = gameState.pendingPoints.team1.PARES || gameState.pendingPoints.team2.PARES;
    
    // Calculate pares for each player
    const paresResults = {};
    for (let i = 0; i < 4; i++) {
      paresResults[i] = calculatePares(hands[i]);
    }
    
    // Determine team with best pares
    const team1Best = [paresResults[0], paresResults[2]].filter(p => p !== null).sort((a, b) => b.rank - a.rank)[0];
    const team2Best = [paresResults[1], paresResults[3]].filter(p => p !== null).sort((a, b) => b.rank - a.rank)[0];
    
    let winningTeam = null;
    
    if (team1Best && !team2Best) {
      winningTeam = 'team1';
    } else if (team2Best && !team1Best) {
      winningTeam = 'team2';
    } else if (team1Best && team2Best) {
      // Compare ranks
      if (team1Best.rank > team2Best.rank) {
        winningTeam = 'team1';
      } else if (team2Best.rank > team1Best.rank) {
        winningTeam = 'team2';
      } else {
        // Same rank - compare values (for double pairs)
        // If tie, closer to mano wins
        winningTeam = 'team1'; // Simplified - proper implementation would compare card values
      }
    }
    
    if (betAmount > 0 && winningTeam) {
      // Bet was placed - award bet amount + bonus
      gameState.teams[winningTeam].score += betAmount;
      console.log(`PARES: ${winningTeam} wins ${betAmount} points (bet)`);
      
      // Add bonus points for the winning team
      const teamPlayers = gameState.teams[winningTeam].players;
      teamPlayers.forEach(p => {
        const pares = paresResults[p];
        if (pares) {
          if (pares.type === 'double_pair') {
            gameState.teams[winningTeam].score += 3;
            console.log(`PARES bonus: ${winningTeam} +3 for double pair`);
          } else if (pares.type === 'triplet') {
            gameState.teams[winningTeam].score += 2;
            console.log(`PARES bonus: ${winningTeam} +2 for triplet`);
          } else if (pares.type === 'pair') {
            gameState.teams[winningTeam].score += 1;
            console.log(`PARES bonus: ${winningTeam} +1 for pair`);
          }
        }
      });
    } else if (winningTeam) {
      // No bet - only award bonus points
      const teamPlayers = gameState.teams[winningTeam].players;
      teamPlayers.forEach(p => {
        const pares = paresResults[p];
        if (pares) {
          if (pares.type === 'double_pair') {
            gameState.teams[winningTeam].score += 3;
          } else if (pares.type === 'triplet') {
            gameState.teams[winningTeam].score += 2;
          } else if (pares.type === 'pair') {
            gameState.teams[winningTeam].score += 1;
          }
        }
      });
      console.log(`PARES: ${winningTeam} wins bonus points only (no bet)`);
    }
    
    // Return scoring details
    let description = '';
    let totalPoints = betAmount || 0;
    if (winningTeam) {
      const bonuses = [];
      const teamPlayers = gameState.teams[winningTeam].players;
      teamPlayers.forEach(p => {
        const pares = paresResults[p];
        if (pares) {
          if (pares.type === 'double_pair') {
            bonuses.push('Duples +3');
            totalPoints += 3;
          } else if (pares.type === 'triplet') {
            bonuses.push('Medias +2');
            totalPoints += 2;
          } else if (pares.type === 'pair') {
            bonuses.push('Pares +1');
            totalPoints += 1;
          }
        }
      });
      if (betAmount > 0 && bonuses.length > 0) {
        description = `${betAmount}pts apuesta, ${bonuses.join(', ')}`;
      } else if (bonuses.length > 0) {
        description = bonuses.join(', ');
      } else {
        description = betAmount > 0 ? `${betAmount}pts apuesta` : 'Sin pares';
      }
    } else {
      description = 'Sin pares';
    }
    
    return { winner: winningTeam, points: totalPoints, description };
  }
  
  // Score JUEGO/PUNTO round
  function scoreJuegoRound(hands) {
    const betAmount = gameState.pendingPoints.team1.JUEGO || gameState.pendingPoints.team2.JUEGO;
    // If PUNTO was played earlier we may have moved to CONTEO, so treat that as punto scoring
    const isPunto = gameState.currentRound === 'PUNTO' || !!gameState.puntoPlayed;
    
    // Calculate juego for each player
    const juegoResults = {};
    for (let i = 0; i < 4; i++) {
      juegoResults[i] = calculateJuego(hands[i]);
    }
    
    // Determine team with best juego/punto
    const team1Best = [juegoResults[0], juegoResults[2]].sort((a, b) => b.sum - a.sum)[0];
    const team2Best = [juegoResults[1], juegoResults[3]].sort((a, b) => b.sum - a.sum)[0];
    
    let winningTeam = team1Best.sum >= team2Best.sum ? 'team1' : 'team2';
    
    if (isPunto) {
      // PUNTO scoring
      if (betAmount > 0) {
        // Bet accepted - award bet amount + 1 point
        gameState.teams[winningTeam].score += betAmount + 1;
        console.log(`PUNTO: ${winningTeam} wins ${betAmount} + 1 point`);
      } else {
        // No bet or rejected - 1 point to winner
        gameState.teams[winningTeam].score += 1;
        console.log(`PUNTO: ${winningTeam} wins 1 point`);
      }
    } else {
      // JUEGO scoring
      if (betAmount > 0) {
        // Bet accepted - award bet amount
        gameState.teams[winningTeam].score += betAmount;
        console.log(`JUEGO: ${winningTeam} wins ${betAmount} points (bet)`);
      }
      
      // Add bonus points for juego (31 = 3 points, 32-40 = 2 points)
      const teamPlayers = gameState.teams[winningTeam].players;
      teamPlayers.forEach(p => {
        const result = juegoResults[p];
        if (result.hasJuego) {
          if (result.sum === 31) {
            gameState.teams[winningTeam].score += 3;
            console.log(`JUEGO bonus: ${winningTeam} +3 for 31`);
          } else {
            gameState.teams[winningTeam].score += 2;
            console.log(`JUEGO bonus: ${winningTeam} +2 for ${result.sum}`);
          }
        }
      });
      
      if (betAmount === 0) {
        console.log(`JUEGO: ${winningTeam} wins bonus points only (no bet)`);
      }
    }
    
    // Return scoring details
    let description = '';
    let totalPoints = 0;
    const roundName = isPunto ? 'PUNTO' : 'JUEGO';
    
    if (isPunto) {
      if (betAmount > 0) {
        totalPoints = betAmount + 1;
        description = `${betAmount}pts apuesta +1`;
      } else {
        totalPoints = 1;
        description = '1pt';
      }
    } else {
      totalPoints = betAmount || 0;
      const bonuses = [];
      const teamPlayers = gameState.teams[winningTeam].players;
      teamPlayers.forEach(p => {
        const result = juegoResults[p];
        if (result.hasJuego) {
          if (result.sum === 31) {
            bonuses.push('31 +3');
            totalPoints += 3;
          } else {
            bonuses.push(`${result.sum} +2`);
            totalPoints += 2;
          }
        }
      });
      if (betAmount > 0 && bonuses.length > 0) {
        description = `${betAmount}pts apuesta, ${bonuses.join(', ')}`;
      } else if (bonuses.length > 0) {
        description = bonuses.join(', ');
      } else {
        description = betAmount > 0 ? `${betAmount}pts apuesta` : 'Sin juego';
      }
    }
    
    return { winner: winningTeam, points: totalPoints, description, roundName };
  }
  
  function revealAllCards(force = false) {
    // Only reveal during CONTEO unless explicitly forced (e.g., ÓRDAGO)
    if (!force && gameState.currentRound !== 'CONTEO') {
      console.log('[REVEAL] Skipping reveal: not in CONTEO and not forced (currentRound=', gameState.currentRound, ')');
      return;
    }
    console.log('[REVEAL] Collapsing all remaining cards before reveal');

    // First, collapse all remaining entangled cards and wait for animations
    collapseAllRemaining().then(() => {
      // Then show all player cards after a brief delay for collapse animation
      setTimeout(() => {
      for (let i = 0; i < 4; i++) {
        const playerId = `player${i + 1}`;
        const cards = document.querySelectorAll(`#${playerId}-zone .quantum-card`);
        
        cards.forEach(card => {
          // Remove hidden symbol and show actual cards
          const hiddenSymbol = card.querySelector('.hidden-card-symbol, .hidden-symbol-right, .hidden-symbol-left');
          if (hiddenSymbol) {
            hiddenSymbol.remove();
            
            // Add visible card content
            const value = card.dataset.mainValue || card.dataset.value;
            const suitColor = card.dataset.suitColor || '#2ec4b6';
            const isEntangled = card.dataset.entangled === 'true';
            const entangledPartner = card.dataset.partner;
            
            const topLabel = document.createElement('div');
            topLabel.className = 'dirac-label card-top';
            topLabel.style.color = suitColor;
            topLabel.innerHTML = `|${value}⟩`;
            card.appendChild(topLabel);
            
            const bottomLabel = document.createElement('div');
            bottomLabel.className = 'dirac-label card-bottom';
            bottomLabel.style.color = suitColor;
            const partner = card.dataset.partner || card.dataset.superposedValue || value;
            bottomLabel.innerHTML = `⟨${partner}|`;
            card.appendChild(bottomLabel);
            
            // Add Bloch sphere for revealed cards
            const bloch = document.createElement('div');
            bloch.className = 'bloch-sphere';
            let state = 'superposition';
            
            if (isEntangled) {
              state = 'entangled';
              bloch.innerHTML = CardGenerator.generateBlochSphere(state, true, value, entangledPartner, 0, 0, suitColor);
            } else {
              // Regular card: random up or down
              state = Math.random() > 0.5 ? 'up' : 'down';
              bloch.innerHTML = CardGenerator.generateBlochSphere(state, false, '0', '1', 0, 0, suitColor);
            }
            card.appendChild(bloch);
          }
        });
      }
      }, 500); // Wait for collapse animations to complete

      // After reveal, make sure all declarations/bets are checked and penalized if incorrect
      setTimeout(() => {
        // Iterate over PARES declarations
        if (gameState.paresDeclarations) {
          Object.keys(gameState.paresDeclarations).forEach(k => {
            const idx = parseInt(k, 10);
            const decl = gameState.paresDeclarations[idx];
            if (decl !== undefined) {
              checkPredictionPenalty(idx, 'PARES', decl === 'tengo' || decl === true);
            }
          });
        }

        // Iterate over JUEGO declarations
        if (gameState.juegoDeclarations) {
          Object.keys(gameState.juegoDeclarations).forEach(k => {
            const idx = parseInt(k, 10);
            const decl = gameState.juegoDeclarations[idx];
            if (decl !== undefined) {
              // juegoDeclarations stores true/false or 'puede'
              const boolDecl = decl === true || decl === 'tengo';
              checkPredictionPenalty(idx, 'JUEGO', boolDecl);
            }
          });
        }

        // Also check any pre-JUEGO pre-declarations that might not have been evaluated
        if (gameState.preJuegoDeclarations) {
          Object.keys(gameState.preJuegoDeclarations).forEach(k => {
            const idx = parseInt(k, 10);
            const decl = gameState.preJuegoDeclarations[idx];
            if (decl !== undefined) {
              checkPredictionPenalty(idx, 'JUEGO', decl === true || decl === 'tengo');
            }
          });
        }
      }, 900);
    });
  }
  
  function showHandSummary(scoringDetails = {}) {
    const team1Score = gameState.teams.team1.score;
    const team2Score = gameState.teams.team2.score;
    
    // Build detailed breakdown
    let breakdownHTML = '';
    const rounds = ['GRANDE', 'CHICA', 'PARES', 'JUEGO'];
    
    rounds.forEach(round => {
      if (scoringDetails[round]) {
        const detail = scoringDetails[round];
        const roundName = detail.roundName || round;
        if (detail.points > 0 || detail.description) {
          const winnerColor = detail.winner === 'team1' ? '#2ec4b6' : '#ff9e6d';
          const winnerName = detail.winner === 'team1' ? 'Cop' : 'MM';
          breakdownHTML += `
            <div style="color: var(--paper-beige); font-size: 0.85rem; margin: 5px 0; text-align: left;">
              <span style="color: #a78bfa;">${roundName}:</span>
              <span style="color: ${winnerColor};">${winnerName}</span>
              <span style="color: var(--circuit-blueprint);"> - ${detail.description}</span>
            </div>
          `;
        }
      }
    });
    
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
        ${breakdownHTML ? `<div style="margin: 20px auto; max-width: 400px;">${breakdownHTML}</div>` : ''}
        <div style="display: flex; justify-content: space-around; margin: 30px 0;">
          <div>
            <p style="color: #2ec4b6; font-size: 1rem;">Copenhague</p>
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
    }, 4500);
  }
  
  // Start new hand
  function startNewHand() {
    console.log('Starting new hand...');
    
    // Increment hands counter
    gameState.handsPlayed++;
    console.log(`Hand ${gameState.handsPlayed} starting`);
    
    // Ensure timers and AI timeouts are cleared to avoid cross-hand racing
    try {
      if (typeof timerInterval !== 'undefined' && timerInterval) { clearTimeout(timerInterval); timerInterval = null; }
    } catch (e) { console.warn('Failed to clear timerInterval', e); }
    try {
      if (typeof aiDecisionTimeout !== 'undefined' && aiDecisionTimeout) { clearTimeout(aiDecisionTimeout); aiDecisionTimeout = null; }
    } catch (e) { console.warn('Failed to clear aiDecisionTimeout', e); }
    try {
      if (gameState.autoDiscardTimeouts) {
        Object.keys(gameState.autoDiscardTimeouts).forEach(k => {
          try { clearTimeout(gameState.autoDiscardTimeouts[k]); } catch (e) {}
        });
        gameState.autoDiscardTimeouts = {};
      }
    } catch (e) { console.warn('Failed to clear autoDiscardTimeouts', e); }

    // Remove any leftover UI overlays/modals/notifications from previous hand
    document.querySelectorAll('.auto-declaration-message, .penalty-notification, .declaration-banner, .timeout-notification, .ordago-winner-banner, .game-over-modal, .modal, #discard-button').forEach(el => {
      try { el.remove(); } catch (e) {}
    });

    // Reset timer bars visibility and widths
    for (let i = 0; i < 4; i++) {
      const fill = document.querySelector(`#timer-bar-player${i + 1} .timer-bar-fill`);
      const timerBar = document.querySelector(`#timer-bar-player${i + 1}`);
      if (fill) {
        fill.style.transition = 'none';
        fill.style.width = '0%';
        fill.style.opacity = '0';
      }
      if (timerBar) {
        timerBar.style.opacity = '0';
        timerBar.style.visibility = 'hidden';
      }
    }

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
    const previousMano = gameState.manoIndex;
    gameState.manoIndex = (gameState.manoIndex - 1 + 4) % 4; // Rotate mano counter-clockwise (4→3→2→1→4)
    gameState.activePlayerIndex = gameState.manoIndex;
    resetRoundState();
    // Clear declaration maps and pre-declarations for a fresh mano
    gameState.paresDeclarations = undefined;
    gameState.juegoDeclarations = undefined;
    gameState.preJuegoDeclarations = null;
    // Track whether any bets were placed per round in this hand
    gameState.roundHadBetHistory = { GRANDE: false, CHICA: false, PARES: false, JUEGO: false };
    // Reset entanglement maps for new hand
    resetEntanglementForNewHand();
    // Ensure pending points are cleared
    gameState.pendingPoints = { team1: { GRANDE: 0, CHICA: 0, PARES: 0, JUEGO: 0 }, team2: { GRANDE: 0, CHICA: 0, PARES: 0, JUEGO: 0 } };
    // Reset per-hand transient maps
    gameState.cardsDiscarded = {};
    gameState.waitingForDiscard = false;
    
    console.log(`New hand - Mano rotated counter-clockwise from player ${previousMano + 1} to player ${gameState.manoIndex + 1}`);
    
    // Update mano indicator on avatars
    updateManoIndicators();
    
    // Deal new cards to all players
    dealInitialCards();
    
    // Play deal animation
    setTimeout(() => {
      playDealAnimation();
    }, 100);
    
    // Start MUS round after cards are dealt - Update scoreboard AFTER cards are in DOM
    setTimeout(() => {
      // Match entangled cards between player1 and player3
      matchEntangledCards();
      // Update probabilities after cards are dealt and matched
      updateScoreboard();
      // Ensure activePlayerIndex is set to mano and start timer
      gameState.activePlayerIndex = gameState.manoIndex;
      startPlayerTurnTimer(gameState.activePlayerIndex);
    }, 2000);
  }
  
  // Update mano indicator on player avatars
  function updateManoIndicators() {
    for (let i = 0; i < 4; i++) {
      const zone = document.querySelector(`#player${i + 1}-zone`);
      if (!zone) continue;
      
      // Remove existing mano indicator
      const existingIndicator = zone.querySelector('.atom-indicator');
      if (existingIndicator) {
        existingIndicator.remove();
      }
      
      // Add mano indicator to current mano player
      if (i === gameState.manoIndex) {
        const avatar = zone.querySelector('.character-avatar');
        if (avatar) {
          const indicator = document.createElement('div');
          indicator.className = 'atom-indicator';
          indicator.title = 'Mano - Comienza el juego';
          // Use stored character key (e.g. 'preskill') to get consistent color
          const characterKey = (gameState.playerCharacters && gameState.playerCharacters[i]) || null;
          const color = characterKey ? getCharacterColorValue(characterKey) : getPlayerColorValue(i);
          indicator.innerHTML = CardGenerator.generateAtomIndicator(color);
          avatar.appendChild(indicator);
        }
      }
    }
  }
  
  // Deal initial cards to all players at the start of a new hand
  function dealInitialCards() {
    const gameMode = window.currentGameMode || '4';
    const cardValues = gameMode === '8' 
      ? ['A', '2', '4', '5', '6', '7', 'J', 'Q', 'K']  // No 3s in 8 reyes
      : ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K'];
    
    const suits = ['psi', 'phi', 'delta', 'theta'];
    const suitSymbols = ['ψ', 'φ', 'δ', 'θ'];
    const suitColors = ['#2ec4b6', '#a78bfa', '#ff6b6b', '#f5c518'];
    
    for (let playerIndex = 0; playerIndex < 4; playerIndex++) {
      const playerId = `player${playerIndex + 1}`;
      const cardsRow = document.querySelector(`#${playerId}-zone .cards-row`);
      if (!cardsRow) continue;
      
      const isCurrentPlayer = playerIndex === 0;
      const isTeammate = playerIndex === 2;
      
      // Deal 4 random cards to each player
      for (let cardIndex = 0; cardIndex < 4; cardIndex++) {
        const randomValue = cardValues[Math.floor(Math.random() * cardValues.length)];
        const randomSuitIndex = Math.floor(Math.random() * 4);
        
        const card = createCard(
          randomValue,
          suits[randomSuitIndex],
          suitSymbols[randomSuitIndex],
          cardIndex,
          isCurrentPlayer,
          isTeammate,
          suitColors[randomSuitIndex],
          playerIndex,
          gameMode
        );
        
        card.classList.add('card-dealing');
        card.dataset.dealOrder = (playerIndex * 4) + cardIndex;
        cardsRow.appendChild(card);
      }
    }
  }

  // Show game over panel with winner
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
  
  // Update scoreboard with current round
  function updateRoundDisplay() {
    const roundElement = document.querySelector('.stat-value');
    if (roundElement) {
      // Show the actual current round name (include PUNTO explicitly)
      roundElement.textContent = gameState.currentRound;
    }
  }

  function createPlayerZone(player, index, gameMode) {
    const zone = document.createElement('div');
    zone.className = 'player-zone';
    zone.id = `${player.id}-zone`;
    const isCurrentPlayer = player.id === 'player1';
    const displayName = player.playerName ? ` (${player.playerName})` : '';

    // Determine who starts (mano) - randomly select one player on first initialization
    if (!window.startingPlayer) {
      window.startingPlayer = `player${Math.floor(Math.random() * 4) + 1}`;
    }
    const isMano = player.id === window.startingPlayer;

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
      <div class="character-portrait">
        ${CardGenerator.generateCharacter(player.name)}
      </div>
      <div class="character-name" style="color: var(--quantum-${getCharacterColor(player.character)})">
        ${player.name}${displayName}
      </div>
      <div class="character-score" style="color: var(--quantum-${getCharacterColor(player.character)})" data-score="0">
        (0)
      </div>
      ${isMano ? `<div class="atom-indicator" title="Mano - Comienza el juego">${CardGenerator.generateAtomIndicator(getCharacterColorValue(player.character))}</div>` : ''}
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
    const suitColors = ['#2ec4b6', '#a78bfa', '#ff6b6b', '#f5c518']; // bastos(teal), espadas(purple), copas(red), oros(gold)

    const isTeammate = index === 2;


    // Timer bar (inside hand container so it aligns with cards)
    const timerBar = document.createElement('div');
    timerBar.className = `timer-bar timer-bar-player${index+1}`;
    timerBar.id = `timer-bar-player${index+1}`;
    timerBar.style.opacity = '0'; // Start hidden until timer activates
    const timerFill = document.createElement('div');
    timerFill.className = 'timer-bar-fill';
    timerFill.style.width = '100%'; // Start full width
    timerFill.style.opacity = '0'; // Start transparent
    timerBar.appendChild(timerFill);


    const cardsRow = document.createElement('div');
    cardsRow.className = 'cards-row';
    for (let i = 0; i < 4; i++) {
      const card = createCard(cardValues[i], suits[i], suitSymbols[i], i, isCurrentPlayer, isTeammate, suitColors[i], index, gameMode);
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
  // Timer initialization moved to initGame() to avoid conflicts

  // ===================== TIMER AND UI MANAGEMENT =====================
  
  // Start timer for a single player with callback on timeout
  function startPlayerTurnTimer(index, duration = 10, onTimeout = null) {
    console.log(`[startPlayerTurnTimer] Starting turn for player ${index + 1}, Round: ${gameState.currentRound}`);

    // If in PARES/JUEGO/PUNTO betting phases and this player cannot bet,
    // skip them immediately (no timer, no buttons) and move to next eligible.
    // Exception: if the declaration object for PARES/JUEGO is not yet initialized,
    // we're in the declaration phase and should NOT skip — allow the turn to run.
    const inBettingPhase = (gameState.currentRound === 'PARES' || gameState.currentRound === 'JUEGO' || gameState.currentRound === 'PUNTO');
    // Treat PARES/JUEGO as declaration-pending when their declarations map is missing
    // or when it's present but incomplete (not all players have declared).
    const declarationPending = (gameState.currentRound === 'PARES' && (!gameState.paresDeclarations || Object.keys(gameState.paresDeclarations).length < 4))
      || (gameState.currentRound === 'JUEGO' && (!gameState.juegoDeclarations || Object.keys(gameState.juegoDeclarations).length < 4));
    if (inBettingPhase && !declarationPending && !canPlayerBet(index)) {
      console.log(`[startPlayerTurnTimer] Player ${index + 1} cannot bet in ${gameState.currentRound}, skipping turn`);
      console.log(`[startPlayerTurnTimer][DEBUG] declarationPending=${declarationPending}, canPlayerBet=${canPlayerBet(index)}, currentRound=${gameState.currentRound}`);
      // Hide UI for this player
      hideTimerBar(index);
      // Advance to next eligible player
      nextPlayerWhoCanBet();
      // If after attempting to find next eligible player there still isn't one,
      // move to the next round (no betting possible) to avoid stuck loop.
      if (!canPlayerBet(gameState.activePlayerIndex)) {
        console.log('[startPlayerTurnTimer] No eligible bettors found - advancing to next round');
        setTimeout(() => moveToNextRound(), 200);
        return;
      }
      // Start timer for the new active player (small delay to allow UI update)
      setTimeout(() => startPlayerTurnTimer(gameState.activePlayerIndex, duration, onTimeout), 50);
      return;
    }
    
    // Clean card styles to ensure hover works properly
    cleanCardStyles();
    
    // Update visual feedback for active player
    updateActivePlayerHighlight(index);
    
    // Reset all timers: hide others, prepare active timer
    for (let i = 0; i < 4; i++) {
      const timerBar = document.querySelector(`#timer-bar-player${i + 1}`);
      const fill = document.querySelector(`#timer-bar-player${i + 1} .timer-bar-fill`);
      if (fill && timerBar) {
        fill.style.transition = 'none';
        fill.style.width = '100%'; // Start full
        if (i === index) {
          fill.style.opacity = '1';
          timerBar.style.opacity = '1';
          timerBar.style.visibility = 'visible';
        } else {
          fill.style.opacity = '0';
          timerBar.style.opacity = '0';
        }
      }
    }

    const fill = document.querySelector(`#timer-bar-player${index + 1} .timer-bar-fill`);
    const timerBar = document.querySelector(`#timer-bar-player${index + 1}`);
    if (!fill) {
      console.warn(`Timer bar for player ${index + 1} not found`);
      return;
    }

    // Ensure timer bar is visible before animation starts
    if (timerBar) {
      timerBar.style.opacity = '1';
      timerBar.style.visibility = 'visible';
    }
    fill.style.opacity = '1';

    // Start the animation: bar empties from 100% to 0% over duration
    setTimeout(() => {
      fill.style.transition = `width ${duration}s linear`;
      fill.style.width = '0%'; // Animate to empty
    }, 10);

    // Clear any existing timers before setting new ones
    if (timerInterval) {
      clearTimeout(timerInterval);
      timerInterval = null;
    }
    if (aiDecisionTimeout) {
      clearTimeout(aiDecisionTimeout);
      aiDecisionTimeout = null;
    }
    
    // Set timeout handler
    timerInterval = setTimeout(() => {
      // Timeout - auto action
      if (onTimeout) {
        onTimeout();
      } else {
        handleTimeout(index);
      }
    }, duration * 1000);
    
    console.log(`[startPlayerTurnTimer] Timer set for ${duration}s. Is AI player? ${index !== 0}`);
    
    // If AI player, make decision
    if (index !== 0) {
      console.log(`[startPlayerTurnTimer] Triggering AI decision for player ${index + 1}`);
      makeAIDecision(index);
    }
  }
  
  // Hide timer bar for a specific player
  function hideTimerBar(index) {
    const timerBar = document.querySelector(`#timer-bar-player${index + 1}`);
    const fill = document.querySelector(`#timer-bar-player${index + 1} .timer-bar-fill`);
    if (timerBar && fill) {
      fill.style.transition = 'none';
      fill.style.width = '0%';
      timerBar.style.opacity = '0';
      timerBar.style.visibility = 'hidden';
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
    updateButtonStates(index === 0);
  }
  
  // Enable/disable buttons based on whose turn it is
  function updateButtonStates(isLocalPlayerTurn) {
    const buttons = document.querySelectorAll('.scoreboard-controls .quantum-gate');
    
    // During CONTEO phase, all buttons should be disabled
    if (gameState.currentRound === 'CONTEO') {
      buttons.forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
        btn.style.pointerEvents = 'none';
      });
      return;
    }
    
    // Normal button state logic
    buttons.forEach(btn => {
      btn.disabled = !isLocalPlayerTurn;
      if (isLocalPlayerTurn) {
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.style.pointerEvents = 'auto';
      } else {
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
        btn.style.pointerEvents = 'none';
      }
    });
  }
  
  // Start all players' timers simultaneously
  function startAllPlayersTimer(duration = 10) {
    // Show all timer bars for simultaneous play
    for (let i = 0; i < 4; i++) {
      const timerBar = document.querySelector(`#timer-bar-player${i + 1}`);
      const fill = document.querySelector(`#timer-bar-player${i + 1} .timer-bar-fill`);
      if (fill && timerBar) {
        // Make timer bars visible
        timerBar.style.opacity = '1';
        timerBar.style.visibility = 'visible';
        fill.style.opacity = '1';
        fill.style.transition = 'none';
        fill.style.width = '100%'; // Start full
        
        // Start animation after a frame
        requestAnimationFrame(() => {
          fill.style.transition = `width ${duration}s linear`;
          fill.style.width = '0%'; // Empty to 0%
        });
      }
    }
    
    if (timerInterval) clearTimeout(timerInterval);
    timerInterval = setTimeout(() => {
      // All timers expired - auto discard all cards for players who haven't acted
      handleAllPlayersTimeout();
    }, duration * 1000);

    // Failsafe: set per-AI fallback timeouts in case AI-specific timeouts fail (works across hands)
    try {
      const localIdx = window.currentLocalPlayerIndex ?? 0;
      gameState.autoDiscardTimeouts = gameState.autoDiscardTimeouts || {};
      // Clear any previous per-AI timeouts first
      Object.keys(gameState.autoDiscardTimeouts).forEach(k => {
        try { clearTimeout(gameState.autoDiscardTimeouts[k]); } catch (e) {}
        delete gameState.autoDiscardTimeouts[k];
      });
      for (let i = 0; i < 4; i++) {
        if (i === localIdx) continue; // local player handled by UI
        // Schedule a fallback discard slightly after the global timer
        const id = setTimeout(() => {
          try {
            if (!gameState.cardsDiscarded || !gameState.cardsDiscarded[i]) {
              console.log(`[FAILSAFE DISCARD] Auto-discarding player ${i + 1} (failsafe)`);
              handleDiscard(i, [0,1,2,3]);
            }
          } catch (e) { console.warn('Failsafe discard failed', e); }
        }, (duration * 1000) + 300);
        gameState.autoDiscardTimeouts[i] = id;
      }
    } catch (e) {
      console.warn('Failed to setup autoDiscardTimeouts', e);
    }
    
    // No immediate auto-discard. Only the 10s timer triggers auto-discard for all players.
  }
  
  // Show mus courtesy message (2 seconds before timer starts)
  function showMusCourtesyMessage() {
    const courtesy = document.createElement('div');
    courtesy.id = 'mus-courtesy';
    courtesy.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(46, 196, 182, 0.9);
      padding: 40px 80px;
      border-radius: 20px;
      font-size: 2.5rem;
      font-weight: bold;
      color: white;
      z-index: 200;
      text-align: center;
      font-family: Georgia, serif;
      letter-spacing: 3px;
      animation: pulseCourtesy 2s ease-in-out forwards;
      box-shadow: 0 0 40px rgba(46, 196, 182, 0.5);
    `;
    courtesy.textContent = 'RONDA DE MUS';
    document.body.appendChild(courtesy);
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulseCourtesy {
        0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        50% { opacity: 1; }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(1.2); }
      }
    `;
    document.head.appendChild(style);
    
    // Remove after animation
    setTimeout(() => {
      if (courtesy.parentNode) courtesy.remove();
    }, 2000);
  }
  
  // Handle timeout for a player
  function handleTimeout(playerIndex) {
    console.log(`[TIMEOUT] Player ${playerIndex + 1} in round ${gameState.currentRound}`);
    
    // Ensure we clear the AI decision timeout to prevent double execution
    if (aiDecisionTimeout) {
      clearTimeout(aiDecisionTimeout);
      aiDecisionTimeout = null;
    }
    
    if (gameState.waitingForDiscard) {
      // Auto discard all cards
      console.log(`[TIMEOUT] Auto-discarding all cards for player ${playerIndex + 1}`);
      handleDiscard(playerIndex, [0, 1, 2, 3]);
    } else if (gameState.currentRound === 'MUS') {
      // Auto assume mus - don't end the round
      console.log(`[TIMEOUT] Auto-MUS for player ${playerIndex + 1}`);
      handleMusRound(playerIndex, 'mus');
    } else if (gameState.currentRound === 'GRANDE' || gameState.currentRound === 'CHICA' || 
               gameState.currentRound === 'PARES' || gameState.currentRound === 'JUEGO') {
      // Timeout in betting rounds = PASO
      console.log(`[TIMEOUT] Auto-PASO for player ${playerIndex + 1} in ${gameState.currentRound} round`);
      handleBettingRound(playerIndex, 'paso', 0);
    } else if (gameState.currentRound === 'PUNTO') {
      // Auto paso in PUNTO round
      console.log(`[TIMEOUT] Auto-PASO for player ${playerIndex + 1} in PUNTO round`);
      handleBettingRound(playerIndex, 'paso', 0);
    } else {
      // Unknown round - default to paso
      console.log(`[TIMEOUT] Unknown round ${gameState.currentRound}, defaulting to PASO`);
      handleBettingRound(playerIndex, 'paso', 0);
    }
  }
  
  // AI player decision making
  function makeAIDecision(playerIndex) {
    console.log(`[AI DECISION] Starting decision for player ${playerIndex + 1} in round ${gameState.currentRound}`);
    console.log(`[AI DECISION] Active player: ${gameState.activePlayerIndex + 1}, Expected: ${playerIndex + 1}`);
    
    // Clear any previous AI timeout to prevent duplicates
    if (aiDecisionTimeout) {
      console.log(`[AI DECISION] Clearing previous timeout`);
      clearTimeout(aiDecisionTimeout);
    }
    
    // If there's an active pending bet and this AI needs to respond,
    // reject immediately (paso) to ensure instant rejection of bets.
    try {
      const responsesImmediate = gameState.currentBet && gameState.currentBet.responses;
      const hasPendingImmediateBet = gameState.currentBet && !responsesImmediate?.[playerIndex];
      if (hasPendingImmediateBet && gameState.currentBet.bettingTeam && !responsesImmediate[playerIndex]) {
        console.log(`[AI DECISION] Instant reject - Player ${playerIndex + 1} PASO (pending bet)`);
        handleBettingRound(playerIndex, 'paso');
        return;
      }
    } catch (e) {
      console.warn('[AI DECISION] Error checking immediate bet response', e);
    }

    // Choose AI thinking delay: faster during JUEGO declaration to match 2s pacing
    const aiDelay = (gameState.currentRound === 'JUEGO' && gameState.juegoDeclarations) ? 1000 : 3000;
    aiDecisionTimeout = setTimeout(() => {
      console.log(`[AI DECISION] Executing - Player ${playerIndex + 1} deciding in ${gameState.currentRound}`);
      console.log(`[AI DECISION] Current state - activePlayerIndex: ${gameState.activePlayerIndex}, waitingForDiscard: ${gameState.waitingForDiscard}`);

      // Verify this is still the active player (game state may have changed)
      if (gameState.activePlayerIndex !== playerIndex) {
        console.log(`[AI DECISION] Ignoring - player ${playerIndex + 1} is no longer active (current: ${gameState.activePlayerIndex + 1})`);
        aiDecisionTimeout = null;
        return;
      }

      // If we're in PARES declaration phase, AI should declare only when it's their turn
      if (gameState.currentRound === 'PARES' && gameState.paresDeclarations) {
        if (gameState.activePlayerIndex !== playerIndex) {
          console.log(`[AI DECISION] PARES declaration - not this player's turn (${playerIndex + 1}), skipping`);
          aiDecisionTimeout = null;
          return;
        }

        // Try auto-declare first
        const autoPares = shouldAutoDeclarePares(playerIndex) ? getAutoParesDeclaration(playerIndex) : null;
        if (autoPares !== null) {
          console.log(`[AI PARES] Auto-declare for player ${playerIndex + 1}: ${autoPares}`);
          handleParesDeclaration(playerIndex, autoPares, true);
          aiDecisionTimeout = null;
          return;
        }

        // Uncertain outcome - choose among 'puede', true (tengo), or false (no tengo)
        const rP = Math.random();
        let finalParesDecl;
        if (rP < 0.4) finalParesDecl = 'puede';
        else if (rP < 0.7) finalParesDecl = true;
        else finalParesDecl = false;
        console.log(`[AI PARES] Player ${playerIndex + 1} uncertain - declaring ${finalParesDecl}`);
        handleParesDeclaration(playerIndex, finalParesDecl, false);
        aiDecisionTimeout = null;
        return;
      }

      // If we're in JUEGO declaration phase, AI should declare only when it's their turn
      if (gameState.currentRound === 'JUEGO' && gameState.juegoDeclarations) {
        if (gameState.activePlayerIndex !== playerIndex) {
          console.log(`[AI DECISION] JUEGO declaration - not this player's turn (${playerIndex + 1}), skipping`);
          aiDecisionTimeout = null;
          return;
        }
        // Use any pre-declaration from PARES first, otherwise attempt auto-declare
        let autoResult = null;
        if (gameState.preJuegoDeclarations && gameState.preJuegoDeclarations[playerIndex] !== undefined) {
          autoResult = gameState.preJuegoDeclarations[playerIndex];
        } else {
          autoResult = autoDeclareJuego(playerIndex);
        }

        if (autoResult !== null) {
          // Certain outcome - treat as auto-declared (no collapse animation)
          console.log(`[AI JUEGO] Auto-declare certain outcome for player ${playerIndex + 1}: ${autoResult}`);
          handleJuegoDeclaration(playerIndex, autoResult, true);
          aiDecisionTimeout = null;
          return;
        }

        // Uncertain outcome - AI must pick a declaration as a deliberate choice (not auto)
        // Build card values and entangled info like updateScoreboard does
        const playerId = `player${playerIndex + 1}`;
        const cardEls = document.querySelectorAll(`#${playerId}-zone .quantum-card`);
        const cardValues = [];
        const entangledInfo = [];
        cardEls.forEach((card, idx) => {
          const isCollapsed = card.dataset.collapsed === 'true';
          const decoration = card.querySelector('.quantum-decoration');
          let value = decoration ? decoration.textContent.trim() : (card.dataset.value || card.dataset.mainValue);
          if (isCollapsed) {
            const cardTop = card.querySelector('.card-top');
            if (cardTop && cardTop.textContent.includes('⟩')) {
              const match = cardTop.textContent.match(/\|(\w+)⟩/);
              value = match ? match[1] : value;
            }
          }
          cardValues.push(value);
          if (card.dataset.entangled === 'true' && card.dataset.collapsed !== 'true') {
            entangledInfo.push({ index: idx, value1: value, value2: card.dataset.partner });
          }
        });

        const gameMode = window.currentGameMode || '4';
        const juegoProbStr = calculateJuegoProbability(cardValues, entangledInfo, gameMode);
        const juegoProb = parseInt(juegoProbStr, 10);

        // Decision policy: high probability -> TENGO, low -> NO TENGO, middle -> prefer 'puede'
        let finalDecl;
        if (juegoProb >= 70) finalDecl = true;
        else if (juegoProb <= 30) finalDecl = false;
        else {
          // weighted choice preferring 'puede'
          const r = Math.random();
          if (r < 0.6) finalDecl = 'puede';
          else if (r < 0.8) finalDecl = true;
          else finalDecl = false;
        }

        console.log(`[AI JUEGO] Player ${playerIndex + 1} uncertain - prob ${juegoProb} -> declaring ${finalDecl}`);
        // Treat this as a manual/intentional declaration (isAutoDeclared = false)
        handleJuegoDeclaration(playerIndex, finalDecl, false);
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
        // In betting rounds - if a bet is pending, accept; otherwise, always paso
        const responses = gameState.currentBet && gameState.currentBet.responses;
        const hasPendingBet = gameState.currentBet && !responses?.[playerIndex];
        if (hasPendingBet && gameState.currentBet.bettingTeam && !responses[playerIndex]) {
          console.log(`[AI] Player ${playerIndex + 1} accepts in ${gameState.currentRound}`);
          handleBettingRound(playerIndex, 'accept');
        } else {
          // Normal betting action: paso
          console.log(`[AI] Player ${playerIndex + 1} PASO in ${gameState.currentRound}`);
          handleBettingRound(playerIndex, 'paso');
        }
      } else {
        // Default to paso for unknown rounds
        console.log(`[AI] Player ${playerIndex + 1} unknown round ${gameState.currentRound}, passing`);
        handleBettingRound(playerIndex, 'paso');
      }
      aiDecisionTimeout = null; // Clear reference after execution
    }, aiDelay); // AI thinking delay (ms)
  }
  
  // Handle timeout when all players' timers expire
  function handleAllPlayersTimeout() {
    console.log('[TIMEOUT] All players timeout - auto-discarding remaining cards');
    
    // Remove discard button if it exists
    const discardBtn = document.getElementById('discard-button');
    if (discardBtn) {
      discardBtn.remove();
    }
    
    // Show timeout notification
    showTimeoutNotification('¡TIEMPO AGOTADO! Descartando todas las cartas...');
    
    // Auto discard for any player who hasn't discarded yet
    for (let i = 0; i < 4; i++) {
      if (!gameState.cardsDiscarded[i]) {
        console.log(`[TIMEOUT] Auto-discarding all cards for player ${i + 1}`);
        handleDiscard(i, [0, 1, 2, 3]);
      }
    }
  }
  
  // Show timeout notification
  function showTimeoutNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'timeout-notification';
    notification.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(100, 100, 100, 0.95);
      color: white;
      padding: 30px 60px;
      border-radius: 15px;
      font-size: 2rem;
      font-weight: bold;
      z-index: 1000;
      text-align: center;
      box-shadow: 0 0 30px rgba(100, 100, 100, 0.6);
      animation: pulseNotification 0.5s ease-out;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Remove after 1.5 seconds (faster since it's automatic)
    setTimeout(() => {
      notification.style.transition = 'opacity 0.5s ease-out';
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 500);
    }, 1500);
  }
  
  // Show discard UI for all players
  function showDiscardUI() {
    // For all players, allow card selection for discard
    for (let i = 0; i < 4; i++) {
      const playerId = `player${i + 1}`;
      const cards = document.querySelectorAll(`#${playerId}-zone .quantum-card`);
      
      cards.forEach((card, cardIndex) => {
        // Clean all previous styles from any previous discard phase
        card.style.transform = '';
        card.style.filter = '';
        card.style.opacity = '';
        card.style.transition = '';
        card.classList.remove('card-dealing', 'card-dealt');
        
        // Remove any overlay from previous selection
        const oldOverlay = card.querySelector('.discard-overlay');
        if (oldOverlay) oldOverlay.remove();
        
        // Reset selection state
        card.classList.add('selectable');
        card.dataset.selected = 'false';
        
        // Remove the default click handler that shows card details
        card.onclick = null;
        
        // Add new click handler only for local player's cards
        if (i === 0) {
          card.onclick = (e) => {
            e.stopPropagation();
            toggleCardSelection(card);
          };
        }
      });
    }
    
    // Show discard button for local player
    showDiscardButton();
  }
  
  // Toggle card selection for discard with visual feedback
  function toggleCardSelection(card) {
    const isSelected = card.dataset.selected === 'true';
    card.dataset.selected = isSelected ? 'false' : 'true';
    
    if (isSelected) {
      // Deselect: remove gray overlay and X
      card.style.transform = 'translateY(0)';
      card.style.filter = '';
      // Remove X overlay if it exists
      const overlay = card.querySelector('.discard-overlay');
      if (overlay) overlay.remove();
    } else {
      // Select: add gray overlay and X
      card.style.transform = 'translateY(-15px)';
      card.style.filter = 'grayscale(100%) brightness(0.3)';
      
      // Add X overlay
      let overlay = card.querySelector('.discard-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'discard-overlay';
        overlay.style.cssText = `
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 4rem;
          color: #888888;
          font-weight: 900;
          text-shadow: 0 0 10px rgba(0, 0, 0, 0.6);
          z-index: 10;
          pointer-events: none;
        `;
        overlay.textContent = '✕';
        card.appendChild(overlay);
      }
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
      // Get selected cards
      const selectedCards = [];
      const cards = document.querySelectorAll('#player1-zone .quantum-card');
      cards.forEach((card, index) => {
        if (card.dataset.selected === 'true') {
          selectedCards.push(index);
        }
      });
      
      // If no cards selected, select all cards (same as discarding all)
      const cardsToDiscard = selectedCards.length === 0 ? [0, 1, 2, 3] : selectedCards;
      
      // Disable discard button
      discardBtn.disabled = true;
      discardBtn.style.opacity = '0.5';
      
      // Discard selected cards - keep them gray
      handleDiscard(0, cardsToDiscard);
      
      // Remove discard button
      discardBtn.remove();
    };
    
    document.body.appendChild(discardBtn);
  }
  
  // Deal new cards after discard
  function dealNewCards() {
    console.log('[DEAL NEW CARDS] Starting card replacement, discarded:', gameState.cardsDiscarded);
    
    // Hide all timer bars
    for (let i = 0; i < 4; i++) {
      const timerBar = document.querySelector(`#timer-bar-player${i + 1}`);
      const fill = document.querySelector(`#timer-bar-player${i + 1} .timer-bar-fill`);
      if (timerBar && fill) {
        fill.style.transition = 'none';
        fill.style.width = '0%';
        timerBar.style.opacity = '0';
        timerBar.style.visibility = 'hidden';
      }
    }
    
    // For each player, replace discarded cards with new ones
    for (let i = 0; i < 4; i++) {
      const playerId = `player${i + 1}`;
      const cardsToDiscard = gameState.cardsDiscarded[i] || [];
      const playerZone = document.getElementById(`${playerId}-zone`);
      if (!playerZone) continue;
      
      const cardsRow = playerZone.querySelector('.cards-row');
      if (!cardsRow) continue;
      
      const cardElements = Array.from(cardsRow.querySelectorAll('.quantum-card'));
      
      console.log(`[DEAL NEW CARDS] Player ${i + 1}: discarding ${cardsToDiscard.length} cards at indices:`, cardsToDiscard);
      
      // Fade out discarded cards
      cardsToDiscard.forEach(cardIndex => {
        if (cardElements[cardIndex]) {
          cardElements[cardIndex].style.transition = 'opacity 0.5s ease-out';
          cardElements[cardIndex].style.opacity = '0';
        }
      });
      
      // Remove discarded cards and add new ones after 1 second delay
      setTimeout(() => {
        const updatedCardElements = Array.from(cardsRow.querySelectorAll('.quantum-card'));
        
        // Remove discarded cards (in reverse order to avoid index shifting)
        cardsToDiscard.sort((a, b) => b - a).forEach(cardIndex => {
          if (updatedCardElements[cardIndex]) {
            updatedCardElements[cardIndex].remove();
          }
        });
        
        // Generate new random cards to replace the discarded ones
        const gameMode = window.currentGameMode || '4';
        const cardValues = gameMode === '8' 
          ? ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K']
          : ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K'];
        
        const suits = ['psi', 'phi', 'delta', 'theta'];
        const suitColors = ['#2ec4b6', '#a78bfa', '#ff6b6b', '#f5c518']; // bastos(teal), espadas(purple), copas(red), oros(gold)
        const suitSymbols = ['ψ', 'φ', 'δ', 'θ'];
        
        // Create replacement cards in the correct positions
        console.log(`[DEAL NEW CARDS] Player ${i + 1}: creating ${cardsToDiscard.length} new cards`);
        for (let discardIdx of cardsToDiscard) {
          const randomValue = cardValues[Math.floor(Math.random() * cardValues.length)];
          const randomSuit = Math.floor(Math.random() * 4);
          const suit = suits[randomSuit];
          const suitColor = suitColors[randomSuit];
          const suitSymbol = suitSymbols[randomSuit];
          
          // Create card with proper parameters
          const isCurrentPlayer = (i === 0); // Player 1 is local player
          const isTeammate = (i === 2); // Players 0 and 2 are teammates
          const newCard = createCard(randomValue, suit, suitSymbol, discardIdx, isCurrentPlayer, isTeammate, suitColor, i, gameMode);
          newCard.classList.add('card-dealing');
          newCard.style.animationDelay = `${discardIdx * 0.1}s`;
          newCard.style.opacity = '0';
          cardsRow.appendChild(newCard);
          
          console.log(`[DEAL NEW CARDS] Player ${i + 1}: added new card ${randomValue} at index ${discardIdx}`);
          
          // Animate appearing
          setTimeout(() => {
            newCard.style.transition = 'opacity 0.5s ease-in';
            newCard.style.opacity = '1';
            newCard.classList.remove('card-dealing');
            newCard.classList.add('card-dealt');
            
            // Restore normal transition after animation completes
            setTimeout(() => {
              newCard.style.transition = '';
            }, 500);
          }, 50);
        }
        
        // Clean up remaining cards and animate them appearing
        const remainingCards = cardsRow.querySelectorAll('.quantum-card');
        remainingCards.forEach((card, idx) => {
          card.classList.remove('selectable');
          card.dataset.selected = 'false';
          card.style.transform = '';
          card.style.filter = '';
          card.onclick = null;
          const overlay = card.querySelector('.discard-overlay');
          if (overlay) overlay.remove();
          
          // Apply appearing animation to remaining cards (like the new ones)
          card.classList.add('card-dealt');
          card.style.transition = 'opacity 0.5s ease-in';
          card.style.opacity = '1';
          
          // Restore normal transition after animation completes
          setTimeout(() => {
            card.style.transition = '';
          }, 500);
        });
      }, 1000);
    }
    
    // After all cards are dealt, show the quantum gate buttons again and remove discard button
    setTimeout(() => {
      const controls = document.querySelector('.scoreboard-controls');
      if (controls) {
        controls.style.display = 'flex';
      }
      const discardBtn = document.getElementById('discard-button');
      if (discardBtn) {
        discardBtn.remove();
      }
      
      // Clean card styles to ensure hover works after dealing
      cleanCardStyles();
      
      // Match entangled cards between player1 and player3
      matchEntangledCards();
      
      // Update scoreboard with new probabilities
      updateScoreboard();
      
      console.log('[DEAL NEW CARDS] Complete - cards replaced and UI updated');
    }, 1100);
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
    // Get entangled and superposed cards from player1 (my hand)
    const player1Cards = document.querySelectorAll('#player1-zone .quantum-card');
    const player1Entangled = new Set();
    const player1Superposed = new Set();
    
    player1Cards.forEach(card => {
      if (card.dataset.entangled === 'true') {
        player1Entangled.add(card.dataset.partner);
      }
      if (card.dataset.superposed === 'true') {
        player1Superposed.add(card.dataset.value2);
      }
    });
    
    if (player1Entangled.size === 0 && player1Superposed.size === 0) return;
    
    // Teammate is at player3 (index 2, top position)
    const teammateCards = document.querySelectorAll('#player3-zone .quantum-card');
    
    teammateCards.forEach(card => {
      const mainValue = card.dataset.mainValue;
      
      // Solo iluminar borde cuando está entrelazada con una mía (no superpuesta)
      if (card.classList.contains('entangled-candidate')) {
        if (mainValue && player1Entangled.has(mainValue)) {
          card.classList.remove('entangled-candidate');
          card.classList.add('entangled-card');
          card.style.setProperty('--entangle-color', card.dataset.suitColor);
        } else {
          card.classList.remove('entangled-candidate');
        }
      }
      
      if (card.classList.contains('superposed-candidate')) {
        card.classList.remove('superposed-candidate');
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
    card.dataset.suit = suit;  // Store suit for all cards
    
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
    let isSuperposed = false;
    
    // ONLY A and K are ALWAYS entangled with each other (in both 4 and 8 reyes)
    // In 8 reyes mode: 2 and 3 are also entangled with each other
    // J and Q are NEVER entangled
    const is8Reyes = gameMode === '8';
    if (value === 'A' || value === 'K') {
      isEntangled = true;
    } else if (is8Reyes && (value === '2' || value === '3')) {
      isEntangled = true;
    }
    // Superposition disabled - all other cards (including J, Q) are regular
    
    const cardValues = ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K'];
    let entangledPartner = '';
    let superposedValue = '';
    let coefficientA = 0;
    let coefficientB = 0;
    
    if (isEntangled) {
      if (value === 'A') {
        entangledPartner = 'K';
      } else if (value === 'K') {
        entangledPartner = 'A';
      } else if (value === '2') {
        entangledPartner = '3';
      } else if (value === '3') {
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
    } else {
      // Non-entangled cards also need their value stored
      card.dataset.value = value;
      card.dataset.entangled = 'false';
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
      
      if (isEntangled) {
        topLabel.innerHTML = `|${value}⟩`;
      } else {
        topLabel.innerHTML = `|${value}⟩`;
      }
      card.appendChild(topLabel);

      // Bottom left label - siempre mostrar otro número (boca arriba)
      const bottomLabel = document.createElement('div');
      bottomLabel.className = `dirac-label card-bottom${(playerIndex === 1 || playerIndex === 3) ? ' label-flipped' : ''}`;
      bottomLabel.style.color = suitColor;
      
      if (isEntangled && entangledPartner) {
        // Para entrelazadas: mostrar el partner
        bottomLabel.innerHTML = `|${entangledPartner}⟩`;
      } else {
        // Para normales: mostrar el mismo valor
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
      let blochParams = [];
      
      if (isEntangled) {
        state = 'entangled';
        bloch.innerHTML = CardGenerator.generateBlochSphere(state, true, value, entangledPartner, 0, 0, suitColor);
      } else {
        // Regular card: random up or down
        state = Math.random() > 0.5 ? 'up' : 'down';
        bloch.innerHTML = CardGenerator.generateBlochSphere(state, false, '0', '1', 0, 0, suitColor);
      }
      card.appendChild(bloch);

      // Quantum decoration
      const decoration = document.createElement('div');
      decoration.className = 'quantum-decoration';
      decoration.textContent = value;
      card.appendChild(decoration);



      // Particle effect for entangled cards
      if (isEntangled) {
        for (let i = 0; i < 6; i++) {
          const particle = document.createElement('div');
          particle.className = 'entangle-particle';
          particle.style.setProperty('--particle-delay', `${i * 0.15}s`);
          particle.style.setProperty('--particle-color', suitColor);
          card.appendChild(particle);
        }
      }
    }

    // Card click interaction
    card.addEventListener('click', () => {
      // Don't show details during discard phase
      if (card.classList.contains('selectable')) {
        return;
      }
      showCardDetails(value, suit, suitSymbol, isCurrentPlayer, suitColor, isEntangled, entangledPartner, isSuperposed, superposedValue, coefficientA, coefficientB);
    });

    return card;
  }

  function createScoreboard() {
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
    const entangledInfo = []; // Track entangled cards
    const superposedInfo = []; // Track superposed cards
    
    player1Cards.forEach((card, idx) => {
      // Extract the main card value from quantum-decoration element
      const decoration = card.querySelector('.quantum-decoration');
      if (decoration) {
        const value = decoration.textContent.trim();
        cardValues.push(value);
        
        // Only include cards in entangledInfo if they haven't collapsed yet
        if (card.dataset.entangled === 'true' && card.dataset.collapsed !== 'true') {
          entangledInfo.push({
            index: idx,
            value1: value,
            value2: card.dataset.partner
          });
        }
        
        // Only include cards in superposedInfo if they haven't collapsed yet
        if (card.dataset.superposed === 'true' && card.dataset.collapsed !== 'true') {
          superposedInfo.push({
            index: idx,
            value1: value,
            value2: card.dataset.superposedValue
          });
        }
      }
    });
    
    const paresProb = calculateParesProbability(cardValues, entangledInfo, superposedInfo);
    const juegoProb = calculateJuegoProbability(cardValues, entangledInfo, gameMode);
    
    scoreboard.innerHTML = `
      <div class="scoreboard-title">Marcador Cuántico</div>
      <div class="scoreboard-teams">
        <div class="team-score">
          <div class="team-label">Copenhague<br><small>(Preskill + Zoller)</small></div>
          <div class="team-points">${team1Score}</div>
        </div>
        <div class="team-vs">VS</div>
        <div class="team-score">
          <div class="team-label">Bohmian<br><small>(Cirac + Deutsch)</small></div>
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
          <div class="stat-value">${gameState.handsPlayed}</div>
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
        <button class="quantum-gate" title="Mus: Aplicar Puerta Medida">
          M
          <div class="gate-label">MUS</div>
        </button>
        <button class="quantum-gate m-gate" title="Envido: Medir Qubits">
          H
          <div class="gate-label">ENVIDO</div>
        </button>
        <button class="quantum-gate i-gate" title="Paso: Identity Gate">
          I
          <div class="gate-label">PASO</div>
        </button>
        <button class="quantum-gate accept-gate" title="Aceptar: Acepta la apuesta">
          ✓
          <div class="gate-label">ACEPTA</div>
        </button>
        <button class="quantum-gate ordago-gate" title="ORDAGO: Apuesta Máxima">
          CX
          <div class="gate-label">ORDAGO</div>
        </button>
      </div>
    `;
    gameContainer.appendChild(scoreboard);

    // Add button interactions - bind by class to avoid index/order issues
    const musBtn = scoreboard.querySelector('.scoreboard-controls .quantum-gate:not(.m-gate):not(.i-gate):not(.accept-gate):not(.ordago-gate)');
    const envidoBtn = scoreboard.querySelector('.quantum-gate.m-gate');
    const pasoBtn = scoreboard.querySelector('.quantum-gate.i-gate');
    const acceptBtn = scoreboard.querySelector('.quantum-gate.accept-gate');
    const ordagoBtn = scoreboard.querySelector('.quantum-gate.ordago-gate');

    if (musBtn) musBtn.onclick = () => {
      if (gameState.activePlayerIndex === 0) {
        if (gameState.currentRound === 'MUS') {
          handleMusRound(gameState.activePlayerIndex, 'mus');
        } else if (gameState.currentRound === 'PARES' && !gameState.paresDeclarations.hasOwnProperty(0)) {
          handleParesDeclaration(0, true);
        } else if (gameState.currentRound === 'JUEGO' && !gameState.juegoDeclarations.hasOwnProperty(0)) {
          handleJuegoDeclaration(0, true);
        }
      }
    };

    if (envidoBtn) envidoBtn.onclick = () => {
      if (gameState.activePlayerIndex === 0) {
        if (gameState.currentRound === 'PARES' && !gameState.paresDeclarations.hasOwnProperty(0)) {
          handleParesDeclaration(0, false);
        } else if (gameState.currentRound === 'JUEGO' && !gameState.juegoDeclarations.hasOwnProperty(0)) {
          handleJuegoDeclaration(0, false);
        } else if (gameState.currentRound === 'MUS') {
          showEnvidoModal((amount) => {
            gameState.currentBet.amount = amount;
            handleMusRound(gameState.activePlayerIndex, 'envido', { amount: amount });
          });
        } else if (gameState.currentRound === 'GRANDE' || gameState.currentRound === 'CHICA' ||
                   gameState.currentRound === 'PARES' || gameState.currentRound === 'JUEGO' || gameState.currentRound === 'PUNTO') {
          if (gameState.currentRound === 'PUNTO') {
            showPuntoModal((amount) => { handleBettingRound(0, 'raise', amount); });
          } else {
            showEnvidoModal((amount) => { handleBettingRound(0, 'raise', amount); });
          }
        }
      }
    };

    if (pasoBtn) pasoBtn.onclick = () => {
      if (gameState.activePlayerIndex === 0) {
        if (gameState.currentRound === 'PARES' && !gameState.paresDeclarations.hasOwnProperty(0)) {
          handleParesDeclaration(0, 'puede');
        } else if (gameState.currentRound === 'JUEGO' && !gameState.juegoDeclarations.hasOwnProperty(0)) {
          handleJuegoDeclaration(0, 'puede');
        } else if (gameState.currentRound === 'MUS') {
          handleMusRound(gameState.activePlayerIndex, 'paso');
        } else {
          handleBettingRound(0, 'paso');
        }
      }
    };

    if (acceptBtn) acceptBtn.onclick = () => {
      if (gameState.activePlayerIndex === 0) {
        if (gameState.currentRound === 'GRANDE' || gameState.currentRound === 'CHICA' || 
            gameState.currentRound === 'PARES' || gameState.currentRound === 'JUEGO') {
          handleBettingRound(0, 'accept');
        }
      }
    };

    if (ordagoBtn) {
      // Ensure the button appears above neighbors and captures clicks
      ordagoBtn.style.position = ordagoBtn.style.position || 'relative';
      ordagoBtn.style.zIndex = '1000';
      ordagoBtn.style.pointerEvents = 'auto';

      ordagoBtn.addEventListener('click', (e) => {
        // Prevent any other handlers from running and stop default behavior
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        if (e.stopPropagation) e.stopPropagation();
        if (e.preventDefault) e.preventDefault();

        if (gameState.activePlayerIndex === 0) {
          if (gameState.currentRound === 'MUS') {
            handleMusRound(gameState.activePlayerIndex, 'ordago');
          } else {
            handleBettingRound(0, 'ordago');
          }
        }
      }, false);

      // Also guard mousedown/touchstart to block early propagation
      ordagoBtn.addEventListener('mousedown', (e) => { e.stopPropagation(); }, true);
      ordagoBtn.addEventListener('touchstart', (e) => { e.stopPropagation(); }, true);
    }
    
    // Initialize button visibility - hide ACCEPT button initially (MUS round)
    if (acceptBtn) acceptBtn.style.display = 'none';

    // Set initial button disabled state - ALL buttons disabled at game start
    const allButtons = scoreboard.querySelectorAll('.quantum-gate');
    allButtons.forEach(btn => { btn.disabled = true; });
    
    // Initialize all timer bars to hidden
    for (let i = 0; i < 4; i++) {
      const fill = document.querySelector(`#timer-bar-player${i + 1} .timer-bar-fill`);
      if (fill) {
        fill.style.opacity = '0';
      }
    }
  }

  // Update scoreboard with current game state
  function updateScoreboard() {
    const team1ScoreEl = document.querySelector('.team-score:first-child .team-points');
    const team2ScoreEl = document.querySelector('.team-score:last-child .team-points');
    const roundEl = document.querySelector('.stat-item:first-child .stat-value');
    
    if (team1ScoreEl) team1ScoreEl.textContent = gameState.teams.team1.score;
    if (team2ScoreEl) team2ScoreEl.textContent = gameState.teams.team2.score;
    if (roundEl) roundEl.textContent = gameState.currentRound;
    
    // Recalculate and update probabilities for Pares and Juego
    const player1Cards = document.querySelectorAll('#player1-zone .quantum-card');
    const cardValues = [];
    const entangledInfo = [];
    const superposedInfo = [];
    
    player1Cards.forEach((card, idx) => {
      // Check if card has collapsed - if so, read the final value
      const isCollapsed = card.dataset.collapsed === 'true';
      const decoration = card.querySelector('.quantum-decoration');
      
      if (decoration) {
        let value;
        if (isCollapsed) {
          // Card has collapsed - read the final displayed value
          const cardTop = card.querySelector('.card-top');
          if (cardTop && cardTop.textContent.includes('⟩')) {
            // Extract value from |value⟩ format
            const match = cardTop.textContent.match(/\|(\w+)⟩/);
            value = match ? match[1] : decoration.textContent.trim();
          } else {
            value = decoration.textContent.trim();
          }
        } else {
          // Card not collapsed - read current value
          value = decoration.textContent.trim();
        }
        
        cardValues.push(value);
        
        // Only include cards in entangledInfo if they haven't collapsed yet
        if (card.dataset.entangled === 'true' && card.dataset.collapsed !== 'true') {
          entangledInfo.push({
            index: idx,
            value1: value,
            value2: card.dataset.partner
          });
        }
        
        // Only include cards in superposedInfo if they haven't collapsed yet
        if (card.dataset.superposed === 'true' && card.dataset.collapsed !== 'true') {
          superposedInfo.push({
            index: idx,
            value1: value,
            value2: card.dataset.superposedValue
          });
        }
      }
    });
    
    // Calculate new probabilities
    const gameMode = window.currentGameMode || '4';
    const paresProb = calculateParesProbability(cardValues, entangledInfo, superposedInfo);
    const juegoProb = calculateJuegoProbability(cardValues, entangledInfo, gameMode);
    
    console.log(`[UPDATE SCOREBOARD] Recalculated probabilities - Pares: ${paresProb}%, Juego: ${juegoProb}%`);
    console.log(`[UPDATE SCOREBOARD] Card values:`, cardValues, 'Entangled:', entangledInfo.length);
    
    // Update probability displays in scoreboard
    const statItems = document.querySelectorAll('.stat-item');
    statItems.forEach(item => {
      const label = item.querySelector('.stat-label');
      const value = item.querySelector('.stat-value');
      if (label && value) {
        if (label.textContent === 'Pares %') {
          const oldValue = value.textContent;
          value.textContent = `${paresProb}%`;
          
          // Only animate if value actually changed
          if (oldValue !== `${paresProb}%`) {
            // Add strong visual update effect with glow and pulse
            value.style.transition = 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
            value.style.color = '#2ec4b6';
            value.style.textShadow = '0 0 20px rgba(46, 196, 182, 1), 0 0 40px rgba(46, 196, 182, 0.5)';
            value.style.transform = 'scale(1.4)';
            value.style.fontWeight = 'bold';
            setTimeout(() => {
              value.style.color = '';
              value.style.textShadow = '';
              value.style.transform = '';
              value.style.fontWeight = '';
            }, 600);
          }
        } else if (label.textContent === 'Juego %') {
          const oldValue = value.textContent;
          value.textContent = `${juegoProb}%`;
          
          // Only animate if value actually changed
          if (oldValue !== `${juegoProb}%`) {
            // Add strong visual update effect with glow and pulse
            value.style.transition = 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
            value.style.color = '#a78bfa';
            value.style.textShadow = '0 0 20px rgba(167, 139, 250, 1), 0 0 40px rgba(167, 139, 250, 0.5)';
            value.style.transform = 'scale(1.4)';
            value.style.fontWeight = 'bold';
            setTimeout(() => {
              value.style.color = '';
              value.style.textShadow = '';
              value.style.transform = '';
              value.style.fontWeight = '';
            }, 600);
          }
        }
      }
    });
    
    // Update button labels and visibility based on current round
    const buttons = document.querySelectorAll('.scoreboard-controls .quantum-gate');
    if (buttons.length >= 5) {
      const button1Label = buttons[0].querySelector('.gate-label');
      const button2Label = buttons[1].querySelector('.gate-label');
      const button3Label = buttons[2].querySelector('.gate-label'); // PASO/NO QUIERO button
      const button4Label = buttons[3].querySelector('.gate-label'); // ACCEPT/QUIERO button
      const acceptButton = buttons[3]; // ACCEPT button
      const musButton = buttons[0]; // MUS button
      
      // Check if we're in a declaration phase (local player hasn't declared yet)
      // Declaration is in progress if we're in the declaration round and
      // not all 4 players have declared yet.
      const paresDeclaredCount = gameState.paresDeclarations ? Object.keys(gameState.paresDeclarations).length : 0;
      const juegoDeclaredCount = gameState.juegoDeclarations ? Object.keys(gameState.juegoDeclarations).length : 0;
      const inParesDeclaration = gameState.currentRound === 'PARES' && paresDeclaredCount < 4;
      const inJuegoDeclaration = gameState.currentRound === 'JUEGO' && juegoDeclaredCount < 4;
      
      // Check if there's an active bet
      const hasActiveBet = gameState.currentBet && gameState.currentBet.bettingTeam;
      const localPlayerTeam = getPlayerTeam(0);
      const isMyTeamsBet = hasActiveBet && gameState.currentBet.bettingTeam === localPlayerTeam;
      const isOpponentsBet = hasActiveBet && gameState.currentBet.bettingTeam !== localPlayerTeam;
      
      // CONTEO phase - hide all buttons
      if (gameState.currentRound === 'CONTEO') {
        musButton.style.display = 'none';
        buttons[1].style.display = 'none';
        buttons[2].style.display = 'none';
        buttons[3].style.display = 'none';
        buttons[4].style.display = 'none';
      } else if (gameState.currentRound === 'MUS') {
        // In MUS round - show MUS, ENVIDO, PASO, ORDAGO
        if (button1Label) button1Label.textContent = 'MUS';
        if (button2Label) button2Label.textContent = (gameState.currentRound === 'PUNTO' ? 'PUNTO' : 'ENVIDO');
        if (button3Label) button3Label.textContent = 'PASO';
        musButton.style.display = 'inline-flex';
        buttons[1].style.display = 'inline-flex';
        buttons[2].style.display = 'inline-flex';
        buttons[4].style.display = 'inline-flex';
        acceptButton.style.display = 'none';
      } else if (inParesDeclaration) {
        // In PARES declaration phase - show TENGO, NO TENGO, PUEDE only
        if (button1Label) button1Label.textContent = 'TENGO';
        if (button2Label) button2Label.textContent = 'NO TENGO';
        if (button3Label) button3Label.textContent = 'PUEDE';
        musButton.style.display = 'inline-flex'; // Show TENGO button
        buttons[1].style.display = 'inline-flex'; // Show NO TENGO button
        buttons[2].style.display = 'inline-flex'; // Show PUEDE button
        acceptButton.style.display = 'none'; // Hide ACCEPT during declaration
        buttons[4].style.display = 'none'; // Hide ÓRDAGO during declaration
      } else if (inJuegoDeclaration) {
        // In JUEGO declaration phase - show TENGO, NO TENGO, PUEDE only
        if (button1Label) button1Label.textContent = 'TENGO JUEGO';
        if (button2Label) button2Label.textContent = 'NO TENGO';
        if (button3Label) button3Label.textContent = 'PUEDE';
        musButton.style.display = 'inline-flex'; // Show TENGO button
        buttons[1].style.display = 'inline-flex'; // Show NO TENGO button
        buttons[2].style.display = 'inline-flex'; // Show PUEDE button
        acceptButton.style.display = 'none'; // Hide ACCEPT during declaration
        buttons[4].style.display = 'none'; // Hide ÓRDAGO during declaration
      } else if (hasActiveBet && isOpponentsBet) {
        // There's an active bet from the OPPONENT team - show response buttons only
        if (button3Label) button3Label.textContent = 'NO QUIERO';
        if (button4Label) button4Label.textContent = 'QUIERO';
        musButton.style.display = 'none'; // Hide MUS button (not in MUS round anymore)
        buttons[2].style.display = 'inline-flex'; // Show NO QUIERO (PASO)
        buttons[3].style.display = 'inline-flex'; // Show QUIERO (accept)
        
        // If ORDAGO bet, only show PASO and ACCEPT buttons
        if (gameState.currentBet.betType === 'ordago') {
          console.log('[ORDAGO RESPONSE] Only PASO and ACCEPT buttons available');
          if (button1Label) button1Label.textContent = 'ORDAGO';
          if (button2Label) button2Label.textContent = 'COUNTER';
          buttons[1].style.display = 'none'; // Hide ENVIDO/COUNTER (can't counter ORDAGO)
          buttons[4].style.display = 'none'; // Hide ÓRDAGO button (already in ORDAGO)
        } else {
          // For regular bets (ENVIDO), allow counter-raises and ÓRDAGO
          if (button1Label) button1Label.textContent = 'MUS';
          if (button2Label) button2Label.textContent = 'ENVIDO';
          buttons[1].style.display = 'inline-flex'; // Show ENVIDO (counter-raise)
          buttons[4].style.display = 'inline-flex'; // Show ÓRDAGO
        }
      } else if (hasActiveBet && isMyTeamsBet) {
        // My team has an active bet - disable all buttons, wait for opponent response
        musButton.style.display = 'none'; // Hide MUS button
        buttons[1].style.display = 'none';
        buttons[2].style.display = 'none';
        buttons[3].style.display = 'none';
        buttons[4].style.display = 'none';
      } else {
        // Default: No active bet - show betting options
        if (button1Label) button1Label.textContent = 'MUS';
        if (button2Label) button2Label.textContent = 'ENVIDO';
        if (button3Label) button3Label.textContent = 'PASO';
        musButton.style.display = 'none'; // Hide MUS button after MUS round
        buttons[1].style.display = 'inline-flex';
        buttons[2].style.display = 'inline-flex';
        buttons[4].style.display = 'inline-flex';
        
        // Hide ACCEPT button when there's no active bet
        acceptButton.style.display = 'none';
      }
    }
    
    // Always ensure buttons are enabled/disabled based on whose turn it is
    updateButtonStates(gameState.activePlayerIndex === 0);
  }
  
  // Simulate AI player decisions for offline mode
  function simulateAIDecisions(round, lastPlayerIndex) {
    console.log(`[AI] Simulating decisions for round ${round}`);
    
    // Get players who haven't acted yet
    const playersNotYetDecided = [];
    for (let i = 0; i < 4; i++) {
      if (!gameState.roundActions[i]) {
        playersNotYetDecided.push(i);
      }
    }
    
    if (playersNotYetDecided.length === 0) {
      // All players have decided
      if (round === 'MUS') {
        const allMus = Object.values(gameState.roundActions).every(a => a === 'mus');
        if (allMus) {
          console.log('All players chose MUS - starting discard phase');
          startDiscardPhase();
        }
      }
      return;
    }
    
    // Simulate next player
    const nextPlayer = playersNotYetDecided[0];
    console.log(`[AI] Simulating Player ${nextPlayer + 1}`);
    
    // AI always says MUS in MUS phase
    if (round === 'MUS') {
      setTimeout(() => {
        handleMusRound(nextPlayer, 'mus');
      }, 800 + (nextPlayer * 800));
    }
  }
  
  // Show action notification
  function showTeamPointsNotification(team, points) {
    const teamName = gameState.teams[team].name || team;
    
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, rgba(46, 196, 182, 0.95), rgba(30, 180, 150, 0.95));
      border: 2px solid #2ec4b6;
      border-radius: 15px;
      padding: 15px 30px;
      color: white;
      font-size: 1.3rem;
      font-weight: bold;
      z-index: 2000;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      opacity: 0;
      transition: opacity 0.3s;
    `;
    
    notification.textContent = `${teamName} gana ${points} punto${points !== 1 ? 's' : ''}!`;
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

  function showActionNotification(playerIndex, action, extraData = {}) {
    const amount = extraData.amount || gameState.currentBet.amount || '';
    const actionTexts = {
      'mus': 'MUS',
      'paso': 'PASO',
      'envido': `ENVIDO ${amount}`,
      'ordago': 'Órdago',
      'accept': 'QUIERO',
      'raise': `SUBE A ${amount}`,
      'pares': 'TENGO PARES',
      'no_pares': 'NO TENGO PARES',
      'puede_pares': 'puede',
      'juego': 'TENGO JUEGO',
      'no_juego': 'NO TENGO JUEGO',
      'puede_juego': 'puede'
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
    
    // Use playerActualNames if available, fallback to character names
    const playerName = (gameState.playerActualNames && gameState.playerActualNames[playerIndex]) || gameState.playerNames[playerIndex] || `Player ${playerIndex + 1}`;
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
    // Equivalencias para PARES (no para puntos):
    // 4 reyes: A, 2, 3, K son independientes (no forman pares entre sí)
    // 8 reyes: A=2 (forman par), 3=K (forman par)
    
    const gameMode = window.currentGameMode || '4';
    console.log(`[PARES PROB] Mode: ${gameMode}, Cards:`, cardValues, 'Entangled:', entangledInfo.length);
    
    const normalizeValue = (val) => {
      if (gameMode === '8') {
        if (val === 'A') return '2';  // A y 2 pueden formar par en 8 reyes
        if (val === '3') return 'K';  // 3 y K pueden formar par en 8 reyes
      }
      return val;
    };
    
    // Si no hay cartas entrelazadas (todas colapsadas), es simple - 0% o 100%
    if (entangledInfo.length === 0) {
      const valueCounts = {};
      cardValues.forEach(val => {
        const normalized = normalizeValue(val);
        valueCounts[normalized] = (valueCounts[normalized] || 0) + 1;
      });
      
      console.log(`[PARES PROB] No entanglement - Value counts:`, valueCounts);
      
      for (let val in valueCounts) {
        if (valueCounts[val] >= 2) {
          console.log(`[PARES PROB] Found pair of ${val}, returning 100%`);
          return '100'; // Tiene pares con certeza
        }
      }
      console.log(`[PARES PROB] No pairs found, returning 0%`);
      return '0'; // No tiene pares con certeza
    }
    
    // Si hay cartas entrelazadas, calcular todas las combinaciones posibles
    const cardValuesWithoutEntangled = cardValues.filter((_, idx) => {
      return !entangledInfo.some(e => e.index === idx);
    });
    
    // Obtener índices de cartas entrelazadas
    const entangledIndices = entangledInfo.map(e => e.index);
    
    // Generar todas las combinaciones posibles de colapso de cartas entrelazadas
    const numEntangled = entangledInfo.length;
    const totalCombinations = Math.pow(2, numEntangled);
    let combinationsWithPairs = 0;
    
    for (let combination = 0; combination < totalCombinations; combination++) {
      const testValues = [...cardValuesWithoutEntangled];
      
      // Para cada carta entrelazada, agregar su valor según la combinación
      entangledInfo.forEach((entangled, idx) => {
        const bit = (combination >> idx) & 1;
        const value = bit === 0 ? entangled.value1 : entangled.value2;
        testValues.push(value);
      });
      
      // Contar cartas normalizadas en esta combinación
      const valueCounts = {};
      testValues.forEach(val => {
        const normalized = normalizeValue(val);
        valueCounts[normalized] = (valueCounts[normalized] || 0) + 1;
      });
      
      // Verificar si esta combinación tiene pares
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
    
    // Calcular porcentaje
    const probability = Math.round((combinationsWithPairs / totalCombinations) * 100);
    return probability.toString();
  }

  function calculateJuegoProbability(cardValues, entangledInfo = [], gameMode = '4') {
    // Valores de PUNTO para calcular suma (no equivalencias de pares):
    // A = 1, 2 = 2 (4 reyes) o 1 (8 reyes), 3 = 3 (4 reyes) o 10 (8 reyes), J/Q/K = 10
    const getCardPoints = (val) => {
      if (val === 'A') return 1;
      if (val === '2') return gameMode === '4' ? 2 : 1;
      if (val === '3') return gameMode === '4' ? 3 : 10;
      if (val === 'J') return 10;
      if (val === 'Q') return 10;
      if (val === 'K') return 10;
      return parseInt(val) || 0;
    };
    
    // If no entangled cards (all collapsed), just check if sum >= 31
    if (entangledInfo.length === 0) {
      const sum = cardValues.reduce((acc, val) => acc + getCardPoints(val), 0);
      console.log(`[JUEGO PROB] No entanglement - Sum: ${sum}`);
      // Return 100% if sum >= 31, otherwise 0%
      return sum >= 31 ? '100' : '0';
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

  function showCardDetails(value, suit, symbol, isCurrentPlayer, suitColor, isEntangled, entangledPartner, isSuperposed = false, superposedValue = '', coeffA = 0, coeffB = 0) {
    if (!isCurrentPlayer) {
      // Cannot reveal hidden cards
      return;
    }
    
    const modal = createModal('#2ec4b6');
    
    let cardInfo = '';
    let stateLabel = '';
    let stateColor = '#2ec4b6';
    
    if (isSuperposed) {
      // Para cartas superpuestas: mostrar probabilidades
      const prob1 = (coeffA * coeffA * 100).toFixed(1);
      const prob2 = (coeffB * coeffB * 100).toFixed(1);
      
      stateLabel = 'Superposición';
      stateColor = '#a78bfa';
      cardInfo = `<div style="color: var(--paper-beige); font-size: 1rem; margin-bottom: 20px;">
        <strong>Estado Cuántico:</strong><br>
        ${coeffA.toFixed(2)}|${value}⟩ + ${coeffB.toFixed(2)}|${superposedValue}⟩<br><br>
        <strong>Probabilidades:</strong><br>
        |${value}⟩: <strong>${prob1}%</strong><br>
        |${superposedValue}⟩: <strong>${prob2}%</strong>
      </div>`;
    } else if (isEntangled) {
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
        if (btn.dataset.type === 'slider') {
          const value = parseInt(slider.value);
          closeModal(modal);
          if (callback) {
            callback(value);
          } else {
            applyQuantumGate('Envido', `¡Has cantado envido por ${value} puntos!`, '#a78bfa');
          }
        } else {
          const value = parseInt(btn.dataset.value);
          closeModal(modal);
          if (callback) {
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
        <p style="color: var(--circuit-blueprint); font-size: 1.2rem; margin-bottom: 30px; line-height: 1.8;">
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
    
    // Only show animation for player 1 (index 0)
    const showAnimation = playerIndex === 0;
    
    // Trigger collapse (with or without animation)
    if (showAnimation) {
      window.quantumCollapse.collapseMultipleCards(cardsToCollapse, () => {
        // After collapse, check if prediction was correct
        checkPredictionPenalty(playerIndex, roundName, declaration);
        
        // Also collapse partner cards in other players' hands
        collapsePartnerCards(cardsToCollapse, playerIndex);
        
        // Update scoreboard to reflect new probabilities (always, not just for player 0)
        updateScoreboard();
      });
    } else {
      // No animation - just update card states directly
      cardsToCollapse.forEach(({ cardElement, finalValue }) => {
        convergeSuperpositionToFinal(cardElement, finalValue);
        cardElement.dataset.collapsed = 'true';
        cardElement.dataset.value = finalValue;
        cardElement.dataset.entangled = 'false';
        delete cardElement.dataset.mainValue;
        delete cardElement.dataset.partner;
      });
      
      // After collapse, check if prediction was correct
      checkPredictionPenalty(playerIndex, roundName, declaration);
      
      // Also collapse partner cards in other players' hands
      collapsePartnerCards(cardsToCollapse, playerIndex);
      
      // Update scoreboard
      updateScoreboard();
    }
  }
  
  /**
   * Collapse cards when a player accepts/makes a bet after saying "puede"
   * @param {number} playerIndex - Player who accepted/made the bet
   * @param {string} roundName - 'PARES' or 'JUEGO'
   */
  function collapseOnBetAcceptance(playerIndex, roundName) {
    console.log(`[COLLAPSE ON BET] Player ${playerIndex + 1} collapsing for ${roundName}`);
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
      console.log(`[COLLAPSE ON BET] No entangled cards to collapse`);
      updateScoreboard(); // Still update scoreboard
      return; // No entangled cards to collapse
    }
    
    console.log(`[COLLAPSE ON BET] Collapsing ${cardsToCollapse.length} cards`);
    
    // Only show animation for player 1 (index 0)
    const showAnimation = playerIndex === 0;
    
    // Collapsing in PARES affects JUEGO auto-declarations
    const shouldCheckJuego = roundName === 'PARES';
    
    // Trigger collapse (with or without animation)
    if (showAnimation) {
      window.quantumCollapse.collapseMultipleCards(cardsToCollapse, () => {
        console.log(`[COLLAPSE ON BET] Animation complete, updating partner cards`);
        
        // Explicitly ensure all collapsed cards have proper dataset values
        cardsToCollapse.forEach(({ cardElement, finalValue }) => {
          cardElement.dataset.collapsed = 'true';
          cardElement.dataset.value = finalValue;
          cardElement.dataset.entangled = 'false';
          delete cardElement.dataset.mainValue;
          delete cardElement.dataset.partner;
        });
        
        // Collapse partner cards in other players' hands
        collapsePartnerCards(cardsToCollapse, playerIndex);
        
        // Update scoreboard to reflect new probabilities (always, not just for player 0)
        setTimeout(() => {
          updateScoreboard();
          // If collapsed in PARES, check if player now has certain juego outcome
          if (shouldCheckJuego) {
            checkAndAutoDeclareJuego(playerIndex);
          }
        }, 200);
      });
    } else {
      // No animation - just update card states directly
      cardsToCollapse.forEach(({ cardElement, finalValue }) => {
        convergeSuperpositionToFinal(cardElement, finalValue);
        cardElement.dataset.collapsed = 'true';
        cardElement.dataset.value = finalValue;
        cardElement.dataset.entangled = 'false';
        delete cardElement.dataset.mainValue;
        delete cardElement.dataset.partner;
      });
      
      // Collapse partner cards in other players' hands
      collapsePartnerCards(cardsToCollapse, playerIndex);
      
      // Update scoreboard
      setTimeout(() => {
        updateScoreboard();
        // If collapsed in PARES, check if player now has certain juego outcome
        if (shouldCheckJuego) {
          checkAndAutoDeclareJuego(playerIndex);
        }
      }, 200);
    }
  }
  
  // Check if a player's cards now allow auto-declaration for JUEGO after PARES collapse
  function checkAndAutoDeclareJuego(playerIndex) {
    console.log(`[AUTO-DECLARE CHECK] Checking player ${playerIndex + 1} after PARES collapse`);
    
    // Only check if we haven't declared yet
    if (gameState.juegoDeclarations && gameState.juegoDeclarations[playerIndex] !== undefined) {
      console.log(`[AUTO-DECLARE CHECK] Player ${playerIndex + 1} already declared, skipping`);
      return; // Already declared
    }
    
    // Log current card states for debugging
    const playerId = `player${playerIndex + 1}`;
    const cardElements = document.querySelectorAll(`#${playerId}-zone .quantum-card`);
    cardElements.forEach((cardEl, idx) => {
      console.log(`[AUTO-DECLARE CHECK] Card ${idx}: entangled=${cardEl.dataset.entangled}, collapsed=${cardEl.dataset.collapsed}, value=${cardEl.dataset.value}`);
    });
    
    // Check if auto-declaration is now possible
    const autoResult = autoDeclareJuego(playerIndex);
    if (autoResult !== null) {
      console.log(`[AUTO-DECLARE] Player ${playerIndex + 1} can now auto-declare JUEGO after PARES collapse: ${autoResult}`);
      // Store this for later when JUEGO phase starts
      if (!gameState.preJuegoDeclarations) {
        gameState.preJuegoDeclarations = {};
      }
      gameState.preJuegoDeclarations[playerIndex] = autoResult;
    } else {
      console.log(`[AUTO-DECLARE] Player ${playerIndex + 1} still has uncertain juego outcome`);
    }
  }
  
  /**
   * Collapse all remaining entangled cards at the end
   */
  function collapseAllRemaining() {
    console.log('[COLLAPSE ALL] Collapsing all remaining entangled cards');

    // Build list of collapse tasks per player
    const collapsePromises = [];

    for (let i = 0; i < 4; i++) {
      const playerId = `player${i + 1}`;
      const cardElements = document.querySelectorAll(`#${playerId}-zone .quantum-card`);
      const cardsToCollapse = [];

      cardElements.forEach((cardEl, idx) => {
        if (cardEl.dataset.entangled === 'true' && cardEl.dataset.collapsed !== 'true') {
          const mainValue = cardEl.dataset.mainValue || cardEl.dataset.value;
          const partnerValue = cardEl.dataset.partner;
          const finalValue = Math.random() < 0.5 ? mainValue : partnerValue;
          cardsToCollapse.push({ cardElement: cardEl, finalValue, cardIndex: idx });
        }
      });

      if (cardsToCollapse.length === 0) continue;

      // For each player create a promise that resolves when that player's collapse animation (if any) is done
      const p = new Promise(resolve => {
        // Use animation for all players if collapseMultipleCards exists; otherwise collapse immediately
        if (typeof window.quantumCollapse !== 'undefined' && typeof window.quantumCollapse.collapseMultipleCards === 'function') {
          // Trigger animation for this player's cards
          window.quantumCollapse.collapseMultipleCards(cardsToCollapse, () => {
            // Ensure DOM state set for each collapsed card
            cardsToCollapse.forEach(({ cardElement, finalValue }) => {
              cardElement.dataset.collapsed = 'true';
              cardElement.dataset.value = finalValue;
              cardElement.dataset.entangled = 'false';
              delete cardElement.dataset.mainValue;
              delete cardElement.dataset.partner;
            });
            resolve();
          });
        } else {
          // Fallback - immediate collapse
          cardsToCollapse.forEach(({ cardElement, finalValue }) => {
            convergeSuperpositionToFinal(cardElement, finalValue);
            cardElement.dataset.collapsed = 'true';
            cardElement.dataset.value = finalValue;
            cardElement.dataset.entangled = 'false';
            delete cardElement.dataset.mainValue;
            delete cardElement.dataset.partner;
          });
          resolve();
        }
      });

      collapsePromises.push(p);
    }

    // When all collapse animations are complete, update scoreboard
    return Promise.all(collapsePromises).then(() => {
      updateScoreboard();
    }).catch(err => {
      console.warn('[COLLAPSE ALL] Error during collapse animations', err);
      updateScoreboard();
    });
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
            // Only show animation if this is player 1's card (index 0)
            if (i === 0) {
              window.quantumCollapse.triggerCollapseEffect(cardEl, partnerCollapsedValue);
            } else {
              // No animation - just update state
              convergeSuperpositionToFinal(cardEl, partnerCollapsedValue);
              cardEl.dataset.collapsed = 'true';
              cardEl.dataset.value = partnerCollapsedValue;
              cardEl.dataset.entangled = 'false';
              delete cardEl.dataset.mainValue;
              delete cardEl.dataset.partner;
            }
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
      actuallyHas = paresResult !== null;
    } else if (roundName === 'JUEGO' || roundName === 'PUNTO') {
      const juegoResult = calculateJuego(cards);
      actuallyHas = juegoResult.hasJuego;
    }

    // Check if prediction was wrong
    const predictionWrong = (declaration === true && !actuallyHas) || (declaration === false && actuallyHas);

    if (predictionWrong) {
      // Apply -1 point penalty and show notification (UI copied from insp.js)
      const playerTeam = getPlayerTeam(playerIndex);
      gameState.teams[playerTeam].score -= 1;
      console.log(`Player ${playerIndex + 1} incurred -1 penalty for wrong ${roundName} prediction`);
      // Show visual penalty notification
      if (typeof showPenaltyNotification === 'function') {
        try { showPenaltyNotification(playerIndex, roundName, 1); } catch (e) { console.warn('showPenaltyNotification failed', e); }
      }
      updateScoreboard();
    }
  }
  
  /**
   * Show penalty notification with graphic
   */
  function showPenaltyNotification(playerIndex, roundName, penalty) {
    const notification = document.createElement('div');
    notification.className = 'penalty-notification';
    notification.innerHTML = `
      <div class="penalty-icon" style="font-size: 3rem; margin-bottom: 10px;">⚠️</div>
      <div class="penalty-text">
        <strong style="font-size: 1.5rem; color: #ff4444;">Predicción Incorrecta</strong><br>
        <span style="font-size: 1.2rem; margin: 10px 0; display: block;">Jugador ${playerIndex + 1} - ${roundName}</span><br>
        <span style="color: #ff4444; font-size: 2rem; font-weight: bold;">-${penalty} Punto${penalty > 1 ? 's' : ''}</span>
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
      padding: 40px;
      text-align: center;
      box-shadow: 0 15px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(255, 68, 68, 0.4);
      z-index: 10000;
      color: white;
      font-family: 'Courier New', monospace;
    `;
    
    document.body.appendChild(notification);
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes penalty-appear {
        0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
        50% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
        100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
      }
      @keyframes penalty-disappear {
        0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        100% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
    
    // Animate in
    setTimeout(() => {
      notification.style.animation = 'penalty-appear 0.5s ease-out forwards';
      notification.style.transform = 'translate(-50%, -50%) scale(1)';
    }, 10);
    
    // Remove after 1.5 seconds
    setTimeout(() => {
      notification.style.animation = 'penalty-disappear 0.5s ease-in forwards';
      setTimeout(() => {
        if (notification.parentNode) notification.parentNode.removeChild(notification);
        if (style.parentNode) style.parentNode.removeChild(style);
      }, 500);
    }, 1500);
  }
  
  /**
   * Trigger quantum collapse visual effect on a card
   * @param {HTMLElement} cardElement - The card element to collapse
   * @param {string} finalValue - The value the card collapsed to
   * @param {Function} onComplete - Callback when animation completes
   */
  function triggerCollapseEffect(cardElement, finalValue, onComplete) {
    if (!cardElement) return;
    
    // Ensure card has relative positioning for animations
    const originalPosition = cardElement.style.position;
    if (!originalPosition || originalPosition === 'static') {
      cardElement.style.position = 'relative';
    }
    
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
      // Clear entanglement data since card is now classical
      cardElement.dataset.entangled = 'false';
      delete cardElement.dataset.mainValue;
      delete cardElement.dataset.partner;
      
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
      z-index: 100;
      opacity: 1;
    `;
    
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
          z-index: 99;
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
        z-index: 101;
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
    
    // Get card color - map both Greek letter suits and Spanish suits
    const suit = cardElement.dataset.suit || 'psi';
    const suitColors = {
      'psi': '#2ec4b6',      // bastos - teal
      'phi': '#a78bfa',      // espadas - purple
      'delta': '#ff6b6b',    // copas - red
      'theta': '#f5c518',    // oros - gold
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
      // Use the same suit color already determined above
      const sphereSuit = cardElement.dataset.suit || 'psi';
      const sphereSuitColors = {
        'psi': '#2ec4b6',
        'phi': '#a78bfa',
        'delta': '#ff6b6b',
        'theta': '#f5c518',
        'oros': '#f5c518',
        'copas': '#ff6b6b',
        'espadas': '#a78bfa',
        'bastos': '#2ec4b6'
      };
      const sphereColor = sphereSuitColors[sphereSuit] || suitColor;
      
      // Generate static Bloch sphere showing collapsed value
      blochSphere.innerHTML = CardGenerator.generateBlochSphere('up', false, finalValue, finalValue, 0, 0, sphereColor);
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
// Listen for game screen entry (from lobby "Iniciar partida")
window.addEventListener('enterGameScreen', initGame);