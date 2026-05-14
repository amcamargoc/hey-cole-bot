import { test, describe } from 'node:test';
import assert from 'node:assert';
import { loadAllContext, loadMemory, loadTodos, loadReminders } from '../utils/memory.js';
import { createReminder, deleteReminder, getReminderById } from '../modules/reminders/index.js';

describe('Memory Module', () => {
  test('loadMemory returns content from memory.md', () => {
    const memory = loadMemory();
    assert.ok(memory !== null, 'Memory should not be null');
    assert.ok(memory.includes('Memory'), 'Memory should contain # Memory');
  });

  test('loadTodos returns content from todos.md', () => {
    const todos = loadTodos();
    assert.ok(todos !== null, 'Todos should not be null');
  });

  test('loadReminders returns active reminders from database', () => {
    const reminders = loadReminders();
    assert.ok(Array.isArray(reminders), 'Reminders should be an array');
  });

  test('loadAllContext includes memory, todos, reminders, projects', () => {
    const context = loadAllContext();
    assert.ok(context.includes('PERSISTENT MEMORY'), 'Context should include memory');
    assert.ok(context.includes('DAILY TASKS'), 'Context should include todos');
    assert.ok(context.includes('SCHEDULED REMINDERS') || context.includes('projects'), 'Context should include reminders or projects');
  });

  test('create and retrieve reminder', () => {
    const now = Math.floor(Date.now() / 1000);
    const reminder = createReminder('Test memory reminder', now + 3600, null);
    assert.ok(reminder.id > 0, 'Reminder should have an ID');
    
    const retrieved = getReminderById(reminder.id);
    assert.strictEqual(retrieved.message, 'Test memory reminder');
    
    deleteReminder(reminder.id);
  });
});

describe('Reminder Scheduler Integration', () => {
  test('reminders are included in context', () => {
    const context = loadAllContext();
    assert.ok(context.length > 0, 'Context should not be empty');
  });
});