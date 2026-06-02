# Phase 1: Core Gameplay Engine

## 📌 Status: Completed

This phase established the basic math, game representation, and logic rules for **Crazy Crack** on a 10×10 grid.

---

## 🎯 Completed Requirements

### 1. Board Generation & Shuffling
* Grid is 100 cells (`10 rows` × `10 columns`).
* Contains unique numbers `1–100` positioned randomly for each player.
* Implemented using the **Fisher-Yates Shuffle** algorithm to guarantee equal distribution.

### 2. Line Evaluation Rules
* Evaluation tracks completions across **22 possible directions**:
  * **10 Rows**
  * **10 Columns**
  * **2 Diagonals** (Main diagonal and anti-diagonal).
* A line is complete only when all 10 of its cells have been "called" by any player in the game.
* Strikethrough lines render visually overlaying the grid on completion.

### 3. Score Representation & Win State
* Score tracks the number of completed lines.
* Aligned with the name **"CRAZY CRACK"** (10 characters). Each completed line strikes out a letter from left to right.
* Reaching `10 lines` completes the strikeout of all letters and triggers a win condition.

---

## 🔍 Code References
* Grid generation and line checking calculations are located in:
  * Server-side: `server/server.js` (`checkBotLines` and `randomizeBoard`)
  * Client-side: [LocalGameEngine.js](file:///c:/Users/green/Documents/Antigravity%20Projects/crazy-crack/client/src/services/LocalGameEngine.js) (`checkLines`)
  * UI component: [GameBoard.jsx](file:///c:/Users/green/Documents/Antigravity%20Projects/crazy-crack/client/src/components/GameBoard.jsx) (Line checking in `useEffect`)
  * Score strike rendering: [TitleScore.jsx](file:///c:/Users/green/Documents/Antigravity%20Projects/crazy-crack/client/src/components/TitleScore.jsx)
