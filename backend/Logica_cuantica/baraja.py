import numpy as np
from typing import List, Tuple, Dict
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

    def __init__(self, enable_king_pit_entanglement: bool = True, enable_two_three_entanglement: bool = True):
        self.cards = self._create_deck()
        self.deck_index = 0
        self.simulator = AerSimulator()

        self.enable_king_pit_entanglement = enable_king_pit_entanglement
        self.enable_two_three_entanglement = enable_two_three_entanglement

        # Cache del colapso Rey-Pito: palo -> (estado_rey, estado_pito)
        # Estados en 6 bits (q0..q5): [palo(2)][valor(4)]
        self.king_pit_collapsed: Dict[str, Tuple[str, str]] = {}

        # Cache del colapso Dos-Tres: palo -> (estado_2, estado_3)
        # Estados en 6 bits (q0..q5): [palo(2)][valor(4)]
        self.two_three_collapsed: Dict[str, Tuple[str, str]] = {}

    def _create_deck(self) -> List[QuantumCard]:
        cards: List[QuantumCard] = []
        card_id = 0
        for palo in self.PALOS:
            for valor in self.VALORES:
                cards.append(QuantumCard(palo, valor, card_id))
                card_id += 1
        return cards

    def shuffle(self, seed: int = None):
        if seed is not None:
            np.random.seed(seed)
        np.random.shuffle(self.cards)
        self.deck_index = 0

    def draw(self, num_cards: int = 1) -> List[QuantumCard]:
        if self.deck_index + num_cards > len(self.cards):
            raise ValueError("No hay suficientes cartas en la baraja")

        drawn = self.cards[self.deck_index:self.deck_index + num_cards]
        self.deck_index += num_cards
        return drawn

    def reset(self):
        self.deck_index = 0

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
    # Dos-Tres "entrelazado" (simple + consistente)
    # ------------------------------------------------------------
    def collapse_two_three(self, palo: str) -> Tuple[str, str]:
        """
        Colapsa el par Dos-Tres de un palo de manera consistente:
        - Primera vez: decide aleatoriamente si queda (2,3) o (3,2)
        - A partir de ahí: siempre devuelve lo mismo (cache).
        """
        if palo not in self.PALO_CODE:
            raise ValueError(f"Palo inválido: {palo}")

        if not self.enable_two_three_entanglement:
            dos = self.PALO_CODE[palo] + self.VALOR_CODE[2]
            tres = self.PALO_CODE[palo] + self.VALOR_CODE[3]
            return dos, tres

        if palo in self.two_three_collapsed:
            return self.two_three_collapsed[palo]

        dos = self.PALO_CODE[palo] + self.VALOR_CODE[2]
        tres = self.PALO_CODE[palo] + self.VALOR_CODE[3]

        if np.random.rand() < 0.5:
            pair = (dos, tres)
        else:
            pair = (tres, dos)

        self.two_three_collapsed[palo] = pair
        return pair

    # Compatibilidad con vuestro nombre anterior
    def measure_king_pit(self, palo: str) -> Tuple[str, str]:
        return self.collapse_king_pit(palo)

    def __repr__(self) -> str:
        return f"QuantumDeck(remaining={self.get_deck_info()['remaining_cards']}/40)"
