# Crazy Crack - Developer Guide for Gemini

Welcome, Gemini! This file contains technical details, architecture specs, and development patterns for the **Crazy Crack** codebase. Use this as a reference guide when modifying or extending this repository.

---

## 🏛️ System Architecture Overview

Crazy Crack is built as a split client-server structure:
* **Server (`/server`):** Node.js Express server running `socket.io` for handling room lobbies, syncing game phases, managing CPU bots when single-player requests go through server, and maintaining security layers.
* **Client (`/client`):** Vite-managed React 19 SPA. Runs multiplayer rooms over the network, or falls back to an in-memory game client (`LocalGameEngine.js`) to support zero-latency offline CPU play. Hides mobile system bars via Capacitor.

---

## 📂 Key Codebase Directories

```bash
crazy-crack/
├── client/
│   ├── src/
│   │   ├── components/       # Game UI elements (Board, Lobbies, Setup, Chat)
│   │   ├── services/         # Local singleplayer offline game engine
│   │   ├── utils/            # Shared sound oscillators and helpers
│   │   ├── App.jsx           # Core client state and routing
│   │   ├── App.css           # Global layout variables
│   │   └── index.css         # Theme palettes and core stylesheet
│   ├── package.json          # React 19 client config
│   └── capacitor.config.json # Capacitor native shell definitions
├── server/
│   ├── server.js             # Express & Socket.io server logic
│   └── package.json          # Socket server node dependencies
├── test_game_flow.js         # Integration flow test simulation
└── render.yaml               # Deployment config for Render.com hosting
```

---

## 🔌 Socket.io API Reference Specification

When writing or editing real-time socket listeners, use these exact event signatures.

### Client-to-Server Emissions (`socket.emit`)

* **`create_room` (payload: `profile`, ack: `(res) => void`)**
  * *Description:* Creates a multiplayer waiting lobby.
  * *Payload format:* `{ username: string, avatar: string }`
  * *Ack response format:* `{ success: true, roomCode: string }`

* **`create_single_player` (payload: `profile`, ack: `(res) => void`)**
  * *Description:* Starts a single-player game on the server (alternative path to LocalGameEngine).
  * *Payload format:* `{ username: string, avatar: string }`
  * *Ack response format:* `{ success: true, roomCode: string }`

* **`join_room` (payload: `{ roomCode, profile }`, ack: `(res) => void`)**
  * *Description:* Connects a human player or spectator to an active room.
  * *Payload format:* `{ roomCode: string, profile: { username: string, avatar: string } }`
  * *Ack response format (Spectator):* `{ success: true, roomCode, spectator: true, gameState, calledNumbers: number[], currentTurnId: string }`
  * *Ack response (Reconnection):* `{ success: true, roomCode, reconnected: true, gameState }`
  * *Ack response (Player):* `{ success: true, roomCode }`

* **`get_room_data` (payload: `roomCode`, ack: `(res) => void`)**
  * *Description:* Fetches sanitized room state. Strips `board` lists to avoid cheating.
  * *Ack response format:* `{ success: boolean, players: Player[], state: string, calledNumbers: number[], currentTurnId: string|null }`

* **`get_spectator_board` (payload: `{ roomCode, targetId }`, ack: `(res) => void`)**
  * *Description:* Fetches the secret board numbers of a target player. Validates that request sender has won or is a spectator.
  * *Payload format:* `{ roomCode: string, targetId: string }`
  * *Ack response format:* `{ success: true, board: number[] }` or `{ success: false, message: string }`

* **`start_game_request` (payload: `roomCode`, ack: `(res) => void`)**
  * *Description:* Requests transition from lobby to Setup board phase. Checked for host privileges.

* **`board_ready` (payload: `{ roomCode, board }`, ack: `(res) => void`)**
  * *Description:* Submits a grid for setup validation.
  * *Payload format:* `{ roomCode: string, board: number[] }`
  * *Ack response format:* `{ success: true, allReady: boolean, players?: Player[], currentTurnId?: string }`

