// Navigation and UI Management for Quantum Mus
document.addEventListener('DOMContentLoaded', () => {
  // Game state
  const gameState = {
    playerName: '',
    roomCode: '',
    roomId: '',
    isHost: false,
    selectedCharacter: null,
    players: [],
    gameMode: '8', // '4' or '8' reyes (default to 8 to match HTML default)
    socket: null // Socket.IO connection
  };

  // Initialize Socket.IO
  function initializeSocket() {
    if (gameState.socket && gameState.socket.connected) {
      return; // Already connected
    }
    
    gameState.socket = io();
    
    // Socket.IO event listeners
    gameState.socket.on('connect', () => {
      console.log('Connected to server');
    });
    
    gameState.socket.on('room_updated', (data) => {
      console.log('Room updated:', data);
      if (data && data.room) {
        gameState.players = data.room.players || [];
        updatePlayersList();
        
        // Also refresh character selection grid to show updated "elegido" status
        createCharacterSelection();
      }
    });
    
    gameState.socket.on('joined_room', (data) => {
      console.log('Joined room:', data);
      if (data.success) {
        gameState.roomId = data.room_id;
        // Room data is in room_updated event
      }
    });
    
    gameState.socket.on('game_error', (data) => {
      console.error('Game error:', data.error);
      alert('Error: ' + data.error);
      
      // If it's a character selection error, refresh the character grid to show current state
      if (data.error && data.error.includes('character')) {
        createCharacterSelection();
      }
    });
    
    gameState.socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });
  }

  // Character data organized by teams
  const characters = [
    {
      id: 'preskill',
      name: 'Preskill',
      color: '#2ec4b6',
      specialty: 'Corrección de Errores',
      description: '<strong>John Preskill (1961-presente)</strong><br><br>Pionero teórico en información cuántica e informática cuántica. Preskill es el Profesor Richard P. Feynman de Física Teórica en Caltech y una autoridad destacada en corrección de errores cuánticos y el camino hacia computadoras cuánticas prácticas.<br><br><strong>Símbolo de la Carta:</strong> El código de corrección de errores (círculos anidados) representa códigos de corrección de errores cuánticos - mecanismos esenciales que protegen la información cuántica de la decoherencia y el ruido ambiental, haciendo posibles computadoras cuánticas confiables.<br><br><strong>Contribución:</strong> Desarrolló marcos fundamentales para corrección de errores cuánticos, estableció el concepto de era "NISQ" (Noisy Intermediate-Scale Quantum), y continúa guiando la realización práctica de computadoras cuánticas en el mundo real.',
      team: 1
    },
    {
      id: 'zoller',
      name: 'Zoller',
      color: '#a78bfa',
      specialty: 'Redes Cuánticas',
      description: '<strong>Peter Zoller (1952-presente)</strong><br><br>Distinguido físico cuántico especializado en computación cuántica con iones atrapados. Zoller desarrolló protocolos detallados para manipular y medir estados cuánticos usando iones enfriados por láser.<br><br><strong>Símbolo de la Carta:</strong> La celosía cuántica (puntos interconectados) representa la disposición geométrica de iones atrapados en una computadora cuántica, mostrando cómo los bits cuánticos individuales se comunican e se enredan entre sí.<br><br><strong>Contribución:</strong> Sus protocolos transformaron sistemas de iones atrapados en computadoras cuánticas prácticas, proporcionando instrucciones paso a paso para operaciones de puertas cuánticas que se implementan en el hardware cuántico actual.',
      team: 1
    },
    {
      id: 'cirac',
      name: 'Cirac',
      color: '#ff9e6d',
      specialty: 'Trampas de Iones',
      description: '<strong>Ignacio Cirac (1965-presente)</strong><br><br>Científico de información cuántica líder que revolucionó la teoría de la informática cuántica. Cirac es reconocido por desarrollar protocolos de simulación cuántica y demostrar cómo construir computadoras cuánticas usando iones atrapados.<br><br><strong>Símbolo de la Carta:</strong> La representación de trampa de iones (tres puntos dispuestos en un patrón) simboliza iones atrapados dispuestos en una configuración lineal - los componentes fundamentales para la computación cuántica en su enfoque.<br><br><strong>Contribución:</strong> Su trabajo sobre entrelazamiento cuántico y sistemas de muchos cuerpos creó el fundamento teórico para computadoras y simuladores cuánticos modernos.',
      team: 2
    },
    {
      id: 'deutsch',
      name: 'Deutsch',
      color: '#f5c518',
      specialty: 'Algoritmos Cuánticos',
      description: '<strong>David Deutsch (1953-presente)</strong><br><br>Fundador de la teoría de la computación cuántica - el primero en reconocer que las computadoras cuánticas podrían resolver problemas exponencialmente más rápido que las computadoras clásicas. Su trabajo revolucionario estableció algoritmos cuánticos como un nuevo paradigma computacional.<br><br><strong>Símbolo de la Carta:</strong> La representación de circuito cuántico (caja con círculo y punto) simboliza una puerta cuántica - las operaciones computacionales fundamentales que manipulan bits cuánticos y forman la base de algoritmos cuánticos.<br><br><strong>Contribución:</strong> Probó que el principio Church-Turing se extiende a la mecánica cuántica y creó el algoritmo de Deutsch, el primer algoritmo cuántico que demuestra ventaja computacional sobre métodos clásicos.',
      team: 2
    },
    {
      id: 'simmons',
      name: 'Simmons',
      color: '#ff66c4',
      specialty: 'Computación Atómica',
      description: '<strong>Michelle Simmons (1967-presente)</strong><br><br>Física australiana pionera en computación cuántica a escala atómica. Simmons es directora del Centro de Excelencia en Tecnologías Cuánticas de Australia y ha revolucionado la forma en que construimos dispositivos cuánticos usando silicio. Su trabajo utiliza microscopía de efecto túnel escanificado para posicionar átomos individuales de fósforo en silicio, creando transistores de un solo átomo y sistemas cuánticos de precisión extrema.<br><br><strong>Símbolo de la Carta:</strong> El átomo de fósforo puntualmente posicionado en una red de silicio representa la precisión extraordinaria del enfoque de Simmons en ingeniería cuántica a escala atómica.<br><br><strong>Contribución:</strong> Creó el primer transistor de un solo átomo y demostró que los sistemas de silicio pueden mantener coherencia cuántica lo suficientemente larga como para computación práctica.',
      team: 1
    },
    {
      id: 'broadbent',
      name: 'Broadbent',
      color: '#2ecc71',
      specialty: 'Criptografía Cuántica',
      description: '<strong>Anne Broadbent (1978-presente)</strong><br><br>Destacada criptógrafa cuántica y teórica de información cuántica. Broadbent ha realizado contribuciones fundamentales a la criptografía cuántica y especialmente a la computación cuántica delegada. Su trabajo combina rigor matemático con aplicaciones prácticas en seguridad cuántica.<br><br><strong>Símbolo de la Carta:</strong> El símbolo de candado con seguridad representa el enfoque de Broadbent en proteger y verificar la integridad de información cuántica.<br><br><strong>Contribución:</strong> Desarrolló protocolos revolucionarios para computación cuántica delegada que permiten verificar resultados de computadoras cuánticas sin poseer una propia.',
      team: 2
    },
    {
      id: 'martinis',
      name: 'Yunger Halpern',
      color: '#ffb347',
      specialty: 'Termodinámica Cuántica',
      description: '<strong>Nicole Yunger Halpern (1987-presente)</strong><br><br>Física teórica innovadora especializada en termodinámica cuántica y conexiones entre mecánica cuántica y fenómenos del mundo real observable. Yunger Halpern trabaja en NIST y es conocida por su creatividad en conectar conceptos cuánticos esotéricos con aplicaciones prácticas.<br><br><strong>Símbolo de la Carta:</strong> El símbolo de engranaje steampunk representa la combinación ingeniosa de Yunger Halpern de ideas antiguas de la física con nuevas perspectivas cuánticas.<br><br><strong>Contribución:</strong> Reveló conexiones profundas entre entrelazamiento cuántico y fenómenos termodinámicos, mostrando cómo sistemas cuánticos pueden desafiar intuiciones clásicas.',
      team: 1
    },
    {
      id: 'monroe',
      name: 'Hallberg',
      color: '#5f9ea0',
      specialty: 'Materiales Cuánticos',
      description: '<strong>Karen Hallberg (1960-presente)</strong><br><br>Eminente física teórica argentina especializada en sistemas cuánticos fuertemente correlacionados y métodos computacionales. Hallberg es investigadora principal en el Centro Atómico Bariloche y ha desarrollado técnicas sofisticadas para entender sistemas cuánticos complejos.<br><br><strong>Símbolo de la Carta:</strong> Los símbolos de estructura molecular interconectada representan el enfoque de Hallberg en entender cómo los átomos se combinan para crear comportamientos cuánticos colectivos.<br><br><strong>Contribución:</strong> Desarrolló métodos numéricos innovadores para simular sistemas cuánticos intratables computacionalmente, permitiendo la predicción de propiedades de nuevos materiales cuánticos.',
      team: 2
    }
  ];

  // Screen management
  const screens = {
    portada: document.getElementById('portada-screen'),
    menu: document.getElementById('menu-screen'),
    name: document.getElementById('name-screen'),
    code: document.getElementById('code-screen'),
    lobby: document.getElementById('lobby-screen'),
    game: document.getElementById('game-screen'),
    gameover: document.getElementById('gameover-screen')
  };

  function showScreen(screenName) {
    Object.values(screens).forEach(screen => {
      if (screen) screen.classList.remove('active');
    });
    const target = screens[screenName];
    if (target) target.classList.add('active');
    
    // Initialize game when entering game screen
    if (screenName === 'game') {
      window.dispatchEvent(new CustomEvent('enterGameScreen'));
    }
  }

  // ============================================================
  // PORTADA (Cover) SCREEN
  // ============================================================
  createPortadaSchematic();
  
  // Quantum gate descriptions
  const gateDescriptions = {
    'M': {
      symbol: 'M',
      title: 'Puerta de Medida',
      description: 'Aplica medición cuántica para colapsar la función de onda. El proceso de medición transforma superposiciones cuánticas en estados clásicos definidos, obteniendo información concreta del sistema cuántico.'
    },
    'H': {
      symbol: 'H',
      title: 'Puerta Hadamard',
      description: 'Aplica transformación Hadamard para crear superposición cuántica. Esta puerta transforma estados base en superposición equitativa de |0⟩ y |1⟩, siendo fundamental para algoritmos cuánticos y creación de estados superposicionados.'
    },
    'I': {
      symbol: 'I',
      title: 'Puerta Identidad',
      description: 'Aplica operación identidad que preserva el estado cuántico sin cambios. Esta puerta mantiene el sistema en su estado actual, útil para sincronización de circuitos cuánticos y operaciones condicionales.'
    },
    'CX': {
      symbol: 'CX',
      title: 'Puerta CNOT',
      description: 'Puerta controlada-NOT, la puerta fundamental de entrelazamiento de dos qubits. Opera sobre un qubit de control y un qubit objetivo, invirtiendo el objetivo solo si el control está en |1⟩. Produce estados de Bell (estados maximalmente entrelazados), esencial para computación cuántica.'
    }
  };
  
  // Function to get gate color
  function getGateColor(symbol) {
    const colors = {
      'M': '#a78bfa',   // lavender
      'H': '#2ec4b6',   // teal
      'I': '#f5c518',   // gold
      'CX': '#ff6b6b'   // red
    };
    return colors[symbol] || '#2ec4b6';
  }

  // Function to show quantum gate description modal
  function showQuantumGateDescription(symbol, title, description) {
    const color = getGateColor(symbol);
    const modal = document.createElement('div');
    const closeModal = () => {
      modal.style.animation = 'modalSlideOut 0.3s ease-out forwards';
      overlay.style.animation = 'fadeOut 0.3s ease-out forwards';
      setTimeout(() => {
        modal.remove();
        overlay.remove();
      }, 300);
    };
    
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
      animation: modalPopIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    `;
    
    // Helper to convert hex to rgba
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
          line-height: 1;
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
        <button class="modal-close-btn" style="
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
           onmouseout="this.style.background='linear-gradient(135deg, ${hexToRgba(color, 0.3)}, ${hexToRgba(color, 0.1)})'">
          ENTENDIDO
        </button>
      </div>
    `;
    
    // Add overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      z-index: 2999;
      animation: fadeIn 0.3s ease-out;
      cursor: pointer;
    `;
    
    // Click handlers
    overlay.onclick = closeModal;
    modal.onclick = (e) => {
      if (e.target === modal) {
        closeModal();
      }
    };
    
    // Button click handler
    const closeBtn = modal.querySelector('.modal-close-btn');
    if (closeBtn) {
      closeBtn.onclick = closeModal;
    }
    
    document.body.appendChild(overlay);
    document.body.appendChild(modal);
  }
  
  // Add event listeners for quantum gate info buttons
  const portadaGates = document.querySelectorAll('.portada-gate');
  portadaGates.forEach(gate => {
    gate.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const gateType = gate.dataset.gate;
      const gateInfo = gateDescriptions[gateType];
      if (gateInfo) {
        showQuantumGateDescription(gateInfo.symbol, gateInfo.title, gateInfo.description);
      }
    });
  });
  
  const portadaStartButton = document.getElementById('portada-start-button');
  if (portadaStartButton) {
    portadaStartButton.addEventListener('click', () => {
      showScreen('name');
      setTimeout(() => {
        const input = document.getElementById('player-name-input');
        if (input) input.focus();
      }, 300);
    });
  }

  // ============================================================
  // NAME SCREEN (before Host/Join - everyone enters name first)
  // ============================================================
  const nameInput = document.getElementById('player-name-input');
  const confirmNameButton = document.getElementById('confirm-name-button');

  if (nameInput) {
    nameInput.addEventListener('input', (e) => {
      const value = e.target.value.trim();
      if (confirmNameButton) confirmNameButton.disabled = value.length < 2;
    });
    nameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && confirmNameButton && !confirmNameButton.disabled) {
        confirmNameButton.click();
      }
    });
  }

  if (confirmNameButton) {
    confirmNameButton.addEventListener('click', () => {
      gameState.playerName = nameInput ? nameInput.value.trim() : 'Jugador';
      showScreen('menu');
    });
  }

  // ============================================================
  // MENU SCREEN (Host or Join)
  // ============================================================
  const hostButton = document.getElementById('host-button');
  const joinButton = document.getElementById('join-button');

  hostButton.addEventListener('click', () => {
    gameState.isHost = true;
    gameState.roomCode = generateRoomCode();
    initializeLobby();
    showScreen('lobby');
  });

  joinButton.addEventListener('click', () => {
    gameState.isHost = false;
    if (joinPlayerNameHint) {
      joinPlayerNameHint.textContent = `Uniéndote como: ${gameState.playerName || 'Jugador'}`;
    }
    showScreen('code');
    setTimeout(() => {
      document.getElementById('room-code-input').focus();
    }, 300);
  });

  // ============================================================
  // CODE SCREEN
  // ============================================================
  const roomCodeInput = document.getElementById('room-code-input');
  const joinRoomButton = document.getElementById('join-room-button');
  const backToModeButton = document.getElementById('back-to-mode-button');
  const joinPlayerNameHint = document.getElementById('join-player-name-hint');

  function updateJoinButtonState() {
    const codeOk = roomCodeInput && roomCodeInput.value.length === 4;
    if (joinRoomButton) joinRoomButton.disabled = !codeOk;
  }

  if (roomCodeInput) {
    roomCodeInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      updateJoinButtonState();
    });
    roomCodeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && joinRoomButton && !joinRoomButton.disabled) {
        joinRoomButton.click();
      }
    });
  }

  if (joinRoomButton) {
    joinRoomButton.addEventListener('click', () => {
      const roomCode = roomCodeInput.value.toUpperCase();
      gameState.roomCode = roomCode;
      
      // Initialize Socket.IO if not already done
      if (!gameState.socket) {
        initializeSocket();
      }
      
      // Join room by code
      if (gameState.socket) {
        gameState.socket.emit('join_room_by_code', {
          room_code: roomCode,
          player_name: gameState.playerName
        });
        
        gameState.socket.once('joined_room', (data) => {
          if (data.success) {
            gameState.roomId = data.room_id;
            initializeLobby();
            showScreen('lobby');
          } else {
            alert('Error joining room: ' + data.error);
          }
        });
      }
    });
  }

  if (backToModeButton) {
    backToModeButton.addEventListener('click', () => {
      if (roomCodeInput) roomCodeInput.value = '';
      showScreen('menu');
    });
  }

  // ============================================================
  // LOBBY SCREEN
  // ============================================================
  function initializeLobby() {
    // Initialize Socket.IO connection if not already done
    if (!gameState.socket) {
      initializeSocket();
    }

    // Display room code (will be updated when we get room_created response)
    document.getElementById('room-code-value').textContent = gameState.roomCode || 'Conectando...';

    // Setup game settings panel
    setupGameSettings();

    // Create character selection
    createCharacterSelection();

    // Initialize players list
    gameState.players = [{
      name: gameState.playerName,
      character: null,
      isReady: false,
      isHost: gameState.isHost
    }];
    updatePlayersList();

    // If host, create room on server; if joining, this is handled in join_room event
    if (gameState.isHost && gameState.socket && !gameState.roomId) {
      gameState.socket.emit('create_room', {
        name: `Room_${Date.now()}`,
        game_mode: gameState.gameMode
      });
      
      gameState.socket.once('room_created', (data) => {
        if (data.success) {
          gameState.roomId = data.room.id;
          gameState.roomCode = data.room.code; // Use server-generated code
          document.getElementById('room-code-value').textContent = gameState.roomCode;
          
          // Join the room we just created
          gameState.socket.emit('join_room', {
            room_id: gameState.roomId,
            player_name: gameState.playerName,
            character: null
          });
        } else {
          alert('Error creating room: ' + (data.error || 'Unknown error'));
        }
      });
    }

    // Setup buttons
    const startGameButton = document.getElementById('start-game-button');
    const backToMenuButton = document.getElementById('back-to-menu-button');
    const leaveLobbyButton = document.getElementById('leave-lobby-button');

    if (gameState.isHost) {
      startGameButton.style.display = 'block';
    } else {
      startGameButton.style.display = 'none';
    }

    // Use onclick to avoid duplicate listeners when initializeLobby is called multiple times
    startGameButton.onclick = startGame;
    
    backToMenuButton.onclick = () => {
      // Leave room on server if connected
      if (gameState.socket && gameState.roomId) {
        gameState.socket.emit('leave_room', {
          room_id: gameState.roomId
        });
      }
      showScreen('menu');
      resetGameState();
    };
    
    leaveLobbyButton.onclick = () => {
      // Leave room on server if connected
      if (gameState.socket && gameState.roomId) {
        gameState.socket.emit('leave_room', {
          room_id: gameState.roomId
        });
      }
      showScreen('menu');
      resetGameState();
    };

    // Demo mode: add bot players for solo testing (cada personaje solo una vez)
    const demoBtn = document.getElementById('demo-players-button');
    if (demoBtn && gameState.isHost) {
      demoBtn.style.display = 'block';
      demoBtn.addEventListener('click', () => {
        const allChars = ['preskill', 'cirac', 'zoller', 'deutsch'];
        const taken = gameState.players.map(p => p.character).filter(Boolean);
        const available = allChars.filter(c => !taken.includes(c));
        const botNames = ['Alice', 'Bob', 'Charlie'];
        botNames.forEach((name, i) => {
          if (gameState.players.length < 4 && available[i]) {
            const char = characters.find(c => c.id === available[i]);
            gameState.players.push({
              name,
              character: available[i],
              team: char ? char.team : null,
              isReady: true,
              isHost: false
            });
          }
        });
        updatePlayersList();
        updateStartButton();
        demoBtn.style.display = 'none';
      });
    }
  }

  function setupGameSettings() {
    const settingsPanel = document.getElementById('game-settings-panel');
    const entanglementInfo = document.getElementById('entanglement-info');
    const gameModeRadios = document.querySelectorAll('input[name="game-mode"]');
    
    if (!settingsPanel) return;
    
    // Initialize gameMode from checked radio button
    const checkedRadio = document.querySelector('input[name="game-mode"]:checked');
    if (checkedRadio) {
      gameState.gameMode = checkedRadio.value;
      console.log(`Initial game mode set to: ${checkedRadio.value} reyes`);
      
      // Show/hide entanglement info based on initial selection
      if (checkedRadio.value === '8') {
        entanglementInfo.classList.add('show');
      } else {
        entanglementInfo.classList.remove('show');
      }
    }
    
    // Host can choose 4 or 8 kings; non-hosts see disabled panel
    if (!gameState.isHost) {
      settingsPanel.classList.add('disabled');
      settingsPanel.style.position = 'relative';
    } else {
      settingsPanel.classList.remove('disabled');
    }
    
    // Handle radio button changes
    gameModeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        gameState.gameMode = e.target.value;
        
        // Show/hide entanglement info based on selection
        if (e.target.value === '8') {
          entanglementInfo.classList.add('show');
        } else {
          entanglementInfo.classList.remove('show');
        }
        
        console.log(`Game mode changed to: ${e.target.value} reyes`);
      });
      
      // Set initial state
      if (radio.value === gameState.gameMode && radio.checked) {
        if (radio.value === '8') {
          entanglementInfo.classList.add('show');
        }
      }
    });
  }

  function createCharacterSelection() {
    const team1Grid = document.getElementById('team1-grid');
    const team2Grid = document.getElementById('team2-grid');
    if (!team1Grid || !team2Grid) return;
    
    team1Grid.innerHTML = '';
    team2Grid.innerHTML = '';

    // Get all taken characters (by ANY player, including the current one)
    const takenCharacters = gameState.players
      .filter(p => p.character)
      .map(p => p.character);

    // Get characters taken by OTHER players only (for "elegido" label)
    const takenByOthers = gameState.players
      .filter(p => p.name !== gameState.playerName && p.character)
      .map(p => p.character);

    // Count selected players per team
    const team1Selected = gameState.players.filter(p => {
      const char = characters.find(c => c.id === p.character);
      return char && char.team === 1;
    }).length;
    
    const team2Selected = gameState.players.filter(p => {
      const char = characters.find(c => c.id === p.character);
      return char && char.team === 2;
    }).length;

    characters.forEach(char => {
        // Character is taken if ANY player (including me) has selected it
        const isTaken = takenCharacters.includes(char.id);
        
        // Show "elegido" if:
        // 1. Another player selected it, OR
        // 2. The team has 2+ players selected (team is full)
        const isTeamFull = (char.team === 1 && team1Selected >= 2) || (char.team === 2 && team2Selected >= 2);
        const shouldShowElegido = takenByOthers.includes(char.id) || isTeamFull;
        
        // Is this my selection?
        const isMySelection = gameState.selectedCharacter && gameState.selectedCharacter.id === char.id;
        
        const charCard = document.createElement('div');
        charCard.className = 'character-card';
        if (isTaken) charCard.classList.add('taken');
        if (isMySelection) charCard.classList.add('selected');
        charCard.classList.add(`character-id-${char.id}`);
        charCard.dataset.characterId = char.id;
        
        // Extract just the brief description
        const descParts = char.description.split('<br><br>');
        const briefDesc = descParts[0] ? descParts[0].replace(/<[^>]*>/g, '') : '';
        
        charCard.innerHTML = `
          <div class="character-portrait-wrapper">
            ${CardGenerator.generateCharacter(char.id)}
          </div>
          <div class="character-info">
            <h4 class="character-name" style="color: ${char.color}">${char.name}</h4>
            <p class="character-specialty">${char.specialty}</p>
            <p class="character-description">${briefDesc || char.specialty}</p>
          </div>
          ${shouldShowElegido ? '<div class="character-taken-label">Elegido</div>' : ''}
          <div class="character-selected-indicator">✓</div>
        `;

      charCard.addEventListener('click', () => {
        // Prevent selecting if character is taken by someone else
        if (isTaken && !isMySelection) {
          console.log(`Character ${char.id} is already taken`);
          return;
        }
        
        // Toggle selection - unselect if I already selected it
        if (isMySelection) {
          unselectCharacter();
        } else {
          selectCharacter(char, charCard);
        }
      });
      
      // Add to appropriate team grid
      if (char.team === 1) {
        team1Grid.appendChild(charCard);
      } else {
        team2Grid.appendChild(charCard);
      }
    });
  }

  function selectCharacter(character, cardElement) {
    // Check if character is already taken by another player
    const takenByOthers = gameState.players
      .filter(p => p.name !== gameState.playerName && p.character)
      .map(p => p.character);
    
    if (takenByOthers.includes(character.id)) {
      console.log(`Cannot select ${character.id} - already taken by another player`);
      alert(`${character.name} ya ha sido elegido por otro jugador`);
      return;
    }

    document.querySelectorAll('.character-card').forEach(card => {
      card.classList.remove('selected');
    });

    cardElement.classList.add('selected');
    gameState.selectedCharacter = character;

    const currentPlayer = gameState.players.find(p => p.name === gameState.playerName);
    if (currentPlayer) {
      currentPlayer.character = character.id;
      currentPlayer.team = character.team;
      currentPlayer.isReady = true;
      updatePlayersList();
    }

    updateStartButton();

    // Emit character selection to server if we have a socket connection
    if (gameState.socket && gameState.roomId) {
      gameState.socket.emit('set_character', {
        room_id: gameState.roomId,
        character: character.id
      });
    }
  }

  function unselectCharacter() {
    document.querySelectorAll('.character-card').forEach(card => {
      card.classList.remove('selected');
    });

    gameState.selectedCharacter = null;

    const currentPlayer = gameState.players.find(p => p.name === gameState.playerName);
    if (currentPlayer) {
      currentPlayer.character = null;
      currentPlayer.team = null;
      currentPlayer.isReady = false;
      updatePlayersList();
    }

    updateStartButton();

    // Emit character deselection to server if we have a socket connection
    if (gameState.socket && gameState.roomId) {
      gameState.socket.emit('set_character', {
        room_id: gameState.roomId,
        character: null
      });
    }
  }

  function updatePlayersList() {
    const playersList = document.getElementById('players-list');
    const playerCount = document.getElementById('player-count');
    
    playerCount.textContent = gameState.players.length;
    playersList.innerHTML = '';

    gameState.players.forEach(player => {
      const playerItem = document.createElement('div');
      playerItem.className = 'player-item';
      
      if (player.character) {
        const char = characters.find(c => c.id === player.character);
        playerItem.innerHTML = `
          <div class="player-avatar" style="border-color: ${char.color}; position: relative;">
            ${CardGenerator.generateCharacter(char.name)}
            <div style="color: ${char.color}; background: rgba(0,0,0,0.5); position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 2rem; font-weight: bold; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; border-radius: 8px; z-index: 10;">
              ${char.name.charAt(0).toUpperCase()}
            </div>
          </div>
          <div class="player-info">
            <span class="player-name">${player.name}</span>
            ${player.isHost ? '<span class="host-badge">HOST</span>' : ''}
            <span class="player-character" style="color: ${char.color}">${char.name}</span>
          </div>
          <div class="player-status ready">✓ LISTO</div>
        `;
      } else {
        playerItem.innerHTML = `
          <div class="player-avatar pending">
            <div class="avatar-placeholder">?</div>
          </div>
          <div class="player-info">
            <span class="player-name">${player.name}</span>
            ${player.isHost ? '<span class="host-badge">HOST</span>' : ''}
          </div>
          <div class="player-status waiting">Eligiendo...</div>
        `;
      }

      playersList.appendChild(playerItem);
    });

    // Add empty slots
    for (let i = gameState.players.length; i < 4; i++) {
      const emptySlot = document.createElement('div');
      emptySlot.className = 'player-item empty';
      emptySlot.innerHTML = `
        <div class="player-avatar empty">
          <div class="avatar-placeholder">?</div>
        </div>
        <div class="player-info">
          <span class="player-name">Esperando jugador...</span>
        </div>
      `;
      playersList.appendChild(emptySlot);
    }

    // Update team members count
    const team1Count = gameState.players.filter(p => p.team === 1).length;
    const team2Count = gameState.players.filter(p => p.team === 2).length;
    
    const team1Members = document.getElementById('team1-members');
    const team2Members = document.getElementById('team2-members');
    
    if (team1Members) team1Members.textContent = `${team1Count}/2 jugadores`;
    if (team2Members) team2Members.textContent = `${team2Count}/2 jugadores`;

    // Refrescar cuadrícula de personajes para marcar los ya elegidos por otros
    createCharacterSelection();
  }

  function updateStartButton() {
    const startButton = document.getElementById('start-game-button');
    if (!gameState.isHost) return;

    const allReady = gameState.players.every(p => p.isReady);
    const enoughPlayers = gameState.players.length >= 1;
    
    startButton.disabled = !(allReady && enoughPlayers);
    
    if (!enoughPlayers) {
      startButton.textContent = `ESPERANDO JUGADORES (${gameState.players.length}/1)`;
    } else if (!allReady) {
      startButton.textContent = 'ESPERANDO QUE TODOS ESTÉN LISTOS';
    } else {
      startButton.textContent = 'INICIAR PARTIDA';
    }
  }

  function startGame() {
    // Reset game initialization flag before starting
    window.gameInitialized = false;

    // Record client timestamp to measure initialization latency
    try {
      window._create_start_ts = performance.now();
      console.log('[client] startGame clicked, timestamp set');
    } catch (e) {
      window._create_start_ts = Date.now();
    }

    // Find local player index (from character selection)
    const localIndex = gameState.players.findIndex(p => p.name === gameState.playerName);
    const safeIndex = localIndex >= 0 ? localIndex : 0;
    initializeGame(gameState.gameMode, gameState.players, safeIndex);
    showScreen('game');
  }

  // ============================================================
  // LEAVE GAME BUTTON
  // ============================================================
  const leaveGameButton = document.getElementById('leave-game-button');
  if (leaveGameButton) {
    leaveGameButton.onclick = () => {
      if (confirm('¿Estás seguro de que quieres abandonar la partida?')) {
        // Reset game initialization flag
        window.gameInitialized = false;
        // Ensure lobby is initialized before showing it
        if (typeof window.initializeLobby === 'function') {
          try { window.initializeLobby(); } catch (e) { console.warn('initializeLobby() failed', e); }
        }
        showScreen('lobby');
      }
    };
  }

  // ============================================================
  // GAME OVER SCREEN
  // ============================================================
  function showGameOver(winnerTeam, finalScore, gameStats) {
    const gameoverTitle = document.getElementById('gameover-title');
    const winnerPlayers = document.getElementById('winner-players');
    const finalScoreValue = document.getElementById('final-score-value');
    const gameoverStats = document.getElementById('gameover-stats');
    
    // Create trophy animation
    createTrophyAnimation();
    
    // Create quantum particles
    createQuantumParticles();
    
    // Set winner title
    if (winnerTeam === 1) {
      gameoverTitle.textContent = '¡VICTORIA CUÁNTICA!';
    } else {
      gameoverTitle.textContent = '¡VICTORIA CUÁNTICA!';
    }
    
    // Display winner players
    winnerPlayers.innerHTML = '';
    const winnerPlayersList = winnerTeam === 1 
      ? [gameState.players[0], gameState.players[2]] 
      : [gameState.players[1], gameState.players[3]];
    
    winnerPlayersList.forEach((player, index) => {
      if (player && player.character) {
        const char = characters.find(c => c.id === player.character);
        const playerDiv = document.createElement('div');
        playerDiv.className = 'winner-player';
        playerDiv.style.borderColor = char.color;
        
        playerDiv.innerHTML = `
          ${index === 0 ? '<div class="crown-icon">👑</div>' : ''}
          <div class="winner-avatar">
            ${CardGenerator.generateCharacter(char.name)}
          </div>
          <span class="winner-name" style="color: ${char.color}">${player.name}</span>
        `;
        
        winnerPlayers.appendChild(playerDiv);
      }
    });
    
    // Set final score
    finalScoreValue.textContent = `${finalScore.team1} - ${finalScore.team2}`;
    
    // Display game stats
    gameoverStats.innerHTML = `
      <div class="stat-box">
        <span class="stat-box-label">Rondas Jugadas</span>
        <span class="stat-box-value">${gameStats.rounds || 0}</span>
      </div>
      <div class="stat-box">
        <span class="stat-box-label">Envidos Cantados</span>
        <span class="stat-box-value">${gameStats.envidos || 0}</span>
      </div>
      <div class="stat-box">
        <span class="stat-box-label">Tiempo de Juego</span>
        <span class="stat-box-value">${gameStats.time || '0:00'}</span>
      </div>
    `;
    
    showScreen('gameover');
  }

  function createTrophyAnimation() {
    const trophyContainer = document.getElementById('trophy-animation');
    trophyContainer.innerHTML = `
      <svg class="trophy-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="trophy-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#f5c518;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#ff9e6d;stop-opacity:1" />
          </linearGradient>
          <filter id="trophy-glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        <!-- Trophy base -->
        <rect x="70" y="160" width="60" height="15" rx="3" 
              fill="url(#trophy-gradient)" filter="url(#trophy-glow)"/>
        <rect x="85" y="145" width="30" height="20" 
              fill="url(#trophy-gradient)" filter="url(#trophy-glow)"/>
        
        <!-- Trophy cup -->
        <path d="M 60 80 L 60 120 Q 60 140 100 140 Q 140 140 140 120 L 140 80 Z" 
              fill="url(#trophy-gradient)" filter="url(#trophy-glow)" opacity="0.9"/>
        
        <!-- Trophy handles -->
        <path d="M 60 90 Q 40 90 40 110 Q 40 120 50 120" 
              stroke="url(#trophy-gradient)" stroke-width="6" fill="none" 
              filter="url(#trophy-glow)" opacity="0.8"/>
        <path d="M 140 90 Q 160 90 160 110 Q 160 120 150 120" 
              stroke="url(#trophy-gradient)" stroke-width="6" fill="none" 
              filter="url(#trophy-glow)" opacity="0.8"/>
        
        <!-- Trophy rim -->
        <ellipse cx="100" cy="80" rx="40" ry="10" 
                 fill="url(#trophy-gradient)" filter="url(#trophy-glow)"/>
        
        <!-- Quantum symbol -->
        <circle cx="100" cy="110" r="15" fill="none" stroke="#2ec4b6" stroke-width="3" opacity="0.8">
          <animate attributeName="r" values="15;18;15" dur="2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.8;1;0.8" dur="2s" repeatCount="indefinite"/>
        </circle>
        <circle cx="100" cy="110" r="8" fill="#2ec4b6" opacity="0.6"/>
        
        <!-- Sparkles -->
        <circle cx="50" cy="60" r="3" fill="#f5c518" opacity="0.8">
          <animate attributeName="opacity" values="0.8;0;0.8" dur="1.5s" repeatCount="indefinite"/>
        </circle>
        <circle cx="150" cy="70" r="2" fill="#ff9e6d" opacity="0.8">
          <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite"/>
        </circle>
        <circle cx="100" cy="50" r="2.5" fill="#a78bfa" opacity="0.8">
          <animate attributeName="opacity" values="0.8;0;0.8" dur="1.8s" repeatCount="indefinite"/>
        </circle>
      </svg>
    `;
  }

  function createQuantumParticles() {
    const particlesContainer = document.querySelector('.quantum-particles');
    if (!particlesContainer) return;
    
    particlesContainer.innerHTML = '';
    
    // Create 30 particles
    for (let i = 0; i < 30; i++) {
      const particle = document.createElement('div');
      particle.className = 'quantum-particle';
      
      // Random properties
      const left = Math.random() * 100;
      const delay = Math.random() * 8;
      const duration = 8 + Math.random() * 4;
      const drift = (Math.random() - 0.5) * 200;
      
      const colors = ['#2ec4b6', '#ff9e6d', '#a78bfa', '#f5c518'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      particle.style.left = `${left}%`;
      particle.style.animationDelay = `${delay}s`;
      particle.style.animationDuration = `${duration}s`;
      particle.style.setProperty('--drift', `${drift}px`);
      particle.style.background = color;
      particle.style.boxShadow = `0 0 10px ${color}`;
      
      particlesContainer.appendChild(particle);
    }
  }

  // Game Over buttons
  const playAgainButton = document.getElementById('play-again-button');
  const exitToHomeButton = document.getElementById('exit-to-home-button');

  if (playAgainButton) {
    playAgainButton.addEventListener('click', () => {
      showScreen('lobby');
      // Reset game state for new game
      resetGameForNewRound();
    });
  }

  if (exitToHomeButton) {
    exitToHomeButton.addEventListener('click', () => {
      resetGameState();
      showScreen('portada');
    });
  }

  function resetGameForNewRound() {
    // Reset game initialization flag
    window.gameInitialized = false;
    
    // Reset scores but keep players and room
    gameState.players.forEach(player => {
      player.isReady = false;
    });
    updatePlayersList();
    updateStartButton();
  }

  // ============================================================
  // UTILITY FUNCTIONS
  // ============================================================
  function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  function resetGameState() {
    // Reset game initialization flag
    window.gameInitialized = false;
    
    gameState.playerName = '';
    gameState.roomCode = '';
    gameState.isHost = false;
    gameState.selectedCharacter = null;
    gameState.players = [];
    gameState.gameMode = '8'; // Default to 8 reyes
  }

  function createPortadaSchematic() {
    const container = document.getElementById('portada-schematic');
    if (!container) return;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 480 320');
    svg.setAttribute('class', 'portada-schematic-svg');

    // Portada elegante: referencia a lo cuántico con esfera de Bloch, ondas y partículas
    const schematic = `
      <defs>
        <radialGradient id="portada-orb" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style="stop-color:#2ec4b6;stop-opacity:0.5" />
          <stop offset="40%" style="stop-color:#a78bfa;stop-opacity:0.25" />
          <stop offset="70%" style="stop-color:#ff9e6d;stop-opacity:0.12" />
          <stop offset="100%" style="stop-color:#1a2840;stop-opacity:0" />
        </radialGradient>
        <radialGradient id="portada-orb-inner" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style="stop-color:#fff;stop-opacity:0.35" />
          <stop offset="100%" style="stop-color:#2ec4b6;stop-opacity:0" />
        </radialGradient>
        <linearGradient id="portada-wave" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#2ec4b6;stop-opacity:0" />
          <stop offset="50%" style="stop-color:#a78bfa;stop-opacity:0.4" />
          <stop offset="100%" style="stop-color:#2ec4b6;stop-opacity:0" />
        </linearGradient>
        <filter id="portada-glow">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      <!-- Ondas suaves (referencia a función de onda) -->
      <path d="M 0 140 Q 120 100, 240 140 T 480 140" fill="none" stroke="url(#portada-wave)" stroke-width="1.5" opacity="0.5"/>
      <path d="M 0 160 Q 120 200, 240 160 T 480 160" fill="none" stroke="url(#portada-wave)" stroke-width="1" opacity="0.35"/>
      <path d="M 0 120 Q 80 80, 240 120 T 480 120" fill="none" stroke="#2ec4b6" stroke-width="0.8" opacity="0.2"/>
      
      <!-- Esfera tipo Bloch (núcleo visual) -->
      <circle cx="240" cy="140" r="85" fill="url(#portada-orb)" filter="url(#portada-glow)"/>
      <circle cx="240" cy="140" r="55" fill="url(#portada-orb-inner)" opacity="0.6"/>
      <circle cx="240" cy="140" r="70" fill="none" stroke="#2ec4b6" stroke-width="1" opacity="0.25"/>
      <circle cx="240" cy="140" r="45" fill="none" stroke="#a78bfa" stroke-width="0.8" opacity="0.2" stroke-dasharray="4 3"/>
      
      <!-- Notación |ψ⟩ sutil -->
      <text x="240" y="148" fill="rgba(255,255,255,0.4)" font-size="28" font-style="italic" text-anchor="middle" font-family="Georgia, serif">|ψ⟩</text>
      
      <!-- Partículas flotantes -->
      <circle cx="120" cy="100" r="2" fill="#2ec4b6" opacity="0.6">
        <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2.5s" repeatCount="indefinite"/>
      </circle>
      <circle cx="360" cy="90" r="1.5" fill="#a78bfa" opacity="0.6">
        <animate attributeName="opacity" values="0.2;0.7;0.2" dur="2.8s" repeatCount="indefinite"/>
      </circle>
      <circle cx="80" cy="180" r="2" fill="#ff9e6d" opacity="0.5">
        <animate attributeName="opacity" values="0.2;0.6;0.2" dur="2.2s" repeatCount="indefinite"/>
      </circle>
      <circle cx="400" cy="190" r="1.5" fill="#f5c518" opacity="0.5">
        <animate attributeName="opacity" values="0.3;0.7;0.3" dur="2.6s" repeatCount="indefinite"/>
      </circle>
      <circle cx="240" cy="60" r="1" fill="#2ec4b6" opacity="0.4">
        <animate attributeName="opacity" values="0.1;0.5;0.1" dur="3s" repeatCount="indefinite"/>
      </circle>
      
      <!-- Anillo exterior suave -->
      <circle cx="240" cy="140" r="95" fill="none" stroke="#2ec4b6" stroke-width="0.5" opacity="0.15">
        <animate attributeName="r" values="92;98;92" dur="4s" repeatCount="indefinite"/>
      </circle>
    `;

    svg.innerHTML = schematic;
    container.appendChild(svg);
  }

  function createQuantumComputerArt() {
    const artContainer = document.querySelector('.quantum-computer-art');
    if (!artContainer) return;

    // Create quantum computer SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 600 400');
    svg.setAttribute('class', 'quantum-computer-svg');

    // Quantum processor unit
    const processor = `
      <defs>
        <linearGradient id="processor-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#2ec4b6;stop-opacity:0.8" />
          <stop offset="100%" style="stop-color:#a78bfa;stop-opacity:0.8" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      <!-- Main processor box -->
      <rect x="150" y="100" width="300" height="200" rx="20" 
            fill="none" stroke="url(#processor-grad)" stroke-width="4" 
            filter="url(#glow)" opacity="0.9">
        <animate attributeName="opacity" values="0.9;1;0.9" dur="3s" repeatCount="indefinite"/>
      </rect>
      
      <!-- Quantum grid -->
      <g opacity="0.7">
        <circle cx="250" cy="150" r="12" fill="none" stroke="#2ec4b6" stroke-width="2"/>
        <circle cx="300" cy="150" r="12" fill="none" stroke="#2ec4b6" stroke-width="2"/>
        <circle cx="350" cy="150" r="12" fill="none" stroke="#2ec4b6" stroke-width="2"/>
        
        <circle cx="250" cy="200" r="12" fill="none" stroke="#ff9e6d" stroke-width="2"/>
        <circle cx="300" cy="200" r="12" fill="none" stroke="#ff9e6d" stroke-width="2"/>
        <circle cx="350" cy="200" r="12" fill="none" stroke="#ff9e6d" stroke-width="2"/>
        
        <circle cx="250" cy="250" r="12" fill="none" stroke="#a78bfa" stroke-width="2"/>
        <circle cx="300" cy="250" r="12" fill="none" stroke="#a78bfa" stroke-width="2"/>
        <circle cx="350" cy="250" r="12" fill="none" stroke="#a78bfa" stroke-width="2"/>
        
        <!-- Connection lines -->
        <line x1="250" y1="150" x2="300" y2="150" stroke="#2ec4b6" stroke-width="1.5" opacity="0.5"/>
        <line x1="300" y1="150" x2="350" y2="150" stroke="#2ec4b6" stroke-width="1.5" opacity="0.5"/>
        
        <line x1="250" y1="200" x2="300" y2="200" stroke="#ff9e6d" stroke-width="1.5" opacity="0.5"/>
        <line x1="300" y1="200" x2="350" y2="200" stroke="#ff9e6d" stroke-width="1.5" opacity="0.5"/>
        
        <line x1="250" y1="250" x2="300" y2="250" stroke="#a78bfa" stroke-width="1.5" opacity="0.5"/>
        <line x1="300" y1="250" x2="350" y2="250" stroke="#a78bfa" stroke-width="1.5" opacity="0.5"/>
      </g>
      
      <!-- Cooling tubes -->
      <line x1="150" y1="120" x2="50" y2="120" stroke="#64748b" stroke-width="4" opacity="0.6"/>
      <line x1="150" y1="140" x2="50" y2="140" stroke="#64748b" stroke-width="4" opacity="0.6"/>
      <line x1="450" y1="120" x2="550" y2="120" stroke="#64748b" stroke-width="4" opacity="0.6"/>
      <line x1="450" y1="140" x2="550" y2="140" stroke="#64748b" stroke-width="4" opacity="0.6"/>
      
      <!-- Control panel -->
      <rect x="200" y="330" width="200" height="40" rx="5" 
            fill="none" stroke="#f5c518" stroke-width="2" opacity="0.7"/>
      <circle cx="230" cy="350" r="5" fill="#2ec4b6" opacity="0.8">
        <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2s" repeatCount="indefinite"/>
      </circle>
      <circle cx="260" cy="350" r="5" fill="#ff9e6d" opacity="0.8">
        <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" repeatCount="indefinite"/>
      </circle>
      <circle cx="290" cy="350" r="5" fill="#a78bfa" opacity="0.8">
        <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2.5s" repeatCount="indefinite"/>
      </circle>
      <circle cx="320" cy="350" r="5" fill="#f5c518" opacity="0.8">
        <animate attributeName="opacity" values="0.3;0.8;0.3" dur="1.5s" repeatCount="indefinite"/>
      </circle>
      
      <!-- Quantum particles -->
      <circle cx="200" cy="180" r="3" fill="#2ec4b6" opacity="0.8">
        <animateMotion path="M0,0 Q50,-30 100,0" dur="4s" repeatCount="indefinite"/>
      </circle>
      <circle cx="400" cy="220" r="3" fill="#ff9e6d" opacity="0.8">
        <animateMotion path="M0,0 Q-50,30 -100,0" dur="3s" repeatCount="indefinite"/>
      </circle>
    `;

    svg.innerHTML = processor;
    artContainer.appendChild(svg);
  }

  // ============================================================
  // DEMO: Add simulated players for testing
  // ============================================================
  // Uncomment the following to test the lobby with simulated players
  /*
  setTimeout(() => {
    if (gameState.isHost && gameState.players.length < 4) {
      gameState.players.push({
        name: 'Alice',
        character: 'cirac',
        isReady: true,
        isHost: false
      });
      gameState.players.push({
        name: 'Bob',
        character: 'zoller',
        isReady: true,
        isHost: false
      });
      gameState.players.push({
        name: 'Charlie',
        character: 'deutsch',
        isReady: true,
        isHost: false
      });
      updatePlayersList();
      updateStartButton();
    }
  }, 3000);
  */
  // Expose navigation helpers to global scope so other scripts (game.js) can call them
  try {
    window.showScreen = showScreen;
    window.initializeLobby = initializeLobby;
  } catch (e) {
    console.warn('Failed to expose navigation helpers to window', e);
  }

});

// Initialize the actual game (from game.js)
function initializeGame(gameMode = '8', players = [], localPlayerIndex = 0) {
  console.log('Game initialized!');
  console.log(`Game Mode: ${gameMode} reyes`);
  console.log('Players:', players);
  console.log('Local player index:', localPlayerIndex);
  
  window.currentGameMode = gameMode;
  window.currentPlayers = players;
  window.currentLocalPlayerIndex = localPlayerIndex;
}

// Export showGameOver function to be called from game.js
window.showGameOver = function(winnerTeam, finalScore, gameStats) {
  // Get the showGameOver function from the navigation.js scope
  const event = new CustomEvent('gameOver', {
    detail: { winnerTeam, finalScore, gameStats }
  });
  document.dispatchEvent(event);
};

// Listen for game over event
document.addEventListener('gameOver', (e) => {
  const { winnerTeam, finalScore, gameStats } = e.detail;
  
  // Get navigation functions (they're in the DOMContentLoaded scope)
  setTimeout(() => {
    const screens = {
      gameover: document.getElementById('gameover-screen')
    };
    
    // Show gameover screen
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
    screens.gameover.classList.add('active');
    
    // Setup gameover screen
    setupGameOverScreen(winnerTeam, finalScore, gameStats);
  }, 100);
});

function setupGameOverScreen(winnerTeam, finalScore, gameStats) {
  const gameoverTitle = document.getElementById('gameover-title');
  const winnerPlayers = document.getElementById('winner-players');
  const finalScoreValue = document.getElementById('final-score-value');
  const gameoverStats = document.getElementById('gameover-stats');
  
  // Create trophy animation
  createTrophyAnimationGlobal();
  
  // Create quantum particles
  createQuantumParticlesGlobal();
  
  // Set winner title
  gameoverTitle.textContent = '¡VICTORIA CUÁNTICA!';
  
  // Display winner players (simplified version - you can customize)
  winnerPlayers.innerHTML = `
    <div class="winner-player" style="border-color: #2ec4b6;">
      <div class="crown-icon">👑</div>
      <div class="winner-avatar">
        ${CardGenerator.generateCharacter('Preskill')}
      </div>
      <span class="winner-name" style="color: #2ec4b6">Equipo ${winnerTeam}</span>
    </div>
  `;
  
  // Set final score
  finalScoreValue.textContent = `${finalScore.team1} - ${finalScore.team2}`;
  
  // Display game stats
  gameoverStats.innerHTML = `
    <div class="stat-box">
      <span class="stat-box-label">Rondas Jugadas</span>
      <span class="stat-box-value">${gameStats.rounds || 0}</span>
    </div>
    <div class="stat-box">
      <span class="stat-box-label">Envidos Cantados</span>
      <span class="stat-box-value">${gameStats.envidos || 0}</span>
    </div>
    <div class="stat-box">
      <span class="stat-box-label">Tiempo de Juego</span>
      <span class="stat-box-value">${gameStats.time || '0:00'}</span>
    </div>
  `;
}

function createTrophyAnimationGlobal() {
  const trophyContainer = document.getElementById('trophy-animation');
  if (!trophyContainer) return;
  
  trophyContainer.innerHTML = `
    <svg class="trophy-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="trophy-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#f5c518;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#ff9e6d;stop-opacity:1" />
        </linearGradient>
        <filter id="trophy-glow">
          <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      <rect x="70" y="160" width="60" height="15" rx="3" 
            fill="url(#trophy-gradient)" filter="url(#trophy-glow)"/>
      <rect x="85" y="145" width="30" height="20" 
            fill="url(#trophy-gradient)" filter="url(#trophy-glow)"/>
      
      <path d="M 60 80 L 60 120 Q 60 140 100 140 Q 140 140 140 120 L 140 80 Z" 
            fill="url(#trophy-gradient)" filter="url(#trophy-glow)" opacity="0.9"/>
      
      <path d="M 60 90 Q 40 90 40 110 Q 40 120 50 120" 
            stroke="url(#trophy-gradient)" stroke-width="6" fill="none" 
            filter="url(#trophy-glow)" opacity="0.8"/>
      <path d="M 140 90 Q 160 90 160 110 Q 160 120 150 120" 
            stroke="url(#trophy-gradient)" stroke-width="6" fill="none" 
            filter="url(#trophy-glow)" opacity="0.8"/>
      
      <ellipse cx="100" cy="80" rx="40" ry="10" 
               fill="url(#trophy-gradient)" filter="url(#trophy-glow)"/>
      
      <circle cx="100" cy="110" r="15" fill="none" stroke="#2ec4b6" stroke-width="3" opacity="0.8">
        <animate attributeName="r" values="15;18;15" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.8;1;0.8" dur="2s" repeatCount="indefinite"/>
      </circle>
      <circle cx="100" cy="110" r="8" fill="#2ec4b6" opacity="0.6"/>
      
      <circle cx="50" cy="60" r="3" fill="#f5c518" opacity="0.8">
        <animate attributeName="opacity" values="0.8;0;0.8" dur="1.5s" repeatCount="indefinite"/>
      </circle>
      <circle cx="150" cy="70" r="2" fill="#ff9e6d" opacity="0.8">
        <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite"/>
      </circle>
      <circle cx="100" cy="50" r="2.5" fill="#a78bfa" opacity="0.8">
        <animate attributeName="opacity" values="0.8;0;0.8" dur="1.8s" repeatCount="indefinite"/>
      </circle>
    </svg>
  `;
}

function createQuantumParticlesGlobal() {
  const particlesContainer = document.querySelector('.quantum-particles');
  if (!particlesContainer) return;
  
  particlesContainer.innerHTML = '';
  
  for (let i = 0; i < 30; i++) {
    const particle = document.createElement('div');
    particle.className = 'quantum-particle';
    
    const left = Math.random() * 100;
    const delay = Math.random() * 8;
    const duration = 8 + Math.random() * 4;
    const drift = (Math.random() - 0.5) * 200;
    
    const colors = ['#2ec4b6', '#ff9e6d', '#a78bfa', '#f5c518'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    particle.style.left = `${left}%`;
    particle.style.animationDelay = `${delay}s`;
    particle.style.animationDuration = `${duration}s`;
    particle.style.setProperty('--drift', `${drift}px`);
    particle.style.background = color;
    particle.style.boxShadow = `0 0 10px ${color}`;
    
    particlesContainer.appendChild(particle);
  }
}