const WebSocket = require('ws');

async function runMultiplayerVerification() {
  console.log('--- STARTING MULTIPLAYER PROTOCOL VERIFICATION ---');

  const ws1 = new WebSocket('ws://localhost:3000');
  const ws2 = new WebSocket('ws://localhost:3000');

  let roomCode = null;

  const waitOpen = (ws) => new Promise((resolve) => ws.on('open', resolve));
  await Promise.all([waitOpen(ws1), waitOpen(ws2)]);
  console.log('✅ Both WebSockets connected to ws://localhost:3000');

  // Promise listeners helper
  const nextMsg = (ws) => new Promise((resolve) => {
    ws.once('message', (raw) => {
      resolve(JSON.parse(raw));
    });
  });

  // Step 1: Client 1 creates room
  ws1.send(JSON.stringify({
    type: 'CREATE_ROOM',
    payload: { playerName: 'Dipson' }
  }));

  const createMsg = await nextMsg(ws1);
  console.log('Received from server (Client 1):', createMsg.type, 'Room Code:', createMsg.roomCode);
  if (createMsg.type !== 'ROOM_CREATED' || !createMsg.roomCode || createMsg.roomCode.length !== 4) {
    throw new Error('Failed to create room with 4-letter code');
  }
  roomCode = createMsg.roomCode;
  console.log(`✅ 1. Create Room verified: 4-letter code "${roomCode}"`);

  // Step 2: Client 2 joins room via 4-letter code
  ws2.send(JSON.stringify({
    type: 'JOIN_ROOM',
    roomCode: roomCode,
    payload: { playerName: 'Her' }
  }));

  // Client 2 should receive ROOM_JOINED
  const joinMsg = await nextMsg(ws2);
  console.log('Received from server (Client 2):', joinMsg.type, 'Role:', joinMsg.role);
  if (joinMsg.type !== 'ROOM_JOINED' || joinMsg.role !== 'p2') {
    throw new Error('Failed to join room as Player 2');
  }

  // Both should receive GAME_STARTED
  const [startMsg1, startMsg2] = await Promise.all([nextMsg(ws1), nextMsg(ws2)]);
  console.log('Client 1 received:', startMsg1.type, 'Players:', startMsg1.players);
  console.log('Client 2 received:', startMsg2.type, 'Players:', startMsg2.players);

  if (startMsg1.type !== 'GAME_STARTED' || startMsg2.type !== 'GAME_STARTED') {
    throw new Error('Game start transition not received by both players');
  }
  console.log('✅ 2. Room Join & Screen Transition verified: Both screens transition to active game board!');

  // Step 3: Synchronized Wheel Spin
  const spinPayload = {
    targetDeg: 1620,
    chosenPlayer: 'Her',
    chosenRole: 'p2',
    spinCount: 1
  };
  ws1.send(JSON.stringify({
    type: 'SPIN_WHEEL',
    roomCode: roomCode,
    payload: spinPayload
  }));

  const [spinMsg1, spinMsg2] = await Promise.all([nextMsg(ws1), nextMsg(ws2)]);
  console.log('Client 1 spin event:', spinMsg1.type, spinMsg1.payload.targetDeg, spinMsg1.payload.chosenPlayer);
  console.log('Client 2 spin event:', spinMsg2.type, spinMsg2.payload.targetDeg, spinMsg2.payload.chosenPlayer);

  if (spinMsg1.payload.targetDeg !== spinMsg2.payload.targetDeg || 
      spinMsg1.payload.chosenPlayer !== spinMsg2.payload.chosenPlayer) {
    throw new Error('Spin not synchronized!');
  }
  console.log('✅ 3. Synchronized Wheel Spin verified: identical targetDeg & chosenPlayer on both screens!');

  // Step 4: Synchronized Category Selection (Selected player Her picks TRUTH)
  ws2.send(JSON.stringify({
    type: 'SELECT_CATEGORY',
    roomCode: roomCode,
    payload: { category: 'TRUTH', byRole: 'p2' }
  }));

  const [catMsg1, catMsg2] = await Promise.all([nextMsg(ws1), nextMsg(ws2)]);
  if (catMsg1.payload.category !== 'TRUTH' || catMsg2.payload.category !== 'TRUTH') {
    throw new Error('Category selection out of sync!');
  }
  console.log('✅ 4. Synchronized Category Selection verified: Both screens receive TRUTH flip!');

  // Step 5: Real-Time Custom Directive (Non-selected player Dipson writes custom dare/truth)
  ws1.send(JSON.stringify({
    type: 'DIRECTIVE_REVEALED',
    roomCode: roomCode,
    payload: {
      task: 'Admit who your secret crush was in high school without laughing for 30s!',
      isCustom: true,
      senderName: 'Dipson'
    }
  }));

  const [dirMsg1, dirMsg2] = await Promise.all([nextMsg(ws1), nextMsg(ws2)]);
  if (!dirMsg2.payload.isCustom || !dirMsg2.payload.task.includes('crush')) {
    throw new Error('Custom directive not broadcasted properly');
  }
  console.log('✅ 5. Real-Time Custom Directive verified: Immediately delivered to target screen with custom flag!');

  // Step 6: Challenge Complete & Turn Handover
  ws2.send(JSON.stringify({
    type: 'COMPLETE_CHALLENGE',
    roomCode: roomCode,
    payload: { completedBy: 'Her' }
  }));

  const [compMsg1, compMsg2] = await Promise.all([nextMsg(ws1), nextMsg(ws2)]);
  if (compMsg1.type !== 'CHALLENGE_COMPLETED') {
    throw new Error('Completion notification failed');
  }

  // Step 7: Live Name Customization / Rename Synchronization
  ws2.send(JSON.stringify({
    type: 'UPDATE_PLAYER_NAME',
    roomCode: roomCode,
    payload: { role: 'p2', newName: 'Queen' }
  }));

  const [renameMsg1, renameMsg2] = await Promise.all([nextMsg(ws1), nextMsg(ws2)]);
  if (renameMsg1.payload.newName !== 'Queen' || renameMsg2.payload.newName !== 'Queen') {
    throw new Error('Name update sync failed');
  }
  console.log('✅ 7. Live Name Customization verified: Player 2 renamed to "Queen" across both screens!');

  // Next round
  ws1.send(JSON.stringify({
    type: 'NEXT_ROUND',
    roomCode: roomCode
  }));

  const [nextRndMsg1, nextRndMsg2] = await Promise.all([nextMsg(ws1), nextMsg(ws2)]);
  if (nextRndMsg1.payload.round !== 2 || nextRndMsg2.payload.round !== 2) {
    throw new Error('Next round handover failed');
  }
  console.log('✅ 8. Turn handover verified: Round 2 synchronized across both clients!');

  ws1.close();
  ws2.close();
  console.log('--- ALL MULTIPLAYER VERIFICATION CHECKS PASSED SUCCESSFULLY! ---');
}

runMultiplayerVerification().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