* **`call_number` (payload: `{ roomCode, number }`)**
  * *Description:* Marks a selected grid number on all participants' boards and moves the turn index.
  * *Payload format:* `{ roomCode: string, number: number }`

* **`update_score` (payload: `{ roomCode, linesCompleted }`)**
  * *Description:* Sends updated completed lines score of the client player. Triggers win checks.
  * *Payload format:* `{ roomCode: string, linesCompleted: number }`

* **`send_chat` (payload: `msgData`)**
  * *Description:* Relays a chat line to the room chat channel.
  * *Payload format:* `{ roomCode: string, message: string, sender: string, avatar: string, timestamp: number }`

* **`rematch` (payload: `roomCode`)**
  * *Description:* Restores room configurations for another game. Only host can invoke.

* **`kick_player` (payload: `{ roomCode, playerId }`)**
  * *Description:* Kicks a player from the waiting lobby. Only host can invoke.

---

### Server-to-Client Emissions (`socket.on`)

* **`lobby_update` (payload: `Player[]`)**
  * *Description:* Triggered on arrival/departure updates. Boards are hidden.

* **`game_started` (payload: `{ state: 'setup' }`)**
  * *Description:* Signals that board grid setup phase has begun.

* **`player_ready_update` (payload: `Player[]`)**
  * *Description:* Sent as intermediate updates when players click "I'm Ready".

* **`all_players_ready` (payload: `{ players: Player[], currentTurnId: string }`)**
  * *Description:* Emitted when the last player sets their board. Transition to active play.

* **`turn_update` (payload: `{ currentTurnId: string }`)**
  * *Description:* Signals whose turn it is to select a number.

* **`number_called` (payload: `{ number: number, caller: string }`)**
  * *Description:* Triggers the strike-out animations and pop sounds across boards.

* **`player_won` (payload: `{ username: string, rank: string }`)**
  * *Description:* Triggers win banners, arpeggios, and confetti overlays.

* **`game_over` (payload: `Player[]`)**
  * *Description:* Fired when the final game finishes. Transitions to leaderboard screen.

* **`rematch_started`**
  * *Description:* Reverts UI state to the waiting lobby.

* **`kicked_from_room`**
  * *Description:* Notifies guest player that they have been kicked. Clears current room.

* **`chat_message` (payload: `msgData`)**
  * *Description:* Appends messages in the sidebar window.

---

## 🤖 Offline Bot Simulation AI Engine

To work offline, client UI elements utilize the class [LocalGameEngine](file:///c:/Users/green/Documents/Antigravity%20Projects/crazy-crack/client/src/services/LocalGameEngine.js). It mocks Socket behavior and schedules bot moves after a delay of `2000ms`.

### Bot Strategy Heuristics:
1. **Beginner:** Sabotage mode. Chooses numbers with the lowest heuristic score (helps the player, hinders itself).
2. **Easy:** Pure random numbers selection.
3. **Medium:** 50% chance of playing greedy, 50% random.
4. **Hard:** Greedy choice. Selects numbers that maximize its own line progress score.
5. **Extreme:** Strategic balance. Evaluates `botScore - humanScore * 1.5` to prioritize completing its own lines while actively avoiding calling numbers that help the human complete their lines.

---

## 💅 Styling & Visual Standards

Crazy Crack uses a custom CSS system defined in [index.css](file:///c:/Users/green/Documents/Antigravity%20Projects/crazy-crack/client/src/index.css) to support multiple design themes.

* **Design Tokens:** Always utilize CSS variables (`var(--bg-color)`, `var(--panel-bg)`, `var(--text-color)`, `var(--accent-color)`) instead of hardcoding raw color hex values in component files.
* **Component Responsiveness:** Keep board items flexible to scale down neatly to 320px widths on compact phones. Use CSS Grid autofits and relative rem/em font values.

---

## 🛠️ Developer Checklist

1. **Starting Local Sockets Server:**
   ```powershell
   cd server
   npm install
   npm start
   ```
2. **Starting Client Development Server:**
   ```powershell
   cd client
   npm install
   npm run dev
   ```
3. **Running Local E2E Flow test:**
   ```powershell
   node test_game_flow.js
   ```
