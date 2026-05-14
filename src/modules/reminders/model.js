import db from './db.js';

/**
 * Reminder Model - CRUD operations for reminders
 */

// Create a new reminder
// @param {string} message - The reminder message
// @param {number} reminderTime - Unix timestamp (seconds)
// @param {string|null} recurrence - null, 'daily', 'weekly'
// @returns {object} The created reminder
export function createReminder(message, reminderTime, recurrence = null) {
  const stmt = db.prepare(`
    INSERT INTO reminders (message, reminder_time, recurrence)
    VALUES (?, ?, ?)
  `);
  const result = stmt.run(message, reminderTime, recurrence);
  return getReminderById(result.lastInsertRowid);
}

// Get reminder by ID
// @param {number} id - Reminder ID
// @returns {object|null} The reminder or null
export function getReminderById(id) {
  const stmt = db.prepare('SELECT * FROM reminders WHERE id = ?');
  return stmt.get(id) || null;
}

// Get all active reminders
// @returns {array} Array of active reminders
export function getReminders() {
  const stmt = db.prepare(`
    SELECT * FROM reminders 
    WHERE status = 'active' 
    ORDER BY reminder_time ASC
  `);
  return stmt.all();
}

// Get all reminders (including completed)
// @returns {array} Array of all reminders
export function getAllReminders() {
  const stmt = db.prepare('SELECT * FROM reminders ORDER BY reminder_time ASC');
  return stmt.all();
}

// Get reminders due before a given timestamp
// @param {number} timestamp - Unix timestamp (seconds)
// @returns {array} Array of due reminders
export function getDueReminders(timestamp) {
  const stmt = db.prepare(`
    SELECT * FROM reminders 
    WHERE status = 'active' 
    AND reminder_time <= ?
    ORDER BY reminder_time ASC
  `);
  return stmt.all(timestamp);
}

// Update a reminder
// @param {number} id - Reminder ID
// @param {object} updates - Object with fields to update
// @returns {object|null} The updated reminder
export function updateReminder(id, updates) {
  const fields = [];
  const values = [];
  
  if (updates.message !== undefined) {
    fields.push('message = ?');
    values.push(updates.message);
  }
  if (updates.reminder_time !== undefined) {
    fields.push('reminder_time = ?');
    values.push(updates.reminder_time);
  }
  if (updates.recurrence !== undefined) {
    fields.push('recurrence = ?');
    values.push(updates.recurrence);
  }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  
  if (fields.length === 0) return getReminderById(id);
  
  fields.push('updated_at = strftime(\'%s\', \'now\')');
  values.push(id);
  
  const stmt = db.prepare(`
    UPDATE reminders 
    SET ${fields.join(', ')}
    WHERE id = ?
  `);
  stmt.run(...values);
  return getReminderById(id);
}

// Delete a reminder (soft delete)
// @param {number} id - Reminder ID
// @returns {boolean} Success
export function deleteReminder(id) {
  const stmt = db.prepare(`
    UPDATE reminders 
    SET status = 'deleted', updated_at = strftime('%s', 'now')
    WHERE id = ?
  `);
  const result = stmt.run(id);
  return result.changes > 0;
}

// Mark reminder as completed
// @param {number} id - Reminder ID
// @returns {object|null} The completed reminder
export function completeReminder(id) {
  const stmt = db.prepare(`
    UPDATE reminders 
    SET status = 'completed', completed_at = strftime('%s', 'now'), updated_at = strftime('%s', 'now')
    WHERE id = ?
  `);
  stmt.run(id);
  return getReminderById(id);
}

// Record a delivery (for tracking and recurring rescheduling)
// @param {number} reminderId - Reminder ID
// @param {string} status - 'delivered', 'failed'
// @returns {object} The created log
export function logDelivery(reminderId, status = 'delivered') {
  const stmt = db.prepare(`
    INSERT INTO reminder_logs (reminder_id, status)
    VALUES (?, ?)
  `);
  const result = stmt.run(reminderId, status);
  
  const logStmt = db.prepare('SELECT * FROM reminder_logs WHERE id = ?');
  return logStmt.get(result.lastInsertRowid);
}

// Get streak count for a recurring reminder
// @param {number} reminderId - Reminder ID
// @returns {number} Streak count (consecutive days)
export function getStreakCount(reminderId) {
  const stmt = db.prepare(`
    SELECT * FROM reminder_logs 
    WHERE reminder_id = ? AND status = 'delivered'
    ORDER BY delivered_at DESC
  `);
  const logs = stmt.all(reminderId);
  
  if (logs.length === 0) return 0;
  
  let streak = 0;
  const now = Math.floor(Date.now() / 1000);
  const daySeconds = 24 * 60 * 60;
  
  // Simple streak: consecutive日志 entries within 24h window
  for (let i = 0; i < logs.length; i++) {
    if (i === 0) {
      streak = 1;
    } else {
      const prevTime = logs[i - 1].delivered_at;
      const currTime = logs[i].delivered_at;
      if (prevTime - currTime <= daySeconds) {
        streak++;
      } else {
        break;
      }
    }
  }
  
  return streak;
}

// Close database connection
export function closeDb() {
  db.close();
}