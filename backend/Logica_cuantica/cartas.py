import numpy as np
from qiskit import QuantumCircuit, QuantumRegister, ClassicalRegister
from qiskit_aer import AerSimulator

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

    def __init__(self, palo: str, valor: int, card_id: int = 0):
        self.palo = palo
        self.valor = valor
        self.card_id = card_id
        self.simulator = AerSimulator()
        self.measured_state: str | None = None  # 6 bits (q0..q5)
        
        # Quantum properties for compatibility with game_logic.py
        self.is_entangled = False
        self.entangled_partner_value = None
        self.entangled_partner_suit = None
        self.is_collapsed = False
        self.collapsed_value = None

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
    def collapse(self) -> str:
        return self.measure()

    def set_collapsed_state(self, state_6bits_q0_to_q5: str) -> None:
        """Fuerza un colapso externo (para entrelazados / pares)."""
        if len(state_6bits_q0_to_q5) != 6 or any(b not in "01" for b in state_6bits_q0_to_q5):
            raise ValueError("El estado debe ser un string de 6 bits (q0..q5).")
        self.measured_state = state_6bits_q0_to_q5

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
            'is_entangled': self.is_entangled,
            'entangled_partner_value': self.entangled_partner_value,
            'entangled_partner_suit': self.entangled_partner_suit,
            'is_collapsed': self.is_collapsed,
            'collapsed_value': self.collapsed_value,
            'repr': str(self)
        }
