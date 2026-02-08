# ⚛️ Sistema de Entrelazamiento Cuántico en Quantum Mus

## 📖 Concepto

El entrelazamiento cuántico es una característica única de Quantum Mus donde ciertas cartas están "entrelazadas" entre compañeros de equipo. Cuando un jugador juega una carta entrelazada, su compañero automáticamente tiene acceso cuántico a su pareja.

## 🎴 Modos de Entrelazamiento

### Modo 4 Reyes (Clásico)

```
EQUIPO 1 (Preskill & Zoller)
┌─────────────────────────────────────┐
│                                     │
│  Rey de Oros  ⟷  Rey de Copas     │
│      🟡            🔴              │
│   (Player 1)    (Player 3)         │
│                                     │
└─────────────────────────────────────┘

EQUIPO 2 (Cirac & Deutsch)
┌─────────────────────────────────────┐
│                                     │
│  Rey de Espadas ⟷ Rey de Bastos    │
│      ⚫            🟢              │
│   (Player 2)    (Player 4)         │
│                                     │
└─────────────────────────────────────┘
```

**Cartas Totales**: 4 cartas entrelazadas (solo reyes)

---

### Modo 8 Reyes (Avanzado)

```
EQUIPO 1 (Preskill & Zoller)
┌─────────────────────────────────────────────────┐
│                                                 │
│  REYES                                          │
│  Rey de Oros 🟡 ⟷ Rey de Copas 🔴            │
│   (Player 1)        (Player 3)                  │
│                                                 │
│  TRESES                                         │
│  3 de Oros 🟡 ⟷ 3 de Copas 🔴                │
│   (Player 1)        (Player 3)                  │
│                                                 │
│  DOSES                                          │
│  2 de Oros 🟡 ⟷ 2 de Copas 🔴                │
│   (Player 1)        (Player 3)                  │
│                                                 │
└─────────────────────────────────────────────────┘

EQUIPO 2 (Cirac & Deutsch)
┌─────────────────────────────────────────────────┐
│                                                 │
│  REYES                                          │
│  Rey de Espadas ⚫ ⟷ Rey de Bastos 🟢        │
│   (Player 2)        (Player 4)                  │
│                                                 │
│  TRESES                                         │
│  3 de Espadas ⚫ ⟷ 3 de Bastos 🟢            │
│   (Player 2)        (Player 4)                  │
│                                                 │
│  DOSES                                          │
│  2 de Espadas ⚫ ⟷ 2 de Bastos 🟢            │
│   (Player 2)        (Player 4)                  │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Cartas Totales**: 12 cartas entrelazadas (reyes, 3s y 2s)

## 🔬 Mecánicas de Entrelazamiento

### Estado Cuántico

Cada par entrelazado existe en un **estado de superposición** hasta que es observado (jugado):

```
|Ψ⟩ = α|Rey_Oros⟩ + β|Rey_Copas⟩

Donde:
- |Ψ⟩ es el estado cuántico del sistema
- α y β son las amplitudes de probabilidad
- El estado colapsa cuando se juega una carta
```

### Visualización en las Cartas

Las cartas entrelazadas se muestran con:
- **Borde especial** con efecto glow naranja (#ff9e6d)
- **Partículas flotantes** entre las cartas del mismo par
- **Notación cuántica** mostrando el par: `|0/1⟩` o `|1/0⟩`
- **Esfera de Bloch animada** girando para indicar superposición

### Ejemplo de Juego

**Situación**: Modo 8 Reyes, Equipo 1

```
Player 1 (Preskill) tiene:
┌─────────────┐
│ Rey Oros 🟡 │ ← ENTRELAZADA con Player 3
├─────────────┤
│ 3 Oros 🟡   │ ← ENTRELAZADA con Player 3
├─────────────┤
│ 7 Copas 🔴  │
├─────────────┤
│ As Espadas  │
└─────────────┘

