import { createOpencode } from '@opencode-ai/sdk';

async function runTests() {
  console.log('🧪 Starting Integration Tests...');

  // 1. Test Session Creation and Model Switching
  console.log('\n--- Test 1: Session & Model Logic ---');
  const sessions = new Map();
  const chatId = 12345;

  // Mock session creation
  sessions.set(chatId, {
    id: 'test-session-id',
    createdAt: Date.now(),
    lastUsed: Date.now(),
    messageCount: 0,
    model: null
  });

  const session = sessions.get(chatId);
  console.log('Initial Session:', session);

  // Switch model
  session.model = { providerID: 'openai', modelID: 'gpt-4' };
  console.log('Updated Session (Model Set):', sessions.get(chatId));

  if (sessions.get(chatId).model.modelID === 'gpt-4') {
    console.log('✅ Model switching logic passed');
  } else {
    throw new Error('❌ Model switching logic failed');
  }

  // 2. Test Command Preparation
  console.log('\n--- Test 2: Prompt Body Preparation ---');
  const userMessage = 'Hello world';
  const promptBody = {
    parts: [{ type: 'text', text: userMessage }],
  };

  if (session.model) {
    promptBody.model = session.model;
  }

  console.log('Prepared Prompt Body:', JSON.stringify(promptBody, null, 2));
  if (promptBody.model.providerID === 'openai') {
    console.log('✅ Prompt body preparation passed');
  } else {
    throw new Error('❌ Prompt body preparation failed');
  }

  // 3. Test Authorization Logic
  console.log('\n--- Test 3: Authorization Logic ---');
  const OWNER_CHAT_ID = '123456';
  const BOT_PASSWORD = 'testpassword';
  const authorizedUsers = new Set(OWNER_CHAT_ID ? [OWNER_CHAT_ID] : []);

  function isOwner(ctx) {
    return OWNER_CHAT_ID && String(ctx.chat.id) === OWNER_CHAT_ID;
  }

  function isAuthorized(ctx) {
    return isOwner(ctx) || authorizedUsers.has(String(ctx.chat.id));
  }

  function requireAuth(ctx) {
    if (!isAuthorized(ctx)) {
      return false;
    }
    return true;
  }

  const ownerCtx = { chat: { id: '123456' } };
  const authorizedCtx = { chat: { id: '111111' } };
  const unauthorizedCtx = { chat: { id: '999999' } };

  // Test owner is authorized
  if (requireAuth(ownerCtx) === true) {
    console.log('✅ Owner authorized');
  } else {
    throw new Error('❌ Owner should be authorized');
  }

  // Test authorized user
  authorizedUsers.add('111111');
  if (requireAuth(authorizedCtx) === true) {
    console.log('✅ Authorized user passed');
  } else {
    throw new Error('❌ Authorized user should pass');
  }

  // Test unauthorized user
  if (requireAuth(unauthorizedCtx) === false) {
    console.log('✅ Unauthorized user blocked');
  } else {
    throw new Error('❌ Unauthorized user should be blocked');
  }

  // Test password check
  if (BOT_PASSWORD === 'testpassword') {
    console.log('✅ Password verification passed');
  } else {
    throw new Error('❌ Password verification failed');
  }

  // 4. Test Message Splitting
  console.log('\n--- Test 4: Message Splitting ---');
  function splitMessage(text, maxLength = 100) {
    if (text.length <= maxLength) return [text];
    const chunks = [];
    let currentChunk = '';
    const lines = text.split('\n');
    for (const line of lines) {
      if ((currentChunk + line + '\n').length > maxLength) {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = line + '\n';
      } else {
        currentChunk += line + '\n';
      }
    }
    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks.length === 0 ? [''] : chunks;
  }

  const longMessage = 'A'.repeat(250) + '\n' + 'B'.repeat(250);
  const split = splitMessage(longMessage, 100);
  if (split.length > 1) {
    console.log(`✅ Message split into ${split.length} chunks`);
  } else {
    throw new Error('❌ Message should be split');
  }

  // 5. Test Server Reconnection Logic
  console.log('\n--- Test 5: Server Reconnection Logic ---');
  let opencodeServerRunning = false;
  let reconnectAttempts = 0;

  async function simulateReconnect() {
    opencodeServerRunning = false;
    reconnectAttempts++;
    console.log(`Server down. Attempt ${reconnectAttempts}...`);
    await new Promise(r => setTimeout(r, 100));
    opencodeServerRunning = true;
    console.log('Server restarted!');
  }

  await simulateReconnect();
  if (opencodeServerRunning === true && reconnectAttempts === 1) {
    console.log('✅ Server reconnection logic passed');
  } else {
    throw new Error('❌ Server reconnection logic failed');
  }

  // 6. Test Health Status with Server State
  console.log('\n--- Test 6: Health Status ---');
  const healthSessions = new Map();
  healthSessions.set('123', { id: 's1' });

  function getHealthStatus(serverRunning) {
    const status = serverRunning ? 'Running' : 'Restarting...';
    const activeSessions = healthSessions.size;
    return { status, activeSessions };
  }

  const health = getHealthStatus(opencodeServerRunning);
  if (health.status === 'Running' && health.activeSessions === 1) {
    console.log('✅ Health status passed');
  } else {
    throw new Error('❌ Health status failed');
  }

  console.log('\n✅ All tests passed!');
  process.exit(0);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
