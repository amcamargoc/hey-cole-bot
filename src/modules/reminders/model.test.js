import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { createReminder, getReminderById, getReminders, getDueReminders, updateReminder, deleteReminder, completeReminder, logDelivery, getStreakCount } from './model.js';
import { closeDb } from './model.js';

// Use in-memory database for testing
process.env.NODE_ENV = 'test';

test('createReminder creates a one-time reminder', (t) => {
  const now = Math.floor(Date.now() / 1000);
  const reminder = createReminder('Test reminder', now + 3600, null);
  
  assert.strictEqual(reminder.message, 'Test reminder');
  assert.strictEqual(reminder.recurrence, null);
  assert.strictEqual(reminder.status, 'active');
});

test('createReminder creates a daily recurring reminder', (t) => {
  const reminder = createReminder('Daily task', Math.floor(Date.now() / 1000), 'daily');
  
  assert.strictEqual(reminder.recurrence, 'daily');
});

test('createReminder creates a weekly recurring reminder', (t) => {
  const reminder = createReminder('Weekly task', Math.floor(Date.now() / 1000), 'weekly');
  
  assert.strictEqual(reminder.recurrence, 'weekly');
});

test('getReminderById returns reminder by ID', (t) => {
  const created = createReminder('Find me', Math.floor(Date.now() / 1000), null);
  const found = getReminderById(created.id);
  
  assert.strictEqual(found.id, created.id);
  assert.strictEqual(found.message, 'Find me');
});

test('getReminderById returns null for non-existent ID', (t) => {
  const found = getReminderById(99999);
  
  assert.strictEqual(found, null);
});

test('getReminders returns all active reminders', (t) => {
  createReminder('Active 1', Math.floor(Date.now() / 1000), null);
  createReminder('Active 2', Math.floor(Date.now() / 1000), null);
  
  const reminders = getReminders();
  
  assert.ok(reminders.length >= 2);
  assert.ok(reminders.every(r => r.status === 'active'));
});

test('getDueReminders returns reminders that are due', (t) => {
  const pastTime = Math.floor(Date.now() / 1000) - 100;
  const futureTime = Math.floor(Date.now() / 1000) + 3600;
  
  createReminder('Due now', pastTime, null);
  createReminder('Due later', futureTime, null);
  
  const due = getDueReminders(Math.floor(Date.now() / 1000));
  
  assert.ok(due.some(r => r.message === 'Due now'));
  assert.ok(!due.some(r => r.message === 'Due later'));
});

test('updateReminder updates message', (t) => {
  const reminder = createReminder('Original', Math.floor(Date.now() / 1000), null);
  
  const updated = updateReminder(reminder.id, { message: 'Updated' });
  
  assert.strictEqual(updated.message, 'Updated');
});

test('updateReminder updates reminder_time', (t) => {
  const reminder = createReminder('Test', Math.floor(Date.now() / 1000), null);
  const newTime = Math.floor(Date.now() / 1000) + 7200;
  
  const updated = updateReminder(reminder.id, { reminder_time: newTime });
  
  assert.strictEqual(updated.reminder_time, newTime);
});

test('updateReminder updates recurrence', (t) => {
  const reminder = createReminder('Test', Math.floor(Date.now() / 1000), null);
  
  const updated = updateReminder(reminder.id, { recurrence: 'daily' });
  
  assert.strictEqual(updated.recurrence, 'daily');
});

test('deleteReminder soft deletes a reminder', (t) => {
  const reminder = createReminder('To delete', Math.floor(Date.now() / 1000), null);
  
  const deleted = deleteReminder(reminder.id);
  
  assert.strictEqual(deleted, true);
  
  const found = getReminderById(reminder.id);
  assert.strictEqual(found.status, 'deleted');
});

test('completeReminder marks reminder as completed', (t) => {
  const reminder = createReminder('Complete me', Math.floor(Date.now() / 1000), null);
  
  const completed = completeReminder(reminder.id);
  
  assert.strictEqual(completed.status, 'completed');
  assert.ok(completed.completed_at !== null);
});

test('logDelivery creates delivery log', (t) => {
  const reminder = createReminder('Log test', Math.floor(Date.now() / 1000), null);
  
  const log = logDelivery(reminder.id, 'delivered');
  
  assert.strictEqual(log.reminder_id, reminder.id);
  assert.strictEqual(log.status, 'delivered');
});

test('getStreakCount returns 0 for no logs', (t) => {
  const reminder = createReminder('Streak test', Math.floor(Date.now() / 1000), 'daily');
  
  const streak = getStreakCount(reminder.id);
  
  assert.strictEqual(streak, 0);
});

test('getStreakCount calculates streak from logs', (t) => {
  const reminder = createReminder('Streak calc', Math.floor(Date.now() / 1000), 'daily');
  
  // Log multiple deliveries within 24h window
  const now = Math.floor(Date.now() / 1000);
  logDelivery(reminder.id, 'delivered');
  logDelivery(reminder.id, 'delivered');
  logDelivery(reminder.id, 'delivered');
  
  const streak = getStreakCount(reminder.id);
  
  assert.ok(streak >= 1);
});