// Automated Multiplayer Test Suite for Belt Panic!
import http from 'http';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { GameRoom } from '../server/gameRoom.js';
import { GAME_PHASES, PLAYER_STATES, GAME_RULES, ARENA } from '../server/constants.js';

const TEST_PORT = 3999;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('--- STARTING BELT PANIC MULTIPLAYER RIGOROUS TESTS ---');

  // Set up test server
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  const rooms = new Map();
  const clientRoomMap = new Map();

  function broadcastToRoom(roomId, message) {
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    for (const [ws, info] of clientRoomMap.entries()) {
      if (info.roomId === roomId && ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  function getOrCreateRoom(roomId) {
    const normId = (roomId || 'default').toUpperCase().trim();
    if (!rooms.has(normId)) {
      const room = new GameRoom(normId, broadcastToRoom);
      rooms.set(normId, room);
    }
    return rooms.get(normId);
  }

  wss.on('connection', (ws) => {
    let currentRoom = null;
    let playerId = null;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'JOIN_ROOM') {
          const roomId = (msg.roomId || 'DEFAULT').toUpperCase().trim();
          currentRoom = getOrCreateRoom(roomId);
          playerId = `p_test_${Math.random().toString(36).substr(2, 6)}`;
          clientRoomMap.set(ws, { roomId, playerId });

          const newPlayer = currentRoom.addPlayer(playerId, msg.name, msg.skin);
          ws.send(
            JSON.stringify({
              type: 'JOINED_SUCCESS',
              playerId,
              roomId,
              phase: currentRoom.phase,
              matchTimer: currentRoom.matchTimer,
              phaseTimer: currentRoom.phaseTimer,
              hunterId: currentRoom.hunterId,
              belt: currentRoom.belt,
              players: Array.from(currentRoom.players.values()).map((p) => currentRoom._serializePlayer(p)),
            })
          );
        } else if (msg.type === 'PLAYER_INPUT') {
          if (currentRoom && playerId) {
            currentRoom.setPlayerInput(playerId, msg.input);
          }
        } else if (msg.type === 'START_MATCH') {
          if (currentRoom) currentRoom.startMatch();
        }
      } catch (err) {
        console.error(err);
      }
    });

    ws.on('close', () => {
      if (clientRoomMap.has(ws)) {
        const { roomId, playerId } = clientRoomMap.get(ws);
        clientRoomMap.delete(ws);
        const room = rooms.get(roomId);
        if (room) {
          room.removePlayer(playerId);
        }
      }
    });
  });

  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`Test server listening on port ${TEST_PORT}`);

  function createClient(name) {
    const client = {
      name,
      ws: new WebSocket(`ws://localhost:${TEST_PORT}`),
      playerId: null,
      messages: [],
      states: [],
      lastState: null,
    };

    client.ws.on('message', (raw) => {
      const msg = JSON.parse(raw);
      client.messages.push(msg);
      if (msg.type === 'JOINED_SUCCESS') {
        client.playerId = msg.playerId;
      } else if (msg.type === 'STATE_UPDATE') {
        client.lastState = msg;
        client.states.push(msg);
      }
    });

    return client;
  }

  let clients = [];
  try {
    // TEST 1: Multiple independent clients connect and join the same room
    console.log('\n[TEST 1] Connecting 4 independent clients to room TEST_ROOM...');
    const clientNames = ['Alice', 'Bob', 'Charlie', 'Daisy'];
    clients = clientNames.map(createClient);

    // Wait for all WS connections to open
    await Promise.all(
      clients.map(
        (c) =>
          new Promise((resolve) => {
            c.ws.on('open', resolve);
          })
      )
    );

    // Send JOIN_ROOM for all 4
    for (const c of clients) {
      c.ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomId: 'TEST_ROOM', name: c.name }));
    }

    await sleep(200);

    for (const c of clients) {
      if (!c.playerId) throw new Error(`Client ${c.name} failed to get a player ID!`);
      console.log(`  ✓ ${c.name} joined with ID ${c.playerId}`);
    }

    const testRoom = rooms.get('TEST_ROOM');
    if (testRoom.players.size !== 4) {
      throw new Error(`Expected 4 players in room, found ${testRoom.players.size}`);
    }
    console.log('✓ TEST 1 PASSED: 4 clients joined room and received IDs.');

    // TEST 2: Start Match and verify synchronized countdown
    console.log('\n[TEST 2] Starting match and verifying countdown synchronization...');
    clients[0].ws.send(JSON.stringify({ type: 'START_MATCH' }));
    await sleep(150);

    if (testRoom.phase !== GAME_PHASES.COUNTDOWN) {
      throw new Error(`Expected phase to be COUNTDOWN, got ${testRoom.phase}`);
    }

    for (const c of clients) {
      const startMsg = c.messages.find((m) => m.type === 'MATCH_COUNTDOWN_STARTED');
      if (!startMsg) throw new Error(`Client ${c.name} did not receive MATCH_COUNTDOWN_STARTED!`);
    }
    console.log('✓ TEST 2 PASSED: All clients received synchronized MATCH_COUNTDOWN_STARTED.');

    // TEST 3: Countdown expires -> RUSH phase -> Belt Pickup
    console.log('\n[TEST 3] Simulating rush phase and belt pickup...');
    // Fast-forward countdown
    testRoom.phaseTimer = 0.05;
    await sleep(100);

    if (testRoom.phase !== GAME_PHASES.RUSH) {
      throw new Error(`Expected phase to be RUSH, got ${testRoom.phase}`);
    }
    console.log('  ✓ Room entered RUSH phase');

    // Move Alice directly to the pedestal
    const aliceObj = testRoom.players.get(clients[0].playerId);
    aliceObj.x = ARENA.PEDESTAL.x;
    aliceObj.z = ARENA.PEDESTAL.z;
    await sleep(100);

    if (testRoom.hunterId !== clients[0].playerId) {
      throw new Error(`Expected Alice to become Hunter, got ${testRoom.hunterId}`);
    }
    if (testRoom.phase !== GAME_PHASES.LIGHTS_ON) {
      throw new Error(`Expected phase to transition to LIGHTS_ON, got ${testRoom.phase}`);
    }

    // Verify all clients received BELT_PICKED_UP message
    for (const c of clients) {
      const pickupMsg = c.messages.find((m) => m.type === 'BELT_PICKED_UP');
      if (!pickupMsg) throw new Error(`Client ${c.name} missed BELT_PICKED_UP message!`);
      if (pickupMsg.hunterId !== clients[0].playerId) throw new Error(`Mismatched hunterId on ${c.name}`);
    }
    console.log('✓ TEST 3 PASSED: Alice grabbed the belt, became Hunter, and all 4 clients synchronized!');

    // TEST 4: Hunter belt swing and hit detection
    console.log('\n[TEST 4] Testing Hunter belt swing and fair hit detection...');
    // Position Bob (clients[1]) in front of Alice (within 2m)
    const bobObj = testRoom.players.get(clients[1].playerId);
    bobObj.x = aliceObj.x;
    bobObj.z = aliceObj.z + 1.8;
    aliceObj.angle = 0; // facing +Z towards Bob

    // Alice swings belt
    clients[0].ws.send(
      JSON.stringify({
        type: 'PLAYER_INPUT',
        input: { x: 0, z: 0, jump: false, swing: true, steal: false, angle: 0 },
      })
    );

    await sleep(100);

    if (bobObj.state !== PLAYER_STATES.STUNNED) {
      throw new Error(`Expected Bob to be STUNNED, got ${bobObj.state}`);
    }
    if (aliceObj.score < GAME_RULES.TAG_SCORE) {
      throw new Error(`Expected Alice to receive score for tag, got ${aliceObj.score}`);
    }

    for (const c of clients) {
      const tagMsg = c.messages.find((m) => m.type === 'PLAYER_TAGGED');
      if (!tagMsg) throw new Error(`Client ${c.name} missed PLAYER_TAGGED event!`);
    }
    console.log(`✓ TEST 4 PASSED: Bob tagged and stunned! Alice score: ${aliceObj.score} pts. All clients notified.`);

    // TEST 5: Blackout phase and Belt Steal
    console.log('\n[TEST 5] Testing BLACKOUT phase transition and Belt Stealing...');
    // Fast forward lights on to trigger blackout
    testRoom.phaseTimer = 0.05;
    await sleep(100);

    if (testRoom.phase !== GAME_PHASES.BLACKOUT) {
      throw new Error(`Expected phase to be BLACKOUT, got ${testRoom.phase}`);
    }

    // Position Charlie (clients[2]) next to Hunter Alice
    const charlieObj = testRoom.players.get(clients[2].playerId);
    charlieObj.x = aliceObj.x + 0.8;
    charlieObj.z = aliceObj.z;

    // Charlie holds E to steal for 1.1s
    const startTime = Date.now();
    while (Date.now() - startTime < 1200) {
      clients[2].ws.send(
        JSON.stringify({
          type: 'PLAYER_INPUT',
          input: { x: 0, z: 0, jump: false, swing: false, steal: true, angle: 0 },
        })
      );
      await sleep(40);
    }

    if (!testRoom.beltStolenInBlackout) {
      throw new Error('Expected belt to be stolen in blackout!');
    }
    if (testRoom.pendingHunterId !== clients[2].playerId) {
      throw new Error(`Expected pending hunter to be Charlie, got ${testRoom.pendingHunterId}`);
    }

    // During blackout, Hunter identity remains hidden in broadcast state for suspense!
    const latestState = clients[3].lastState;
    if (latestState.hunterId !== null) {
      throw new Error('Hunter identity should be hidden in blackout broadcast!');
    }
    console.log('✓ TEST 5 PASSED: Charlie stole the belt! Identity kept secret during blackout.');

    // TEST 6: Warning buzzer and Lights Return with NEW HUNTER reveal!
    console.log('\n[TEST 6] Testing LIGHTS_WARN buzzer and NEW HUNTER reveal...');
    testRoom.phaseTimer = 0.05;
    await sleep(100);

    if (testRoom.phase === GAME_PHASES.LIGHTS_WARN) {
      testRoom.phaseTimer = 0.05;
      await sleep(100);
    }

    if (testRoom.phase !== GAME_PHASES.LIGHTS_ON) {
      throw new Error(`Expected phase to return to LIGHTS_ON, got ${testRoom.phase}`);
    }
    if (testRoom.hunterId !== clients[2].playerId) {
      throw new Error(`Expected Charlie to be revealed as NEW HUNTER, got ${testRoom.hunterId}`);
    }

    // Verify all clients have Charlie as hunter
    await sleep(50);
    for (const c of clients) {
      if (c.lastState.hunterId !== clients[2].playerId) {
        throw new Error(`Client ${c.name} does not see Charlie as Hunter!`);
      }
    }
    console.log('✓ TEST 6 PASSED: Lights returned and all clients synchronized on NEW HUNTER Charlie!');

    // TEST 7: Hunter disconnect safety handling
    console.log('\n[TEST 7] Testing Hunter disconnect handling...');
    // Move remaining players away from pedestal so belt stays on pedestal initially
    for (const p of testRoom.players.values()) {
      p.x = 14;
      p.z = 14;
    }
    // Disconnect Charlie
    clients[2].ws.close();
    await sleep(150);

    if (testRoom.phase !== GAME_PHASES.RUSH) {
      throw new Error(`Expected phase to return to RUSH after hunter disconnect, got ${testRoom.phase}`);
    }
    if (!testRoom.belt.onPedestal) {
      throw new Error('Expected belt to return to pedestal!');
    }
    console.log('✓ TEST 7 PASSED: Server gracefully handled hunter disconnect; belt returned to pedestal.');

    console.log('\n========================================');
    console.log('🎉 ALL MULTIPLAYER AUTHORITATIVE TESTS PASSED (7/7)!');
    console.log('========================================');
  } finally {
    for (const c of clients) {
      c.ws.close();
    }
    for (const room of rooms.values()) {
      room.stopLoop();
    }
    server.close();
  }
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
