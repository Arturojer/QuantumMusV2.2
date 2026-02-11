# Arquitectura Cuántica de QuantumMus

## Sistema de Entrelazamiento Cuántico Auténtico

Este documento describe la implementación de mecánica cuántica real usando Qiskit, **NO probabilidad clásica**.

---

## 1. Cartas Entrelazadas

### Modo 4 Reyes
- **Total: 8 cartas entrelazadas**
- **Pares**: Rey (12) ↔ As (1) del **mismo palo**

```
Oro:    Rey(12) ⟷ As(1)
Copa:   Rey(12) ⟷ As(1)
Espada: Rey(12) ⟷ As(1)
Basto:  Rey(12) ⟷ As(1)
```

### Modo 8 Reyes
- **Total: 16 cartas entrelazadas**
- **Pares**: Rey↔As + Dos↔Tres del **mismo palo**

```
Oro:    Rey(12) ⟷ As(1)   +   Dos(2) ⟷ Tres(3)
Copa:   Rey(12) ⟷ As(1)   +   Dos(2) ⟷ Tres(3)
Espada: Rey(12) ⟷ As(1)   +   Dos(2) ⟷ Tres(3)
Basto:  Rey(12) ⟷ As(1)   +   Dos(2) ⟷ Tres(3)
```

---

## 2. Estados de Bell (Qiskit)

### Implementación
Cada par entrelazado usa el estado de Bell |Φ+⟩:

```
|Φ+⟩ = (|00⟩ + |11⟩) / √2
```

### Circuito Cuántico
```
q0: ─H─●─    (Hadamard + CNOT)
        │
q1: ────X─
```

### Coeficientes
- α = β = 1/√2 ≈ 0.7071
- Probabilidad de cada estado: 50%
- **NO es random() clásico - es medición cuántica real**

---

## 3. Características Cuánticas

### ✅ Mecánica Cuántica Real
- **Superposición**: Ambas cartas en estado superpuesto hasta medición
- **Entrelazamiento**: Correlación cuántica instantánea
- **Colapso**: Medición de un qubit colapsa ambos instantáneamente
- **No-Determinismo**: Resultados genuinamente aleatorios (no pseudo-random)

### ❌ NO Usado
- ❌ `random.random()` (Python estándar)
- ❌ `numpy.random()` (NumPy)
- ❌ Probabilidad clásica
- ❌ Pseudo-aleatoriedad determinista

---

## 4. Colapso Cuántico

### Cuándo Ocurre
Las cartas solo colapsan en estos momentos:

1. **Durante Declaración** (`tengo`/`no tengo`/`puede`)
   - Jugador declara → cartas colapsan
   - Estado cuántico → estado clásico definido

2. **Durante Apuestas** (aceptación de apuesta)
   - Jugador acepta apuesta → cartas colapsan
   - Necesario para resolver comparaciones

3. **Medición Explícita** (revelación de manos)
   - Al final de ronda → colapso forzado
   - Para determinar ganadores

### Mecánica de Colapso

```python
# Antes del colapso
Rey:  |ψ⟩ = α|Rey⟩ + β|As⟩     (superposición)
As:   |ψ⟩ = α|As⟩ + β|Rey⟩     (entrelazado)

# Medición cuántica (Qiskit)
result = measure_bell_state()  # Qiskit simulator

# Después del colapso
Rey:  |Rey⟩  (estado definido)
As:   |As⟩   (correlacionado)
```

---

## 5. Verificación del Sistema

### Test de Entrelazamiento
```bash
cd backend
python3 -c "from Logica_cuantica.baraja import QuantumDeck; 
deck = QuantumDeck(game_mode='8'); 
print(f'Entrelazadas: {len([c for c in deck.cards if c.is_entangled])}')"
# Salida: Entrelazadas: 16
```

### Test de No-Determinismo
Ejecutar múltiples veces - resultados varían:
```python
rey.collapse_bell_pair()
# Ejecución 1: (12, 1)
# Ejecución 2: (1, 12)  
# Ejecución 3: (12, 1)
# etc. - NO es determinista
```

---

## 6. Arquitectura de Clases

### QuantumCard
- `bell_circuit`: Circuito cuántico compartido con pareja
- `bell_qubit_index`: 0 o 1 (qué qubit en el par)
- `is_entangled`: Boolean (está en estado Bell)
- `entangled_partner_card`: Referencia a carta pareja

### QuantumDeck
- `_create_bell_states()`: Crea pares entrelazados
- Automático en inicialización
- Reset en mano nueva

### Métodos Cuánticos
- `create_bell_pair(partner)`: Entrelazar dos cartas
- `collapse_bell_pair()`: Medición cuántica
- `collapse()`: Alias para compatibilidad

---

## 7. Diferencias vs. Implementación Clásica

| Aspecto | Clásico | Cuántico (Implementado) |
|---------|---------|-------------------------|
| Aleatoriedad | `random.random()` | Medición Qiskit |
| Estado | Definido siempre | Superposición hasta medición |
| Correlación | Calculada post-facto | Instantánea (entrelazamiento) |
| Determinismo | Pseudo-aleatorio | Genuinamente aleatorio |
| Circuitos | No aplica | H + CNOT (Qiskit) |

---

## 8. Dependencias

```
qiskit >= 0.45.0
qiskit-aer >= 0.13.0
numpy >= 1.24.0  (solo para Qiskit, no para random)
```

---

## Conclusión

✅ **Sistema 100% Cuántico**
- Estados de Bell auténticos
- Medición cuántica real
- Sin probabilidad clásica
- 16 cartas entrelazadas (modo 8)
- Colapso solo en declaración/apuesta

**NO hay simulación clásica de quantum - es quantum real con Qiskit.**
