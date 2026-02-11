import numpy as np
from qiskit import QuantumCircuit, QuantumRegister, ClassicalRegister
from qiskit_aer import AerSimulator
from typing import Optional, Tuple

class QuantumCard:
    """
    Representa una carta cuántica usando Qiskit.
    6 qubits: 2 para palo, 4 para valor.

    Nota importante:
    - Qiskit devuelve los bitstrings en orden clásico "reverso" respecto a q[0], q[1], ...
      Por eso invertimos el bitstring al medir para que:
        measured_state[0] corresponda a qr[0], etc.
    """

    PALOS = {
        '00': 'Oro',
        '01': 'Copa',
        '10': 'Espada',
        '11': 'Basto'
    }

    VALORES = {
        '0001': 1,
        '0010': 2,
        '0011': 3,
        '0100': 4,
        '0101': 5,
        '0110': 6,
        '0111': 7,
        '1000': 10,
        '1001': 11,
        '1010': 12
    }

    PALO_CODE = {
        'Oro': '00',
        'Copa': '01',
        'Espada': '10',
        'Basto': '11'
    }

    VALOR_CODE = {
        1: '0001', 2: '0010', 3: '0011', 4: '0100',
        5: '0101', 6: '0110', 7: '0111', 10: '1000',
        11: '1001', 12: '1010'
    }

    def __init__(self, palo: str, valor: int, card_id: int = 0, game_mode: str = '4'):
        self.palo = palo
        self.valor = valor
        self.card_id = card_id
        self.game_mode = game_mode
        self.simulator = AerSimulator()
        self.measured_state: str | None = None  # 6 bits (q0..q5)
        
        # Quantum properties for compatibility with entanglement system
        self.is_entangled = False
        self.entangled_partner_value = None
        self.entangled_partner_suit = None
        self.entangled_partner_card: Optional['QuantumCard'] = None  # Reference to partner
        self.is_superposed = False
        self.superposed_value = None
        self.coefficient_a = 0
        self.coefficient_b = 0
        
        # Collapse state tracking
        self.is_collapsed = False
        self.collapsed_value = None
        self.collapse_reason = None
        
        # Bell State for entanglement (shared quantum circuit)
        self.bell_circuit: Optional[QuantumCircuit] = None
        self.bell_qubit_index: Optional[int] = None  # 0 or 1 (which qubit in Bell pair)
        
        # Compatibility attributes for game logic
        self.value = valor  # Alias for English compatibility
        self.suit = palo    # Alias for English compatibility

    def _create_circuit(self) -> QuantumCircuit:
        """Crea un circuito cuántico para la carta en estado base."""
        qr = QuantumRegister(6, f'card_{self.card_id}')
        cr = ClassicalRegister(6, f'c_{self.card_id}')
        circuit = QuantumCircuit(qr, cr)

        palo_bits = self.PALO_CODE[self.palo]
        valor_bits = self.VALOR_CODE[self.valor]

        # q0-q1: palo
        for i, bit in enumerate(palo_bits):
            if bit == '1':
                circuit.x(qr[i])

        # q2-q5: valor
        for i, bit in enumerate(valor_bits):
            if bit == '1':
                circuit.x(qr[i + 2])

        return circuit

    def measure(self) -> str:
        """
        Mide la carta y colapsa el estado (una vez).
        Devuelve un string de 6 bits en el orden q0..q5.
        """
        if self.measured_state is not None:
            return self.measured_state

        circuit = self._create_circuit()
        qr = circuit.qregs[0]
        cr = circuit.cregs[0]

        circuit.measure(qr, cr)

        job = self.simulator.run(circuit, shots=1)
        result = job.result()
        counts = result.get_counts(circuit)

        measured_state = list(counts.keys())[0]

        # CLAVE: invertir para que [0] sea q0, etc.
        measured_state = measured_state[::-1]

        self.measured_state = measured_state
        return measured_state

    # Alias por si queréis llamarlo explícitamente "collapse"
    def collapse(self, deterministic_value=None, collapse_seed=None) -> str:
        """
        Collapse the card to a definite value.
        
        Si la carta está en un estado de Bell, colapsa usando correlación cuántica.
        Si no, colapsa el estado cuántico individual de la carta.
        """
        if self.is_collapsed:
            return str(self.collapsed_value)
        
        # Si está en estado de Bell, usar colapso cuántico entrelazado
        if self.is_entangled and self.bell_circuit:
            result_tuple = self.collapse_bell_pair()
            return str(self.collapsed_value)
        
        # Si tiene un valor determinístico forzado
        if deterministic_value:
            self.collapsed_value = deterministic_value
            self.is_collapsed = True
            return str(deterministic_value)
        
        # Colapso cuántico normal (sin entrelazamiento)
        result = self.measure()
        self.is_collapsed = True
        self.collapsed_value = self.get_valor()
        self.collapse_reason = 'observation'
        return result

    def set_collapsed_state(self, state_6bits_q0_to_q5: str) -> None:
        """Fuerza un colapso externo (para entrelazados / pares)."""
        if len(state_6bits_q0_to_q5) != 6 or any(b not in "01" for b in state_6bits_q0_to_q5):
            raise ValueError("El estado debe ser un string de 6 bits (q0..q5).")
        self.measured_state = state_6bits_q0_to_q5
        self.is_collapsed = True
        self.collapsed_value = self.get_valor()
    
    def create_bell_pair(self, partner_card: 'QuantumCard') -> None:
        """
        Crear un estado de Bell (entrelazamiento cuántico auténtico) con otra carta.
        Usa el estado |Φ+⟩ = (|00⟩ + |11⟩)/√2
        
        Cuando una carta colapsa, su pareja también colapsa instantáneamente (correlación cuántica).
        """
        if self.is_entangled or partner_card.is_entangled:
            raise ValueError("Una o ambas cartas ya están entrelazadas")
        
        # Crear circuito cuántico con 2 qubits para el par de Bell
        qr = QuantumRegister(2, f'bell_{self.card_id}_{partner_card.card_id}')
        cr = ClassicalRegister(2, f'c_bell_{self.card_id}_{partner_card.card_id}')
        bell_circuit = QuantumCircuit(qr, cr)
        
        # Crear estado de Bell |Φ+⟩: Hadamard en q0, luego CNOT(q0, q1)
        bell_circuit.h(qr[0])
        bell_circuit.cx(qr[0], qr[1])
        
        # Ambas cartas comparten el mismo circuito de Bell
        self.bell_circuit = bell_circuit
        self.bell_qubit_index = 0
        partner_card.bell_circuit = bell_circuit
        partner_card.bell_qubit_index = 1
        
        # Marcar ambas cartas como entrelazadas
        self.is_entangled = True
        self.entangled_partner_card = partner_card
        self.entangled_partner_value = partner_card.valor
        self.entangled_partner_suit = partner_card.palo
        self.coefficient_a = 0.7071  # 1/√2
        self.coefficient_b = 0.7071  # 1/√2
        
        partner_card.is_entangled = True
        partner_card.entangled_partner_card = self
        partner_card.entangled_partner_value = self.valor
        partner_card.entangled_partner_suit = self.palo
        partner_card.coefficient_a = 0.7071
        partner_card.coefficient_b = 0.7071
    
    def collapse_bell_pair(self) -> Tuple[int, int]:
        """
        Colapsar el estado de Bell (medición cuántica).
        Cuando se mide un qubit, el otro colapsa instantáneamente al estado correlacionado.
        
        Returns:
            Tupla (resultado_esta_carta, resultado_pareja)
        """
        if not self.is_entangled or not self.bell_circuit:
            raise ValueError("Esta carta no está en un estado de Bell")
        
        if self.is_collapsed:
            # Ya colapsó, devolver resultado previo
            partner_collapsed = self.entangled_partner_card.collapsed_value if self.entangled_partner_card else None
            return (self.collapsed_value, partner_collapsed)
        
        # Medir el estado de Bell
        qr = self.bell_circuit.qregs[0]
        cr = self.bell_circuit.cregs[0]
        self.bell_circuit.measure(qr, cr)
        
        # Ejecutar la medición
        job = self.simulator.run(self.bell_circuit, shots=1)
        result = job.result()
        counts = result.get_counts(self.bell_circuit)
        measured_state = list(counts.keys())[0]
        
        # measured_state es "q1q0" en orden Qiskit (reverso)
        # Invertir para obtener [q0, q1]
        measured_state = measured_state[::-1]
        
        bit_0 = int(measured_state[0])  # Resultado de q0
        bit_1 = int(measured_state[1])  # Resultado de q1
        
        # En estado de Bell |Φ+⟩, ambos qubits colapsan al mismo valor
        # bit_0 = bit_1 debido a la correlación cuántica
        
        # Esta carta usa su qubit correspondiente
        my_result = bit_0 if self.bell_qubit_index == 0 else bit_1
        partner_result = bit_1 if self.bell_qubit_index == 0 else bit_0
        
        # Mapear resultado cuántico (0 o 1) a valores de carta
        # Si resultado = 0: mantener valor original
        # Si resultado = 1: intercambiar con valor del compañero
        if my_result == 0:
            self.collapsed_value = self.valor
        else:
            self.collapsed_value = self.entangled_partner_value
        
        if partner_result == 0:
            partner_collapsed_val = self.entangled_partner_card.valor
        else:
            partner_collapsed_val = self.valor
        
        # Marcar ambas como colapsadas
        self.is_collapsed = True
        self.collapse_reason = 'bell_pair_measurement'
        
        if self.entangled_partner_card:
            self.entangled_partner_card.is_collapsed = True
            self.entangled_partner_card.collapsed_value = partner_collapsed_val
            self.entangled_partner_card.collapse_reason = 'bell_pair_correlation'
        
        return (self.collapsed_value, partner_collapsed_val)

    def get_palo_qubits(self) -> str:
        if self.measured_state is None:
            self.measure()
        return self.measured_state[:2]

    def get_valor_qubits(self) -> str:
        if self.measured_state is None:
            self.measure()
        return self.measured_state[2:]

    def get_palo(self) -> str:
        palo_bits = self.get_palo_qubits()
        return self.PALOS.get(palo_bits, "Desconocido")

    def get_valor(self) -> int:
        valor_bits = self.get_valor_qubits()
        return self.VALORES.get(valor_bits, -1)

    def __repr__(self) -> str:
        if self.measured_state:
            return f"{self.get_valor()} de {self.get_palo()}"
        return f"Carta(id={self.card_id})"

    def to_dict(self) -> dict:
        return {
            'palo': self.palo,
            'valor': self.valor,
            'value': self.valor,  # English compatibility
            'suit': self.palo,     # English compatibility  
            'card_id': self.card_id,
            'measured_state': self.measured_state,
            'repr': str(self),
            'is_entangled': self.is_entangled,
            'entangled_partner_value': self.entangled_partner_value,
            'entangled_partner_suit': self.entangled_partner_suit,
            'is_superposed': self.is_superposed,
            'superposed_value': self.superposed_value,
            'coefficient_a': self.coefficient_a,
            'coefficient_b': self.coefficient_b,
            'is_collapsed': self.is_collapsed,
            'collapsed_value': self.collapsed_value,
            'collapse_reason': self.collapse_reason
        }
