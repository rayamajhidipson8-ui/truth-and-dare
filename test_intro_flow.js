const fs = require('fs');
const WebSocket = require('ws');

async function testIntroFlow() {
  console.log('=== VERIFYING INTRODUCTION PAGE ARCHITECTURE & NETWORKING ===');

  // 1. Verify index.html content
  const html = fs.readFileSync('index.html', 'utf8');
  
  const requiredElements = [
    'id="introductionScreen"',
    'id="introInviteAlertBanner"',
    'id="introHostNameBanner"',
    'id="introRoomCodeText"',
    'id="introSneakPeekWidget"',
    'id="introJoinTerminal"',
    'id="introPlayerNameInput"',
    'id="btnIntroMainAction"',
    'showIntroductionScreen',
    'sampleIntroDirective',
    'handleIntroAcceptInvite',
    'updateIntroHostInfo',
    'btnHeaderIntro'
  ];

  for (const elem of requiredElements) {
    if (!html.includes(elem)) {
      throw new Error(`Missing expected element/function in index.html: ${elem}`);
    }
  }
  console.log('✅ 1. All Introduction Page UI elements & handler functions verified in index.html');

  // 2. Verify WebSocket Network Flow:
  // Host creates room -> Guest queries room details -> Guest receives Host name -> Guest accepts challenge & joins
  const wsHost = new WebSocket('ws://localhost:3000');
  const wsGuest = new WebSocket('ws://localhost:3000');

  const waitOpen = (ws) => new Promise(res => ws.on('open', res));
  await Promise.all([waitOpen(wsHost), waitOpen(wsGuest)]);

  const nextMsg = (ws) => new Promise(res => ws.once('message', data => res(JSON.parse(data))));

  // Host creates room with custom name
  wsHost.send(JSON.stringify({
    type: 'CREATE_ROOM',
    payload: { playerName: 'SpecterHost' }
  }));

  const created = await nextMsg(wsHost);
  const roomCode = created.roomCode;
  console.log(`✅ 2. Room created by SpecterHost with code: ${roomCode}`);

  // Guest arrives via invite link and queries host info
  wsGuest.send(JSON.stringify({
    type: 'QUERY_ROOM',
    roomCode: roomCode
  }));

  const roomInfo = await nextMsg(wsGuest);
  console.log('✅ 3. Guest received Host Info via QUERY_ROOM:', roomInfo);
  if (roomInfo.type !== 'ROOM_INFO' || roomInfo.hostName !== 'SpecterHost') {
    throw new Error('Host name query failed or mismatch');
  }

  // Guest accepts invitation from Introduction Page terminal
  wsGuest.send(JSON.stringify({
    type: 'JOIN_ROOM',
    roomCode: roomCode,
    payload: { playerName: 'ChallengerQueen' }
  }));

  const guestJoined = await nextMsg(wsGuest);
  if (guestJoined.type !== 'ROOM_JOINED' || guestJoined.role !== 'p2') {
    throw new Error('Failed to join room as p2');
  }

  const [hostStart, guestStart] = await Promise.all([nextMsg(wsHost), nextMsg(wsGuest)]);
  if (hostStart.type !== 'GAME_STARTED' || guestStart.type !== 'GAME_STARTED') {
    throw new Error('Game start synchronization failed');
  }

  console.log(`✅ 4. Guest joined successfully as ChallengerQueen! Game started on both screens.`);
  console.log('=== ALL INTRODUCTION PAGE TESTS PASSED WITH 100% SUCCESS ===');

  wsHost.close();
  wsGuest.close();
}

testIntroFlow().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
