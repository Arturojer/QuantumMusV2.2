import numpy as np
from typing import List, Tuple, Dict
from qiskit import QuantumCircuit
from qiskit_aer import AerSimulator
from .cartas import QuantumCard

class QuantumDeck:
    """
    Baraja cuántica de 40 cartas.
    Para esta versión "simple", el colapso siempre ocurre cuando se pide,
    y el entrelazamiento Rey-Pito se simula de forma CONSISTENTE:
    - se colapsa 1 vez por palo y queda cacheado.
    """

    PALOS = ['Oro', 'Copa', 'Espada', 'Basto']
    VALORES = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12]

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

    def __init__(self, game_mode='4', enable_king_pit_entanglement: bool = True, enable_two_three_entanglement: bool = None):
        """
        Initialize QuantumDeck with entanglement options
        
        Args:
            game_mode: '4' for 4 reyes (only K/Pito entangled), '8' for 8 reyes (K/Pito and 3/2 entangled)
            enable_king_pit_entanglement: Enable Rey-Pito entanglement
            enable_two_three_entanglement: Enable Tres-Dos entanglement (auto-set based on game_mode if None)
        """
        # Auto-configure entanglement based on game mode if not explicitly set
        if enable_two_three_entanglement is None:
            enable_two_three_entanglement = (game_mode == '8')
        
        self.game_mode = game_mode
        self.cards = self._create_deck()
        self.deck_index = 0
        self.simulator = AerSimulator()

        self.enable_king_pit_entanglement = enable_king_pit_entanglement
        self.enable_two_three_entanglement = enable_two_three_entanglement

        # Cache del colapso Rey-Pito: palo -> (estado_rey, estado_pito)
        # Estados en 6 bits (q0..q5): [palo(2)][valor(4)]
        self.king_pit_collapsed: Dict[str, Tuple[str, str]] = {}

        # Cache del colapso Tres-Dos: palo -> (estado_3, estado_2)
        # Estados en 6 bits (q0..q5): [palo(2)][valor(4)]
        self.tres_dos_collapsed: Dict[str, Tuple[str, str]] = {}

    def _create_deck(self) -> List[QuantumCard]:
        cards: List[QuantumCard] = []
        card_id = 0
        for palo in self.PALOS:
            for valor in self.VALORES:
                cards.append(QuantumCard(palo, valor, card_id))
                card_id += 1
        return cards

    def _generate_quantum_random_bits(self, num_bits: int) -> List[int]:
        """Generate random bits using quantum measurement"""
        qc = QuantumCircuit(num_bits, num_bits)
        # Apply Hadamard to all qubits to create superposition
        for i in range(num_bits):
            qc.h(i)
        # Measure all qubits
        qc.measure(range(num_bits), range(num_bits))
        
        # Execute circuit
        job = self.simulator.run(qc, shots=1)
        result = job.result()
        counts = result.get_counts()
        
        # Get the measurement result (binary string)
        bitstring = list(counts.keys())[0]
        # Convert to list of ints (reverse to match qubit order)
        return [int(b) for b in reversed(bitstring)]
    
    def _quantum_fisher_yates_shuffle(self, items: List) -> List:
        """Shuffle using quantum random numbers with Fisher-Yates algorithm"""
        n = len(items)
        shuffled = items.copy()
        
        for i in range(n - 1, 0, -1):
            # Calculate number of bits needed to represent i
            bits_needed = i.bit_length()
            
            # Generate quantum random number in range [0, i]
            while True:
                random_bits = self._generate_quantum_random_bits(bits_needed)
                # Convert bits to integer
                j = sum(bit * (2 ** idx) for idx, bit in enumerate(random_bits))
                if j <= i:
                    break
            
            # Swap elements
            shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
        
        return shuffled

    def shuffle(self, seed: int = None):
        """Shuffle deck using quantum randomness"""
        if seed is not None:
            # For testing/reproducibility, use classical numpy
            np.random.seed(seed)
            np.random.shuffle(self.cards)
        else:
            # Use quantum shuffle
            self.cards = self._quantum_fisher_yates_shuffle(self.cards)
        self.deck_index = 0

    def draw(self, num_cards: int = 1) -> List[QuantumCard]:
        if self.deck_index + num_cards > len(self.cards):
            raise ValueError("No hay suficientes cartas en la baraja")

        drawn = self.cards[self.deck_index:self.deck_index + num_cards]
        self.deck_index += num_cards
        return drawn

    def reset(self):
        """Reset deck index"""
        self.deck_index = 0
    
    def reset_entanglement_states(self):
        """Reset entanglement collapse caches for new hand - cards return to entangled state"""
        self.king_pit_collapsed = {}
        self.tres_dos_collapsed = {}

    def get_deck_info(self) -> dict:
        return {
            'total_cards': len(self.cards),
            'remaining_cards': len(self.cards) - self.deck_index,
            'cards_drawn': self.deck_index
        }

    # ------------------------------------------------------------
    # Rey-Pito "entrelazado" (simple + consistente)
    # ------------------------------------------------------------
    def collapse_king_pit(self, palo: str) -> Tuple[str, str]:
        """
        Colapsa el par Rey-Pito de un palo de manera consistente:
        - Primera vez: decide aleatoriamente si queda (Rey,Pito) o (Pito,Rey)
        - A partir de ahí: siempre devuelve lo mismo (cache).
        """
        if palo not in self.PALO_CODE:
            raise ValueError(f"Palo inválido: {palo}")

        if not self.enable_king_pit_entanglement:
            # Sin entrelazamiento: simplemente "Rey" y "Pito" normales
            rey = self.PALO_CODE[palo] + self.VALOR_CODE[12]
            pito = self.PALO_CODE[palo] + self.VALOR_CODE[10]
            return rey, pito

        if palo in self.king_pit_collapsed:
            return self.king_pit_collapsed[palo]

        rey = self.PALO_CODE[palo] + self.VALOR_CODE[12]
        pito = self.PALO_CODE[palo] + self.VALOR_CODE[10]

        # Colapso: o se quedan como (Rey,Pito) o se "intercambian identidades"
        if np.random.rand() < 0.5:
            pair = (rey, pito)
        else:
            pair = (pito, rey)

        self.king_pit_collapsed[palo] = pair
        return pair

    # ------------------------------------------------------------
    # Tres-Dos "entrelazado" (simple + consistente)
    # ------------------------------------------------------------
    def collapse_tres_dos(self, palo: str) -> Tuple[str, str]:
        """
        Colapsa el par Tres-Dos de un palo de manera consistente:
        - Primera vez: decide aleatoriamente si queda (3,2) o (2,3)
        - A partir de ahí: siempre devuelve lo mismo (cache).
        """
        if palo not in self.PALO_CODE:
            raise ValueError(f"Palo inválido: {palo}")

        if not self.enable_two_three_entanglement:
            tres = self.PALO_CODE[palo] + self.VALOR_CODE[3]
            dos = self.PALO_CODE[palo] + self.VALOR_CODE[2]
            return tres, dos

        if palo in self.tres_dos_collapsed:
            return self.tres_dos_collapsed[palo]

        tres = self.PALO_CODE[palo] + self.VALOR_CODE[3]
        dos = self.PALO_CODE[palo] + self.VALOR_CODE[2]

        if np.random.rand() < 0.5:
            pair = (tres, dos)
        else:
            pair = (dos, tres)

        self.tres_dos_collapsed[palo] = pair
        return pair

    # Compatibilidad con vuestro nombre anterior
    def collapse_two_three(self, palo: str) -> Tuple[str, str]:
        return self.collapse_tres_dos(palo)

    # Compatibilidad con vuestro nombre anterior
    def measure_king_pit(self, palo: str) -> Tuple[str, str]:
        return self.collapse_king_pit(palo)

    def __repr__(self) -> str:
        return f"QuantumDeck(remaining={self.get_deck_info()['remaining_cards']}/40)"
