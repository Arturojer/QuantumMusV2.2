// Artistic Card Generator with Character Avatars
class CardGenerator {
  
  // Generate artistic hand-drawn Bloch sphere
  static generateBlochSphere(state = 'superposition', isEntangled = false, value1 = '0', value2 = '1', coeffA = 0, coeffB = 0, suitColor = '#2ec4b6') {
    const stateConfigs = {
      superposition: {
        vectorX: 65,
        vectorY: 35,
        color: suitColor,
        label: '|+âŸ©',
        rotate: true,
        secondLabel: null
      },
      up: {
        vectorX: 50,
        vectorY: 20,
        color: suitColor,
        label: '|â†‘âŸ©',
        rotate: false,
        secondLabel: null
      },
      down: {
        vectorX: 50,
        vectorY: 80,
        color: suitColor,
        label: '|â†“âŸ©',
        rotate: false,
        secondLabel: null
      },
      entangled: {
        vectorX: 65,
        vectorY: 35,
        color: suitColor,
        label: `|${value1}/${value2}âŸ©`,
        rotate: true,
        secondLabel: `|${value2}/${value1}âŸ©`
      },
      superposed: {
        vectorX: 50 + (coeffA * 20),
        vectorY: 50 - (coeffB * 30),
        color: suitColor,
        label: `${coeffA.toFixed(2)}|${value1}âŸ©+${coeffB.toFixed(2)}|${value2}âŸ©`,
        rotate: true,
        secondLabel: null
      }
    };
    
    const config = stateConfigs[state] || stateConfigs.superposition;
    const shouldRotate = isEntangled || config.rotate;
    
    return `<svg width="80" height="80" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="sphere-${state}" cx="35%" cy="35%" r="65%">
          <stop offset="0%" style="stop-color:#ffffff;stop-opacity:0.95" />
          <stop offset="50%" style="stop-color:#f8f4e8;stop-opacity:0.6" />
          <stop offset="100%" style="stop-color:#e8dcc8;stop-opacity:0.3" />
        </radialGradient>
      </defs>
      
      <!-- Main sphere -->
      <circle cx="50" cy="50" r="38" 
              fill="url(#sphere-${state})" 
              stroke="${config.color}" 
              stroke-width="2.5" 
              opacity="0.95"
              style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.2))"/>
      
      <!-- Latitude circles -->
      <ellipse cx="50" cy="50" rx="38" ry="15" 
               fill="none" stroke="#64748b" stroke-width="0.8" 
               stroke-dasharray="2,3" opacity="0.25"/>
      <ellipse cx="50" cy="50" rx="38" ry="28" 
               fill="none" stroke="#64748b" stroke-width="0.8" 
               stroke-dasharray="2,3" opacity="0.2"/>
      <ellipse cx="50" cy="50" rx="38" ry="8" 
               fill="none" stroke="#64748b" stroke-width="1" 
               stroke-dasharray="3,2" opacity="0.3"/>
      
      <!-- Longitude lines -->
      <path d="M 50,12 Q 60,50 50,88" fill="none" stroke="#64748b" 
            stroke-width="0.8" stroke-dasharray="2,3" opacity="0.2"/>
      <path d="M 50,12 Q 40,50 50,88" fill="none" stroke="#64748b" 
            stroke-width="0.8" stroke-dasharray="2,3" opacity="0.2"/>
      
      <!-- Axes -->
      <line x1="10" y1="50" x2="90" y2="50" stroke="#64748b" 
            stroke-width="1.2" stroke-dasharray="4,3" opacity="0.4" stroke-linecap="round"/>
      <line x1="50" y1="10" x2="50" y2="90" stroke="#64748b" 
            stroke-width="1.2" stroke-dasharray="4,3" opacity="0.4" stroke-linecap="round"/>
      
      <!-- State vector -->
      <line x1="50" y1="50" x2="${config.vectorX}" y2="${config.vectorY}" 
            stroke="${config.color}" stroke-width="3" stroke-linecap="round" opacity="0.9"
            style="filter: drop-shadow(0px 1px 2px rgba(0,0,0,0.3))">
        ${shouldRotate ? `
        <animateTransform attributeName="transform" attributeType="XML" type="rotate"
                         from="0 50 50" to="360 50 50" dur="6s" repeatCount="indefinite"/>
        ` : ''}
      </line>
      
      <!-- Vector endpoint -->
      <circle cx="${config.vectorX}" cy="${config.vectorY}" r="4.5" 
              fill="${config.color}" opacity="0.9"
              style="filter: drop-shadow(0px 0px 3px ${config.color})">
        ${shouldRotate ? `
        <animateTransform attributeName="transform" attributeType="XML" type="rotate"
                         from="0 50 50" to="360 50 50" dur="6s" repeatCount="indefinite"/>
        ` : ''}
      </circle>
      
      <!-- Highlight -->
      <circle cx="${config.vectorX}" cy="${config.vectorY}" r="2" 
              fill="white" opacity="0.6">
        ${shouldRotate ? `
        <animateTransform attributeName="transform" attributeType="XML" type="rotate"
                         from="0 50 50" to="360 50 50" dur="6s" repeatCount="indefinite"/>
        ` : ''}
      </circle>
      
      <!-- Axis labels -->
      <text x="92" y="54" font-size="9" fill="#64748b" 
            font-family="Georgia, serif" font-style="italic" opacity="0.6">x</text>
      <text x="46" y="10" font-size="9" fill="#64748b" 
            font-family="Georgia, serif" font-style="italic" opacity="0.6">z</text>
      
      <!-- State label -->
      <text x="50" y="97" font-size="10" fill="${config.color}" 
            font-family="'Courier New', monospace" text-anchor="middle" 
            opacity="0.7">${config.label}</text>
    </svg>`;
  }

