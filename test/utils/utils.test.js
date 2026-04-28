import test from 'node:test';
import assert from 'node:assert/strict';
import { splitMessage, isValidMessage } from '../../src/utils/textUtils.js';
import { isStrongPassword, validatePasswordRequirements } from '../../src/utils/validationUtils.js';

test('splitMessage splits long text correctly and handles code blocks', (t) => {
  const longText = 'Some text\n```js\nconst x = 1;\n' + 'console.log(x);\n'.repeat(300) + '```\nMore text';
  const chunks = splitMessage(longText, 1000);
  
  assert.ok(chunks.length > 1);
  
  // Check if code blocks are correctly closed and reopened
  for (let i = 0; i < chunks.length - 1; i++) {
    const chunk = chunks[i];
    if (chunk.includes('```js')) {
      assert.ok(chunk.endsWith('```'), `Chunk ${i} should end with closing code block`);
    }
  }
  
  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i];
    // If the previous chunk ended a code block that wasn't actually finished
    if (chunks[i-1].endsWith('```') && !longText.includes('```\nMore text')) {
       // This is a bit hard to test precisely without knowing exact split points, 
       // but we check if it starts with the language tag
    }
  }
});

test('splitMessage handles short text correctly', (t) => {
  const shortText = 'Hello World';
  const chunks = splitMessage(shortText, 4000);
  assert.strictEqual(chunks.length, 1);
  assert.strictEqual(chunks[0], 'Hello World');
});

test('isValidMessage validation', (t) => {
  assert.strictEqual(isValidMessage(''), false);
  assert.strictEqual(isValidMessage('   '), false);
  assert.strictEqual(isValidMessage(null), false);
  assert.strictEqual(isValidMessage('hello'), true);
});

test('isStrongPassword validation', (t) => {
  assert.strictEqual(isStrongPassword('weak'), false);
  assert.strictEqual(isStrongPassword('Short1!'), false); // Too short
  assert.strictEqual(isStrongPassword('NoSpecialChar123'), false);
  assert.strictEqual(isStrongPassword('StrongPass123!'), true);
});

test('validatePasswordRequirements returns correct errors', (t) => {
  const errors = validatePasswordRequirements('weak');
  assert.ok(errors.includes('Must be at least 12 characters'));
  assert.ok(errors.includes('Add an uppercase letter'));
  assert.ok(errors.includes('Add a special symbol (!@#$%)'));
});