Player 3 (Zoller) tiene:
┌─────────────┐
│ Rey Copas 🔴│ ← ENTRELAZADA con Player 1
├─────────────┤
│ 3 Copas 🔴  │ ← ENTRELAZADA con Player 1
├─────────────┤
│ 5 Bastos 🟢 │
├─────────────┤
│ Sota Oros   │
└─────────────┘
```

**Acción**: Player 1 juega el Rey de Oros

**Resultado Cuántico**:
1. La carta aparece con animación de partículas
2. Se muestra una línea de conexión cuántica hacia Player 3
3. La esfera de Bloch del Player 3 se ilumina
4. Ambos jugadores ganan ventaja táctica

## 🎯 Ventajas Estratégicas del Entrelazamiento

### En Modo 4 Reyes
- **Coordinación**: Los reyes son cartas poderosas, el entrelazamiento permite jugadas sincronizadas
- **Comunicación implícita**: Tu compañero sabe que tienes el rey entrelazado
- **Presión psicológica**: El equipo rival debe considerar ambos reyes

### En Modo 8 Reyes
- **Mayor complejidad**: 3 niveles de entrelazamiento por equipo
- **Estrategias múltiples**: Puedes coordinar con reyes, 3s o 2s
- **Combos poderosos**: Jugar 3s entrelazados + Puerta Hadamard = superposición avanzada
- **Información táctica**: Más señales entre compañeros

## 🔧 Implementación en el Backend

### Estructura de Datos

```javascript
const entangledPairs = [
  {
    id: 'pair_1',
    cards: ['rey_oros', 'rey_copas'],
    team: 1,
    players: ['player1_id', 'player3_id'],
    state: 'superposition' // 'superposition' | 'collapsed'
  },
  // ... más pares
];
```

### Detección de Entrelazamiento

```javascript
function checkEntanglement(card, gameMode) {
  const entanglementMap = {
    '4': ['rey_oros', 'rey_copas', 'rey_espadas', 'rey_bastos'],
    '8': [
      'rey_oros', 'rey_copas', 'rey_espadas', 'rey_bastos',
      '3_oros', '3_copas', '3_espadas', '3_bastos',
      '2_oros', '2_copas', '2_espadas', '2_bastos'
    ]
  };
  
  return entanglementMap[gameMode].includes(card.id);
}
```

### Sincronización en Tiempo Real

Cuando se juega una carta entrelazada:

```javascript
// Backend emite evento
socket.emit('entanglement-activated', {
  playerId: currentPlayer.id,
  partnerId: partner.id,
  card1: cardPlayed,
  card2: entangledCard,
  effect: 'quantum_sync',
  animation: 'particle_beam'
});

// Frontend escucha y anima
socket.on('entanglement-activated', (data) => {
  showEntanglementAnimation(data);
  updateQuantumState(data);
  notifyPartner(data.partnerId);
});
```

## 🎨 Efectos Visuales del Entrelazamiento

### En las Cartas
```css
.entangled-card {
  border: 3px solid #ff9e6d;
  box-shadow: 0 0 20px rgba(255, 158, 109, 0.6);
  animation: entangle-glow 2s ease-in-out infinite;
}

.entangle-particle {
  /* Partículas que flotan entre cartas del mismo par */
  animation: particle-float 4s ease-in-out infinite;
}
```

### Animación de Activación
```javascript
function showEntanglementBeam(from, to) {
  // Rayo cuántico que conecta las cartas
  const beam = createSVGBeam(from, to);
  beam.style.animation = 'quantum-pulse 0.8s';
  
  // Partículas que viajan por el rayo
  for (let i = 0; i < 20; i++) {
    const particle = createParticle();
    animateParticleAlongBeam(particle, beam, i * 50);
  }
}
```

## 📊 Estadísticas de Entrelazamiento

El sistema puede rastrear:
- **Pares jugados**: Cuántas veces se activa el entrelazamiento
- **Timing perfecto**: Jugadas sincronizadas en el mismo turno
- **Combo cuántico**: Entrelazamiento + Puerta Hadamard
- **Eficiencia del equipo**: Uso estratégico de cartas entrelazadas

## 🎓 Física Cuántica Real vs. Juego

### En la Física Real
- El entrelazamiento cuántico es no-local
- Las mediciones están correlacionadas instantáneamente
- No se puede usar para comunicación FTL (faster-than-light)

### En Quantum Mus
- Es una mecánica de juego inspirada en el concepto
- Representa la coordinación especial entre compañeros de equipo
- Añade profundidad estratégica y temática cuántica
- Es visual y comprensible para todos los jugadores

## 💡 Consejos Estratégicos

### Para el Modo 4 Reyes
1. **No gastes ambos reyes temprano** - El entrelazamiento pierde valor
2. **Usa reyes entrelazados en momentos clave** - Máximo impacto psicológico
3. **Comunica indirectamente** - Tu compañero debe saber cuándo esperar tu rey

### Para el Modo 8 Reyes
1. **Escalona tus cartas entrelazadas** - No uses todas a la vez
2. **Combina con puertas cuánticas** - 3 entrelazado + Hadamard = poderoso
3. **Lee el patrón del rival** - Predice qué cartas entrelazadas tienen
4. **Protege tus 2s entrelazados** - Son más versátiles que los reyes

---

¡El entrelazamiento es el corazón de Quantum Mus! Domínalo y dominarás el juego. ⚛️🎴
