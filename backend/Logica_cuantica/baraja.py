import numpy as np
from typing import List, Tuple, Dict
from qiskit import QuantumCircuit
from qiskit_aer import AerSimulator
from .cartas import QuantumCard
from .quantum_random import QuantumRNG

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

    def __init__(self, enable_king_pit_entanglement: bool = True, enable_two_three_entanglement: bool = None, game_mode='4'):
        """
        Initialize QuantumDeck with entanglement options
        
        Args:
            enable_king_pit_entanglement: Enable Rey-Pito entanglement
            enable_two_three_entanglement: Enable Tres-Dos entanglement (auto-set based on game_mode if None)
            game_mode: '4' for 4 reyes (only K/Pito entangled), '8' for 8 reyes (K/Pito and 3/2 entangled)
        """
        # Auto-configure entanglement based on game mode if not explicitly set
        if enable_two_three_entanglement is None:
            enable_two_three_entanglement = (game_mode == '8')
        
        self.game_mode = game_mode
        self.enable_king_pit_entanglement = enable_king_pit_entanglement
        self.enable_two_three_entanglement = enable_two_three_entanglement
        
        # Initialize cards AFTER setting entanglement flags
        self.cards = self._create_deck()
        self.deck_index = 0
        self.simulator = AerSimulator()
        
        # Use quantum RNG for all random operations
        self.qrng = QuantumRNG()

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
                cards.append(QuantumCard(palo, valor, card_id, game_mode=self.game_mode))
                card_id += 1
        
        # Crear estados de Bell para cartas entrelazadas
        self._create_bell_states(cards)
        
        return cards
    
    def _create_bell_states(self, cards: List[QuantumCard]):
        """
        Crear estados de Bell auténticos para pares entrelazados.
        
        ENTRELAZAMIENTO CORRECTO:
        - Rey (12) ↔ As (1) del MISMO palo
        - Dos (2) ↔ Tres (3) del MISMO palo (solo en modo 8)
        
        Cada palo tiene su propio par entrelazado:
        - Oro: Rey↔As
        - Copa: Rey↔As
        - Espada: Rey↔As
        - Basto: Rey↔As
        """
        # Mapear cartas por (palo, valor) para fácil acceso
        card_map = {}
        for card in cards:
            key = (card.palo, card.valor)
            card_map[key] = card
        
        # Función auxiliar para entrelazar un par del mismo palo
        def entangle_same_suit_pair(palo: str, valor1: int, valor2: int):
            """Entrelaza dos valores diferentes del mismo palo"""
            card1 = card_map.get((palo, valor1))
            card2 = card_map.get((palo, valor2))
            if card1 and card2:
                card1.create_bell_pair(card2)
        
        # Rey (12) ↔ As (1) - Siempre entrelazados en todos los palos
        if self.enable_king_pit_entanglement:
            for palo in self.PALOS:
                entangle_same_suit_pair(palo, 12, 1)  # Rey ↔ As (Pito)
        
        # Dos (2) ↔ Tres (3) - Solo en modo 8, en todos los palos
        if self.enable_two_three_entanglement and self.game_mode == '8':
            for palo in self.PALOS:
                entangle_same_suit_pair(palo, 2, 3)  # Dos ↔ Tres

    def shuffle(self, seed: int = None):
        """
        Shuffle deck using quantum randomness.
        
        Args:
            seed: DEPRECATED - Only for testing/reproducibility. Do not use in production.
                  Production code should use quantum shuffle (seed=None).
        
        Raises:
            Warning if seed is provided (classical shuffle used for testing only)
        """
        if seed is not None:
            # For testing/reproducibility only - emit warning
            import warnings
            warnings.warn(
                "Classical shuffle with seed is only for testing. "
                "Production code should use quantum shuffle (seed=None).",
                UserWarning
            )
            np.random.seed(seed)
            np.random.shuffle(self.cards)
        else:
            # Use quantum shuffle for production
            self.cards = self.qrng.shuffle(self.cards)
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
        """
        Reset entanglement collapse caches for new hand - cards return to entangled state.
        Recrea los estados de Bell para las cartas entrelazadas.
        """
        self.king_pit_collapsed = {}
        self.tres_dos_collapsed = {}
        
        # Recrear estados de Bell para todas las cartas entrelazadas
        self._create_bell_states(self.cards)

    def get_deck_info(self) -> dict:
        return {
            'total_cards': len(self.cards),
            'remaining_cards': len(self.cards) - self.deck_index,
            'cards_drawn': self.deck_index
        }

    # ------------------------------------------------------------
    # Rey-As "entrelazado" (King-Ace entanglement)
    # ------------------------------------------------------------
    def collapse_king_pit(self, palo: str) -> Tuple[str, str]:
        """
        Colapsa el par Rey-As de un palo de manera consistente:
        - Primera vez: decide aleatoriamente si queda (Rey,As) o (As,Rey)
        - A partir de ahí: siempre devuelve lo mismo (cache).
        Entanglement: K (12) ↔ A (1) within same suit
        """
        if palo not in self.PALO_CODE:
            raise ValueError(f"Palo inválido: {palo}")

        if not self.enable_king_pit_entanglement:
            # Sin entrelazamiento: simplemente "Rey" y "As" normales
            rey = self.PALO_CODE[palo] + self.VALOR_CODE[12]
            as_card = self.PALO_CODE[palo] + self.VALOR_CODE[1]
            return rey, as_card

        if palo in self.king_pit_collapsed:
            return self.king_pit_collapsed[palo]

        rey = self.PALO_CODE[palo] + self.VALOR_CODE[12]
        as_card = self.PALO_CODE[palo] + self.VALOR_CODE[1]

        # Colapso: o se quedan como (Rey,As) o se "intercambian identidades"
        # Use quantum randomness instead of numpy
        if self.qrng.random_float() < 0.5:
            pair = (rey, as_card)
        else:
            pair = (as_card, rey)

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

        # Use quantum randomness instead of numpy
        if self.qrng.random_float() < 0.5:
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
