// Quantum Mus - 4 Player Game with Character Avatars
// Only initialize when entering the game screen (after lobby)
let gameInitialized = false;
let timerInterval = null; // Global timer reference
let aiDecisionTimeout = null; // Track AI decision timeout to prevent duplicates

function mapBackendCardToFrontend(cardData) {
  const suitMap = {
    oro: 'oros',
    copa: 'copas',
    espada: 'espadas',
    basto: 'bastos'
  };
  // Support both old format (palo/valor) and new format (suit/value)
  const rawSuit = (cardData && typeof cardData.palo !== 'undefined') 
    ? String(cardData.palo).toLowerCase() 
    : (cardData && cardData.suit) ? String(cardData.suit).toLowerCase() : '';
  const suit = suitMap[rawSuit] || suitMap[rawSuit.replace(/s$/, '')] || rawSuit;
  
  const rawValue = cardData ? (cardData.valor || cardData.value) : undefined;
  let value = rawValue;
  if (rawValue === '1' || rawValue === 1) value = 'A';
  else if (rawValue === '10' || rawValue === 10) value = 'J';
  else if (rawValue === '11' || rawValue === 11) value = 'Q';
  else if (rawValue === '12' || rawValue === 12) value = 'K';
  
  // Preserve entanglement data from backend
  return { 
    value, 
    suit,
    is_entangled: cardData?.is_entangled || false,
    entangled_partner_value: cardData?.entangled_partner_value,
    entangled_partner_suit: cardData?.entangled_partner_suit,
    is_superposed: cardData?.is_superposed || false,
    superposed_value: cardData?.superposed_value,
    coefficient_a: cardData?.coefficient_a,
    coefficient_b: cardData?.coefficient_b,
    is_collapsed: cardData?.is_collapsed || false,
    collapsed_value: cardData?.collapsed_value
  };
}

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
  playerNames: ['Preskill', 'Cirac', 'Zoller', 'Deutsch', 'Simmons', 'Broadbent', 'Yunger Halpern', 'Hallberg'], // Player character names
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
  ,
  // Guard to ensure per-player timeout actions are only executed once
  playerTimeoutConsumed: [false, false, false, false]

};

// Reactive setter for currentRound: ensure demo tunneling runs on every round start
(function() {
  let _currentRound = gameState.currentRound;
  Object.defineProperty(gameState, 'currentRound', {
    get() { return _currentRound; },
    set(val) {
      _currentRound = val;
      // update musPhaseActive flag
      gameState.musPhaseActive = (_currentRound === 'MUS');
      // Only apply frontend/demo tunneling when NOT online.
      try {
        if (!window.onlineMode) {
          // Apply tunneling only for betting rounds (GRANDE/CHICA).
          // PARES/JUEGO declarations must invoke tunneling exactly once
          // inside their declaration handlers to avoid loops.
          if (['GRANDE','CHICA'].includes(_currentRound)) {
            try {
              const classicStart = gameState.manoIndex ?? 0;
              const finalStart = chooseRoundStarter(classicStart);
              gameState.activePlayerIndex = finalStart;
              updateManoIndicators && updateManoIndicators();
              updateRoundDisplay && updateRoundDisplay();
              updateScoreboard && updateScoreboard();
              updateButtonStates && updateButtonStates(gameState.activePlayerIndex === 0);
              startPlayerTurnTimer && startPlayerTurnTimer(gameState.activePlayerIndex);
            } catch (e) {
              console.warn('[gameState.currentRound.setter] tunneling apply failed', e);
            }
          }
        }
      } catch (e) {
        console.warn('[gameState.currentRound.setter] error', e);
      }
    }
  });
})();

// Demo tunneling controls (frontend-only)
// By default do NOT force tunneling in local/demo mode — use probabilistic sampling
gameState.forceTunnelNextRound = false; // if true, next round start will tunnel 100%
gameState.forceTunnelNextHand = false;  // if true, next hand rotation will tunnel 100%
gameState.tunnelPClassic = 0.99;        // probability to keep classic starter

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
    responses: {},
    raiseCount: 0,
    previousAmount: 0,
    isFirstBet: true
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
  // Only glow if the partner is the local player's teammate
  const entangled = getPlayerEntangledCards(playerIndex);
  const localPlayerIndex = gameState.playerIndex;
  const teammateIndex = getTeammate(localPlayerIndex);
  return entangled.some(e => e.card_index === cardIndex && e.partner_player === teammateIndex);
}

// Get partner player for an entangled card
function getEntangledPartnerPlayer(playerIndex, cardIndex) {
  const entangled = getPlayerEntangledCards(playerIndex);
  const pair = entangled.find(e => e.card_index === cardIndex);
  return pair ? pair.partner_player : null;
}

