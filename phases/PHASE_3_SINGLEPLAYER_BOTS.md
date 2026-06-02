# Phase 3: Single-Player Bot Engine

## 📌 Status: Completed

This phase created a localized client-side simulation engine to allow players to compete offline against an adaptive CPU bot of varying skill difficulties.

---

## 🎯 Completed Requirements

### 1. Mock Socket client (`LocalGameEngine`)
* Created a Javascript class `LocalGameEngine` mimicking standard `socket.io-client` interface (`on`, `off`, `emit`, `connect`, `disconnect`).
* Redirects all multiplayer event streams to client-side memory callbacks, enabling zero-latency offline gameplay without server interactions.

### 2. Adaptive Bot AI Levels
AI behavior dynamically alters selection weights depending on difficulty setting:
* **Beginner:** Chooses numbers that minimize its own progress (sabotages its own board).
* **Easy:** Selection is 100% random.
* **Medium:** Blends strategy — 50% chance to select a number greedy for completing its best lines, 50% chance to choose randomly.
* **Hard:** Plays strictly greedy, choosing numbers that maximize progress on its own rows, columns, or diagonals.
* **Extreme:** Maximizes its own line completion progress *minus* the progress that call would give to the human player (active defense/sabotage strategy).

### 3. Board Progress Heuristic Algorithm
* Implemented `getNumberProgressScore` to analyze rows, columns, and diagonals passing through a candidate cell.
* Determines cells where line completions are most immediate (highest pre-existing called numbers in a line).

---

## 🔍 Code References
* Local Game engine wrapper and AI heuristics: [LocalGameEngine.js](file:///c:/Users/green/Documents/Antigravity%20Projects/crazy-crack/client/src/services/LocalGameEngine.js)
* UI Connection initialization: [App.jsx](file:///c:/Users/green/Documents/Antigravity%20Projects/crazy-crack/client/src/App.jsx) (via `handlePlayBot`)
* Server-side bot backup (in case a single-player game is started over socket connection): [server.js](file:///c:/Users/green/Documents/Antigravity%20Projects/crazy-crack/server/server.js) (via `create_single_player` listener and `takeBotTurn` worker)
