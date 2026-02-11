from typing import List
from .cartas import QuantumCard

class QuantumPlayer:
    """
    Representa un jugador en el Mus cuántico.
    """

    def __init__(self, player_id: int, name: str):
        self.player_id = player_id
        self.name = name
        self.hand: List[QuantumCard] = []
        self.discarded: List[QuantumCard] = []
        self.has_called_mus = False
        self.points = 0

    def receive_card(self, card: QuantumCard):
        self.hand.append(card)

    def receive_cards(self, cards: List[QuantumCard]):
        self.hand.extend(cards)

    def discard_card(self, card: QuantumCard) -> QuantumCard:
        if card not in self.hand:
            raise ValueError(f"La carta {card} no está en la mano")
        self.hand.remove(card)
        self.discarded.append(card)
        return card

    def discard_cards(self, cards: List[QuantumCard]) -> List[QuantumCard]:
        discarded = []
        for card in cards:
            discarded.append(self.discard_card(card))
        return discarded

    def call_mus(self):
        self.has_called_mus = True

    def measure_hand(self) -> List[str]:
        """
        Mide (colapsa) todas las cartas de la mano.
        Ojo: el Dealer puede preferir colapsar con reglas especiales
        (Rey-Pito / pares) antes de esto.
        """
        measured_states = []
        for card in self.hand:
            state = card.measure()
            measured_states.append(state)
        return measured_states

    def clear_hand(self):
        self.hand.clear()
        self.discarded.clear()
        self.has_called_mus = False

    def get_hand_info(self) -> List[str]:
        return [str(card) for card in self.hand]

    def get_discarded_info(self) -> List[str]:
        return [str(card) for card in self.discarded]

    def __repr__(self) -> str:
        return f"QuantumPlayer({self.name}, hand={len(self.hand)}, discarded={len(self.discarded)})"
