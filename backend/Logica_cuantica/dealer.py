# src/quantum/dealer_qiskit.py

import numpy as np
from typing import List, Tuple, Dict, FrozenSet

from .efecto_tunel import TunnelEffect
from .baraja import QuantumDeck
from .cartas import QuantumCard
from .jugador import QuantumPlayer


class QuantumDealer:
    """
    Gestiona la distribución de cartas y el flujo del juego.
    Versión "simple": cuando procede, siempre colapsa.
    Incluye "efecto túnel" para decidir el dealer de la siguiente ronda.
    """

    def __init__(self, num_players: int = 4, p_tunnel_classic: float = 0.99, tunnel_seed: int | None = None):
        self.deck = QuantumDeck(enable_king_pit_entanglement=True)
        self.discard_pile: List[QuantumCard] = []
        self.players: List[QuantumPlayer] = []
        self.current_dealer_idx = 0
        self.round_number = 0
        self.measured_states: Dict[int, str] = {}  # card_id -> measured_state

        # Probabilidad de seguir sentido clásico al cambiar de mano
        self.p_tunnel_classic = p_tunnel_classic
        self._tunnel_rng = np.random.default_rng(tunnel_seed)

        # Pares: key=frozenset({idA,idB}) -> colapsado (bool)
        self.pair_links: Dict[FrozenSet[int], bool] = {}

        for i in range(num_players):
            self.players.append(QuantumPlayer(i, f"Jugador {i + 1}"))

    # -------------------------
    # Registro simple de pares
    # -------------------------
    def register_pair_link(self, card_a: QuantumCard, card_b: QuantumCard) -> None:
        if card_a.card_id == card_b.card_id:
            raise ValueError("No puedes enlazar una carta consigo misma.")
        key = frozenset({card_a.card_id, card_b.card_id})
        self.pair_links[key] = False

    def _collapse_pair_link_if_needed(self, hand_cards: List[QuantumCard], key: FrozenSet[int]) -> None:
        if self.pair_links.get(key, True):
            return

        ids = list(key)
        id_a, id_b = ids[0], ids[1]

        card_a = next((c for c in hand_cards if c.card_id == id_a), None)
        card_b = next((c for c in hand_cards if c.card_id == id_b), None)

        if card_a is None or card_b is None:
            return

        valores = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12]
        v = int(np.random.choice(valores))

        palo_code = QuantumDeck.PALO_CODE
        valor_code = QuantumDeck.VALOR_CODE

        a_bits = palo_code[card_a.palo] + valor_code[v]
        b_bits = palo_code[card_b.palo] + valor_code[v]

        card_a.set_collapsed_state(a_bits)
        card_b.set_collapsed_state(b_bits)

        self.measured_states[card_a.card_id] = a_bits
        self.measured_states[card_b.card_id] = b_bits

        self.pair_links[key] = True

    # ----------------------------------------
    # Colapso centralizado
    # ----------------------------------------
    def collapse_player_hand(self, player: QuantumPlayer) -> None:
        hand = player.hand

        # 1) Pares registrados
        for key in list(self.pair_links.keys()):
            self._collapse_pair_link_if_needed(hand, key)

        # 2) Rey-Pito si aparecen en la mano
        for card in hand:
            if card.measured_state is not None:
                continue

            if card.valor in (10, 12):  # Pito=10, Rey=12
                king_state, pit_state = self.deck.collapse_king_pit(card.palo)

                def valor_from_state(state6: str) -> int:
                    return QuantumCard.VALORES.get(state6[2:], -1)

                ks_val = valor_from_state(king_state)
                ps_val = valor_from_state(pit_state)

                if card.valor == 12:
                    chosen = king_state if ks_val == 12 else pit_state
                else:
                    chosen = king_state if ks_val == 10 else pit_state

                card.set_collapsed_state(chosen)
                self.measured_states[card.card_id] = chosen

        # 3) Resto: colapso normal
        for card in hand:
            if card.measured_state is None:
                state = card.measure()
                self.measured_states[card.card_id] = state

    # -------------------------
    # Ronda / reparto
    # -------------------------
    def reset_round(self):
        # mover descartes a pila
        for player in self.players:
            self.discard_pile.extend(player.discarded)
            player.discarded.clear()

        deck_info = self.deck.get_deck_info()
        if deck_info['remaining_cards'] < 4 * len(self.players):
            self._reshuffle_discard_pile()

        for player in self.players:
            player.clear_hand()

        # ✅ EFECTO TÚNEL: decidir siguiente mano/dealer
        tunnel = TunnelEffect(p_classic=self.p_tunnel_classic)
        self.current_dealer_idx = tunnel.next_dealer_idx(
            self.current_dealer_idx,
            len(self.players)
        )

        self.round_number += 1

    def _reshuffle_discard_pile(self):
        if len(self.discard_pile) == 0:
            raise ValueError("No hay cartas en la pila de descarte para barajar")

        print(f"🔄 Barajando pila de descarte ({len(self.discard_pile)} cartas)...")

        self.deck.cards.extend(self.discard_pile)
        self.discard_pile.clear()
        self.deck.shuffle()
        self.deck.deck_index = 0

    def deal_cards(self, cards_per_player: int = 4) -> bool:
        """
        Repartee quantum cards to all players, using discard pile if deck runs out.
        Ensures no card is dealt twice in a round.
        """
        try:
            for _ in range(cards_per_player):
                for player in self.players:
                    deck_info = self.deck.get_deck_info()
                    # If not enough cards, reshuffle discards and continue
                    if deck_info['remaining_cards'] == 0:
                        if len(self.discard_pile) == 0:
                            print("❌ No hay más cartas disponibles")
                            return False
                        self._reshuffle_discard_pile()
                        deck_info = self.deck.get_deck_info()
                        if deck_info['remaining_cards'] == 0:
                            print("❌ No hay cartas tras barajar descartes")
                            return False
                    card = self.deck.draw(1)[0]
                    player.receive_card(card)
            return True
        except ValueError as e:
            print(f"Error al repartir: {e}")
            return False

    # -------------------------
    # Medición/colapso de mano
    # -------------------------
    def measure_player_hand(self, player: QuantumPlayer) -> List[Tuple[str, int, int]]:
        self.collapse_player_hand(player)

        measured_hand: List[Tuple[str, int, int]] = []
        for card in player.hand:
            palo = card.get_palo()
            valor = card.get_valor()
            measured_hand.append((palo, valor, card.card_id))
        return measured_hand

    def check_mus_quantum(self, player: QuantumPlayer) -> Tuple[bool, str]:
        if len(player.hand) < 2:
            return False, "Necesitas al menos 2 cartas para hacer mus"

        measured_hand = self.measure_player_hand(player)
        palos = [palo for palo, valor, _ in measured_hand]

        cards_str = ", ".join([f"{valor} de {palo}" for palo, valor, _ in measured_hand])
        if len(set(palos)) == len(palos):
            return True, f"✅ MUS CONFIRMADO: {cards_str}"
        return False, f"❌ No es mus: {cards_str}"

    def collect_discards(self) -> List[QuantumCard]:
        all_discards = []
        for player in self.players:
            all_discards.extend(player.discarded)
            self.discard_pile.extend(player.discarded)
            player.discarded.clear()
        return all_discards

    def get_game_status(self) -> dict:
        return {
            'round': self.round_number,
            'current_dealer': self.players[self.current_dealer_idx].name,
            'deck_remaining': self.deck.get_deck_info()['remaining_cards'],
            'discard_pile': len(self.discard_pile),
            'players': [
                {
                    'name': player.name,
                    'hand_size': len(player.hand),
                    'hand': player.get_hand_info(),
                    'has_called_mus': player.has_called_mus
                }
                for player in self.players
            ]
        }

    def __repr__(self) -> str:
        return f"QuantumDealer(round={self.round_number}, players={len(self.players)})"
