# Backend structure

This document describes the responsibility of each backend file.

## Core runtime
- server.py: Flask + Socket.IO entrypoint; HTTP endpoints, websocket events, room lifecycle, game start, state broadcasts.
- config.py: Runtime configuration values and environment wiring (if used by imports).
- run.bat: Windows launcher for the backend server.
- run.sh: Unix shell launcher for the backend server.
- Procfile (repo root): process entry for deployment platforms.

## Lobby and game orchestration
- room_manager.py: In-memory room/lobby registry; player join/leave; room codes; status updates.
- game_manager.py: In-memory game registry; create/get/remove game instances.
- models.py: SQLAlchemy models for players, games, and history records.

## Game flow and rules
- game_logic.py: Main game state and state transitions; dealing, discard, rounds, entanglement hooks, collapse hooks.
- round_handlers.py: Round router for MUS and betting rounds; transitions between rounds.
- grande_betting_handler.py: Full Grande betting phase rules and resolution.
- generic_betting_handler.py: Shared betting logic for CHICA, PARES, JUEGO (deferred resolution).

## Quantum mechanics (game-specific)
- entanglement_system.py: Static entanglement pairs by mode; activation tracking; per-team/per-player queries.
- quantum_collapse.py: Collapse triggers and deterministic collapse logic; penalties and event history.
- card_deck.py: Legacy/non-Qiskit quantum card and deck model; collapse and comparison helpers.
- quantum-engine.py: Deprecated entrypoint; points to newer modules.

## Qiskit-based quantum deck
- Logica_cuantica/baraja.py: Qiskit QuantumDeck; draw/shuffle; King-Pit entanglement collapse with cache.
- Logica_cuantica/cartas.py: Qiskit QuantumCard; measurement/collapse and state decoding helpers.
- Logica_cuantica/dealer.py: Qiskit dealer; deals cards, handles discard pile, collapses hands, tunnel effect.
- Logica_cuantica/efecto_tunel.py: Tunnel effect helper for dealer rotation.
- Logica_cuantica/jugador.py: Player model for Qiskit dealer flow.

## Duplicate/legacy quantum folder
- Logica cuantica/*: Alternate copy of Logica_cuantica with similar content; keep only one active path.

## Utilities and docs
- README.md: Backend usage and notes.
- integration_guide.py: Notes or helper logic for integrations.
- mock_server.py: Lightweight mock server for local testing.
- test_client.py: Socket.IO test client.
- test_collapse_determinism.py: Tests for deterministic collapse.
- test_grande_phase.py: Tests for Grande phase rules.
- requirements.txt: Python dependencies.
- Requisements.py: Likely legacy or helper for dependencies.
- assets/: Card generation assets (if used by backend tooling).
- instance/: Runtime instance folder (Flask/SQLAlchemy instance data).
- .env.example: Sample environment variables.
- .gitignore: Git ignore rules for backend folder.
