import test from 'node:test';
import assert from 'node:assert/strict';
import * as sessionModule from '../services/session.js';
import * as opencodeModule from '../services/opencode.js';

// Mock bot
const mockBot = {
  start: (handler) => { mockBot.startHandler = handler; },
  command: (name, handler) => { mockBot.commands[name] = handler; },
  action: (regex, handler) => { mockBot.actions.push({ regex, handler }); },
  commands: {},
  actions: []
};

// Mock dependencies
const mockOpencodeClient = {
  provider: {
    list: async () => ({ data: [{ id: 'openai', name: 'OpenAI', models: { 'gpt-4': { name: 'GPT-4' } } }] })
  },
  session: {
    create: async () => ({ data: { id: 'test-session-id' } }),
    prompt: async () => ({ data: { parts: [{ type: 'text', text: 'Response' }] } })
  }
};

// Run command handler tests (removed skip after fixing template literals)
test('setup commands', async () => {
  const { setupCommands } = await import('./commandHandler.js');
  setupCommands(mockBot);
  assert.ok(mockBot.commands['project']);
});

test('/project command updates active project', async (t) => {
  const chatId = 1234567;
  const ctx = {
    chat: { id: chatId },
    from: { first_name: 'Beto' },
    message: { text: '/project my-cool-project' },
    reply: (msg) => { ctx.lastReply = msg; }
  };

  // Skip auth for test (manually authorize)
  const authModule = await import('../middleware/auth.js');
  authModule.authorizeUser(chatId);

  await mockBot.commands['project'](ctx);
  
  const activeProj = sessionModule.getActiveProject(chatId);
  assert.strictEqual(activeProj, 'my-cool-project');
  assert.ok(ctx.lastReply.includes('my-cool-project'));
});

test('/models command attempts to list tiers', async (t) => {
  const chatId = 1234567;
  
  // Inject mock client via the new setter
  opencodeModule.setOpencodeClient(mockOpencodeClient);

  const ctx = {
    chat: { id: chatId },
    replyWithChatAction: () => {},
    reply: async (msg) => { ctx.lastReply = msg; return { catch: () => {} }; }
  };

  await mockBot.commands['models'](ctx);
  
  // Verify it tried to fetch models
  assert.ok(ctx.lastReply.includes('Select a Brain'));
});

test('settier action updates session model', async (t) => {
  const chatId = 1234567;
  const ctx = {
    chat: { id: chatId },
    match: [null, 'smart'],
    answerCbQuery: async () => {},
    editMessageText: async (msg) => { ctx.lastEdit = msg; }
  };

  const sessionKey = sessionModule.getSessionKey(chatId);
  sessionModule.sessions.set(sessionKey, { id: 'test-session', model: null });

  const settierAction = mockBot.actions.find(a => a.regex.toString().includes('settier'));
  await settierAction.handler(ctx);

  const session = sessionModule.sessions.get(sessionKey);
  assert.strictEqual(session.model.modelID, 'minimax-m2.5-free');
  assert.ok(ctx.lastEdit.includes('Smart'));
});

test('/health command shows status', async (ctx) => {
  const testCtx = {
    chat: { id: 1234567 },
    reply: (msg) => { testCtx.lastReply = msg; }
  };

  await mockBot.commands['health'](testCtx);
  assert.ok(testCtx.lastReply.includes('Status:'));
});