  // Generate character portraits - artistic hand-drawn style
  static generateCharacter(name) {
    const characters = {
      'Preskill': `<svg width="80" height="100" viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg">
        <!-- Head -->
        <circle cx="40" cy="30" r="20" 
                fill="none" stroke="#2ec4b6" stroke-width="2.5" opacity="0.85"/>
        
        <!-- Modern hair -->
        <path d="M22,16 Q40,8 58,16" 
              fill="none" stroke="#2ec4b6" stroke-width="2" opacity="0.75"/>
        <path d="M24,18 Q40,12 56,18" 
              fill="none" stroke="#2ec4b6" stroke-width="1.5" opacity="0.6"/>
        
        <!-- Body with casual jacket -->
        <path d="M20,52 Q40,70 60,52 L60,90 Q40,100 20,90 Z" 
              fill="none" stroke="#2ec4b6" stroke-width="2.5" opacity="0.85"/>
        
        <!-- Shirt collar -->
        <path d="M30,52 L35,58 M50,52 L45,58" 
              fill="none" stroke="#2ec4b6" stroke-width="2" opacity="0.8"/>
        
        <!-- Thoughtful expression -->
        <path d="M30,36 Q40,40 50,36" 
              fill="none" stroke="#2ec4b6" stroke-width="2" 
              stroke-linecap="round" opacity="0.8"/>
        
        <!-- Eyes -->
        <circle cx="30" cy="28" r="2.5" fill="#2ec4b6" opacity="0.8"/>
        <circle cx="50" cy="28" r="2.5" fill="#2ec4b6" opacity="0.8"/>
        
        <!-- Error correction code symbol (nested circles) -->
        <circle cx="40" cy="75" r="7" fill="none" stroke="#2ec4b6" 
                stroke-width="1.5" opacity="0.7"/>
        <circle cx="40" cy="75" r="4" fill="none" stroke="#2ec4b6" 
                stroke-width="1" opacity="0.5"/>
        <circle cx="40" cy="75" r="1" fill="#2ec4b6" opacity="0.7"/>
      </svg>`,
      
      'Cirac': `<svg width="80" height="100" viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg">
        <!-- Head -->
        <circle cx="40" cy="30" r="20" 
                fill="none" stroke="#ff9e6d" stroke-width="2.5" opacity="0.85"/>
        
        <!-- Modern glasses -->
        <rect x="25" y="25" width="12" height="10" rx="2" 
              fill="none" stroke="#ff9e6d" stroke-width="1.8" opacity="0.8"/>
        <rect x="43" y="25" width="12" height="10" rx="2" 
              fill="none" stroke="#ff9e6d" stroke-width="1.8" opacity="0.8"/>
        <line x1="37" y1="30" x2="43" y2="30" stroke="#ff9e6d" 
              stroke-width="1.5" opacity="0.8"/>
        
        <!-- Hair -->
        <path d="M22,18 Q40,10 58,18" 
              fill="none" stroke="#ff9e6d" stroke-width="2" opacity="0.7"/>
        
        <!-- Body -->
        <path d="M20,52 Q40,68 60,52 L60,90 Q40,100 20,90 Z" 
              fill="none" stroke="#ff9e6d" stroke-width="2.5" opacity="0.85"/>
        
        <!-- Ion trap symbol -->
        <circle cx="40" cy="73" r="8" fill="none" stroke="#ff9e6d" 
                stroke-width="1.5" opacity="0.7"/>
        <circle cx="32" cy="73" r="3" fill="#ff9e6d" opacity="0.7"/>
        <circle cx="40" cy="73" r="3" fill="#ff9e6d" opacity="0.7"/>
        <circle cx="48" cy="73" r="3" fill="#ff9e6d" opacity="0.7"/>
        
        <!-- Eyes behind glasses -->
        <circle cx="31" cy="29" r="2" fill="#ff9e6d" opacity="0.6"/>
        <circle cx="49" cy="29" r="2" fill="#ff9e6d" opacity="0.6"/>
      </svg>`,
      
      'Zoller': `<svg width="80" height="100" viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg">
        <!-- Head -->
        <circle cx="40" cy="30" r="20" 
                fill="none" stroke="#a78bfa" stroke-width="2.5" opacity="0.85"/>
        
        <!-- Distinguished hair -->
        <path d="M21,19 Q30,12 40,16 Q50,12 59,19" 
              fill="none" stroke="#a78bfa" stroke-width="2" opacity="0.7"/>
        <path d="M24,21 Q40,15 56,21" 
              fill="none" stroke="#a78bfa" stroke-width="1.5" opacity="0.6"/>
        
        <!-- Body with academic style -->
        <path d="M20,52 Q40,68 60,52 L60,90 Q40,100 20,90 Z" 
              fill="none" stroke="#a78bfa" stroke-width="2.5" opacity="0.85"/>
        
        <!-- Quantum lattice symbol -->
        <circle cx="32" cy="72" r="4" fill="none" stroke="#a78bfa" 
                stroke-width="1.5" opacity="0.7"/>
        <circle cx="40" cy="72" r="4" fill="none" stroke="#a78bfa" 
                stroke-width="1.5" opacity="0.7"/>
        <circle cx="48" cy="72" r="4" fill="none" stroke="#a78bfa" 
                stroke-width="1.5" opacity="0.7"/>
        <line x1="32" y1="72" x2="48" y2="72" stroke="#a78bfa" 
              stroke-width="1.2" opacity="0.6"/>
        
        <!-- Friendly expression -->
        <path d="M30,38" fill="none" stroke="#a78bfa" stroke-width="2" 
              stroke-linecap="round" opacity="0.7"/>
        <path d="M50,38" fill="none" stroke="#a78bfa" stroke-width="2" 
              stroke-linecap="round" opacity="0.7"/>
        
        <!-- Eyes -->
        <circle cx="30" cy="28" r="2.5" fill="#a78bfa" opacity="0.8"/>
        <circle cx="50" cy="28" r="2.5" fill="#a78bfa" opacity="0.8"/>
      </svg>`,
      
      'Deutsch': `<svg width="80" height="100" viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg">
        <!-- Head -->
        <circle cx="40" cy="30" r="20" 
                fill="none" stroke="#f5c518" stroke-width="2.5" opacity="0.85"/>
        
        <!-- Curly hair -->
        <path d="M22,17 Q28,10 34,16 Q40,10 46,16 Q52,10 58,17" 
              fill="none" stroke="#f5c518" stroke-width="2" opacity="0.7"/>
        <path d="M24,19 Q40,13 56,19" 
              fill="none" stroke="#f5c518" stroke-width="1.5" opacity="0.6"/>
        
        <!-- Body -->
        <path d="M20,52 Q40,68 60,52 L60,90 Q40,100 20,90 Z" 
              fill="none" stroke="#f5c518" stroke-width="2.5" opacity="0.85"/>
        
        <!-- Quantum circuit symbol -->
        <rect x="32" y="68" width="16" height="16" rx="2" 
              fill="none" stroke="#f5c518" stroke-width="1.5" opacity="0.7"/>
        <circle cx="40" cy="76" r="5" fill="none" stroke="#f5c518" 
                stroke-width="1.5" opacity="0.7"/>
        <circle cx="40" cy="76" r="2" fill="#f5c518" opacity="0.7"/>
        
        <!-- Thoughtful expression -->
        <path d="M30,37 Q34,39 38,37" 
              fill="none" stroke="#f5c518" stroke-width="1.5" 
              stroke-linecap="round" opacity="0.7"/>
        <path d="M42,37 Q46,39 50,37" 
              fill="none" stroke="#f5c518" stroke-width="1.5" 
              stroke-linecap="round" opacity="0.7"/>
        
        <!-- Eyes -->
        <circle cx="31" cy="28" r="2.5" fill="#f5c518" opacity="0.8"/>
        <circle cx="49" cy="28" r="2.5" fill="#f5c518" opacity="0.8"/>
      </svg>`,
      
      'Simmons': `<svg width="80" height="100" viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg">
        <!-- Head -->
        <circle cx="40" cy="30" r="20" 
                fill="none" stroke="#ff66c4" stroke-width="2.5" opacity="0.85"/>
        
        <!-- Professional hair -->
        <path d="M22,18 Q40,10 58,18" 
              fill="none" stroke="#ff66c4" stroke-width="2" opacity="0.7"/>
        <path d="M24,16 Q40,8 56,16" 
              fill="none" stroke="#ff66c4" stroke-width="1.5" opacity="0.6"/>
        
        <!-- Body with lab coat -->
        <path d="M20,52 Q40,70 60,52 L60,90 Q40,100 20,90 Z" 
              fill="none" stroke="#ff66c4" stroke-width="2.5" opacity="0.85"/>
        
        <!-- Lab coat buttons -->
        <circle cx="40" cy="60" r="2" fill="#ff66c4" opacity="0.7"/>
        <circle cx="40" cy="72" r="2" fill="#ff66c4" opacity="0.7"/>
        <circle cx="40" cy="84" r="2" fill="#ff66c4" opacity="0.7"/>
        
        <!-- Atomic symbol (single atom) -->
        <circle cx="40" cy="73" r="6" fill="none" stroke="#ff66c4" 
                stroke-width="1.5" opacity="0.7"/>
        <circle cx="40" cy="73" r="2" fill="#ff66c4" opacity="0.8"/>
        
        <!-- Eyes -->
        <circle cx="30" cy="28" r="2.5" fill="#ff66c4" opacity="0.8"/>
        <circle cx="50" cy="28" r="2.5" fill="#ff66c4" opacity="0.8"/>
      </svg>`,
      
      'Broadbent': `<svg width="80" height="100" viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg">
        <!-- Head -->
        <circle cx="40" cy="30" r="20" 
                fill="none" stroke="#2ecc71" stroke-width="2.5" opacity="0.85"/>
        
        <!-- Hair with highlights -->
        <path d="M22,17 Q40,9 58,17" 
              fill="none" stroke="#2ecc71" stroke-width="2" opacity="0.75"/>
        <path d="M25,15 Q40,10 55,15" 
              fill="none" stroke="#2ecc71" stroke-width="1.5" opacity="0.6"/>
        
        <!-- Body -->
        <path d="M20,52 Q40,70 60,52 L60,90 Q40,100 20,90 Z" 
              fill="none" stroke="#2ecc71" stroke-width="2.5" opacity="0.85"/>
        
        <!-- Security/cryptography symbol (padlock) -->
        <rect x="33" y="68" width="14" height="12" rx="1" 
              fill="none" stroke="#2ecc71" stroke-width="1.5" opacity="0.7"/>
        <path d="M36,68 Q36,62 40,62 Q44,62 44,68" 
              fill="none" stroke="#2ecc71" stroke-width="1.5" opacity="0.7"/>
        <circle cx="40" cy="77" r="1.5" fill="#2ecc71" opacity="0.8"/>
        
        <!-- Eyes -->
        <circle cx="30" cy="28" r="2.5" fill="#2ecc71" opacity="0.8"/>
        <circle cx="50" cy="28" r="2.5" fill="#2ecc71" opacity="0.8"/>
      </svg>`,
      
      'Yunger Halpern': `<svg width="80" height="100" viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg">
        <!-- Head -->
        <circle cx="40" cy="30" r="20" 
                fill="none" stroke="#ffb347" stroke-width="2.5" opacity="0.85"/>
        
        <!-- Wavy hair -->
        <path d="M22,16 Q30,10 40,13 Q50,10 58,16" 
              fill="none" stroke="#ffb347" stroke-width="2" opacity="0.75"/>
        <path d="M24,18 Q35,13 40,15 Q45,13 56,18" 
              fill="none" stroke="#ffb347" stroke-width="1.5" opacity="0.6"/>
        
        <!-- Body -->
        <path d="M20,52 Q40,70 60,52 L60,90 Q40,100 20,90 Z" 
              fill="none" stroke="#ffb347" stroke-width="2.5" opacity="0.85"/>
        
        <!-- Steampunk gear symbol -->
        <circle cx="40" cy="73" r="6" fill="none" stroke="#ffb347" 
                stroke-width="1.5" opacity="0.7"/>
        <circle cx="40" cy="73" r="3" fill="none" stroke="#ffb347" 
                stroke-width="1" opacity="0.6"/>
        <circle cx="40" cy="73" r="1" fill="#ffb347" opacity="0.8"/>
        <circle cx="47" cy="73" r="1.5" fill="#ffb347" opacity="0.7"/>
        <circle cx="33" cy="73" r="1.5" fill="#ffb347" opacity="0.7"/>
        
        <!-- Eyes -->
        <circle cx="30" cy="28" r="2.5" fill="#ffb347" opacity="0.8"/>
        <circle cx="50" cy="28" r="2.5" fill="#ffb347" opacity="0.8"/>
      </svg>`,
      
      'Nicole Yunger Halpern': `<svg width="80" height="100" viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg">
        <!-- Head -->
        <circle cx="40" cy="30" r="20" 
                fill="none" stroke="#ffb347" stroke-width="2.5" opacity="0.85"/>
        
        <!-- Wavy hair -->
        <path d="M22,16 Q30,10 40,13 Q50,10 58,16" 
              fill="none" stroke="#ffb347" stroke-width="2" opacity="0.75"/>
        <path d="M24,18 Q35,13 40,15 Q45,13 56,18" 
              fill="none" stroke="#ffb347" stroke-width="1.5" opacity="0.6"/>
        
        <!-- Body -->
        <path d="M20,52 Q40,70 60,52 L60,90 Q40,100 20,90 Z" 
              fill="none" stroke="#ffb347" stroke-width="2.5" opacity="0.85"/>
        
        <!-- Steampunk gear symbol -->
        <circle cx="40" cy="73" r="6" fill="none" stroke="#ffb347" 
                stroke-width="1.5" opacity="0.7"/>
        <circle cx="40" cy="73" r="3" fill="none" stroke="#ffb347" 
                stroke-width="1" opacity="0.6"/>
        <circle cx="40" cy="73" r="1" fill="#ffb347" opacity="0.8"/>
        <circle cx="47" cy="73" r="1.5" fill="#ffb347" opacity="0.7"/>
        <circle cx="33" cy="73" r="1.5" fill="#ffb347" opacity="0.7"/>
        
        <!-- Eyes -->
        <circle cx="30" cy="28" r="2.5" fill="#ffb347" opacity="0.8"/>
        <circle cx="50" cy="28" r="2.5" fill="#ffb347" opacity="0.8"/>
      </svg>`,
      
      'Hallberg': `<svg width="80" height="100" viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg">
        <!-- Head -->
        <circle cx="40" cy="30" r="20" 
                fill="none" stroke="#5f9ea0" stroke-width="2.5" opacity="0.85"/>
        
        <!-- Elegant hair -->
        <path d="M21,17 Q30,9 40,12 Q50,9 59,17" 
              fill="none" stroke="#5f9ea0" stroke-width="2" opacity="0.75"/>
        <path d="M24,15 Q40,8 56,15" 
              fill="none" stroke="#5f9ea0" stroke-width="1.5" opacity="0.6"/>
        
        <!-- Body -->
        <path d="M20,52 Q40,70 60,52 L60,90 Q40,100 20,90 Z" 
              fill="none" stroke="#5f9ea0" stroke-width="2.5" opacity="0.85"/>
        
        <!-- Molecular/material structure symbol (atoms linked) -->
        <circle cx="32" cy="70" r="3" fill="none" stroke="#5f9ea0" 
                stroke-width="1.5" opacity="0.7"/>
        <circle cx="40" cy="70" r="3" fill="none" stroke="#5f9ea0" 
                stroke-width="1.5" opacity="0.7"/>
        <circle cx="48" cy="70" r="3" fill="none" stroke="#5f9ea0" 
                stroke-width="1.5" opacity="0.7"/>
        <line x1="35" y1="70" x2="37" y2="70" stroke="#5f9ea0" 
              stroke-width="1" opacity="0.6"/>
        <line x1="43" y1="70" x2="45" y2="70" stroke="#5f9ea0" 
              stroke-width="1" opacity="0.6"/>
        <circle cx="32" cy="70" r="1" fill="#5f9ea0" opacity="0.8"/>
        <circle cx="40" cy="70" r="1" fill="#5f9ea0" opacity="0.8"/>
        <circle cx="48" cy="70" r="1" fill="#5f9ea0" opacity="0.8"/>
        
        <!-- Eyes -->
        <circle cx="30" cy="28" r="2.5" fill="#5f9ea0" opacity="0.8"/>
        <circle cx="50" cy="28" r="2.5" fill="#5f9ea0" opacity="0.8"/>
      </svg>`
    };
    
    return characters[name] || characters['Preskill'];
  }

