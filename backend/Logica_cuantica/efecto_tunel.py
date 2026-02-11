# src/quantum/tunnel_effect.py
"""
Efecto túnel para elegir quién es la mano/dealer en la siguiente ronda.

- Con probabilidad p_classic (por defecto 0.99) se sigue el orden clásico:
    next_dealer = (current + 1) % num_players
- Con el resto (1 - p_classic), se elige UNIFORMEMENTE entre los otros jugadores
  (todos excepto el "clásico").

Con 4 jugadores:
- 99% clásico
- 1% repartido: ~0.333% a cada uno de los otros 3 (incluye quedarse igual si no es el clásico)

USES QUANTUM RANDOMNESS - NO CLASSICAL RNG
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from .quantum_random import QuantumRNG


@dataclass
class TunnelEffect:
    p_classic: float = 0.99
    seed: Optional[int] = None  # seed is ignored - kept for API compatibility

    def __post_init__(self) -> None:
        if not (0.0 <= self.p_classic <= 1.0):
            raise ValueError("p_classic debe estar en [0, 1].")
        # Use quantum RNG instead of numpy
        self.qrng = QuantumRNG()

    def next_dealer_idx(self, current_dealer_idx: int, num_players: int) -> int:
        if num_players < 2:
            return 0
        if not (0 <= current_dealer_idx < num_players):
            raise ValueError("current_dealer_idx fuera de rango.")

        classic_next = (current_dealer_idx + 1) % num_players

        # Use quantum random float instead of numpy random
        if self.qrng.random_float() < self.p_classic:
            return classic_next

        candidates = [i for i in range(num_players) if i != classic_next]
        # Use quantum choice instead of numpy choice
        return int(self.qrng.random_choice(candidates))


def next_dealer_with_tunnel(
    current_dealer_idx: int,
    num_players: int,
    p_classic: float = 0.99,
    rng: Optional[QuantumRNG] = None,
) -> int:
    """
    Versión funcional (rápida) del efecto túnel.
    Uses quantum randomness instead of classical RNG.
    
    Args:
        current_dealer_idx: Current dealer index
        num_players: Number of players
        p_classic: Probability of following classical order
        rng: Quantum RNG instance (created if None)
    """
    if not (0.0 <= p_classic <= 1.0):
        raise ValueError("p_classic debe estar en [0, 1].")

    if num_players < 2:
        return 0
    if not (0 <= current_dealer_idx < num_players):
        raise ValueError("current_dealer_idx fuera de rango.")

    if rng is None:
        rng = QuantumRNG()

    classic_next = (current_dealer_idx + 1) % num_players

    # Use quantum random instead of numpy
    if rng.random_float() < p_classic:
        return classic_next

    candidates = [i for i in range(num_players) if i != classic_next]
    return int(rng.random_choice(candidates))
