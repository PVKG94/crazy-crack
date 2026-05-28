// End-to-end test: simulates two players creating a room, starting game, and both clicking ready
const { io } = require("socket.io-client");

const SERVER = "https://crazy-crack.onrender.com";

function generateBoard() {
  const nums = Array.from({length: 100}, (_, i) => i + 1);
  for (let i = nums.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [nums[i], nums[j]] = [nums[j], nums[i]];
  }
  return nums;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function test() {
  console.log("=== CRAZY CRACK FLOW TEST ===\n");
  console.log(`Connecting to: ${SERVER}\n`);

  const p1 = io(SERVER, { transports: ["websocket"] });
  const p2 = io(SERVER, { transports: ["websocket"] });

  // Wait for both to connect
  await Promise.all([
    new Promise(r => p1.on("connect", () => { console.log(`[P1] Connected: ${p1.id}`); r(); })),
    new Promise(r => p2.on("connect", () => { console.log(`[P2] Connected: ${p2.id}`); r(); })),
  ]);

  // P1 creates room
  const roomCode = await new Promise(r => {
    p1.emit("create_room", { username: "TestHost", avatar: "🎮" }, (res) => {
      console.log(`[P1] create_room response:`, JSON.stringify(res));
      r(res.roomCode);
    });
  });
  console.log(`[Room] Created: ${roomCode}\n`);

  // Listen for events on both
  p1.on("lobby_update", (players) => {
    console.log(`[P1] lobby_update: ${players.length} players, ready: [${players.map(p=>p.username+':'+p.isReady).join(', ')}]`);
  });
  p2.on("lobby_update", (players) => {
    console.log(`[P2] lobby_update: ${players.length} players, ready: [${players.map(p=>p.username+':'+p.isReady).join(', ')}]`);
  });
  p1.on("game_started", (d) => console.log(`[P1] game_started:`, JSON.stringify(d)));
  p2.on("game_started", (d) => console.log(`[P2] game_started:`, JSON.stringify(d)));
  p1.on("player_ready_update", (players) => {
    console.log(`[P1] player_ready_update: [${players.map(p=>p.username+':'+p.isReady).join(', ')}]`);
  });
  p2.on("player_ready_update", (players) => {
    console.log(`[P2] player_ready_update: [${players.map(p=>p.username+':'+p.isReady).join(', ')}]`);
  });
  p1.on("all_players_ready", (d) => console.log(`[P1] all_players_ready: turnId=${d.currentTurnId}`));
  p2.on("all_players_ready", (d) => console.log(`[P2] all_players_ready: turnId=${d.currentTurnId}`));

  // P2 joins room
  await new Promise(r => {
    p2.emit("join_room", { roomCode, profile: { username: "TestJoiner", avatar: "🎲" } }, (res) => {
      console.log(`[P2] join_room response:`, JSON.stringify(res));
      r();
    });
  });
  await sleep(500);

  // P1 starts game
  console.log(`\n--- HOST STARTS GAME ---`);
  p1.emit("start_game_request", roomCode);
  await sleep(1000);

  // Both click ready
  console.log(`\n--- BOTH CLICK READY ---`);
  
  const board1 = generateBoard();
  const board2 = generateBoard();
  
  const ack1Promise = new Promise(r => {
    p1.emit("board_ready", { roomCode, board: board1 }, (ack) => {
      console.log(`[P1] board_ready ACK:`, JSON.stringify(ack));
      r(ack);
    });
  });

  await sleep(300); // Small gap like real users

  const ack2Promise = new Promise(r => {
    p2.emit("board_ready", { roomCode, board: board2 }, (ack) => {
      console.log(`[P2] board_ready ACK:`, JSON.stringify(ack));
      r(ack);
    });
  });

  const [ack1, ack2] = await Promise.all([ack1Promise, ack2Promise]);
  await sleep(1000);

  // Final check: poll room state
  console.log(`\n--- FINAL POLL ---`);
  p1.emit("get_room_data", roomCode, (res) => {
    console.log(`[P1] get_room_data:`, JSON.stringify({ state: res.state, players: res.players?.map(p=>({name:p.username,ready:p.isReady})), currentTurnId: res.currentTurnId }));
  });
  
  await sleep(1000);
  
  console.log("\n=== TEST COMPLETE ===");
  p1.disconnect();
  p2.disconnect();
  process.exit(0);
}

test().catch(e => { console.error(e); process.exit(1); });
