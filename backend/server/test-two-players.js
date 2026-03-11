/**
 * Two-player WebSocket test
 * Tests if GAME_ACTION is properly broadcasted between players
 */

import WebSocket from 'ws';

const SERVER_URL = 'ws://localhost:7777';
const ROOM_ID = 'test-room-' + Date.now();

function createPlayer(name, isHost) {
  const playerId = `player-${name}-${Date.now()}`;
  const ws = new WebSocket(SERVER_URL);

  return new Promise((resolve, reject) => {
    ws.on('open', () => {
      console.log(`[${name}] Connected, playerId: ${playerId}`);
      resolve({ ws, playerId, name });
    });
    ws.on('error', reject);
  });
}

function send(player, type, data) {
  const msg = {
    type,
    timestamp: Date.now(),
    playerId: player.playerId,
    data
  };
  console.log(`[${player.name}] 📤 Sending ${type}`);
  player.ws.send(JSON.stringify(msg));
}

function onMessage(player, callback) {
  player.ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log(`[${player.name}] 📥 Received ${msg.type}:`, JSON.stringify(msg.data, null, 2));
    callback(msg);
  });
}

async function runTest() {
  console.log('=== Two Player Test ===\n');
  console.log('Room ID:', ROOM_ID);
  console.log('');

  // Create two players
  const player1 = await createPlayer('Player1', true);
  const player2 = await createPlayer('Player2', false);

  let player2ReceivedUpdate = false;

  // Setup message handlers
  onMessage(player1, (msg) => {
    if (msg.type === 'GAME_STATE_UPDATE') {
      console.log('\n[Player1] ✅ Received own GAME_STATE_UPDATE');
    }
  });

  onMessage(player2, (msg) => {
    if (msg.type === 'GAME_STATE_UPDATE') {
      console.log('\n[Player2] ✅ Received GAME_STATE_UPDATE from Player1!');
      player2ReceivedUpdate = true;

      // Verify lastAction
      if (msg.data?.lastAction?.playerId === player1.playerId) {
        console.log('[Player2] ✅ lastAction.playerId matches Player1');
      }
      if (msg.data?.lastAction?.actionType === 'PLAY_CARD') {
        console.log('[Player2] ✅ actionType is correct');
      }
    }
  });

  // Test sequence
  console.log('\n--- Step 1: Player1 joins room ---');
  send(player1, 'JOIN', { roomId: ROOM_ID, nickname: '玩家1', gameType: 'uno' });

  await sleep(300);

  console.log('\n--- Step 2: Player2 joins room ---');
  send(player2, 'JOIN', { roomId: ROOM_ID, nickname: '玩家2', gameType: 'uno' });

  await sleep(300);

  console.log('\n--- Step 3: Player1 starts game ---');
  send(player1, 'START_GAME', { gameType: 'uno', gameConfig: {} });

  await sleep(300);

  console.log('\n--- Step 4: Player1 sends GAME_ACTION ---');
  send(player1, 'GAME_ACTION', {
    actionType: 'PLAY_CARD',
    actionData: { cardId: 'red-5', chosenColor: null }
  });

  await sleep(500);

  // Check result
  console.log('\n=== Test Result ===');
  if (player2ReceivedUpdate) {
    console.log('✅ SUCCESS: Player2 received GAME_STATE_UPDATE');
  } else {
    console.log('❌ FAILED: Player2 did NOT receive GAME_STATE_UPDATE');
  }

  // Cleanup
  player1.ws.close();
  player2.ws.close();
  process.exit(player2ReceivedUpdate ? 0 : 1);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

runTest().catch(console.error);
