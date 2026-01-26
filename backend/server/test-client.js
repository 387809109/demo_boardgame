/**
 * Simple WebSocket test client
 * Usage: node test-client.js
 */

import WebSocket from 'ws';

const SERVER_URL = 'ws://localhost:7777';
const PLAYER_ID = `player-${Date.now()}`;

console.log('Connecting to', SERVER_URL);
console.log('Player ID:', PLAYER_ID);
console.log('---');

const ws = new WebSocket(SERVER_URL);

ws.on('open', () => {
  console.log('✅ Connected to server\n');

  // Test 1: PING
  console.log('📤 Sending PING...');
  ws.send(JSON.stringify({
    type: 'PING',
    timestamp: Date.now(),
    playerId: PLAYER_ID,
    data: {}
  }));

  // Test 2: JOIN after a short delay
  setTimeout(() => {
    console.log('\n📤 Sending JOIN...');
    ws.send(JSON.stringify({
      type: 'JOIN',
      timestamp: Date.now(),
      playerId: PLAYER_ID,
      data: {
        roomId: 'test-room-001',
        nickname: '测试玩家',
        gameType: 'uno'
      }
    }));
  }, 500);

  // Test 3: CHAT after joining
  setTimeout(() => {
    console.log('\n📤 Sending CHAT_MESSAGE...');
    ws.send(JSON.stringify({
      type: 'CHAT_MESSAGE',
      timestamp: Date.now(),
      playerId: PLAYER_ID,
      data: {
        message: 'Hello, 这是一条测试消息！',
        isPublic: true
      }
    }));
  }, 1000);

  // Test 4: LEAVE after chat
  setTimeout(() => {
    console.log('\n📤 Sending LEAVE...');
    ws.send(JSON.stringify({
      type: 'LEAVE',
      timestamp: Date.now(),
      playerId: PLAYER_ID,
      data: {}
    }));
  }, 1500);

  // Close after all tests
  setTimeout(() => {
    console.log('\n---');
    console.log('✅ All tests completed, closing connection');
    ws.close();
  }, 2000);
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  console.log('📥 Received:', message.type);
  console.log('   Data:', JSON.stringify(message.data, null, 2));
});

ws.on('close', () => {
  console.log('Connection closed');
  process.exit(0);
});

ws.on('error', (err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
