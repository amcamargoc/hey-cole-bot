import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  isOwner, 
  isAuthorized, 
  validatePassword, 
  recordFailedAuthAttempt, 
  checkAuthRateLimit,
  getRemainingAttempts
} from './auth.js';

// We need to set up environment for testing
process.env.OWNER_CHAT_ID = '12345';
process.env.BOT_PASSWORD = 'StrongPassword123!';

test('isOwner correctly identifies owner', (t) => {
  const ctx = { chat: { id: 12345 } };
  assert.strictEqual(isOwner(ctx), true);
  
  const otherCtx = { chat: { id: 67890 } };
  assert.strictEqual(isOwner(otherCtx), false);
});

test('validatePassword correctly validates', (t) => {
  assert.strictEqual(validatePassword('StrongPassword123!'), true);
  assert.strictEqual(validatePassword('wrong'), false);
});

test('auth rate limiting and lockout', (t) => {
  const chatId = 999;
  
  // Initial state
  assert.strictEqual(checkAuthRateLimit(chatId), true);
  assert.strictEqual(getRemainingAttempts(chatId), 3);
  
  // 3 failed attempts
  recordFailedAuthAttempt(chatId);
  assert.strictEqual(getRemainingAttempts(chatId), 2);
  
  recordFailedAuthAttempt(chatId);
  assert.strictEqual(getRemainingAttempts(chatId), 1);
  
  recordFailedAuthAttempt(chatId);
  assert.strictEqual(getRemainingAttempts(chatId), 0);
  
  // Should be locked out
  assert.strictEqual(checkAuthRateLimit(chatId), false);
});