// Debug helper: log structured hands and which cards should glow
function logHandsAndGlow() {
  try {
    const players = [];
    for (let p = 0; p < 4; p++) {
      const zone = document.querySelector(`#player${p+1}-zone`);
      const cardEls = zone ? Array.from(zone.querySelectorAll('.quantum-card')) : [];
      const cards = cardEls.map(el => {
        // Prefer explicit cardIndex written to dataset; fallback to dealOrder modulo 4
        const cardIndex = (typeof el.dataset.cardIndex !== 'undefined')
          ? parseInt(el.dataset.cardIndex, 10)
          : (Number.isFinite(parseInt(el.dataset.dealOrder || '', 10)) ? (parseInt(el.dataset.dealOrder, 10) % 4) : -1);
        const value = el.dataset.mainValue || el.dataset.value || null;
        const suit = el.dataset.suit || null;
        const entangledFlag = el.dataset.entangled === 'true';
        const collapsedFlag = el.dataset.collapsed === 'true';
        const shouldGlow = isCardEntangled(p, cardIndex);
        const partnerPlayer = getEntangledPartnerPlayer(p, cardIndex);
        return {
          index: cardIndex,
          value: value,
          suit: suit,
          entangled: entangledFlag,
          collapsed: collapsedFlag,
          shouldGlow: !!shouldGlow,
          partnerPlayer: partnerPlayer
        };
      });
      players.push({ playerIndex: p, cards });
    }

    // Output compact JSON for easy copy/paste
    console.log('[DEBUG HANDS] handsAndGlow:', JSON.stringify({ timestamp: Date.now(), players }, null, 2));
  } catch (err) {
    console.error('[DEBUG HANDS] Failed to log hands', err);
  }
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

// Apply entanglement glows based on server data
function applyEntanglementGlows(gameStateData) {
  if (!gameStateData || !gameStateData.entanglement_glows) return;

  const glowData = gameStateData.entanglement_glows;
  const glowingCardIndices = glowData.my_cards || [];

  // For local player (player 0), apply glows to specified cards
  const playerZone = document.getElementById('player1-zone');
  if (!playerZone) return;

  const cards = playerZone.querySelectorAll('.quantum-card');

  cards.forEach((card, index) => {
    if (glowingCardIndices.includes(index)) {
      // Add glow class if not already present
      if (!card.classList.contains('entangled-card')) {
        card.classList.add('entangled-card');
      }
    } else {
      // Remove glow class if present
      if (card.classList.contains('entangled-card')) {
        card.classList.remove('entangled-card');
      }
    }
  });
}

// Helper to build player entanglement map from pairs
function getPlayerEntangledCardsFromPairs(playerIndex) {
  const entangled = [];
  // Each pair in gameState.entanglement.pairs should be of the form:
  // { cardA: { player: idxA, card_index: cardIdxA }, cardB: { player: idxB, card_index: cardIdxB } }
  if (!gameState.entanglement.pairs) return entangled;
  gameState.entanglement.pairs.forEach(pair => {
    // Check if this player is involved in the pair
    if (pair.cardA.player === playerIndex) {
      entangled.push({
        card_index: pair.cardA.card_index,
        partner_player: pair.cardB.player,
        partner_card_index: pair.cardB.card_index
      });
    } else if (pair.cardB.player === playerIndex) {
      entangled.push({
        card_index: pair.cardB.card_index,
        partner_player: pair.cardA.player,
        partner_card_index: pair.cardA.card_index
      });
    }
  });
  return entangled;
}

// Reset entanglement for new hand
function resetEntanglementForNewHand() {
  gameState.entanglement.events = [];
  gameState.entanglement.playerEntanglements = {};
}

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

function initGame() {
  console.log('initGame called, gameInitialized:', gameInitialized);
  
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
  
  // Get players and game mode from lobby (set by initializeGame)
  const lobbyPlayers = window.currentPlayers || [];
  // Default to '8' (8 reyes) for both online and offline modes
  const gameMode = window.currentGameMode || '8';
  const localPlayerIndex = window.currentLocalPlayerIndex ?? 0;
  
  console.log('Game Mode:', gameMode);
  console.log('Lobby Players:', lobbyPlayers);
  console.log('Local Player Index:', localPlayerIndex);
  
  const characterNames = { preskill: 'Preskill', cirac: 'Cirac', simmons: 'Simmons', broadbent: 'Broadbent', deutsch: 'Deutsch' };

  
  // Build players array so that local player is always player1 (bottom),
  // and all other players follow in the same order as in the lobby, matching their character and color.
  const characterList = [
    { id: 'preskill', name: 'Preskill' },
    { id: 'zoller', name: 'Zoller' },
    { id: 'cirac', name: 'Cirac' },
    { id: 'deutsch', name: 'Deutsch' },
    { id: 'simmons', name: 'Simmons' },
    { id: 'broadbent', name: 'Broadbent' },
    { id: 'martinis', name: 'Yunger Halpern' },
    { id: 'monroe', name: 'Hallberg' }
  ];
  const N = lobbyPlayers.length;
  const L = localPlayerIndex;

  // ===== Apply server/lobby team data BEFORE zone assignment =====
  // In online mode, read team composition from initialServerState so the zone
  // layout reflects the actual server teams.  In offline mode, derive teams
  // from the lobby players' `.team` property (set by character selection).
  (function applyTeamData() {
    // 1) Try server state (online)
    const serverSt = (window.initialServerState && (window.initialServerState.state || window.initialServerState)) || {};
    if (serverSt.teams) {
      const t1 = serverSt.teams.team1;
      const t2 = serverSt.teams.team2;
      if (t1 && t1.players) gameState.teams.team1.players = [...t1.players];
      if (t2 && t2.players) gameState.teams.team2.players = [...t2.players];
      if (t1 && t1.name) gameState.teams.team1.name = t1.name;
      if (t2 && t2.name) gameState.teams.team2.name = t2.name;
      console.log('[initGame] Applied server teams:', JSON.stringify(gameState.teams));
      return;
    }
    // 2) Derive from lobby player `team` property (offline / character selection)
    if (lobbyPlayers.length === 4) {
      const t1 = lobbyPlayers.map((p, i) => ({ idx: i, team: p.team })).filter(x => x.team === 1).map(x => x.idx);
      const t2 = lobbyPlayers.map((p, i) => ({ idx: i, team: p.team })).filter(x => x.team === 2).map(x => x.idx);
      if (t1.length === 2 && t2.length === 2) {
        gameState.teams.team1.players = t1;
        gameState.teams.team2.players = t2;
        console.log('[initGame] Derived teams from lobby:', JSON.stringify(gameState.teams));
      }
    }
  })();

  // ===== Team-based zone assignment =====
  // Zone 1 (player1, Bottom) = local player (lobby index L)
  // Zone 3 (player3, Top)    = teammate (the other player in my team)
  // Zone 2 (player2, Right)  = rival whose turn comes next after mine
  // Zone 4 (player4, Left)   = remaining rival
  //
  // Step 1: Find my team and my teammate using lobby (absolute) indices
  let myTeamKey = null;
  let teammateIdx = null;
  for (const [key, team] of Object.entries(gameState.teams)) {
    if (team.players.includes(L)) {
      myTeamKey = key;
      teammateIdx = team.players.find(p => p !== L);
      break;
    }
  }
  if (myTeamKey === null) {
    // Fallback: if teams don't contain localPlayerIndex, assume default
    console.warn('[initGame] localPlayerIndex', L, 'not found in gameState.teams, falling back');
    myTeamKey = 'team1';
    teammateIdx = (L + 2) % N;
  }

  // Step 2: Identify rival team players
  const rivalTeamKey = myTeamKey === 'team1' ? 'team2' : 'team1';
  const rivals = [...gameState.teams[rivalTeamKey].players];

  // Step 3: Among rivals, the one whose lobby index comes first
  // when walking clockwise from L (i.e. L+1, L+2, …) is the "right" rival (Zone 2).
  let rightRival = null;
  let leftRival = null;
  for (let step = 1; step < N; step++) {
    const candidate = (L + step) % N;
    if (rivals.includes(candidate)) {
      rightRival = candidate;
      leftRival = rivals.find(r => r !== rightRival);
      break;
    }
  }

  // Step 4: Ordered zone map  [Zone1, Zone2, Zone3, Zone4]
  const zoneOrder = [L, rightRival, teammateIdx, leftRival];
  console.log('[initGame] Team-based zone assignment — lobby→zone:', JSON.stringify(zoneOrder),
    '| myTeam:', myTeamKey, '| teammate (lobby):', teammateIdx,
    '| rightRival (lobby):', rightRival, '| leftRival (lobby):', leftRival);

  // Build the lobby↔local lookup tables for server-index conversion
  const lobbyToLocal = {};
  const localToLobby = {};
  zoneOrder.forEach((lobbyIdx, localIdx) => {
    lobbyToLocal[lobbyIdx] = localIdx;
    localToLobby[localIdx] = lobbyIdx;
  });
  gameState.lobbyToLocal = lobbyToLocal;
  gameState.localToLobby = localToLobby;

  // Helper functions for server↔local index conversion (team-aware, NOT simple rotation)
  // These are also exposed on window so socket handlers outside initGame can use them.
  function serverToLocal(serverIdx) {
    if (gameState.lobbyToLocal && typeof gameState.lobbyToLocal[serverIdx] !== 'undefined') {
      return gameState.lobbyToLocal[serverIdx];
    }
    // Fallback: simple rotation (should never happen if lobbyToLocal is set)
    return ((serverIdx - L + 4) % 4);
  }
  function localToServer(localIdx) {
    if (gameState.localToLobby && typeof gameState.localToLobby[localIdx] !== 'undefined') {
      return gameState.localToLobby[localIdx];
    }
    return ((localIdx + L) % 4);
  }
  window.serverToLocal = serverToLocal;
  window.localToServer = localToServer;

  // Step 5: Build the players array using the zone order
  const players = [];
  for (let i = 0; i < N; i++) {
    const lobbyIdx = zoneOrder[i];
    const lp = lobbyPlayers[lobbyIdx];
    const charObj = characterList.find(c => c.id === lp.character);
    if (!charObj) continue;
    players.push({
      id: `player${i + 1}`,
      name: charObj.name,
      character: lp.character,
      playerName: lp.name || charObj.name,
      color: getCharacterColorValue(lp.character),
      score: 0
    });
  }

  // Step 6: Update gameState.teams to LOCAL indices so the rest of the
  // game logic (getPlayerTeam, getTeammate, scoring, etc.) works correctly.
  // After zone assignment: local 0 (bottom) & 2 (top) = my team,
  //                        local 1 (right) & 3 (left)  = rival team.
  gameState.teams[myTeamKey].players  = [0, 2];
  gameState.teams[rivalTeamKey].players = [1, 3];
  
  // Store player actual names for action notifications
  gameState.playerActualNames = players.map(p => p.playerName || p.name);
  // Store character keys so UI helpers can access character color values later
  gameState.playerCharacters = players.map(p => p.character);
  
  // Reset or apply server state
  const isOnline = window.onlineMode && window.initialServerState && window.QuantumMusSocket;
  const localIdx = localPlayerIndex;
  if (isOnline) {
    const st = (window.initialServerState.state || window.initialServerState) || {};
    gameState.currentRound = st.currentRound || 'MUS';
    gameState.musPhaseActive = gameState.currentRound === 'MUS';
    gameState.activePlayerIndex = serverToLocal(st.activePlayerIndex ?? 0);
    gameState.manoIndex = serverToLocal(st.manoIndex ?? 0);
    if (st.teams) {
      gameState.teams.team1.score = st.teams.team1?.score ?? 0;
      gameState.teams.team2.score = st.teams.team2?.score ?? 0;
    }
      const validCharacterIds = characterList.map(c => c.id);
    gameState.waitingForDiscard = st.waitingForDiscard || false;
    window.QuantumMusOnlineRoom = window.roomId;
    window.QuantumMusLocalIndex = localIdx;
  }
  gameState.handsPlayed = isOnline ? gameState.handsPlayed : 0;
  if (!isOnline) {
    gameState.teams.team1.score = gameState.teams.team1.score ?? 0;
    gameState.teams.team2.score = gameState.teams.team2.score ?? 0;
  }
  gameState.manoIndex = gameState.manoIndex ?? 0;
  window.startingPlayer = `player1`;
  gameState.roundActions = {};
  gameState.cardsDiscarded = gameState.cardsDiscarded || {};
  gameState.pendingPoints = { team1: { GRANDE: 0, CHICA: 0, PARES: 0, JUEGO: 0 }, team2: { GRANDE: 0, CHICA: 0, PARES: 0, JUEGO: 0 } };
  gameState.paresDeclarations = undefined;
  gameState.juegoDeclarations = undefined;
  gameState.preJuegoDeclarations = null;
  if (!isOnline) {
    gameState.teams.team1.score = 0;
    gameState.teams.team2.score = 0;
    gameState.activePlayerIndex = gameState.manoIndex;
  }
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

    function renderHandsFromServer(playerHands, gameMode) {
      const suitMap = {
        oros: ['theta', 'θ', '#f5c518'],
        copas: ['phi', 'φ', '#ff6b6b'],
        espadas: ['delta', 'δ', '#a78bfa'],
        bastos: ['psi', 'ψ', '#2ec4b6']
      };
      const mappedHands = {};
      Object.keys(playerHands || {}).forEach((sIdx) => {
        const serverIdx = parseInt(sIdx, 10);
        if (Number.isNaN(serverIdx)) return;
        const localIdx = serverToLocal(serverIdx);
        mappedHands[localIdx] = playerHands[sIdx] || [];
      });
      gameState.playerHands = mappedHands;

      for (let localIdx = 0; localIdx < 4; localIdx++) {
        const cardsRow = document.querySelector(`#player${localIdx + 1}-zone .cards-row`);
        if (!cardsRow) continue;
        cardsRow.innerHTML = '';
        const isCurrentPlayer = localIdx === 0;
        const isTeammate = localIdx === 2;
        const hand = mappedHands[localIdx] || [];
        hand.forEach((card, i) => {
          const mappedCard = mapBackendCardToFrontend(card);
          const suit = mappedCard.suit || 'oros';
          const map = suitMap[suit] || suitMap.oros;
          const cardEl = createCard(mappedCard.value, map[0], map[1], i, isCurrentPlayer, isTeammate, map[2], localIdx, gameMode, mappedCard);
          if (cardEl) {
            cardsRow.appendChild(cardEl);
            // Forzar visibilidad inmediata eliminando la clase de animacion pendiente
            cardEl.classList.remove('card-dealing');
            cardEl.classList.add('card-dealt');
            cardEl.style.opacity = '1'; // Asegurar opacidad
          }
        });
      }

      matchEntangledCards();
    }

    function applyServerSnapshot(payload) {
      const gs = payload.game_state || {};
      const st = gs.state || gs;
      if (!st) return;
      gameState.currentRound = st.currentRound || gameState.currentRound;
      gameState.musPhaseActive = gameState.currentRound === 'MUS';
      if (typeof st.manoIndex !== 'undefined') {
        gameState.manoIndex = serverToLocal(st.manoIndex ?? 0);
      }
      if (typeof st.activePlayerIndex !== 'undefined') {
        gameState.activePlayerIndex = serverToLocal(st.activePlayerIndex ?? 0);
      }
      if (st.teams) {
        gameState.teams.team1.score = st.teams.team1?.score ?? gameState.teams.team1.score;
        gameState.teams.team2.score = st.teams.team2?.score ?? gameState.teams.team2.score;
      }
      gameState.currentBet = st.currentBet || gameState.currentBet;
      gameState.waitingForDiscard = st.waitingForDiscard || false;
        if (gs.entanglement) {
          updateEntanglementState(gs.entanglement);
        }
        if (data.game_state && data.game_state.entanglement_glows) {
          applyEntanglementGlows(data.game_state);
        }
      if (payload.game_state && payload.game_state.player_hands) {
        renderHandsFromServer(payload.game_state.player_hands, payload.game_mode || window.currentGameMode || (window.onlineMode ? '8' : '4'));
      } else if (payload.player_hands) {
        renderHandsFromServer(payload.player_hands, payload.game_mode || window.currentGameMode || (window.onlineMode ? '8' : '4'));
      }
      updateManoIndicators();
      updateRoundDisplay();
      updateScoreboard();
    }
    socket.emit('get_game_state', { room_id: roomId, player_index: localIdx });
    socket.once('game_state', (data) => {
      console.log('DEBUG FRONTEND: Recibido evento de juego. Datos crudos:', data);
      if (data.game_state && data.game_state.my_hand) {
        console.log('DEBUG FRONTEND: Mi mano es:', data.game_state.my_hand);
      } else {
        console.error('DEBUG FRONTEND: ¡No encuentro my_hand en los datos!');
      }
      // Fix: Always show hand for local player, even if my_hand is missing
      const handContainer = document.querySelector('#player1-zone .cards-row');
      handContainer.innerHTML = '';
      const suitMap = { oros: ['theta', 'θ', '#f5c518'], copas: ['phi', 'φ', '#ff6b6b'], espadas: ['delta', 'δ', '#a78bfa'], bastos: ['psi', 'ψ', '#2ec4b6'] };
      let hand = (data.game_state && data.game_state.my_hand) || (data.game_state && data.game_state.hands && data.game_state.hands[localIdx]) || [];
      // If server provides mano, use it (convert from server index to local perspective)
      const gs = (data.game_state && (data.game_state.state || data.game_state)) || {};
      if (gs && typeof gs.manoIndex !== 'undefined') {
        // server manoIndex is absolute; convert to local using team-aware map
        gameState.manoIndex = serverToLocal(gs.manoIndex ?? 0);
        console.log('[ONLINE] Received manoIndex from server:', gs.manoIndex, '-> local manoIndex:', gameState.manoIndex);
        updateManoIndicators();
      }
      if (!hand.length) {
        console.warn('[ONLINE] No hand found for local player, using fallback empty hand');
      }
      hand.forEach((c, i) => {
        const mappedCard = mapBackendCardToFrontend(c);
        const s = suitMap[mappedCard.suit] || suitMap.oros;
        const card = createCard(mappedCard.value, s[0], s[1], i, true, false, s[2], 0, gameMode, mappedCard);
        if (card) {
          handContainer.appendChild(card);
          // Forzar visibilidad inmediata eliminando la clase de animacion pendiente
          card.classList.remove('card-dealing');
          card.classList.add('card-dealt');
          card.style.opacity = '1'; // Asegurar opacidad
        }
      // Apply entanglement glows based on server data
      if (data.game_state && data.game_state.entanglement_glows) {
        applyEntanglementGlows(data.game_state);
      }
      });
    });
    socket.on('game_update', (data) => {
      const gs = data.game_state || {};
      const st = gs.state || gs;
      if (st) {
        const previousRound = gameState.currentRound;
        gameState.currentRound = st.currentRound || gameState.currentRound;
        
        // Check if this is an ordago game ending (immediate resolution)
        if (data.result && data.result.game_ended && data.result.bet_type === 'ordago') {
          console.log('[ONLINE] ORDAGO accepted - game ending immediately!');
          
          // Update scores
          if (st.teams) {
            gameState.teams.team1.score = st.teams.team1?.score ?? 0;
            gameState.teams.team2.score = st.teams.team2?.score ?? 0;
          }
          
          // Collapse and reveal all cards
          collapseAllRemaining().then(() => {
            revealAllCards(true);
            
            // Show game over with ordago winner (showGameOver will freeze state)
            setTimeout(() => {
              const winnerTeam = data.result.winner_team; // Already in 'team1' or 'team2' format
              showGameOver(winnerTeam);
            }, 2000);
          });
          
          // Don't process further updates - game is over
          return;
        }
        
        // Detect round transitions and reset state accordingly
        if (previousRound !== gameState.currentRound) {
          console.log(`[ONLINE] Round transition: ${previousRound} -> ${gameState.currentRound}`);
          gameState.roundActions = {}; // Reset actions whenever round changes
          
          // Reset stale flags on any round transition
          gameState._musBetPending = false;
          
          // Special handling for MUS -> GRANDE transition
          if (previousRound === 'MUS' && gameState.currentRound === 'GRANDE') {
            console.log('[ONLINE] MUS -> GRANDE transition');
            gameState.musPhaseActive = false;
            
            // Determine who cut MUS from the action data
            if (data.action && typeof data.action.player_index !== 'undefined') {
              const cutterServerIdx = data.action.player_index;
              gameState.musCutterIndex = serverToLocal(cutterServerIdx);
              console.log(`[ONLINE] MUS cut by player ${gameState.musCutterIndex + 1} (${data.action.action})`);
            }
            
            // If bet originated in MUS, check server state for active bet
            const serverBet = st.currentBet;
            if (serverBet && serverBet.betType) {
              gameState._musBetPending = true;
              console.log('[ONLINE] Bet originated in MUS - preserving classical defender order');
            }
          }
          
          // Show declaration banner when entering PARES or JUEGO rounds in online mode
          if (gameState.currentRound === 'PARES') {
            console.log('[ONLINE] Entering PARES declaration round');
            gameState.paresDeclarations = {};
            // Show banner to all players
            showDeclarationBanner('PARES', () => {
              console.log('[ONLINE] PARES declaration banner dismissed, waiting for server auto-declarations');
              // Server will automatically emit declarations for players that can auto-declare
            });
          } else if (gameState.currentRound === 'JUEGO') {
            console.log('[ONLINE] Entering JUEGO declaration round');
            gameState.juegoDeclarations = {};
            // Show banner to all players
            showDeclarationBanner('JUEGO', () => {
              console.log('[ONLINE] JUEGO declaration banner dismissed, waiting for server auto-declarations');
              // Server will automatically emit declarations for players that can auto-declare
            });
          }
        }
        
        if (typeof st.manoIndex !== 'undefined') {
          gameState.manoIndex = serverToLocal(st.manoIndex ?? 0);
          updateManoIndicators();
        }
        gameState.activePlayerIndex = serverToLocal(st.activePlayerIndex ?? 0);
        if (st.teams) {
          gameState.teams.team1.score = st.teams.team1?.score ?? 0;
          gameState.teams.team2.score = st.teams.team2?.score ?? 0;
        }
        
        // Update currentBet from server state
        gameState.currentBet = st.currentBet || gameState.currentBet;
        
        // Log betting state for debugging
        if (gameState.currentBet && gameState.currentBet.bettingTeam) {
          console.log(`[ONLINE] Active bet detected: ${gameState.currentBet.betType} for ${gameState.currentBet.amount} by ${gameState.currentBet.bettingTeam}`);
          console.log(`[ONLINE] Local player team: ${getPlayerTeam(0)}, Active player: ${gameState.activePlayerIndex + 1}`);
          
          // If ordago bet, log button visibility intent
          if (gameState.currentBet.betType === 'ordago') {
            console.log('[ONLINE] ORDAGO bet detected - envido button will be hidden');
          }
        }
        
        // Show action notification for received actions
        if (data.action && typeof data.action.player_index !== 'undefined') {
          const actionPlayerIdx = serverToLocal(data.action.player_index);
          const actionType = data.action.action;
          const actionData = data.action.data || {};
          
          // Show notification for all player actions
          if (actionType && typeof showActionNotification === 'function') {
            console.log(`[ONLINE] Showing notification for ${actionType} by player ${actionPlayerIdx + 1}`);
            showActionNotification(actionPlayerIdx, actionType, actionData);
          }
        }
        
        // Clear MUS bet pending flag when processing betting responses in GRANDE
        if (gameState.currentRound === 'GRANDE' && gameState._musBetPending && data.action) {
          const actionType = data.action.action;
          if (actionType && ['paso', 'envido', 'ordago', 'accept', 'reject'].includes(actionType)) {
            console.log('[ONLINE] Clearing _musBetPending (processing betting action)');
            gameState._musBetPending = false;
          }
        }
        
        const previousWaiting = gameState.waitingForDiscard;
        gameState.waitingForDiscard = !!st.waitingForDiscard;
        if (gameState.waitingForDiscard && !previousWaiting) {
          // Just entered discard phase - start simultaneous timer for all players IMMEDIATELY
          console.log('[ONLINE] Entering discard phase - starting 10s timer for all players NOW');
          gameState.roundActions = {};
          gameState.cardsDiscarded = {}; // Reset discard tracking
          
          // Clear any existing timers first
          if (timerInterval) {
            clearTimeout(timerInterval);
            timerInterval = null;
          }
          if (aiDecisionTimeout) {
            clearTimeout(aiDecisionTimeout);
            aiDecisionTimeout = null;
          }
          
          // Show discard UI and start timer synchronously
          showDiscardUI();
          startAllPlayersTimer(10);
        } else if (previousWaiting && !gameState.waitingForDiscard) {
          // Exiting discard phase
          const discardBtn = document.getElementById('discard-button');
          if (discardBtn) discardBtn.remove();
          
          // Show quantum gate controls again
          const controls = document.querySelector('.scoreboard-controls');
          if (controls) {
            controls.style.display = 'flex';
          }
        }
        // If server included declaration-phase metadata, apply it
        try {
          const declRes = data.declaration_result;
          if (declRes && declRes.declarations) {
            // Server declarations are keyed by server-side player indices.
            // Convert them to local indices before storing in client state.
            const remapped = {};
            Object.keys(declRes.declarations).forEach(k => {
              const sIdx = parseInt(k, 10);
              const lIdx = serverToLocal(sIdx);
              remapped[lIdx] = declRes.declarations[k];
            });
            if (declRes.round_name === 'PARES') {
              gameState.paresDeclarations = remapped;
            } else if (declRes.round_name === 'JUEGO') {
              gameState.juegoDeclarations = remapped;
            }
          }
        } catch (e) {
          console.debug('No declaration_result in game_update');
        }
        updateRoundDisplay();
        updateScoreboard();
        startPlayerTurnTimer(gameState.activePlayerIndex);
      }
    });
    socket.on('hand_started', (data) => {
      console.log('DEBUG FRONTEND: Recibido evento de juego. Datos crudos:', data);
      if (data.game_state && data.game_state.my_hand) {
        console.log('DEBUG FRONTEND: Mi mano es:', data.game_state.my_hand);
      } else {
        console.error('DEBUG FRONTEND: ¡No encuentro my_hand en los datos!');
      }
      try {
        if (timerInterval) { clearTimeout(timerInterval); timerInterval = null; }
        if (aiDecisionTimeout) { clearTimeout(aiDecisionTimeout); aiDecisionTimeout = null; }
        applyServerSnapshot(data || {});
        console.log('DEBUG FRONTEND: Snapshot aplicado. playerHands:', gameState.playerHands);
        setTimeout(() => {
          startPlayerTurnTimer(gameState.activePlayerIndex);
        }, 500);
      } catch (e) {
        console.warn('[hand_started] handler failed', e);
      }
    });
    // Server informs all clients when a tunneling moved the mano
    socket.on('tunnel_notification', (tunnel) => {
      try {
        // tunnel: { from, to, to_name, tunneled }
        const toAbs = (typeof tunnel.to !== 'undefined') ? tunnel.to : null;
        if (toAbs !== null) {
          const localTo = serverToLocal(toAbs ?? 0);
          gameState.manoIndex = localTo;
          gameState.activePlayerIndex = localTo; // Make tunneled starter active
          updateManoIndicators();
          updateRoundDisplay();
          updateScoreboard();
          // Ensure buttons enabled if it's local player's turn
          updateButtonStates(gameState.activePlayerIndex === 0);
          // Start timer for new active player (if local) or show timers appropriately
          startPlayerTurnTimer(gameState.activePlayerIndex);
        }
        // Use manoIndex so the alert can color the name correctly
        if (typeof showCentralTunnelAlert === 'function') showCentralTunnelAlert(gameState.manoIndex);
      } catch (e) {
        console.warn('[socket:tunnel_notification] handler failed', e);
      }
    });
    socket.on('game_ended', (data) => {
      console.log('[ONLINE] Game ended event received:', data);
      freezeGameState();
      if (data.winner) {
        const winnerTeam = data.winner; // Already in 'team1' or 'team2' format
        setTimeout(() => showGameOver(winnerTeam), 1000);
      }
    });
    socket.on('declaration_made', (data) => {
      try {
        const localIdx = serverToLocal(data.player_index);
        const roundName = data.round_name;  // 'PARES' or 'JUEGO'
        const declaration = data.declaration;
        
        console.log(`[ONLINE] Player ${localIdx + 1} declared '${declaration}' in ${roundName}`);
        
        // Store declaration locally
        const key = roundName === 'PARES' ? 'paresDeclarations' : 'juegoDeclarations';
        if (!gameState[key]) gameState[key] = {};
        gameState[key][localIdx] = declaration;
        
        // Show notification
        const notificationType = declaration === true ? (roundName === 'PARES' ? 'pares' : 'juego') : 
                                declaration === false ? (roundName === 'PARES' ? 'no_pares' : 'no_juego') : 
                                (roundName === 'PARES' ? 'puede_pares' : 'puede_juego');
        showActionNotification(localIdx, notificationType);
        
        // Check if all players have declared
        const allDeclared = Object.keys(gameState[key]).length === 4;
        
        if (allDeclared) {
          // All players declared - transition to betting or next round
          console.log(`[ONLINE] All players declared in ${roundName}, transitioning to betting/next round`);
          if (roundName === 'PARES') {
            handleAllParesDeclarationsDone();
          } else if (roundName === 'JUEGO') {
            handleAllJuegoDeclarationsDone();
          }
        } else if (data.next_player !== null && data.next_player !== undefined) {
          // More declarations needed - update active player
          const nextLocalIdx = serverToLocal(data.next_player);
          gameState.activePlayerIndex = nextLocalIdx;
          
          console.log(`[ONLINE] Continuing ${roundName} declarations, next player: ${nextLocalIdx + 1}`);
          
          // Start timer for next player (server will auto-declare if possible)
          startPlayerTurnTimer(nextLocalIdx);
        }
        
        // For manual 'tengo' or 'no tengo', wait for 'cards_collapsed' event
      } catch (e) {
        console.warn('[socket:declaration_made] handler failed', e);
      }
    });
    
    socket.on('bet_collapse_completed', (data) => {
      try {
        const localIdx = serverToLocal(data.player_index);
        const roundName = data.round_name;
        
        console.log(`[ONLINE] Bet collapse completed for player ${localIdx + 1} in ${roundName}`);
        
        // Update hands from server
        if (data.updated_hands) {
          Object.keys(data.updated_hands).forEach(serverIdx => {
            const localPlayerIdx = serverToLocal(parseInt(serverIdx));
            const hand = data.updated_hands[serverIdx];
            
            // Update cards in UI
            const playerZone = document.getElementById(`player${localPlayerIdx + 1}-zone`);
            if (playerZone) {
              const cardsRow = playerZone.querySelector('.cards-row');
              const cards = cardsRow.querySelectorAll('.quantum-card');
              
              hand.forEach((cardData, cardIdx) => {
                if (cards[cardIdx]) {
                  // Update card value display
                  const cardTop = cards[cardIdx].querySelector('.card-top');
                  const decoration = cards[cardIdx].querySelector('.quantum-decoration');
                  if (cardTop && decoration) {
                    const mappedCard = mapBackendCardToFrontend(cardData);
                    decoration.textContent = mappedCard.value;
                    // Mark as collapsed
                    cards[cardIdx].dataset.collapsed = 'true';
                    cards[cardIdx].dataset.value = mappedCard.value;
                    cards[cardIdx].dataset.entangled = 'false';
                  }
                }
              });
            }
          });
        }
        
        // Update scoreboard
        updateScoreboard();
      } catch (e) {
        console.warn('[socket:bet_collapse_completed] handler failed', e);
      }
    });
    
    socket.on('cards_collapsed', (data) => {
      try {
        const localIdx = serverToLocal(data.player_index);
        const roundName = data.round_name;
        const declaration = data.declaration;
        const penalty = data.penalty;
        const collapseEvent = data.collapse_event;
        
        console.log(`[ONLINE] Cards collapsed for player ${localIdx + 1} in ${roundName}, penalty:`, penalty);
        
        // Trigger collapse animation for the player who declared (if it's the local player)
        const isLocalPlayerDeclaration = localIdx === 0;
        
        // Update hands from server
        if (data.updated_hands) {
          Object.keys(data.updated_hands).forEach(serverIdx => {
            const localPlayerIdx = serverToLocal(parseInt(serverIdx));
            const hand = data.updated_hands[serverIdx];
            const isPlayerWhoDeclared = localPlayerIdx === localIdx;
            
            // Update cards in UI
            const playerZone = document.getElementById(`player${localPlayerIdx + 1}-zone`);
            if (playerZone) {
              const cardsRow = playerZone.querySelector('.cards-row');
              const cards = cardsRow.querySelectorAll('.quantum-card');
              
              // Collect cards to collapse with animation
              const cardsToCollapse = [];
              
              hand.forEach((cardData, cardIdx) => {
                if (cards[cardIdx]) {
                  const mappedCard = mapBackendCardToFrontend(cardData);
                  const wasEntangled = cards[cardIdx].dataset.entangled === 'true';
                  const wasCollapsed = cards[cardIdx].dataset.collapsed === 'true';
                  
                  // If this card was entangled and is now collapsed, add to animation
                  if (wasEntangled && !wasCollapsed && isPlayerWhoDeclared) {
                    cardsToCollapse.push({
                      cardElement: cards[cardIdx],
                      finalValue: mappedCard.value,
                      cardIndex: cardIdx
                    });
                  }
                  
                  // Update card value display
                  const cardTop = cards[cardIdx].querySelector('.card-top');
                  const decoration = cards[cardIdx].querySelector('.quantum-decoration');
                  if (cardTop && decoration) {
                    decoration.textContent = mappedCard.value;
                    // Mark as collapsed
                    cards[cardIdx].dataset.collapsed = 'true';
                    cards[cardIdx].dataset.value = mappedCard.value;
                    cards[cardIdx].dataset.entangled = 'false';
                  }
                }
              });
              
              // Trigger collapse animation for local player
              if (isLocalPlayerDeclaration && cardsToCollapse.length > 0 && isPlayerWhoDeclared) {
                console.log(`[ONLINE] Triggering collapse animation for ${cardsToCollapse.length} cards`);
                window.quantumCollapse.collapseMultipleCards(cardsToCollapse, () => {
                  console.log(`[ONLINE] Collapse animation complete`);
                  // Update partner cards
                  collapsePartnerCards(cardsToCollapse, localPlayerIdx);
                });
              } else if (isPlayerWhoDeclared && cardsToCollapse.length > 0) {
                // No animation but still collapse partners
                collapsePartnerCards(cardsToCollapse, localPlayerIdx);
              }
            }
          });
        }
        
        // Apply penalty if any
        if (penalty && penalty.penalized) {
          // Show penalty notification
          showPenaltyNotification(localIdx, roundName, penalty.points_deducted);
          
          // Show team point award if points were deducted
          if (penalty.points_deducted) {
            const playerTeam = gameState.teams.team1.players.includes(localIdx) ? 'team1' : 'team2';
            const opponentTeam = playerTeam === 'team1' ? 'team2' : 'team1';
            
            // Deduct points from penalized team's score
            gameState.teams[playerTeam].score -= penalty.points_deducted;
            
            // Award goes to opponent team
            showTeamPointAward(opponentTeam, penalty.points_deducted, 'penalty');
            
            // Update scoreboard
            updateScoreboard();
          }
          
          // Update declaration with penalty marker
          const key = roundName === 'PARES' ? 'paresDeclarations' : 'juegoDeclarations';
          // Mark as penalized but still eligible for betting
          // If declared tengo (true) but was wrong, mark as 'tengo_after_penalty'
          // If declared no tengo (false) but was wrong, mark as 'no_tengo'
          if (declaration === true || declaration === 'tengo') {
            gameState[key][localIdx] = 'tengo_after_penalty';
          } else {
            gameState[key][localIdx] = 'no_tengo';
          }
        }
        
        // Clear waiting flag and advance to next player
        if (window._waitingServerDeclaration && window._waitingServerDeclaration.playerIndex === localIdx) {
          window._waitingServerDeclaration = null;
        }
        
        // Update active player from server if provided
        if (data.next_player !== null && data.next_player !== undefined) {
          const nextLocalIdx = serverToLocal(data.next_player);
          gameState.activePlayerIndex = nextLocalIdx;
          console.log(`[ONLINE] Next player after collapse: ${nextLocalIdx + 1}`);
          
          // Check if more declarations are needed
          const key = roundName === 'PARES' ? 'paresDeclarations' : 'juegoDeclarations';
          if (Object.keys(gameState[key]).length < 4) {
            // More declarations needed - server will auto-declare if possible
            // Just start the timer for the next player
            console.log(`[ONLINE] Waiting for next ${roundName} declaration from player ${nextLocalIdx + 1}`);
            startPlayerTurnTimer(nextLocalIdx);
          } else {
            // All declared - transition to betting/next round
            console.log(`[ONLINE] All players declared in ${roundName}, transitioning to betting/next round`);
            if (roundName === 'PARES') {
              handleAllParesDeclarationsDone();
            } else if (roundName === 'JUEGO') {
              handleAllJuegoDeclarationsDone();
            }
          }
        } else {
          // Fallback: advance turn locally
          nextPlayer();
          startPlayerTurnTimer(gameState.activePlayerIndex);
        }
      } catch (e) {
        console.warn('[socket:cards_collapsed] handler failed', e);
      }
    });
    
    socket.on('round_transition', (data) => {
      console.log(`[ONLINE] Round transition to ${data.round}, reason: ${data.reason}`);
      
      // Update local game state
      gameState.currentRound = data.round;
      gameState.activePlayerIndex = serverToLocal(data.active_player);
      
      // Apply server state update if included
      if (data.game_state) {
        applyServerSnapshot(data);
      }
      
      // If transitioning to PUNTO, call startPuntoBetting
      if (data.round === 'PUNTO') {
        console.log('[ONLINE] Starting PUNTO betting phase');
        startPuntoBetting();
      }
      
      updateRoundDisplay();
      updateScoreboard();
    });
    
    socket.on('betting_phase_started', (data) => {
      console.log(`[ONLINE] Betting phase started for ${data.round}`);
      
      // Update local game state
      gameState.activePlayerIndex = serverToLocal(data.active_player);
      
      // Apply server state update if included
      if (data.game_state) {
        applyServerSnapshot(data);
      }
      
      // Initialize betting phase
      if (data.round === 'JUEGO') {
        gameState.juegoPhase = 'betting';
      } else if (data.round === 'PARES') {
        gameState.paresPhase = 'betting';
      }
      
      startPlayerTurnTimer(gameState.activePlayerIndex);
      updateScoreboard();
    });
    
    socket.on('cards_discarded', (data) => {
      try {
        const localIdx = serverToLocal(data.player_index);
        console.log(`[ONLINE] Player ${localIdx + 1} discarded ${data.num_cards} cards`);
        
        // Mark this player as having discarded (if not already marked)
        if (!gameState.cardsDiscarded[localIdx]) {
          gameState.cardsDiscarded[localIdx] = new Array(data.num_cards).fill(0).map((_, i) => i);
        }
        
        // Update UI to show visual feedback that this player discarded
        const playerId = `player${localIdx + 1}`;
        const playerZone = document.getElementById(`${playerId}-zone`);
        if (playerZone) {
          const cards = playerZone.querySelectorAll('.quantum-card');
          cards.forEach((card, idx) => {
            if (idx < data.num_cards) {
              // Apply discard visual effect
              try { 
                if (card.classList.contains('entangled-card') || card.classList.contains('entangled-candidate')) {
                  card.style.setProperty('animation', 'none', 'important');
                }
              } catch (e) {}
              
              card.style.transform = 'translateY(-15px) scale(0.95)';
              card.style.filter = 'grayscale(100%) brightness(0.3)';
              card.style.transition = 'all 0.3s ease-out';
              
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
                  animation: fadeInX 0.3s ease-out;
                `;
                overlay.textContent = '✕';
                card.appendChild(overlay);
              }
            }
          });
        }
        
        // Hide timer for this player
        hideTimerBar(localIdx);
      } catch (e) {
        console.warn('[socket:cards_discarded] handler failed', e);
      }
    });
    socket.on('new_cards_dealt', (data) => {
      try {
        console.log('[ONLINE] New cards dealt - restarting MUS round');
        
        // Clear timer
        if (timerInterval) {
          clearTimeout(timerInterval);
          timerInterval = null;
        }
        
        // Update game state
        const gs = data.game_state || {};
        const st = gs.state || gs;
        if (st) {
          gameState.currentRound = st.currentRound || 'MUS';
          gameState.activePlayerIndex = serverToLocal(st.activePlayerIndex ?? st.manoIndex ?? 0);
          gameState.waitingForDiscard = false;
          gameState.cardsDiscarded = {};
          gameState.roundActions = {};
          gameState.musPhaseActive = true;
        }
        
        // Update player hands from server and re-render
        if (data.player_hands) {
          renderHandsFromServer(data.player_hands, window.currentGameMode || (window.onlineMode ? '8' : '4'));
        }
        
        // Remove discard button if it exists
        const discardBtn = document.getElementById('discard-button');
        if (discardBtn) discardBtn.remove();
        
        // Show quantum gate controls again
        const controls = document.querySelector('.scoreboard-controls');
        if (controls) {
          controls.style.display = 'flex';
        }
        
        // Update displays
        updateRoundDisplay();
        updateScoreboard();
        
        // Start new turn with mano player
        setTimeout(() => {
          startPlayerTurnTimer(gameState.activePlayerIndex);
        }, 500);
      } catch (e) {
        console.warn('[socket:new_cards_dealt] handler failed', e);
      }
    });
  } else {
    // Mode local (demo): Initialize local game deck
    initializeLocalGameDeck();
    // Choose initial mano randomly for demo using secure RNG
    try {
      const arr = new Uint32Array(1);
      window.crypto.getRandomValues(arr);
      gameState.manoIndex = arr[0] % 4;
      console.log('[DEMO] Selected random initial manoIndex (demo):', gameState.manoIndex);
      updateManoIndicators();
    } catch (e) {
      // Fallback to Math.random
      gameState.manoIndex = Math.floor(Math.random() * 4);
      console.warn('[DEMO] crypto.getRandomValues unavailable, using Math.random for manoIndex:', gameState.manoIndex);
      updateManoIndicators();
    }
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
    if (window.onlineMode && window.QuantumMusSocket && window.QuantumMusOnlineRoom) {
      const serverIdx = localToServer(playerIndex);
      window.QuantumMusSocket.emit('player_action', {
        room_id: window.QuantumMusOnlineRoom,
        player_index: serverIdx,
        action: action,
        data: extraData
      });
      return;
    }
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

    // If a bet originated in MUS and we just entered the betting flow,
    // clear the pending flag now that we're processing a betting action.
    if (gameState._musBetPending) {
      console.log('[handleBettingRound] Clearing _musBetPending (processing betting response)');
      gameState._musBetPending = false;
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
      // Mark that a bet originated in MUS so the initial defender selection
      // in GRANDE preserves classical order (no tunneling). This flag will
      // be cleared when the betting response is processed.
      gameState._musBetPending = true;
      
      // ORDAGO cards only collapse when ACCEPTED, not when declared
      console.log(`Betting started by ${gameState.playerActualNames?.[playerIndex] || `Player ${playerIndex+1}`} (team ${gameState.currentBet.bettingTeam}), amount: ${gameState.currentBet.amount}`);
      
      // Reset responses and move to GRANDE round
      gameState.currentBet.responses = {};
      moveToGrandeRound();
    }
  }
  
  // Choose the starter for a round, applying demo tunneling if enabled.
  function chooseRoundStarter(classicStarter) {
    try {
      // If we're online, the server is authoritative for tunneling decisions.
      if (window.onlineMode) return classicStarter;
      // If configured, ask the local server for a quantum decision even when
      // the client UI is running standalone. This allows a local backend
      // process to provide true quantum samples; falls back to crypto.
      if (gameState.requestServerQuantum && (window.QuantumMusSocket || window.fetch)) {
        try {
          // Prefer Socket.IO request if available
          if (window.QuantumMusSocket && window.QuantumMusSocket.connected) {
            const payload = { classic_start: classicStarter, p_classic: gameState.tunnelPClassic };
            // Return immediately; the server will emit 'tunnel_decision' which
            // the client already listens for via socket.on('tunnel_notification')
            window.QuantumMusSocket.emit('request_tunnel_decision', payload);
            return classicStarter; // finalStarter will be updated once server replies
          }
          // Otherwise try HTTP POST to local backend
          if (window.fetch) {
            fetch('/api/tunnel_decision', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ classic_start: classicStarter, p_classic: gameState.tunnelPClassic })
            }).then(r => r.json()).then(data => {
              if (data && typeof data.to !== 'undefined') {
                const finalStarter = data.to;
                gameState.manoIndex = finalStarter;
                if (typeof updateManoIndicators === 'function') updateManoIndicators();
                const playerName = (gameState.playerActualNames && gameState.playerActualNames[finalStarter]) || gameState.playerNames[finalStarter] || `Player ${finalStarter + 1}`;
                if (typeof showCentralTunnelAlert === 'function') showCentralTunnelAlert(finalStarter);
              }
            }).catch(() => {});
            return classicStarter;
          }
        } catch (e) {
          // fall through to local crypto sampling
        }
      }
      const numPlayers = 4;
      let finalStarter = classicStarter;
      if (gameState.forceTunnelNextRound) {
        const candidates = [...Array(numPlayers).keys()].filter(i => i !== classicStarter);
        // Do not clear the demo force flag here so it can remain persistent
        // across consecutive rounds when enabled by the tester.
        // Use secure crypto randomness where available to emulate quantum sampling.
        try {
          if (window.crypto && window.crypto.getRandomValues) {
            const arr = new Uint32Array(1);
            window.crypto.getRandomValues(arr);
            finalStarter = candidates[arr[0] % candidates.length];
          } else {
            finalStarter = candidates[Math.floor(Math.random() * candidates.length)];
          }
        } catch (e) {
          finalStarter = candidates[Math.floor(Math.random() * candidates.length)];
        }
      } else {
        const pClassic = gameState.tunnelPClassic ?? 0.99;
        try {
          // Use 1_000_000 precision secure randomness to match backend sampling
          let qval = null;
          if (window.crypto && window.crypto.getRandomValues) {
            const arr = new Uint32Array(1);
            window.crypto.getRandomValues(arr);
            qval = arr[0] % 1000000;
          } else {
            qval = Math.floor(Math.random() * 1000000);
          }
          const threshold = Math.floor((pClassic) * 1000000);
          if (qval < threshold) {
            finalStarter = classicStarter;
          } else {
            const candidates = [...Array(numPlayers).keys()].filter(i => i !== classicStarter);
            // pick securely among candidates
            if (window.crypto && window.crypto.getRandomValues) {
              const arr2 = new Uint32Array(1);
              window.crypto.getRandomValues(arr2);
              finalStarter = candidates[arr2[0] % candidates.length];
            } else {
              finalStarter = candidates[Math.floor(Math.random() * candidates.length)];
            }
          }
        } catch (e) {
          // Fallback
          if (Math.random() < pClassic) finalStarter = classicStarter;
          else {
            const candidates = [...Array(numPlayers).keys()].filter(i => i !== classicStarter);
            finalStarter = candidates[Math.floor(Math.random() * candidates.length)];
          }
        }
      }

      // If tunneling changed the starter, move mano indicator and show a brief warning
      try {
        if (finalStarter !== classicStarter) {
          console.log(`[chooseRoundStarter] TUNNEL: classic ${classicStarter + 1} -> ${finalStarter + 1}`);
          gameState.manoIndex = finalStarter;
          if (typeof updateManoIndicators === 'function') updateManoIndicators();
          // Show a small action notification to alert tunneling
          if (typeof showActionNotification === 'function') showActionNotification(finalStarter, 'tunnel');
          // Show a central attention banner for all players (local demo)
          if (typeof showCentralTunnelAlert === 'function') showCentralTunnelAlert(finalStarter);
          // If online, inform server so it can broadcast to other clients
          if (window.onlineMode && window.QuantumMusSocket && window.QuantumMusOnlineRoom) {
            try {
              window.QuantumMusSocket.emit('player_action', {
                room_id: window.QuantumMusOnlineRoom,
                action: 'tunnel_notify',
                player_index: 0,
                data: { to: finalStarter }
              });
            } catch (e) {
              console.warn('[chooseRoundStarter] failed to emit local tunnel notify', e);
            }
          }
        }
      } catch (e) {
        console.warn('[chooseRoundStarter] failed applying tunneling side-effects', e);
      }

      return finalStarter;
    } catch (e) {
      console.warn('[chooseRoundStarter] error, defaulting to classicStarter', e);
      return classicStarter;
    }
  }

  // Show a centered tunnel alert for all players
  function showCentralTunnelAlert(playerIndex) {
    try {
      const id = 'central-tunnel-alert';
      // Remove existing
      const existing = document.getElementById(id);
      if (existing) existing.remove();

      const container = document.createElement('div');
      container.id = id;
      container.style.cssText = `
        position: fixed;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        background: rgba(255, 200, 50, 0.95);
        color: #111;
        padding: 18px 28px;
        border-radius: 12px;
        font-size: 1.25rem;
        font-weight: 700;
        z-index: 4000;
        box-shadow: 0 10px 30px rgba(0,0,0,0.4);
        text-align: center;
      `;
      // Resolve player name and color from index
      const idx = (typeof playerIndex === 'number') ? playerIndex : null;
      const resolvedName = idx !== null ? ((gameState.playerActualNames && gameState.playerActualNames[idx]) || gameState.playerNames[idx] || `Player ${idx + 1}`) : (playerIndex || 'Jugador');
      const charKey = (idx !== null && gameState.playerCharacters) ? gameState.playerCharacters[idx] : null;
      const charColor = charKey ? getCharacterColorValue(charKey) : '#2ec4b6';
      container.innerHTML = `Atención Mano a: <span style="color:${charColor};">${resolvedName}</span> (Túnel)`;
      document.body.appendChild(container);

      setTimeout(() => {
        container.style.opacity = '0';
        setTimeout(() => container.remove(), 300);
      }, 2200);
    } catch (e) {
      console.warn('showCentralTunnelAlert failed', e);
    }
  }

  // Apply tunneling for round start (demo/local only)
  function applyRoundStartTunnel(classicStarter) {
    try {
      const classic = (typeof classicStarter === 'number') ? classicStarter : (gameState.manoIndex ?? 0);
      const finalStarter = chooseRoundStarter(classic);
      // chooseRoundStarter already sets manoIndex when tunneling occurs,
      // but ensure active player follows the final starter.
      gameState.manoIndex = finalStarter;
      gameState.activePlayerIndex = finalStarter;
      if (typeof updateManoIndicators === 'function') updateManoIndicators();
      if (typeof updateRoundDisplay === 'function') updateRoundDisplay();
      if (typeof updateScoreboard === 'function') updateScoreboard();
      if (typeof updateButtonStates === 'function') updateButtonStates(gameState.activePlayerIndex === 0);
      if (typeof startPlayerTurnTimer === 'function') startPlayerTurnTimer(gameState.activePlayerIndex);
    } catch (e) {
      console.warn('[applyRoundStartTunnel] failed', e);
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

      // Determine the classical starter for the betting response
      let classicStarter;
      if (manoTeam === defendingTeam) {
        // Mano belongs to defending team -> mano responds first
        classicStarter = gameState.manoIndex;
        console.log(`[moveToGrandeRound] Betting exists - Mano is on defending team, classical responder would be Mano (Player ${classicStarter + 1})`);
      } else {
        // Mano is on betting team -> first defender counter-clockwise from mano responds
        classicStarter = getFirstOpponentFromMano(defendingTeam);
        console.log(`[moveToGrandeRound] Betting exists - classical first defender counter-clockwise from Mano: Player ${classicStarter + 1}`);
      }

      // Apply tunneling BEFORE the betting decision: tunneling can move the mano.
      // However, if a bet originated in MUS, skip tunneling for the initial
      // defender selection (preserve classical order). The pending flag is
      // cleared when the first betting response is processed.
      if (gameState._musBetPending) {
        console.log('[moveToGrandeRound] MUS-originated bet pending - skipping tunneling to preserve defender order');
        gameState.activePlayerIndex = classicStarter;
      } else if (gameState.currentBet && gameState.currentBet.betType === 'ordago') {
        console.log('[moveToGrandeRound] ORDAGO detected - skipping tunneling before defender response to preserve defender order');
        gameState.activePlayerIndex = classicStarter;
      } else {
        try {
          const finalStarter = chooseRoundStarter(classicStarter);
          if (finalStarter !== classicStarter) {
            // Tunneling occurred — move mano to the tunneled player
            console.log(`[moveToGrandeRound] TUNNEL: classic starter ${classicStarter + 1} -> tunneled starter ${finalStarter + 1}. Moving mano.`);
            gameState.manoIndex = finalStarter;
            if (typeof updateManoIndicators === 'function') updateManoIndicators();
          } else {
            console.log(`[moveToGrandeRound] No tunnel: classical starter remains Player ${classicStarter + 1}`);
          }
          gameState.activePlayerIndex = finalStarter;
        } catch (e) {
          console.warn('[moveToGrandeRound] tunneling decision failed, falling back to classical starter', e);
          gameState.activePlayerIndex = classicStarter;
        }
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
    
    // At this point `gameState.activePlayerIndex` holds the classical starter.
    // Apply tunneling decision immediately when GRANDE starts.
    // Apply tunneling immediately when GRANDE starts, except during ORDAGO
    try {
      if (gameState.currentBet && gameState.currentBet.betType === 'ordago') {
        console.log('[moveToGrandeRound] ORDAGO active - skipping round-start tunneling to avoid disrupting response order');
      } else {
        const classicStarter = gameState.activePlayerIndex;
        gameState.activePlayerIndex = chooseRoundStarter(classicStarter);
        console.log(`[moveToGrandeRound] Starter after tunneling decision: Player ${gameState.activePlayerIndex + 1} (classic was ${classicStarter + 1})`);
      }
    } catch (e) {
      console.warn('[moveToGrandeRound] tunneling decision failed, using classic starter', e);
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
    // If no cards selected (empty array or undefined), discard all 4 cards
    if (!cardIndices || cardIndices.length === 0) {
      cardIndices = [0, 1, 2, 3];
      console.log(`[HANDLE DISCARD] Player ${playerIndex + 1} - no cards selected, auto-discarding all 4 cards`);
    }
    
    console.log(`[HANDLE DISCARD] Player ${playerIndex + 1} discarding cards:`, cardIndices);
    
    // Prevent double-discard
    if (gameState.cardsDiscarded[playerIndex]) {
      console.log(`[HANDLE DISCARD] Player ${playerIndex + 1} has already discarded, ignoring`);
      return;
    }
    
    // In online mode, send discard to server
    if (window.onlineMode && window.QuantumMusSocket && window.QuantumMusOnlineRoom) {
      const serverIdx = localToServer(playerIndex);
      console.log(`[ONLINE] Sending discard for player ${playerIndex + 1} (server index ${serverIdx})`);
      window.QuantumMusSocket.emit('discard_cards', {
        room_id: window.QuantumMusOnlineRoom,
        player_index: serverIdx,
        card_indices: cardIndices
      });
      
      // Mark as discarded locally for immediate UI feedback
      gameState.cardsDiscarded[playerIndex] = cardIndices;
      
      // Visual feedback: mark discarded cards immediately WITH X OVERLAY
      const playerId = `player${playerIndex + 1}`;
      const playerZone = document.getElementById(`${playerId}-zone`);
      if (playerZone) {
        const cards = playerZone.querySelectorAll('.quantum-card');
        cardIndices.forEach(cardIndex => {
          if (cards[cardIndex]) {
            // Apply discard visual effect
            try { 
              if (cards[cardIndex].classList.contains('entangled-card') || cards[cardIndex].classList.contains('entangled-candidate')) {
                cards[cardIndex].style.setProperty('animation', 'none', 'important');
              }
            } catch (e) {}
            
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
      }
      hideTimerBar(playerIndex);
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
          // If entanglement glow animation exists, pause it so filter persists
          try { if (cards[cardIndex].classList.contains('entangled-card') || cards[cardIndex].classList.contains('entangled-candidate')) cards[cardIndex].style.setProperty('animation', 'none', 'important'); } catch (e) {}
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
    if (window.onlineMode && window.QuantumMusSocket && window.QuantumMusOnlineRoom) {
      const serverIdx = localToServer(playerIndex);
      const data = action === 'raise' || action === 'envido' ? { amount: betAmount } : {};
      if (action === 'raise') action = 'envido';
      window.QuantumMusSocket.emit('player_action', {
        room_id: window.QuantumMusOnlineRoom,
        player_index: serverIdx,
        action: action,
        data: data
      });
      return;
    }
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
          // Award points based on bet history:
          // - First bet (no raises): 1 point
          // - Any raise (including ordago): previousAmount (the bet before the raise)
          let points;
          const isRaise = gameState.currentBet.isRaise || (gameState.currentBet.raiseCount && gameState.currentBet.raiseCount > 0);
          
          if (isRaise) {
            // Any raise rejected (including ÓRDAGO as counter-raise): award the bet BEFORE the raise
            points = gameState.currentBet.previousAmount || 1;
            console.log(`[REJECTION] Bet rejected after raise - awarding previous amount: ${points}`);
          } else {
            // First bet rejected (including ÓRDAGO as first bet): 1 point
            points = 1;
            console.log(`[REJECTION] First bet rejected - awarding 1 point`);
          }
          
          gameState.teams[gameState.currentBet.bettingTeam].score += points;
          console.log(`Team ${gameState.currentBet.bettingTeam} wins ${points} points (bet rejected in ${gameState.currentRound})`);
          showTeamPointAward(gameState.currentBet.bettingTeam, points, 'rechazado');
          updateScoreboard();
          
          // Check for game over (updateScoreboard will handle the check and call showGameOver)
          if (gameState.teams[gameState.currentBet.bettingTeam].score >= 40) {
            return; // updateScoreboard already triggered game over
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
        // Determine eligible players for this round. In PARES only players who declared
        // 'tengo' (true) or 'puede' can participate — only they count towards an "all pass".
        let eligiblePlayers;
        if (gameState.currentRound === 'PARES' && gameState.paresDeclarations) {
          eligiblePlayers = [0,1,2,3].filter(p => {
            const decl = gameState.paresDeclarations[p];
            return decl === true || decl === 'puede' || decl === 'tengo_after_penalty';
          });
        } else {
          eligiblePlayers = [0,1,2,3];
        }

        const responses = gameState.currentBet.responses || {};
        const responsesForEligible = eligiblePlayers.map(p => responses[p]);
        const allPassed = eligiblePlayers.length > 0 && responsesForEligible.every(r => r === 'paso');

        if (allPassed) {
          console.log('All eligible players passed with no bet - moving to next round', { eligiblePlayers });
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
      
      // Collapse cards immediately when accepting bet in PARES, JUEGO, or PUNTO rounds
      const isParesBetting = gameState.currentRound === 'PARES' && gameState.paresDeclarations;
      const isJuegoBetting = (gameState.currentRound === 'JUEGO') && gameState.juegoDeclarations;
      const isPuntoBetting = gameState.currentRound === 'PUNTO';
      
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
        // Player is accepting bet in JUEGO - collapse cards with animation
        console.log(`[BET ACCEPT] Player ${playerIndex + 1} accepting in JUEGO - collapsing cards`);
        collapseOnBetAcceptance(playerIndex, 'JUEGO');
        
        // If they said "puede", check penalty after collapse
        if (gameState.juegoDeclarations[playerIndex] === 'puede') {
          setTimeout(() => {
            checkPredictionPenalty(playerIndex, 'JUEGO', true);
          }, 100);
        }
      } else if (isPuntoBetting) {
        // Player is accepting bet in PUNTO - collapse cards with animation
        console.log(`[BET ACCEPT] Player ${playerIndex + 1} accepting in PUNTO - collapsing cards`);
        collapseOnBetAcceptance(playerIndex, 'PUNTO');
        
        // Check penalty after collapse (penalized if they actually have JUEGO)
        // In PUNTO betting, player is implicitly saying "no juego" (false)
        setTimeout(() => {
          checkPredictionPenalty(playerIndex, 'PUNTO', false);
        }, 100);
      }
      
      if (gameState.currentBet.betType === 'ordago') {
        // ORDAGO accepted - collapse all remaining cards, determine winner, end game
        console.log(`[ORDAGO ACCEPT] Player ${playerIndex + 1} accepted ORDAGO - collapsing all cards`);
        // Collapse all remaining cards and wait for animations to finish
          collapseAllRemaining().then(() => {
            revealAllCards(true);
          setTimeout(() => {
            const roundWinner = calculateRoundWinner();
            console.log(`[ORDAGO] ${roundWinner} wins ${gameState.currentRound} round - game over!`);
            // Award 40 points and show game over (which will freeze state)
            gameState.teams[roundWinner].score += 40;
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
      const isPuntoBetting = gameState.currentRound === 'PUNTO';
      
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
        // Player is placing bet in JUEGO - collapse cards with animation
        console.log(`[BET PLACE] Player ${playerIndex + 1} betting in JUEGO - collapsing cards`);
        collapseOnBetAcceptance(playerIndex, 'JUEGO');
        
        // If they said "puede", check penalty after collapse
        if (gameState.juegoDeclarations[playerIndex] === 'puede') {
          setTimeout(() => {
            checkPredictionPenalty(playerIndex, 'JUEGO', true);
          }, 100);
        }
      } else if (isPuntoBetting) {
        // Player is placing bet in PUNTO - collapse cards with animation
        console.log(`[BET PLACE] Player ${playerIndex + 1} betting in PUNTO - collapsing cards`);
        collapseOnBetAcceptance(playerIndex, 'PUNTO');
        
        // Check penalty after collapse (penalized if they actually have JUEGO)
        // In PUNTO betting, player is implicitly saying "no juego" (false)
        setTimeout(() => {
          checkPredictionPenalty(playerIndex, 'PUNTO', false);
        }, 100);
      }
      
      const isRaise = gameState.currentBet.bettingTeam && gameState.currentBet.bettingTeam !== playerTeam;
      const previousAmount = gameState.currentBet.amount || 0;
      
      gameState.currentBet.previousAmount = previousAmount;
      gameState.currentBet.amount = betAmount;
      gameState.currentBet.bettingTeam = playerTeam;
      gameState.currentBet.betType = 'envido';
      gameState.currentBet.isRaise = isRaise;
      gameState.currentBet.raiseCount = (gameState.currentBet.raiseCount || 0) + (isRaise ? 1 : 0);
      gameState.currentBet.isFirstBet = false; // No longer first bet after placement
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
      
      // Check if this is a raise (ordago as counter to existing bet) or first bet
      const isRaise = gameState.currentBet.bettingTeam && gameState.currentBet.bettingTeam !== playerTeam;
      const previousAmount = isRaise ? gameState.currentBet.amount : 0;
      
      if (isRaise) {
        console.log(`[ORDAGO] Counter-raise from bet of ${previousAmount} - previousAmount will be awarded if rejected`);
      } else {
        console.log(`[ORDAGO] First bet - 1 point will be awarded if rejected`);
      }
      
      gameState.currentBet.previousAmount = previousAmount; // Save for rejection calculation
      gameState.currentBet.amount = 40;
      gameState.currentBet.bettingTeam = playerTeam;
      gameState.currentBet.betType = 'ordago';
      gameState.currentBet.responses = {};
      gameState.currentBet.isRaise = isRaise; // Track if this is a counter-raise
      gameState.currentBet.raiseCount = (gameState.currentBet.raiseCount || 0) + (isRaise ? 1 : 0); // Increment if raise
      
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

    // Determine starting player for this round. Allow frontend demo tunneling
    // so you can observe dynamics even without server-side quantum RNG.
    try {
      const numPlayers = 4;
      const classicStart = gameState.manoIndex;
      let roundStart;

      if (gameState.forceTunnelNextRound) {
        const candidates = [...Array(numPlayers).keys()].filter(i => i !== classicStart);
        roundStart = candidates[Math.floor(Math.random() * candidates.length)];
        // Keep the demo force flag persistent so tunneling can occur across
        // consecutive rounds when the developer/tester requests it.
        console.log('[MOVE TO ROUND] Forced tunneling applied for demo (persistent).');
      } else {
        const pClassic = gameState.tunnelPClassic ?? 0.99;
        if (Math.random() < pClassic) {
          roundStart = classicStart;
        } else {
          const candidates = [...Array(numPlayers).keys()].filter(i => i !== classicStart);
          roundStart = candidates[Math.floor(Math.random() * candidates.length)];
          console.log('[MOVE TO ROUND] Tunneling occurred (demo random).');
        }
      }

      gameState.activePlayerIndex = roundStart;
      console.log(`[MOVE TO ROUND] Moving to ${gameState.currentRound}. Starting with Player ${gameState.activePlayerIndex + 1} (mano = ${gameState.manoIndex + 1})`);
      // Apply demo tunneling only for betting rounds (GRANDE/CHICA).
      // For declaration rounds (PARES/JUEGO) tunneling must occur once
      // inside the declaration flow to avoid duplicate application.
      if (gameState.currentRound === 'GRANDE' || gameState.currentRound === 'CHICA') {
        try {
          const classic = gameState.manoIndex ?? 0;
          const finalStarter = chooseRoundStarter(classic);
          gameState.activePlayerIndex = finalStarter;
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      gameState.activePlayerIndex = gameState.manoIndex;
      console.warn('[MOVE TO ROUND] Tunneling logic failed, defaulting to mano start', e);
    }

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
    const gameMode = window.currentGameMode || '8';
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
    const gameMode = window.currentGameMode || '8';
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
    try {
      const decl = gameState.currentRound === 'PARES' ? gameState.paresDeclarations?.[playerIndex] : gameState.juegoDeclarations?.[playerIndex];
      const handState = gameState.playerHands && gameState.playerHands[playerIndex];
      const playerId = `player${playerIndex + 1}`;
      const cardElements = Array.from(document.querySelectorAll(`#${playerId}-zone .quantum-card`)).map(c => ({
        entangled: c.dataset.entangled,
        collapsed: c.dataset.collapsed,
        value: c.dataset.value || c.dataset.mainValue
      }));
      console.debug(`[canPlayerBet] player=${playerIndex + 1} round=${gameState.currentRound} decl=`, decl, 'handState=', handState, 'domCards=', cardElements);
    } catch (e) {
      console.debug('[canPlayerBet] debug gather failed', e);
    }
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

    // If they declared NO TENGO (false), they can't bet (except a special
    // post-penalty state 'tengo_after_penalty' which should be allowed)
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

    // If not all collapsed, allow betting if they declared TENGO, PUEDE
    // or were marked as post-penalty tengo ('tengo_after_penalty').
    return declaration === true || declaration === 'puede' || declaration === 'tengo_after_penalty';
  }
  
  // Get next player who can bet in current round
  function nextPlayerWhoCanBet() {
    let attempts = 0;
    while (attempts < 4) {
      nextPlayer();
      console.debug(`[nextPlayerWhoCanBet] testing player ${gameState.activePlayerIndex + 1} (attempt ${attempts + 1})`);
      if (canPlayerBet(gameState.activePlayerIndex)) {
        console.debug(`[nextPlayerWhoCanBet] found eligible player ${gameState.activePlayerIndex + 1}`);
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
    // Reset tunnel-application guard for this declaration phase.
    proceedWithParesDeclaration._tunnelApplied = false;
    // Apply tunneling BEFORE declaration start so a tunneled mano declares first.
    try {
      const classic = gameState.manoIndex;
      const finalStarter = chooseRoundStarter(classic);
      gameState.activePlayerIndex = finalStarter;
      // If tunneling changed mano, mark that we've applied it for this phase
      if (finalStarter !== classic) {
        proceedWithParesDeclaration._tunnelApplied = true;
      }
    } catch (e) {
      console.warn('[startParesDeclaration] chooseRoundStarter failed', e);
      gameState.activePlayerIndex = gameState.manoIndex;
    }
    // Show declaration banner then proceed
    showDeclarationBanner('PARES', proceedWithParesDeclaration);
  }
  
  function proceedWithParesDeclaration() {
      // Process declarations for all players in order starting from current active player
      // Prevent repeated declaration after transition
      if (proceedWithParesDeclaration._locked) return;
      if (Object.keys(gameState.paresDeclarations).length === 4) {
        proceedWithParesDeclaration._locked = true;
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
        const isOnlineGame = !!(window.onlineMode && window.QuantumMusSocket && window.QuantumMusOnlineRoom);
        setTimeout(() => {
          handleParesDeclaration(gameState.activePlayerIndex, autoResult, true);
          // For local mode, advance turn here
          // For online mode, let server handle turn advancement
          if (!isOnlineGame) {
            nextPlayer();
            proceedWithParesDeclaration();
          }
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
    const gameMode = window.currentGameMode || '8';
    
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
  
  // Make a declaration in online mode (sends to server)
  function makeDeclaration(playerIndex, declaration, roundName, isAutoDeclaration = false) {
    if (!window.onlineMode || !window.QuantumMusSocket || !window.QuantumMusOnlineRoom) {
      console.warn('[makeDeclaration] Not in online mode, ignoring');
      return;
    }
    
    const serverIdx = localToServer(playerIndex);
    console.log(`[makeDeclaration] Player ${playerIndex + 1} (server ${serverIdx}) declaring '${declaration}' in ${roundName} (auto: ${isAutoDeclaration})`);
    
    // First, send the declaration to store it
    window.QuantumMusSocket.emit('player_declaration', {
      room_id: window.QuantumMusOnlineRoom,
      player_index: serverIdx,
      declaration: declaration === 'tengo' ? true : declaration === 'no_tengo' ? false : 'puede',
      round_name: roundName,
      is_auto_declared: isAutoDeclaration
    });
    
    // ONLY trigger collapse for MANUAL tengo/no_tengo declarations
    // Auto-declarations NEVER trigger collapse (cards already collapsed)
    if ((declaration === 'tengo' || declaration === 'no_tengo') && !isAutoDeclaration) {
      console.log(`[makeDeclaration] Manual declaration, triggering collapse`);
      window.QuantumMusSocket.emit('trigger_declaration_collapse', {
        room_id: window.QuantumMusOnlineRoom,
        player_index: serverIdx,
        declaration: declaration,
        round_name: roundName
      });
    }
    // For 'puede', no collapse happens - turn advancement will be handled by proceedWithParesDeclaration
  }
  
  function handleParesDeclaration(playerIndex, declaration, isAutoDeclared = false) {
    // declaration can be: true (tengo), false (no tengo), or 'puede'
    gameState.paresDeclarations[playerIndex] = declaration;
    
    // Show notification based on declaration
    const notificationType = declaration === true ? 'pares' : 
                            declaration === false ? 'no_pares' : 'puede_pares';
    showActionNotification(playerIndex, notificationType);
    
    // Check if we're in online mode
    const isOnlineGame = !!(window.onlineMode && window.QuantumMusSocket && window.QuantumMusOnlineRoom);
    
    // If auto-declared, disable buttons to prevent player interaction
    if (isAutoDeclared) {
      const buttons = document.querySelectorAll('.scoreboard-controls .quantum-gate');
      buttons.forEach(btn => btn.disabled = true);
    }
    
    // If this was a manual declaration, stop this player's timer
    if (!isAutoDeclared) {
      if (timerInterval) {
        clearTimeout(timerInterval);
        timerInterval = null;
      }
      hideTimerBar(playerIndex);
      
      // For online mode, send declaration to server
      if (isOnlineGame && typeof makeDeclaration === 'function') {
        const declStr = declaration === true ? 'tengo' : declaration === false ? 'no_tengo' : 'puede';
        try { 
          makeDeclaration(playerIndex, declStr, 'PARES', false); // false = manual declaration
          // For tengo/no_tengo, wait for server collapse response before advancing
          // For puede, server will send next_player in declaration_made event
          if (declaration !== 'puede') {
            window._waitingServerDeclaration = { playerIndex, roundName: 'PARES', ts: Date.now() };
          }
        } catch (e) { 
          console.error('[handleParesDeclaration] Error calling makeDeclaration:', e);
        }
      } else {
        // Local mode: collapse and advance
        if (declaration === true || declaration === false) {
          collapseOnDeclaration(playerIndex, 'PARES', declaration);
        }
        nextPlayer();
        startPlayerTurnTimer(gameState.activePlayerIndex);
      }
    } else {
      // Auto-declared - cards are already collapsed, NO collapse needed
      console.log(`[AUTO-DECLARATION] Player ${playerIndex + 1} auto-declared, no collapse needed (cards already collapsed)`);
      
      if (isOnlineGame && typeof makeDeclaration === 'function') {
        const declStr = declaration === true ? 'tengo' : declaration === false ? 'no_tengo' : 'puede';
        try { 
          makeDeclaration(playerIndex, declStr, 'PARES', true); // true = auto-declaration, NO collapse
          
          // For auto-declarations, DON'T trigger collapse (cards already collapsed)
          // Just advance turn - server will handle it via declaration_made event
          console.log(`[AUTO-DECLARATION] Sent to server, waiting for turn advancement`);
        } catch (e) { 
          console.error('[handleParesDeclaration] Error calling makeDeclaration:', e);
        }
      } else {
        // Local mode - NO collapse for auto-declarations
        // Cards are already collapsed, just advance turn
        console.log(`[AUTO-DECLARATION] Local mode, advancing turn without collapse`);
        // Turn advancement handled by proceedWithParesDeclaration
      }
    }
    
    // Check if all players declared
    if (Object.keys(gameState.paresDeclarations).length < 4) {
      // Still need more declarations - move to next player
      if (!isAutoDeclared && !isOnlineGame) {
        // Local mode only - online mode handles turn advancement via socket events or above
        proceedWithParesDeclaration();
      }
      return;
    }
    
    // All players have declared
    handleAllParesDeclarationsDone();
  }
  
  function handleAllParesDeclarationsDone() {
    try {
      console.debug('[handleAllParesDeclarationsDone] paresDeclarations=', gameState.paresDeclarations, 'playerHands=', gameState.playerHands);
    } catch (e) {
      console.debug('[handleAllParesDeclarationsDone] debug gather failed', e);
    }
    // Count declarations per team
    // Treat 'tengo_after_penalty' as a TENGO for counting/eligibility purposes
    const isTengo = (val) => val === true || val === 'tengo_after_penalty';
    const isPuede = (val) => val === 'puede';
    const isNoTengo = (val) => val === false;
    
    const team1Players = gameState.teams.team1.players;
    const team2Players = gameState.teams.team2.players;
    
    // Count each type of declaration per team
    const team1Tengo = team1Players.filter(p => isTengo(gameState.paresDeclarations[p])).length;
    const team1Puede = team1Players.filter(p => isPuede(gameState.paresDeclarations[p])).length;
    const team1NoTengo = team1Players.filter(p => isNoTengo(gameState.paresDeclarations[p])).length;
    
    const team2Tengo = team2Players.filter(p => isTengo(gameState.paresDeclarations[p])).length;
    const team2Puede = team2Players.filter(p => isPuede(gameState.paresDeclarations[p])).length;
    const team2NoTengo = team2Players.filter(p => isNoTengo(gameState.paresDeclarations[p])).length;
    
    console.log(`PARES declarations - Team1: ${team1Tengo} tengo, ${team1Puede} puede, ${team1NoTengo} no tengo`);
    console.log(`PARES declarations - Team2: ${team2Tengo} tengo, ${team2Puede} puede, ${team2NoTengo} no tengo`);
    
    // Determine if betting should happen based on requirements:
    // Betting is ONLY skipped if: 
    // - 1-2 players from SAME team say "tengo"/"puede" 
    // - AND both players from OTHER team say "no tengo"
    const team1HasInterest = (team1Tengo + team1Puede >= 1);
    const team2HasInterest = (team2Tengo + team2Puede >= 1);
    const team1AllNoTengo = (team1NoTengo === 2);
    const team2AllNoTengo = (team2NoTengo === 2);
    
    // Betting is skipped only if one team has interest and other team all said no
    const shouldSkipBetting = (team1HasInterest && team2AllNoTengo) || 
                              (team2HasInterest && team1AllNoTengo);
    
    // Betting happens if we shouldn't skip it
    const canBet = !shouldSkipBetting;
    
    console.log(`PARES betting decision: team1HasInterest=${team1HasInterest}, team2HasInterest=${team2HasInterest}, team1AllNoTengo=${team1AllNoTengo}, team2AllNoTengo=${team2AllNoTengo}, shouldSkipBetting=${shouldSkipBetting}, canBet=${canBet}`);

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
      
      // Start from mano. If tunneling was NOT already applied at declaration
      // start, apply it now once. This avoids repeated tunneling loops.
      try {
        if (!proceedWithParesDeclaration._tunnelApplied) {
          const classicStart = gameState.manoIndex;
          const finalStart = chooseRoundStarter(classicStart);
          gameState.activePlayerIndex = finalStart;
          proceedWithParesDeclaration._tunnelApplied = true;
        } else {
          gameState.activePlayerIndex = gameState.manoIndex;
        }

        // If chosen starter cannot bet, find next eligible player
        if (!canPlayerBet(gameState.activePlayerIndex)) {
          console.log(`Chosen starter (Player ${gameState.activePlayerIndex + 1}) cannot bet, finding next eligible player`);
          nextPlayerWhoCanBet();
        }
      } catch (e) {
        gameState.activePlayerIndex = gameState.manoIndex;
        if (!canPlayerBet(gameState.activePlayerIndex)) nextPlayerWhoCanBet();
      }
      
      console.log(`Starting PARES betting with Player ${gameState.activePlayerIndex + 1}`);
      // Keep `paresDeclarations` intact so server/client betting eligibility checks work
      
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
          // Safety: force transition to JUEGO if betting round stalls
          setTimeout(() => {
            if (gameState.currentRound === 'PARES') {
              console.log('[SAFETY] Forcing transition to JUEGO after PARES betting');
              moveToNextRound('JUEGO');
            }
          }, 15000); // 15 seconds safety timeout

      // Ensure juego declarations are reset and preserve any preJuegoDeclarations
      // Clear PARES declaration state to avoid AI confusion
      try { gameState.paresDeclarations = undefined; } catch (e) { gameState.paresDeclarations = null; }
      gameState.currentRound = 'JUEGO';
      gameState.juegoDeclarations = {};
      // Apply demo tunneling for JUEGO start as well
      try {
        const classicStart = gameState.manoIndex;
        const finalStart = chooseRoundStarter(classicStart);
        gameState.activePlayerIndex = finalStart;
      } catch (e) {
        gameState.activePlayerIndex = gameState.manoIndex;
      }

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
    const gameMode = window.currentGameMode || '8';
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
    const gameMode = window.currentGameMode || '8';
    
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
    // Reset tunnel-application guard for this declaration phase.
    proceedWithJuegoDeclaration._tunnelApplied = false;
    // Apply tunneling BEFORE declaration start so a tunneled mano declares first.
    try {
      const classic = gameState.manoIndex;
      const finalStarter = chooseRoundStarter(classic);
      gameState.activePlayerIndex = finalStarter;
      if (finalStarter !== classic) {
        proceedWithJuegoDeclaration._tunnelApplied = true;
      }
    } catch (e) {
      console.warn('[startJuegoDeclaration] chooseRoundStarter failed', e);
      gameState.activePlayerIndex = gameState.manoIndex;
    }
    // Don't clear preJuegoDeclarations here - use them in proceedWithJuegoDeclaration
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
    // Ensure tunneling is applied at the start of the JUEGO declaration phase
    if (!proceedWithJuegoDeclaration._tunnelApplied) {
      try {
        applyRoundStartTunnel(gameState.manoIndex);
      } catch (e) { /* ignore */ }
      proceedWithJuegoDeclaration._tunnelApplied = true;
    }
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
    
    // If this was a manual declaration, stop this player's timer and (if local) pass turn immediately
    if (!isAutoDeclared) {
      if (timerInterval) {
        clearTimeout(timerInterval);
        timerInterval = null;
      }
      hideTimerBar(playerIndex);
      const isOnlineGame = !!(window.onlineMode && window.QuantumMusSocket && window.QuantumMusOnlineRoom);
      if (isOnlineGame) {
        try { window._waitingServerDeclaration = { playerIndex, roundName: 'JUEGO', ts: Date.now() }; } catch (e) {}
      } else {
        nextPlayer();
        startPlayerTurnTimer(gameState.activePlayerIndex);
      }
    }

    // Collapse cards on manual declaration (same as PARES behavior)
    // Trigger collapse for manual TENGO or NO TENGO declarations
    if ((hasJuego === true || hasJuego === false) && !isAutoDeclared) {
      const isOnlineGame = !!(window.onlineMode && window.QuantumMusSocket && window.QuantumMusOnlineRoom);
      if (isOnlineGame && typeof makeDeclaration === 'function') {
        const declStr = hasJuego === true ? 'tengo' : 'no_tengo';
        try { makeDeclaration(playerIndex, declStr, 'JUEGO'); } catch (e) { /* ignore */ }
      } else {
        collapseOnDeclaration(playerIndex, 'JUEGO', hasJuego);
      }
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
    // Count declarations per team (similar to PARES logic)
    const isTengo = (val) => val === true || val === 'tengo_after_penalty';
    const isPuede = (val) => val === 'puede';
    const isNoTengo = (val) => val === false;
    
    const team1Players = gameState.teams.team1.players;
    const team2Players = gameState.teams.team2.players;
    
    // Count each type of declaration per team
    const team1Tengo = team1Players.filter(p => isTengo(gameState.juegoDeclarations[p])).length;
    const team1Puede = team1Players.filter(p => isPuede(gameState.juegoDeclarations[p])).length;
    const team1NoTengo = team1Players.filter(p => isNoTengo(gameState.juegoDeclarations[p])).length;
    
    const team2Tengo = team2Players.filter(p => isTengo(gameState.juegoDeclarations[p])).length;
    const team2Puede = team2Players.filter(p => isPuede(gameState.juegoDeclarations[p])).length;
    const team2NoTengo = team2Players.filter(p => isNoTengo(gameState.juegoDeclarations[p])).length;
    
    console.log(`JUEGO declarations - Team1: ${team1Tengo} tengo, ${team1Puede} puede, ${team1NoTengo} no tengo`);
    console.log(`JUEGO declarations - Team2: ${team2Tengo} tengo, ${team2Puede} puede, ${team2NoTengo} no tengo`);
    
    // Check if everyone said "puede" → start PUNTO betting
    const everyonePuede = (team1Puede === 2 && team2Puede === 2);
    if (everyonePuede) {
      console.log('Everyone said PUEDE - starting PUNTO betting');
      gameState.currentRound = 'PUNTO';
      try {
        gameState._puntoStartGuard = true;
        setTimeout(() => { gameState._puntoStartGuard = false; }, 1500);
      } catch (e) {}
      startPuntoBetting();
      return;
    }
    
    // Check if no one has JUEGO (all said "no tengo") → start PUNTO betting
    if (team1Tengo === 0 && team2Tengo === 0 && team1Puede === 0 && team2Puede === 0) {
      console.log('No one has JUEGO (all NO TENGO) - starting PUNTO betting');
      gameState.currentRound = 'PUNTO';
      try {
        gameState._puntoStartGuard = true;
        setTimeout(() => { gameState._puntoStartGuard = false; }, 1500);
      } catch (e) {}
      startPuntoBetting();
      return;
    }
    
    // Determine if betting should happen (same logic as PARES)
    // Betting is ONLY skipped if: 
    // - 1-2 players from SAME team say "tengo"/"puede" 
    // - AND both players from OTHER team say "no tengo"
    const team1HasInterest = (team1Tengo + team1Puede >= 1);
    const team2HasInterest = (team2Tengo + team2Puede >= 1);
    const team1AllNoTengo = (team1NoTengo === 2);
    const team2AllNoTengo = (team2NoTengo === 2);
    
    // Betting is skipped only if one team has interest and other team all said no
    const shouldSkipBetting = (team1HasInterest && team2AllNoTengo) || 
                              (team2HasInterest && team1AllNoTengo);
    
    // Betting happens if we shouldn't skip it
    const canBet = !shouldSkipBetting;
    
    console.log(`JUEGO betting decision: team1HasInterest=${team1HasInterest}, team2HasInterest=${team2HasInterest}, team1AllNoTengo=${team1AllNoTengo}, team2AllNoTengo=${team2AllNoTengo}, shouldSkipBetting=${shouldSkipBetting}, canBet=${canBet}`);

    if (canBet) {
      // Start JUEGO betting (only TENGO and PUEDE players can bet)
      console.log('Starting JUEGO betting - both teams can compete');
      
      // Reset bet state for betting phase
      gameState.currentBet = {
        amount: 0,
        previousAmount: 0,
        betType: null,
        teamMakingBet: null,
        playerMakingBet: null,
        waitingForResponse: false
      };
      
      // Initialize phase and handlers
      gameState.juegoPhase = 'betting';
      gameState.activePlayerIndex = gameState.manoIndex;
      startPlayerTurnTimer(gameState.activePlayerIndex);
      updateScoreboard();
    } else {
      // Only one team has JUEGO/PUEDE - skip betting, move to PUNTO or conteo
      console.log('Only one team has interest - skipping JUEGO betting, moving to PUNTO');
      gameState.currentRound = 'PUNTO';
      startPuntoBetting();
    }
  }
  
  function startPuntoBetting() {
    console.log('Starting PUNTO betting - all players compete for highest sum');
    
    // Reset bet state for PUNTO betting phase
    gameState.currentBet = {
      amount: 0,
      previousAmount: 0,
      betType: null,
      bettingTeam: null,
      playerMakingBet: null,
      responses: {},
      waitingForResponse: false
    };
    
    // Start betting from mano
    gameState.activePlayerIndex = gameState.manoIndex;
    startPlayerTurnTimer(gameState.activePlayerIndex);
    updateScoreboard();
  }
  
  function calculateJuego(cards) {
    const gameMode = window.currentGameMode || '8';
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

    const isOnlineGame = !!(window.onlineMode && window.QuantumMusSocket && window.QuantumMusOnlineRoom);

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

      // Check if any team reached winning score (updateScoreboard will handle showing game over)
      if (gameState.teams.team1.score >= 40 || gameState.teams.team2.score >= 40) {
        return; // Game is over, updateScoreboard handled it
      }

      // Reset pending points for next hand
      gameState.pendingPoints = {
        team1: { GRANDE: 0, CHICA: 0, PARES: 0, JUEGO: 0 },
        team2: { GRANDE: 0, CHICA: 0, PARES: 0, JUEGO: 0 }
      };

      // Clear puntoPlayed flag after scoring
      gameState.puntoPlayed = false;

      showHandSummary(scoringDetails);
      if (isOnlineGame) {
        console.log('[ONLINE] Waiting for server to start new hand');
        return;
      }
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
            
            if (isEntangled && entangledPartner) {
              // Para entrelazadas: mostrar el partner
              bottomLabel.innerHTML = `|${entangledPartner}⟩`;
            } else {
              // Para normales: mostrar el mismo valor
              bottomLabel.innerHTML = `|${value}⟩`;
            }
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
              const boolDecl = decl === true || decl === 'tengo' || decl === 'tengo_after_penalty';
              checkPredictionPenalty(idx, 'PARES', boolDecl);
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

    const isOnlineGame = !!(window.onlineMode && window.QuantumMusSocket && window.QuantumMusOnlineRoom);
    
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

    // Determine next mano with optional tunneling for demo inspection
    if (isOnlineGame) {
      // In online mode, mano is server-authoritative; keep current value.
      gameState.activePlayerIndex = gameState.manoIndex;
    } else {
      try {
        const numPlayers = 4;
        const classicNext = (gameState.manoIndex - 1 + numPlayers) % numPlayers; // counter-clockwise
        let nextMano;

        if (gameState.forceTunnelNextHand) {
          const candidates = [...Array(numPlayers).keys()].filter(i => i !== classicNext);
          nextMano = candidates[Math.floor(Math.random() * candidates.length)];
          gameState.forceTunnelNextHand = false;
          console.log('[NEW HAND] Forced mano tunneling applied for demo.');
        } else {
          const pClassic = gameState.tunnelPClassic ?? 0.99;
          if (Math.random() < pClassic) {
            nextMano = classicNext;
          } else {
            const candidates = [...Array(numPlayers).keys()].filter(i => i !== classicNext);
            nextMano = candidates[Math.floor(Math.random() * candidates.length)];
            console.log('[NEW HAND] Mano tunneling occurred (demo random).');
          }
        }

        gameState.manoIndex = nextMano;
        gameState.activePlayerIndex = gameState.manoIndex;
      } catch (e) {
        gameState.manoIndex = (gameState.manoIndex - 1 + 4) % 4; // Rotate mano counter-clockwise (fallback)
        gameState.activePlayerIndex = gameState.manoIndex;
        console.warn('[NEW HAND] Tunneling logic failed, defaulting to classic rotation', e);
      }
    }
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
    const gameMode = window.currentGameMode || '8';
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
  // Show game over panel with winner
  function showGameOver(winningTeam) {
    console.log(`[GAME OVER] Winner: ${winningTeam}`);
    
    // Ensure game is frozen first
    freezeGameState();
    
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
      
      // Check if in online mode
      const isOnlineGame = !!(window.onlineMode && window.QuantumMusSocket && window.QuantumMusOnlineRoom);
      
      if (isOnlineGame) {
        // Online mode: notify server and return all players to lobby
        const socket = window.QuantumMusSocket;
        const roomId = window.QuantumMusOnlineRoom;
        
        console.log('[GAME OVER] Returning to lobby in online mode, room:', roomId);
        
        // Send return to lobby event to server
        socket.emit('return_to_lobby', { room_id: roomId });
        
        // The server will emit 'returned_to_lobby' to all players
        // Navigation.js should handle that event
      }
      
      // Return to lobby (works for both online and local mode)
      if (window.showScreen) {
        window.showScreen('lobby');
      } else {
        window.location.reload();
      }
    });
  }
  
  // Make showGameOver available globally for online mode
  window.showGameOver = showGameOver;
  
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

    // Character Avatar (use character color so lobby and game match)
    const avatar = document.createElement('div');
    avatar.className = `character-avatar ${player.character}`;
    avatar.style.cursor = 'pointer';
    avatar.style.position = 'relative';
    // Frame avatar with character color (ensures lobby/game consistency)
    try {
      const frameColor = getCharacterColorValue(player.character) || getPlayerColorValue(index) || '#2ec4b6';
      avatar.style.border = `2px solid ${frameColor}`;
      avatar.style.borderRadius = '8px';
      avatar.style.padding = '4px';
    } catch (e) {}
    
    // Character descriptions (last name only as key)
    const characterDescriptions = {
      'Preskill': '<strong>John Preskill (1961-presente)</strong><br><br>Pionero teórico en información cuántica e informática cuántica. Preskill es el Profesor Richard P. Feynman de Física Teórica en Caltech y una autoridad destacada en corrección de errores cuánticos y el camino hacia computadoras cuánticas prácticas. Su trabajo fundamental en códigos cuánticos ha transformado la forma en que entendemos la protección de información cuántica.<br><br><strong>Símbolo de la Carta:</strong> El código de corrección de errores (círculos anidados) representa códigos de corrección de errores cuánticos - mecanismos esenciales que protegen la información cuántica de la decoherencia y el ruido ambiental, haciendo posibles computadoras cuánticas confiables. Los círculos concéntricos simbolizan las capas redundantes de protección contra errores qubit.<br><br><strong>Contribución:</strong> Desarrolló marcos fundamentales para corrección de errores cuánticos, estableció el concepto de era "NISQ" (Noisy Intermediate-Scale Quantum), y continúa guiando la realización práctica de computadoras cuánticas en el mundo real. Sus predicciones sobre la viabilidad de computadores cuánticos prácticos han influenciado toda la industria cuántica moderna.',
      'Zoller': '<strong>Peter Zoller (1952-presente)</strong><br><br>Distinguido físico cuántico especializado en computación cuántica con iones atrapados. Zoller desarrolló protocolos detallados para manipular y medir estados cuánticos usando iones enfriados por láser, revolucionando la implementación práctica de la computación cuántica. Como colega de Cirac en Max Planck, sus contribuciones teóricas han sido fundamentales para el desarrollo experimental de computadoras cuánticas.<br><br><strong>Símbolo de la Carta:</strong> La celosía cuántica (puntos interconectados) representa la disposición geométrica de iones atrapados en una computadora cuántica, mostrando cómo los bits cuánticos individuales se comunican e se enredan entre sí. Las líneas conectantes simbolizan las interacciones de largo alcance entre iones mediadas por fotones.<br><br><strong>Contribución:</strong> Sus protocolos transformaron sistemas de iones atrapados en computadoras cuánticas prácticas, proporcionando instrucciones paso a paso para operaciones de puertas cuánticas que se implementan en los laboratorios de investigación más avanzados. El protocolo Cirac-Zoller es utilizado hasta hoy en experimentos de vanguardia.',
      'Cirac': '<strong>Ignacio Cirac (1965-presente)</strong><br><br>Científico de información cuántica líder que revolucionó la teoría de la informática cuántica. Cirac es reconocido por desarrollar protocolos de simulación cuántica y demostrar cómo construir computadoras cuánticas usando iones atrapados. Trabaja en el Instituto Max Planck de Óptica Cuántica y ha sido instrumental en entender cómo sistemas cuánticos simples pueden simular sistemas cuánticos complejos.<br><br><strong>Símbolo de la Carta:</strong> La representación de trampa de iones (tres puntos dispuestos en un patrón) simboliza iones atrapados dispuestos en una configuración lineal - los componentes fundamentales para la computación cuántica en su enfoque. Cada punto representa un ion que puede ser manipulado y medido con precisión extraordinaria.<br><br><strong>Contribución:</strong> Su trabajo sobre entrelazamiento cuántico y sistemas de muchos cuerpos creó el fundamento teórico para computadoras y simuladores cuánticos modernos. Desarrolló el protocolo Cirac-Zoller, piedra angular para implementar compuertas de dos qubits en sistemas de iones atrapados.',
      'Simmons': '<strong>Michelle Simmons (1967-presente)</strong><br><br>Física australiana pionera en computación cuántica a escala atómica. Simmons es directora del Centro de Excelencia en Tecnologías Cuánticas de Australia y ha revolucionado la forma en que construimos dispositivos cuánticos usando silicio. Su trabajo utiliza microscopía de efecto túnel escanificado para posicionar átomos individuales de fósforo en silicio, creando transistores de un solo átomo y sistemas cuánticos de precisión extrema.<br><br><strong>Símbolo de la Carta:</strong> El átomo de fósforo puntualmente posicionado en una red de silicio representa la precisión extraordinaria del enfoque de Simmons en ingeniería cuántica a escala atómica. Cada posición de átomo es controlada con precisión de picómetros, permitiendo circuitos cuánticos integrados únicos.<br><br><strong>Contribución:</strong> Creó el primer transistor de un solo átomo y demostró que los sistemas de silicio pueden mantener coherencia cuántica lo suficientemente larga como para computación práctica. Su "quantum atom engineering" ha abierto una ruta totalmente nueva hacia computadoras cuánticas escalables que usan tecnología familiar de semiconductores.',
      'Broadbent': '<strong>Anne Broadbent (1978-presente)</strong><br><br>Destacada criptógrafa cuántica y teórica de información cuántica. Broadbent ha realizado contribuciones fundamentales a la criptografía cuántica y especialmente a la computación cuántica delegada - cómo un cliente puede verificar que un servidor ha realizado cálculos cuánticos correctamente. Su trabajo combina rigor matemático con aplicaciones prácticas en seguridad cuántica.<br><br><strong>Símbolo de la Carta:</strong> El símbolo de candado con seguridad representa el enfoque de Broadbent en proteger y verificar la integridad de información cuántica. La seguridad cuántica es fundamental para confiar en sistemas cuánticos en aplicaciones del mundo real, desde comunicaciones hasta computacion cuántica delegada.<br><br><strong>Contribución:</strong> Desarrolló protocolos revolucionarios para computacion cuántica delegada que permiten verificar resultados de computadoras cuánticas sin poseer una propia. Sus contribuciones en criptografía cuántica han establecido estándares para seguridad en sistemas de información cuántica.',
      'Deutsch': '<strong>David Deutsch (1953-presente)</strong><br><br>Fundador de la teoría de la computación cuántica - el primero en reconocer que las computadoras cuánticas podrían resolver problemas exponencialmente más rápido que las computadoras clásicas. Su trabajo revolucionario estableció algoritmos cuánticos como un nuevo paradigma computacional y sentó las bases para toda la industria cuántica moderna. Trabaja en la Universidad de Oxford y es un filósofo además de físico, explorando las implicaciones profundas de la mecánica cuántica.<br><br><strong>Símbolo de la Carta:</strong> La representación de circuito cuántico (caja con círculo y punto) simboliza una puerta cuántica - las operaciones computacionales fundamentales que manipulan bits cuánticos y forman la base de algoritmos cuánticos. La estructura representa el flujo de información a través de operaciones controladas.<br><br><strong>Contribución:</strong> Probó que el principio Church-Turing se extiende a la mecánica cuántica y creó el algoritmo de Deutsch, el primer algoritmo cuántico que demuestra ventaja computacional sobre métodos clásicos. Su visión de computadoras cuánticas universales pavimentó el camino para el desarrollo teórico de algoritmos como Shor y Grover.',
      'Yunger Halpern': '<strong>Nicole Yunger Halpern (Halpern, 1987-presente)</strong><br><br>Física teórica innovadora especializada en termodinámica cuántica y conexiones entre mecánica cuántica y fenómenos del mundo real observable. Yunger Halpern trabaja en la División de Física del Laboratorio Nacional de Tiempo Estándar de NIST y es conocida por su creatividad en conectar conceptos cuánticos esotéricos con aplicaciones prácticas. Su investigación explora cómo la información cuántica se comporta bajo condiciones termodinámicas reales.<br><br><strong>Símbolo de la Carta:</strong> El símbolo de engranaje steampunk representa la combinación ingeniosa de Yunger Halpern de ideas antiguas de la física con nuevas perspectivas cuánticas. Los engranajes simbolizan cómo diferentes conceptos mecánicos (termodinámica clásica y mecánica cuántica) pueden interconectarse de maneras sorprendentes.<br><br><strong>Contribución:</strong> Reveló conexiones profundas entre entrelazamiento cuántico y fenómenos termodinámicos, mostrando cómo sistemas cuánticos pueden desafiar intuiciones clásicas. Su serie educativa divulgando ciencia cuántica ha inspirado a generaciones de estudiantes a explorar la magia de la mecánica cuántica.',
      'Hallberg': '<strong>Karen Hallberg (1960-presente)</strong><br><br>Eminente física teórica argentina especializada en sistemas cuánticos fuertemente correlacionados y métodos computacionales para resolver problemas cuánticos complejos. Hallberg es investigadora principal en el Centro Atómico Bariloche y ha desarrollado técnicas sofisticadas para entender sistemas donde las aproximaciones simples fallan. Su trabajo en ciencia de materiales cuánticos ha abierto nuevas rutas para diseñar materiales con propiedades cuánticas útiles.<br><br><strong>Símbolo de la Carta:</strong> Los símbolos de estructura molecular interconectada representan el enfoque de Hallberg en entender cómo los átomos se combinan para crear comportamientos cuánticos colectivos. Las conexiones entre moléculas simbolizan los entrelamientos cuánticos complejos que emergen en sistemas muchos-cuerpos.<br><br><strong>Contribución:</strong> Desarrolló métodos numéricos innovadores (como método DMRG adaptado) para simular sistemas cuánticos que de otro modo serían intratables computacionalmente, permitiendo la predicción de propiedades de nuevos materiales cuánticos y diseño racional de dispositivos cuánticos.'
    };
    
    // Always use last name, and color from player.color
    avatar.innerHTML = `
      <div class="character-portrait" style="position: relative;">
        ${CardGenerator.generateCharacter(player.name, player.color || getCharacterColorValue(player.character))}
      </div>
      <div class="character-name" style="color: ${player.color || getCharacterColorValue(player.character)}">
        ${player.name}${displayName}
      </div>
      <div class="character-score" style="color: ${player.color || getCharacterColorValue(player.character)}" data-score="0">
        (0)
      </div>
      ${isMano ? `<div class="atom-indicator" title="Mano - Comienza el juego">${CardGenerator.generateAtomIndicator(player.color || getCharacterColorValue(player.character))}</div>` : ''}
    `;
    
    // Add click event for character description (show colored header)
    avatar.addEventListener('click', () => {
      // Always use last name for description lookup
      const desc = characterDescriptions[player.name] || '';
      const color = player.color || getCharacterColorValue(player.character) || '#2ec4b6';
      showCharacterModal(player.name, desc, color);
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
    const isOnlineGame = !!(window.onlineMode && window.QuantumMusSocket && window.QuantumMusOnlineRoom);

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

    // Reset per-player timeout-consumed flag so this player's automatic action
    // can be executed exactly once when the timer expires.
    gameState.playerTimeoutConsumed = gameState.playerTimeoutConsumed || [false, false, false, false];
    gameState.playerTimeoutConsumed[index] = false;
    
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

    // Clear any existing timers before setting new ones
    if (timerInterval) {
      clearTimeout(timerInterval);
      timerInterval = null;
    }
    if (aiDecisionTimeout) {
      clearTimeout(aiDecisionTimeout);
      aiDecisionTimeout = null;
    }

    // Start the animation: bar empties from 100% to 0% over duration
    // Wait for visual bar to render, THEN start the countdown timer
    setTimeout(() => {
      fill.style.transition = `width ${duration}s linear`;
      fill.style.width = '0%'; // Animate to empty
      
      // Now that the visual timer bar is animating, start the actual countdown
      // Set timeout handler (offline/local only)
      if (!isOnlineGame) {
        timerInterval = setTimeout(() => {
          // Timeout - auto action
          if (onTimeout) {
            onTimeout();
          } else {
            handleTimeout(index);
          }
        }, duration * 1000);
      }
      
      console.log(`[startPlayerTurnTimer] Timer bar visible and countdown started for ${duration}s. Is AI player? ${index !== 0}`);
      
      // If AI player, make decision (offline/local only)
      if (!isOnlineGame && index !== 0) {
        console.log(`[startPlayerTurnTimer] Triggering AI decision for player ${index + 1}`);
        makeAIDecision(index);
      }
    }, 50);
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
    
    // Add highlight to active player using character colors (match lobby)
    const activeZone = document.querySelector(`#player${index + 1}-zone`);
    if (activeZone) {
      // Build colors array from assigned character keys (fallback to seat colors)
      const colors = [];
      for (let i = 0; i < 4; i++) {
        const charKey = (gameState.playerCharacters && gameState.playerCharacters[i]) || null;
        const col = charKey ? getCharacterColorValue(charKey) : getPlayerColorValue(i);
        colors.push(col);
      }
      activeZone.style.boxShadow = `0 0 30px ${colors[index]}`;
      activeZone.style.transition = 'box-shadow 0.3s';
    }
    
    // Update button states (only enable for local player)
    updateButtonStates(index === 0);
  }
  
  // Enable/disable buttons based on whose turn it is
  function updateButtonStates(isLocalPlayerTurn) {
    const musBtn = document.querySelector('.scoreboard-controls .quantum-gate:not(.m-gate):not(.i-gate):not(.accept-gate):not(.ordago-gate)');
    const envidoBtn = document.querySelector('.quantum-gate.m-gate');
    const pasoBtn = document.querySelector('.quantum-gate.i-gate');
    const acceptBtn = document.querySelector('.quantum-gate.accept-gate');
    const ordagoBtn = document.querySelector('.quantum-gate.ordago-gate');
    
    // During CONTEO phase, all buttons should be disabled
    if (gameState.currentRound === 'CONTEO') {
      [musBtn, envidoBtn, pasoBtn, acceptBtn, ordagoBtn].forEach(btn => {
        if (btn) {
          btn.disabled = true;
          btn.style.opacity = '0.5';
          btn.style.cursor = 'not-allowed';
          btn.style.pointerEvents = 'none';
          btn.style.display = 'none';
        }
      });
      return;
    }
    
    // Determine if there's an active bet and if local player is on defending team
    const localPlayerTeam = getPlayerTeam(0); // Local player is always index 0
    const hasActiveBet = gameState.currentBet && gameState.currentBet.bettingTeam && gameState.currentBet.amount > 0;
    const isDefending = hasActiveBet && gameState.currentBet.bettingTeam !== localPlayerTeam;
    const isBettingRound = ['GRANDE', 'CHICA', 'PARES', 'JUEGO'].includes(gameState.currentRound);
    const isMus = gameState.currentRound === 'MUS';
    
    // --- Button visibility ---
    
    // MUS button: only in MUS round and PARES/JUEGO declaration phases
    if (musBtn) {
      musBtn.style.display = (isMus || gameState.currentRound === 'PARES' || gameState.currentRound === 'JUEGO') ? '' : 'none';
    }
    
    // PASO button: always visible when playing
    if (pasoBtn) pasoBtn.style.display = '';
    
    // ENVIDO button: visible in MUS and betting rounds
    if (envidoBtn) envidoBtn.style.display = (isMus || isBettingRound) ? '' : 'none';
    
    // ORDAGO button: visible in MUS and betting rounds
    if (ordagoBtn) ordagoBtn.style.display = (isMus || isBettingRound) ? '' : 'none';
    
    // ACCEPT button: only shown when there's an active bet AND local player is on the defending team AND it's their turn
    if (acceptBtn) {
      acceptBtn.style.display = (isBettingRound && hasActiveBet && isDefending && isLocalPlayerTurn) ? '' : 'none';
    }
    
    // --- Enable/disable based on turn ---
    [musBtn, envidoBtn, pasoBtn, acceptBtn, ordagoBtn].forEach(btn => {
      if (btn && btn.style.display !== 'none') {
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
      }
    });
  }
  
  // Start all players' timers simultaneously
  function startAllPlayersTimer(duration = 10) {
    const isOnlineGame = !!(window.onlineMode && window.QuantumMusSocket && window.QuantumMusOnlineRoom);
    console.log(`[START ALL TIMERS] Starting ${duration}s countdown for all players (online=${isOnlineGame})`);
    
    // Show all timer bars for simultaneous play
    for (let i = 0; i < 4; i++) {
      const timerBar = document.querySelector(`#timer-bar-player${i + 1}`);
      const fill = document.querySelector(`#timer-bar-player${i + 1} .timer-bar-fill`);
      if (fill && timerBar) {
        // Make timer bars fully visible with all necessary properties
        timerBar.style.display = 'block';
        timerBar.style.opacity = '1';
        timerBar.style.visibility = 'visible';
        fill.style.display = 'block';
        fill.style.opacity = '1';
        fill.style.transition = 'none';
        fill.style.width = '100%'; // Start full
        
        // Start animation after a frame
        requestAnimationFrame(() => {
          fill.style.transition = `width ${duration}s linear`;
          fill.style.width = '0%'; // Empty to 0%
        });
        console.log(`[TIMER START] player${i + 1} timer bar rendered and animating`);
      }
      else {
        console.warn(`[TIMER START] player${i + 1} timer bar NOT FOUND - timerBar=${!!timerBar}, fill=${!!fill}`);
      }
    }
    
    // Clear any existing timer
    if (timerInterval) clearTimeout(timerInterval);
    
    // Wait for visual bars to render, THEN start the countdown
    setTimeout(() => {
      timerInterval = setTimeout(() => {
        if (isOnlineGame) {
          const localIdx = window.QuantumMusLocalIndex ?? window.currentLocalPlayerIndex ?? 0;
          if (!gameState.cardsDiscarded || !gameState.cardsDiscarded[localIdx]) {
            handleTimeout(localIdx);
          }
          return;
        }
        // All timers expired - auto discard all cards for players who haven't acted
        handleAllPlayersTimeout();
      }, duration * 1000);

      // Failsafe: set per-AI fallback timeouts in case AI-specific timeouts fail (offline/local only)
      if (!isOnlineGame) {
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
      }
    }, 50);
    
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
    if (window.onlineMode && window.QuantumMusSocket && window.QuantumMusOnlineRoom) {
      if (gameState.waitingForDiscard) {
        console.log('Timeout en descarte: Descartando todo automáticamente');
        const serverIdx = (typeof window.localToServer === 'function')
          ? window.localToServer(playerIndex)
          : playerIndex;
        window.QuantumMusSocket.emit('discard_cards', {
          room_id: window.QuantumMusOnlineRoom,
          player_index: serverIdx,
          card_indices: [0, 1, 2, 3]
        });
      } else {
        console.warn('[TIMEOUT] Ignored in online mode (server authoritative)');
      }
      return;
    }
    
    // If this player's timeout has already been consumed, ignore duplicate calls
    gameState.playerTimeoutConsumed = gameState.playerTimeoutConsumed || [false, false, false, false];
    if (gameState.playerTimeoutConsumed[playerIndex]) {
      console.log(`[TIMEOUT] Already handled for player ${playerIndex + 1}, skipping duplicate`);
      return;
    }
    // Mark as consumed immediately to avoid races
    gameState.playerTimeoutConsumed[playerIndex] = true;

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
    } else if (gameState.currentRound === 'PARES' && gameState.paresDeclarations && Object.keys(gameState.paresDeclarations).length < 4) {
      // In PARES declaration phase - check if can auto-declare, otherwise choose 'puede'
      console.log(`[TIMEOUT] PARES declaration phase - checking auto-declaration for player ${playerIndex + 1}`);
      const shouldAuto = shouldAutoDeclarePares(playerIndex);
      if (shouldAuto) {
        const autoValue = getAutoParesDeclaration(playerIndex);
        if (autoValue !== null) {
          console.log(`[TIMEOUT] Auto-declaring PARES for player ${playerIndex + 1}: ${autoValue}`);
          handleParesDeclaration(playerIndex, autoValue, true);
          return;
        }
      }
      // Can't auto-declare, choose 'puede'
      console.log(`[TIMEOUT] Auto-choosing PARES PUEDE for player ${playerIndex + 1}`);
      handleParesDeclaration(playerIndex, 'puede', false);
    } else if (gameState.currentRound === 'JUEGO' && gameState.juegoDeclarations && Object.keys(gameState.juegoDeclarations).length < 4) {
      // In JUEGO declaration phase - check if can auto-declare, otherwise choose 'puede'
      console.log(`[TIMEOUT] JUEGO declaration phase - checking auto-declaration for player ${playerIndex + 1}`);
      const shouldAuto = shouldAutoDeclareJuego(playerIndex);
      if (shouldAuto) {
        const autoValue = getAutoJuegoDeclaration(playerIndex);
        if (autoValue !== null) {
          console.log(`[TIMEOUT] Auto-declaring JUEGO for player ${playerIndex + 1}: ${autoValue}`);
          handleJuegoDeclaration(playerIndex, autoValue, true);
          return;
        }
      }
      // Can't auto-declare, choose 'puede'
      console.log(`[TIMEOUT] Auto-choosing JUEGO PUEDE for player ${playerIndex + 1}`);
      handleJuegoDeclaration(playerIndex, 'puede', false);
    } else if (gameState.currentRound === 'GRANDE' || gameState.currentRound === 'CHICA' || 
               gameState.currentRound === 'PARES' || gameState.currentRound === 'JUEGO') {
      // Timeout in betting rounds = PASO
      console.log(`[TIMEOUT] Auto-PASO for player ${playerIndex + 1} in ${gameState.currentRound} betting`);
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
    if (window.onlineMode && window.QuantumMusSocket && window.QuantumMusOnlineRoom) {
      console.warn('[AI DECISION] Ignored in online mode');
      return;
    }
    
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

    // Choose AI thinking delay: faster during JUEGO declaration to match 2s pacing (only when declarations pending)
    const aiDelay = (gameState.currentRound === 'JUEGO' && gameState.juegoDeclarations && Object.keys(gameState.juegoDeclarations).length < 4) ? 1000 : 3000;
    aiDecisionTimeout = setTimeout(() => {
      console.log(`[AI DECISION] Executing - Player ${playerIndex + 1} deciding in ${gameState.currentRound}`);
      console.log(`[AI DECISION] Current state - activePlayerIndex: ${gameState.activePlayerIndex}, waitingForDiscard: ${gameState.waitingForDiscard}`);

      // Verify this is still the active player (game state may have changed)
      if (gameState.activePlayerIndex !== playerIndex) {
        console.log(`[AI DECISION] Ignoring - player ${playerIndex + 1} is no longer active (current: ${gameState.activePlayerIndex + 1})`);
        aiDecisionTimeout = null;
        return;
      }

      // If the timeout was already processed for this player (timer-based auto action), abort.
      gameState.playerTimeoutConsumed = gameState.playerTimeoutConsumed || [false, false, false, false];
      if (gameState.playerTimeoutConsumed[playerIndex]) {
        console.log(`[AI_DECISION] Aborting - timeout already handled for player ${playerIndex + 1}`);
        aiDecisionTimeout = null;
        return;
      }

      // If we're in PARES declaration phase (still pending), AI should declare only when it's their turn
      if (gameState.currentRound === 'PARES' && gameState.paresDeclarations && Object.keys(gameState.paresDeclarations).length < 4) {
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
      if (gameState.currentRound === 'JUEGO' && gameState.juegoDeclarations && Object.keys(gameState.juegoDeclarations).length < 4) {
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

        const gameMode = window.currentGameMode || '8';
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
    // Only initialize discard UI once per phase - don't reset if already in discard mode
    const isAlreadyInDiscardMode = gameState.waitingForDiscard && document.getElementById('discard-button');
    if (isAlreadyInDiscardMode) {
      console.log('[SHOW DISCARD UI] Already in discard mode, skipping re-initialization');
      return;
    }
    
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
        
        // FORCE reset selection state to false for ALL cards at start of discard phase
        card.classList.add('selectable');
        // Explicitly set as string 'false' and ensure it's not undefined/null
        card.dataset.selected = 'false';
        card.setAttribute('data-selected', 'false');
        
        // Remove the default click handler that shows card details
        card.onclick = null;
        
        // Add new click handler only for local player's cards
        if (i === 0) {
          card.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleCardSelection(card);
          };
        }
        // Debug: log discard UI assignment for each card
        try {
          console.log(`[SHOW DISCARD UI] player=${i + 1} cardIndex=${card.dataset.cardIndex || cardIndex} selectable=${card.classList.contains('selectable')} selected=${card.dataset.selected} onclick=${!!card.onclick}`);
        } catch (e) { /* ignore */ }
        
      });
    }
    
    // Show discard button for local player
    showDiscardButton();
  }
  
  // Toggle card selection for discard with visual feedback
  function toggleCardSelection(card) {
    // Ensure dataset.selected has a defined value - use getAttribute for safety
    const currentValue = card.getAttribute('data-selected') || card.dataset.selected || 'false';
    const isSelected = String(currentValue).trim() === 'true';
    const newValue = isSelected ? 'false' : 'true';
    
    // Set using both methods to ensure it sticks
    card.dataset.selected = newValue;
    card.setAttribute('data-selected', newValue);

    // Debug log to help identify cards that don't visually update
    try {
      console.log(`[TOGGLE SELECT] playerIndex=${card.dataset.playerIndex || 'unknown'} cardIndex=${card.dataset.cardIndex || 'unknown'} was=${currentValue} now=${newValue}`);
    } catch (e) { /* ignore logging errors */ }

    if (isSelected) {
      // Deselect: remove gray overlay and X
      card.style.transform = 'translateY(0)';
      card.style.filter = '';
      // Restore entanglement animation if it was paused
      try { card.style.removeProperty('animation'); } catch (e) {}
      // Remove X overlay if it exists
      const overlay = card.querySelector('.discard-overlay');
      if (overlay) overlay.remove();
    } else {
      // Select: add gray overlay and X
      card.style.transform = 'translateY(-15px)';
      card.style.filter = 'grayscale(100%) brightness(0.3)';

      // If card is entangled and has glow animation, pause it so filter persists
      if (card.classList.contains('entangled-card') || card.classList.contains('entangled-candidate')) {
        try { card.style.setProperty('animation', 'none', 'important'); } catch (e) {}
      }

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
    
    discardBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Get the local player's index (in online mode, always 0; in offline mode, player 1)
      const localPlayerIdx = 0; // Local player is always rendered at position 0
      const playerZoneId = `#player${localPlayerIdx + 1}-zone`;
      
      // Get selected cards from local player's zone
      const selectedCards = [];
      const cards = document.querySelectorAll(`${playerZoneId} .quantum-card`);
      console.log(`[DISCARD BUTTON DEBUG] Found ${cards.length} cards in ${playerZoneId}`);
      
      cards.forEach((card, index) => {
        // Read both getAttribute and dataset to be safe
        const datasetValue = card.dataset.selected;
        const attrValue = card.getAttribute('data-selected');
        const isSelected = String(datasetValue || attrValue || 'false').trim() === 'true';
        console.log(`[DISCARD BUTTON DEBUG] Card ${index}: dataset="${datasetValue}" attr="${attrValue}" isSelected=${isSelected}`);
        if (isSelected) {
          selectedCards.push(index);
        }
      });
      
      // Require at least one card to be selected (don't auto-discard all if none selected)
      if (selectedCards.length === 0) {
        console.warn('[DISCARD BUTTON] No cards selected - user must select at least one card');
        // Show error message
        showTemporaryMessage('Selecciona al menos una carta para descartar', 2000);
        return;
      }
      
      console.log(`[DISCARD BUTTON] Selected ${selectedCards.length} cards, discarding:`, selectedCards);
      
      // Disable discard button to prevent double-clicks
      discardBtn.disabled = true;
      discardBtn.style.opacity = '0.5';
      discardBtn.style.pointerEvents = 'none';
      
      // Discard selected cards
      handleDiscard(localPlayerIdx, selectedCards);
      
      // Remove discard button
      setTimeout(() => discardBtn.remove(), 100);
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
        const gameMode = window.currentGameMode || '8';
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

          // Log hands after replacement so we can inspect bot/local cards and glow decisions
          logHandsAndGlow();
        }
        
        // Clean up remaining cards and animate them appearing
        const remainingCards = cardsRow.querySelectorAll('.quantum-card');
        remainingCards.forEach((card, idx) => {
          card.classList.remove('selectable');
          card.dataset.selected = 'false';
          card.setAttribute('data-selected', 'false');
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
    // Prefer authoritative entanglement info from gameState if available
    const localPlayer = typeof gameState.playerIndex === 'number' ? gameState.playerIndex : (window.currentLocalPlayerIndex ?? 0);
    const teammate = getTeammate(localPlayer);

    // Get server-provided per-player entanglement info (array of objects) when present
    const localEntangled = gameState.entanglement.playerEntanglements[localPlayer] || [];

    // If no authoritative info, fall back to legacy DOM value-based heuristic
    if (!localEntangled || localEntangled.length === 0) {
      // Legacy behavior: match by partner value (less precise)
      const player1Cards = document.querySelectorAll('#player1-zone .quantum-card');
      const player1Entangled = new Set();
      player1Cards.forEach(card => {
        if (card.dataset.entangled === 'true') player1Entangled.add(card.dataset.partner);
      });
      if (player1Entangled.size === 0) return;

      const teammateCards = document.querySelectorAll('#player3-zone .quantum-card');
      teammateCards.forEach(card => {
        const mainValue = card.dataset.mainValue;
        if (card.classList.contains('entangled-candidate')) {
          if (mainValue && player1Entangled.has(mainValue)) {
            card.classList.remove('entangled-candidate');
            card.classList.add('entangled-card');
            card.style.setProperty('--entangle-color', card.dataset.suitColor);
          } else {
            card.classList.remove('entangled-candidate');
          }
        }
        if (card.classList.contains('superposed-candidate')) card.classList.remove('superposed-candidate');
      });

      return;
    }

    // Use authoritative mapping: find partner suit+value for local player's entangled cards that target teammate
    const partnerTargets = localEntangled
      .filter(e => (e.teammate_index === teammate) || (e.partner && e.partner.player === teammate) || (e.partner_player === teammate))
      .map(e => {
        // e may come from server (has .partner with suit/value) or from derived pairs (partner_card_index)
        if (e.partner && typeof e.partner === 'object') {
          return { value: e.partner.value || (e.partner.card && e.partner.card.value), suit: e.partner.suit || (e.partner.card && e.partner.card.suit) };
        }
        if (e.partner_card && typeof e.partner_card === 'object') {
          return { value: e.partner_card.value, suit: e.partner_card.suit };
        }
        if (e.partner_card_index != null && Array.isArray(gameState.entanglement.pairs)) {
          // Try to resolve via pairs list
          const pair = gameState.entanglement.pairs.find(p => (p.cardA.card_index === e.card_index && p.cardA.player === localPlayer) || (p.cardB.card_index === e.card_index && p.cardB.player === localPlayer));
          if (pair) {
            const partner = pair.cardA.player === localPlayer ? pair.cardB : pair.cardA;
            return { value: partner.value || partner.mainValue || (partner.card && partner.card.value), suit: partner.suit || (partner.card && partner.card.suit) };
          }
        }
        // As a final fallback, use reported e.partner if it contains value
        if (e.partner && e.partner.value) return { value: e.partner.value, suit: e.partner.suit };
        return null;
      }).filter(Boolean);

    if (partnerTargets.length === 0) return;

    const teammateCards = document.querySelectorAll('#player3-zone .quantum-card');
    teammateCards.forEach(card => {
      // Compare both value and suit when possible
      const mainValue = card.dataset.mainValue || card.dataset.value;
      const suit = card.dataset.suit;
      const match = partnerTargets.find(pt => pt && pt.value && ((pt.value === mainValue) && (!pt.suit || pt.suit === suit)));
      if (card.classList.contains('entangled-candidate')) {
        if (match) {
          card.classList.remove('entangled-candidate');
          card.classList.add('entangled-card');
          card.style.setProperty('--entangle-color', card.dataset.suitColor);
        } else {
          card.classList.remove('entangled-candidate');
        }
      }
      if (card.classList.contains('superposed-candidate')) card.classList.remove('superposed-candidate');
    });

    // Log current hands & glow decisions for debugging
    logHandsAndGlow();
  }

  function getCharacterColor(characterKey) {
    const characterColors = {
      'preskill': 'teal',
      'cirac': 'coral',
      'zoller': 'lavender',
      'deutsch': 'gold',
      'simmons': 'magenta',
      'broadbent': 'green',
      'martinis': 'orange',
      'monroe': 'cadet'
    };
    return characterColors[characterKey] || 'teal';
  }

  function getCharacterColorValue(characterKey) {
    const characterColorValues = {
      'preskill': '#2ec4b6',      // teal
      'cirac': '#ff9e6d',         // coral
      'zoller': '#a78bfa',        // lavender
      'deutsch': '#f5c518',       // gold
      'simmons': '#ff66c4',       // magenta
      'broadbent': '#2ecc71',     // green
      'martinis': '#ffb347',      // orange
      'monroe': '#5f9ea0'         // cadet blue
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

  function createCard(value, suit, suitSymbol, index, isCurrentPlayer, isTeammate, suitColor, playerIndex, gameMode = '4', serverCardData = null) {
    // Log gameMode for debugging
    if (playerIndex === 0 && index === 0) {
      console.log(`[CREATE CARD] Creating cards with gameMode: ${gameMode}, value: ${value}, onlineMode: ${window.onlineMode}`);
    }
    
    const card = document.createElement('div');
    const isLateralPlayer = playerIndex === 1 || playerIndex === 3;
    card.className = `quantum-card card-${suit} card-dealing${isLateralPlayer ? ' card-lateral' : ''}${playerIndex === 3 ? ' card-left' : ''}`;
    card.dataset.dealOrder = String(playerIndex * 4 + index);
    card.dataset.suit = suit;  // Store suit for all cards
    // Store logical index in hand (0-3) to allow reliable logging/matching
    card.dataset.cardIndex = String(index);
    // Store player index so selection and logging can reference owner reliably
    card.dataset.playerIndex = String(playerIndex);
    // Initialize selection state for discard phase
    card.dataset.selected = 'false';
    card.setAttribute('data-selected', 'false');
    
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

    // Determine if card is entangled - prefer server data if available
    let isEntangled = false;
    let isSuperposed = false;
    let entangledPartner = '';
    let superposedValue = '';
    let coefficientA = 0;
    let coefficientB = 0;
    
    // Use server card data if provided (online mode)
    if (serverCardData && serverCardData.is_entangled) {
      isEntangled = true;
      entangledPartner = serverCardData.entangled_partner_value || '';
      coefficientA = serverCardData.coefficient_a || 0.7071;
      coefficientB = serverCardData.coefficient_b || 0.7071;
      console.log(`[CREATE CARD] Using server entanglement data: ${value}↔${entangledPartner}`);
    } else {
      // Local determination (offline mode)
      // A and K are ALWAYS entangled with each other (A↔K) in both 4 and 8 reyes
      // 2 and 3 are entangled with each other (2↔3) ONLY in 8 reyes mode
      // J and Q are NEVER entangled
      const is8Reyes = gameMode === '8';
      if (value === 'A' || value === 'K') {
        isEntangled = true;
      } else if (is8Reyes && (value === '2' || value === '3')) {
        isEntangled = true;
      }
      // Superposition disabled - all other cards (including J, Q) are regular
      
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
      }
    }
    
    const cardValues = ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K'];
    
    if (isEntangled) {
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
          handleMusRound(0, 'mus');
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
            handleMusRound(0, 'envido', { amount: amount });
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
          handleMusRound(0, 'paso');
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
            handleMusRound(0, 'ordago');
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
    
    // Check if any team reached 40 points - game over
    if (gameState.teams.team1.score >= 40) {
      console.log('[GAME OVER] Team 1 reached 40 points');
      setTimeout(() => showGameOver('team1'), 1000);
      return;
    } else if (gameState.teams.team2.score >= 40) {
      console.log('[GAME OVER] Team 2 reached 40 points');
      setTimeout(() => showGameOver('team2'), 1000);
      return;
    }
    
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
    const gameMode = window.currentGameMode || '8';
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
        
        // Ensure buttons are enabled if it's local player's turn
        if (gameState.activePlayerIndex === 0) {
          musButton.disabled = false;
          buttons[1].disabled = false;
          buttons[2].disabled = false;
        }
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
        
        // Ensure buttons are enabled if it's local player's turn
        if (gameState.activePlayerIndex === 0) {
          musButton.disabled = false;
          buttons[1].disabled = false;
          buttons[2].disabled = false;
        }
      } else if (hasActiveBet && isOpponentsBet) {
        // There's an active bet from the OPPONENT team - show response buttons only
        if (button3Label) button3Label.textContent = 'NO QUIERO';
        if (button4Label) button4Label.textContent = 'QUIERO';
        musButton.style.display = 'none'; // Hide MUS button (not in MUS round anymore)
        buttons[2].style.display = 'inline-flex'; // Show NO QUIERO (PASO)
        buttons[3].style.display = 'inline-flex'; // Show QUIERO (accept)
        
        // If ORDAGO bet, only show PASO and ACCEPT buttons
        if (gameState.currentBet.betType === 'ordago') {
          console.log('[ORDAGO RESPONSE] Only PASO and ACCEPT buttons available - hiding ENVIDO button');
          if (button1Label) button1Label.textContent = 'ORDAGO';
          // Don't set COUNTER label when responding to ordago - button will be hidden anyway
          buttons[0].style.display = 'none'; // Hide button 0 (MUS/TENGO) - not applicable during ordago response
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

  // Show temporary message to user
  function showTemporaryMessage(message, duration = 2000) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(255, 67, 54, 0.95);
      color: white;
      padding: 20px 30px;
      border-radius: 10px;
      font-size: 1.2rem;
      font-weight: 600;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      animation: fadeIn 0.3s ease-out;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'fadeOut 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }

  // Show team point award notification
  function showTeamPointAward(teamKey, points, reason = '') {
    const teamName = gameState.teams[teamKey].name;
    const teamColor = teamKey === 'team1' ? '#2ec4b6' : '#ff9e6d';
    
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 100px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95));
      border: 2px solid ${teamColor};
      border-radius: 15px;
      padding: 15px 30px;
      color: ${teamColor};
      font-size: 1.3rem;
      font-weight: bold;
      z-index: 2000;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      opacity: 0;
      transition: opacity 0.3s;
    `;
    
    const reasonText = reason ? ` (${reason})` : '';
    notification.innerHTML = `<span style="color:${teamColor};font-weight:700">${teamName}</span>: <span style="color:var(--paper-cream)">+${points} pt${points !== 1 ? 's' : ''}${reasonText}</span>`;
    document.body.appendChild(notification);
    
    // Fade in
    setTimeout(() => { notification.style.opacity = '1'; }, 10);
    
    // Fade out and remove
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 2500);
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
    // Determine character color for this player
    const charKey = (gameState.playerCharacters && gameState.playerCharacters[playerIndex]) || null;
    const charColor = charKey ? getCharacterColorValue(charKey) : '#2ec4b6';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95));
      border: 2px solid ${charColor};
      border-radius: 15px;
      padding: 15px 30px;
      color: ${charColor};
      font-size: 1.2rem;
      font-weight: bold;
      z-index: 2000;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      opacity: 0;
      transition: opacity 0.3s;
    `;

    // Use playerActualNames if available, fallback to character names
    const playerName = (gameState.playerActualNames && gameState.playerActualNames[playerIndex]) || gameState.playerNames[playerIndex] || `Player ${playerIndex + 1}`;
    const actionText = actionTexts[action] || action.toUpperCase();
    notification.innerHTML = `<span style="color:${charColor};font-weight:700">${playerName}</span>: <span style="color:var(--paper-cream)">${actionText}</span>`;
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
    
    const gameMode = window.currentGameMode || '8';
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

  function showCharacterModal(characterName, description, color = '#2ec4b6') {
    // Remove existing modal if any
    const existingModal = document.querySelector('.character-modal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.className = 'character-modal';
    modal.innerHTML = `
      <div class="character-modal-content" style="border-top: 6px solid ${color};">
        <div class="character-modal-header">
          <h2 style="color: ${color}; margin:0;">${characterName}</h2>
          <button class="character-modal-close" style="border:1px solid ${color};">✕</button>
        </div>
        <div class="character-modal-body">
          <p style="color: ${color};">${description}</p>
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
    
    // Check if in online mode
    const isOnlineGame = !!(window.onlineMode && window.QuantumMusSocket && window.QuantumMusOnlineRoom);
    
    if (isOnlineGame) {
      // Online mode: send collapse request to server
      const socket = window.QuantumMusSocket;
      const roomId = window.QuantumMusOnlineRoom;
      const serverIdx = localToServer(playerIndex);
      
      console.log(`[ONLINE BET COLLAPSE] Sending collapse request for player ${playerIndex + 1} (server ${serverIdx}) in ${roundName}`);
      
      socket.emit('trigger_bet_collapse', {
        room_id: roomId,
        player_index: serverIdx,
        round_name: roundName
      });
      
      // Server will broadcast bet_collapse_completed event
      return;
    }
    
    // Local mode: handle collapse directly
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
    const gameMode = window.currentGameMode || '8';
    
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
      // Penalty: JUEGO predictions are worth 2 points, others 1
      const penalty = (roundName === 'JUEGO') ? 2 : 1;
      const playerTeam = getPlayerTeam(playerIndex);
      gameState.teams[playerTeam].score -= penalty;
      console.log(`Player ${playerIndex + 1} incurred -${penalty} penalty for wrong ${roundName} prediction`);
      // Show visual penalty notification
      if (typeof showPenaltyNotification === 'function') {
        try { showPenaltyNotification(playerIndex, roundName, penalty); } catch (e) { console.warn('showPenaltyNotification failed', e); }
      }
      updateScoreboard();
      // Adjust declaration state for PARES according to rules:
      // - If player declared NO TENGO (false) but actually had PARES, they are penalized
      //   but should still be allowed to participate in the PARES betting round.
      // - If player declared TENGO (true) but actually did not have PARES, they are
      //   penalized and should NOT participate in the PARES betting round.
      try {
        if (roundName === 'PARES' && gameState.paresDeclarations) {
          const orig = gameState.paresDeclarations[playerIndex];
          if ((orig === false) && actuallyHas) {
            // Mark as post-penalty tengo so eligibility/counting treats them as having pares
            gameState.paresDeclarations[playerIndex] = 'tengo_after_penalty';
            console.log(`[PARES PENALTY] Player ${playerIndex + 1} was NO TENGO but had PARES; applied penalty and marked as 'tengo_after_penalty'`);
          } else if ((orig === true) && !actuallyHas) {
            // Mark as no tengo so they won't participate further
            gameState.paresDeclarations[playerIndex] = false;
            console.log(`[PARES PENALTY] Player ${playerIndex + 1} declared TENGO but had no PARES; applied penalty and marked as NO TENGO`);
          }
        } else if (roundName === 'JUEGO' && gameState.juegoDeclarations) {
          // Same logic for JUEGO
          const orig = gameState.juegoDeclarations[playerIndex];
          if ((orig === false) && actuallyHas) {
            // Mark as post-penalty tengo so eligibility/counting treats them as having juego
            gameState.juegoDeclarations[playerIndex] = 'tengo_after_penalty';
            console.log(`[JUEGO PENALTY] Player ${playerIndex + 1} was NO TENGO but had JUEGO; applied penalty and marked as 'tengo_after_penalty'`);
          } else if ((orig === true) && !actuallyHas) {
            // Mark as no tengo so they won't participate further
            gameState.juegoDeclarations[playerIndex] = false;
            console.log(`[JUEGO PENALTY] Player ${playerIndex + 1} declared TENGO but had no JUEGO; applied penalty and marked as NO TENGO`);
          }
        }
      } catch (e) {
        console.warn('[checkPredictionPenalty] failed to adjust declaration after penalty', e);
      }
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
// ===================== ENTANGLEMENT GLOW SYSTEM (Server-based) =====================

/**
 * Apply entanglement glow based on server data
 * Uses entanglement_glows from player game state
 */
function applyEntanglementGlows(playerState) {
  if (!playerState || !playerState.entanglement_glows) {
    console.log('[GLOW] No entanglement glow data from server');
    return;
  }
  
  const glowData = playerState.entanglement_glows;
  
  console.log('[GLOW] Applying entanglement glows:', glowData);
  
  // Map backend suit names to frontend colors
  // Backend: 'Oro', 'Copa', 'Espada', 'Basto'
  // Colors: Oro(gold), Copa(red), Espada(purple), Basto(teal)
  const paloToColor = {
    'Oro': '#f5c518',      // gold
    'Copa': '#ff6b6b',     // red
    'Espada': '#a78bfa',   // purple
    'Basto': '#2ec4b6'     // teal
  };
  
  // 1. Apply glow to local player's cards
  if (glowData.has_entangled_pair && glowData.my_cards && glowData.my_cards.length > 0 && glowData.pairs) {
    const player1Cards = document.querySelectorAll('#player1-zone .quantum-card');
    
    // Create a map of card index to palo from pairs data
    const cardIndexToPalo = {};
    glowData.pairs.forEach(pair => {
      if (pair.my_card_index !== undefined && pair.palo) {
        cardIndexToPalo[pair.my_card_index] = pair.palo;
      }
    });
    
    glowData.my_cards.forEach(cardIndex => {
      if (player1Cards[cardIndex]) {
        const card = player1Cards[cardIndex];
        // Add entangled-card class for glow effect
        card.classList.add('entangled-card', 'teammate-entangled');
        
        // Use palo from server data to determine glow color
        const palo = cardIndexToPalo[cardIndex];
        const suitColor = palo ? paloToColor[palo] : (card.dataset.suitColor || '#2ec4b6');
        card.style.setProperty('--entangle-color', suitColor);
        console.log(`[GLOW] ✨ Applied glow to local card ${cardIndex} with palo ${palo} (color: ${suitColor})`);
      }
    });
  }
  
  // 2. Apply glow to teammate's cards (if they have the partner)
  if (glowData.has_entangled_pair && glowData.teammate_index !== null && glowData.pairs) {
    // Map server player index to UI position
    // Server: 0 (local), 2 (teammate top)
    // UI: player1-zone (bottom), player3-zone (top)
    const teammateServerIndex = glowData.teammate_index;
    let teammateUIZone = 'player3-zone'; // Default for player 2
    
    // Map server index to UI zone
    if (teammateServerIndex === 2) {
      teammateUIZone = 'player3-zone'; // Top
    } else if (teammateServerIndex === 0) {
      teammateUIZone = 'player1-zone'; // Bottom (shouldn't happen for teammate)
    }
    
    const teammateZone = document.querySelector(`#${teammateUIZone}`);
    
    if (teammateZone) {
      const teammateCards = teammateZone.querySelectorAll('.quantum-card');
      
      // For each pair, mark the specific card in teammate's hand
      glowData.pairs.forEach((pair) => {
        // Use the specific teammate_card_index from backend
        if (pair.teammate_card_index !== undefined && teammateCards[pair.teammate_card_index]) {
          const card = teammateCards[pair.teammate_card_index];
          card.classList.add('entangled-card', 'teammate-entangled');
          
          // Use palo from server data to determine glow color
          const palo = pair.palo;
          const suitColor = palo ? paloToColor[palo] : (card.dataset.suitColor || '#a78bfa');
          card.style.setProperty('--entangle-color', suitColor);
          console.log(`[GLOW] ✨ Applied glow to teammate card at index ${pair.teammate_card_index} with palo ${palo} (color: ${suitColor})`);
        }
      });
      
      console.log(`[GLOW] ✨ Applied glow to ${glowData.pairs.length} teammate cards (Server Player ${teammateServerIndex})`);
    }
  }
}

/**
 * Remove all entanglement glows
 */
function clearEntanglementGlows() {
  document.querySelectorAll('.quantum-card').forEach(card => {
    card.classList.remove('entangled-card', 'teammate-entangled');
    card.classList.remove('entangled-candidate');
  });
  console.log('[GLOW] Cleared all entanglement glows');
}

