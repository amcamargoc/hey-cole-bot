import test from 'node:test';
import assert from 'node:assert/strict';
import { looksLikeReminder } from './detector.js';

test('looksLikeReminder detects explicit reminder keywords', (t) => {
  assert.strictEqual(looksLikeReminder('remind me to drink water'), true);
  assert.strictEqual(looksLikeReminder('remind: buy groceries'), true);
  assert.strictEqual(looksLikeReminder('reminder: call mom'), true);
});

test('looksLikeReminder rejects normal messages', (t) => {
  assert.strictEqual(looksLikeReminder('hello how are you?'), false);
  assert.strictEqual(looksLikeReminder('verify'), false);
  assert.strictEqual(looksLikeReminder('drink water at 7am'), false);
  assert.strictEqual(looksLikeReminder('call mom at 19:00'), false);
});

test('looksLikeReminder is case insensitive', (t) => {
  assert.strictEqual(looksLikeReminder('REMIND ME to do something'), true);
  assert.strictEqual(looksLikeReminder('Remind: something'), true);
});