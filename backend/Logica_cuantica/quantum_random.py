"""
Quantum Random Number Generator
Uses Qiskit to generate truly quantum random numbers
"""

from qiskit import QuantumCircuit
from qiskit_aer import AerSimulator
import numpy as np
from typing import Optional


class QuantumRNG:
    """Quantum Random Number Generator using Qiskit"""
    
    def __init__(self):
        self.simulator = AerSimulator()
    
    def _generate_quantum_bits(self, num_bits: int) -> list[int]:
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
    
    def random_int(self, min_val: int, max_val: int) -> int:
        """
        Generate quantum random integer in range [min_val, max_val] inclusive
        
        Args:
            min_val: Minimum value (inclusive)
            max_val: Maximum value (inclusive)
            
        Returns:
            Random integer in the specified range
        """
        if min_val > max_val:
            raise ValueError("min_val must be <= max_val")
        
        if min_val == max_val:
            return min_val
        
        range_size = max_val - min_val
        bits_needed = range_size.bit_length()
        
        # Keep generating until we get a valid value
        while True:
            random_bits = self._generate_quantum_bits(bits_needed)
            value = sum(bit * (2 ** idx) for idx, bit in enumerate(random_bits))
            if value <= range_size:
                return min_val + value
    
    def random_float(self) -> float:
        """
        Generate quantum random float in range [0.0, 1.0)
        Uses 32 bits of quantum randomness for precision
        
        Returns:
            Random float in [0.0, 1.0)
        """
        bits = self._generate_quantum_bits(32)
        # Convert bits to integer, then normalize to [0, 1)
        int_val = sum(bit * (2 ** idx) for idx, bit in enumerate(bits))
        return int_val / (2 ** 32)
    
    def random_choice(self, items: list):
        """
        Choose a random item from the list using quantum randomness
        
        Args:
            items: List of items to choose from
            
        Returns:
            Randomly selected item
        """
        if not items:
            raise ValueError("Cannot choose from empty list")
        
        idx = self.random_int(0, len(items) - 1)
        return items[idx]
    
    def shuffle(self, items: list) -> list:
        """
        Shuffle a list using quantum randomness (Fisher-Yates algorithm)
        
        Args:
            items: List to shuffle
            
        Returns:
            New shuffled list (original unchanged)
        """
        shuffled = items.copy()
        n = len(shuffled)
        
        for i in range(n - 1, 0, -1):
            j = self.random_int(0, i)
            shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
        
        return shuffled


# Global quantum RNG instance
_qrng_instance: Optional[QuantumRNG] = None


def get_quantum_rng() -> QuantumRNG:
    """Get or create global quantum RNG instance"""
    global _qrng_instance
    if _qrng_instance is None:
        _qrng_instance = QuantumRNG()
    return _qrng_instance


def quantum_random_int(min_val: int, max_val: int) -> int:
    """Convenience function for generating quantum random integer"""
    return get_quantum_rng().random_int(min_val, max_val)


def quantum_random_float() -> float:
    """Convenience function for generating quantum random float"""
    return get_quantum_rng().random_float()


def quantum_choice(items: list):
    """Convenience function for quantum random choice"""
    return get_quantum_rng().random_choice(items)


def quantum_shuffle(items: list) -> list:
    """Convenience function for quantum shuffle"""
    return get_quantum_rng().shuffle(items)
