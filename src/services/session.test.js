import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  getSessionKey, 
  getActiveProject, 
  switchProject, 
  sessions,
  cleanupOldSessions,
  SESSION_TIMEOUT
} from './session.js';

test('project switching and session keys', (t) => {
  const chatId = 'user123';
  
  // Default project
  assert.strictEqual(getActiveProject(chatId), 'main');
  assert.strictEqual(getSessionKey(chatId), 'user123:main');
  
  // Switch project
  switchProject(chatId, 'ai-bot');
  assert.strictEqual(getActiveProject(chatId), 'ai-bot');
  assert.strictEqual(getSessionKey(chatId), 'user123:ai-bot');
  
  // Different user should still be on main
  assert.strictEqual(getActiveProject('other'), 'main');
});

test('session cleanup', (t) => {
  const key = 'test:key';
  sessions.set(key, { lastUsed: Date.now() - SESSION_TIMEOUT - 1000 });
  
  assert.strictEqual(sessions.has(key), true);
  cleanupOldSessions();
  assert.strictEqual(sessions.has(key), false);
});