  // Generate quantum state notation
  static generateQuantumNotation(state) {
    return `|${state}âŸ©`;
  }

  // Generate cool atom to indicate "mano" (player who starts)
  static generateAtomIndicator(color = '#2ec4b6') {
    const uniqueId = `atom-${Math.random().toString(36).substr(2, 9)}`;
    return `<svg width="60" height="60" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" style="display: block;">
      <defs>
        <radialGradient id="${uniqueId}-nucleus" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${color};stop-opacity:0.6" />
        </radialGradient>
        <style>
          @keyframes atomSpin-${uniqueId} {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes atomPulse-${uniqueId} {
            0%, 100% { r: 5px; opacity: 0; }
            50% { r: 8px; opacity: 0.8; }
          }
        </style>
      </defs>
      
      <!-- Nucleus -->
      <circle cx="20" cy="20" r="4" fill="url(#${uniqueId}-nucleus)" 
              style="filter: drop-shadow(0 0 3px ${color}); opacity: 0.95"/>
      
      <!-- Orbital rings -->
      <circle cx="20" cy="20" r="11" fill="none" stroke="${color}" 
              stroke-width="1.2" opacity="0.6"/>
      <circle cx="20" cy="20" r="16" fill="none" stroke="${color}" 
              stroke-width="1" opacity="0.4"/>
      
      <!-- Electrons on orbits - using g element for rotation -->
      <g style="animation: atomSpin-${uniqueId} 8s linear infinite; transform-origin: 20px 20px;">
        <circle cx="20" cy="9" r="1.5" fill="${color}" opacity="0.9"/>
        <circle cx="31" cy="29" r="1.5" fill="${color}" opacity="0.8"/>
        <circle cx="9" cy="29" r="1.5" fill="${color}" opacity="0.7"/>
      </g>
      
      <!-- Outer electrons -->
      <g style="animation: atomSpin-${uniqueId} 10s linear infinite reverse; transform-origin: 20px 20px;">
        <circle cx="20" cy="4" r="1.3" fill="${color}" opacity="0.85"/>
        <circle cx="36" cy="26" r="1.3" fill="${color}" opacity="0.75"/>
        <circle cx="4" cy="26" r="1.3" fill="${color}" opacity="0.65"/>
      </g>
      
      <!-- Pulse effect on nucleus -->
      <circle cx="20" cy="20" r="4" fill="none" stroke="${color}" 
              stroke-width="0.8" opacity="0"
              style="animation: atomPulse-${uniqueId} 2s ease-in-out infinite; filter: drop-shadow(0 0 2px ${color})"/>
      
      <!-- Mano label centered in nucleus (on top) -->
      <text x="20" y="20" font-size="12" font-weight="900" fill="white" stroke="#000" stroke-width="0.4" text-anchor="middle" dominant-baseline="central"
            font-family="Cambria Math, Georgia, serif" opacity="1" font-style="italic">m</text>
    </svg>`;
  }
}

// Export for browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CardGenerator;
} else {
  window.CardGenerator = CardGenerator;
}