import { createReminder } from './model.js';

/**
 * Format Unix timestamp to readable string
 */
function formatTime(timestamp) {
  const date = new Date(timestamp * 1000);
  const options = { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric', 
    hour: 'numeric', 
    minute: '2-digit' 
  };
  return date.toLocaleDateString('en-US', options);
}

/**
 * Parse time string to Unix timestamp
 */
function parseTime(timeStr) {
  const now = new Date();
  const lower = timeStr.toLowerCase();
  
  // 24-hour format
  const time24Match = lower.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (time24Match) {
    let hours = parseInt(time24Match[1], 10);
    const minutes = time24Match[2] ? parseInt(time24Match[2], 10) : 0;
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      const result = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
      if (result.getTime() <= Date.now()) result.setDate(result.getDate() + 1);
      return Math.floor(result.getTime() / 1000);
    }
    return null;
  }
  
  // 12-hour format
  const timeMatch = lower.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const period = timeMatch[3];
    if (period === 'pm' && hours < 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    if (!period && hours < 12) return null; // Ambiguous
    
    const result = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
    if (result.getTime() <= Date.now()) result.setDate(result.getDate() + 1);
    return Math.floor(result.getTime() / 1000);
  }
  
  // today X or at X today
  if (lower.startsWith('today ')) {
    const rest = lower.replace('today ', '');
    const match = rest.match(/^(\d{1,2})(?::(\d{2}))?$/);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2] ? parseInt(match[2], 10) : 0;
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        const result = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
        if (result.getTime() <= Date.now()) result.setDate(result.getDate() + 1);
        return Math.floor(result.getTime() / 1000);
      }
    }
  }

  // at X today
  if (lower.startsWith('at ')) {
    const rest = lower.replace('at ', '');
    const match = rest.match(/^(\d{1,2})(?::(\d{2}))?$/);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2] ? parseInt(match[2], 10) : 0;
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        const result = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
        if (result.getTime() <= Date.now()) result.setDate(result.getDate() + 1);
        return Math.floor(result.getTime() / 1000);
      }
    }
  }

  // tomorrow X
  if (lower.startsWith('tomorrow ')) {
    const rest = lower.replace('tomorrow ', '');
    const match = rest.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2] ? parseInt(match[2], 10) : 0;
      if (match[3] === 'pm' && hours < 12) hours += 12;
      const result = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hours, minutes, 0);
      return Math.floor(result.getTime() / 1000);
    }
  }
  
  // day names
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < days.length; i++) {
    if (lower.startsWith(days[i])) {
      const rest = lower.replace(days[i] + ' ', '');
      const match = rest.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
      if (match) {
        let hours = parseInt(match[1], 10);
        if (match[3] === 'pm' && hours < 12) hours += 12;
        let targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, match[2] ? parseInt(match[2], 10) : 0, 0);
        let daysUntil = i - now.getDay();
        if (daysUntil <= 0) daysUntil += 7;
        targetDate.setDate(targetDate.getDate() + daysUntil);
        return Math.floor(targetDate.getTime() / 1000);
      }
    }
  }
  
  return null;
}

/**
 * Check if a message suggests creating a reminder (always returns false - AI decides)
 * Now simpler: we just pass to AI and let it decide
 */
export function looksLikeReminder(text) {
  // Don't auto-detect anymore - let AI handle it
  // Return true for specific keywords only
  const lower = text.toLowerCase().trim();
  if (lower.startsWith('remind me') || lower.startsWith('remind:') || lower.startsWith('reminder:')) {
    return true;
  }
  return false;
}

/**
 * Try to create a reminder from a message using AI logic
 * This is called from the AI itself when it detects user wants a reminder
 */
export async function createReminderFromAI(message, timeStr) {
  try {
    const reminderTime = parseTime(timeStr);
    
    if (reminderTime) {
      const reminder = createReminder(message, reminderTime, null);
      return { 
        created: true, 
        reminderId: reminder.id,
        message: `✅ *Reminder created!*\n\n"${message}"\nTime: ${formatTime(reminder.reminder_time)}\nID: \`${reminder.id}\``,
        error: null
      };
    }
    
    return { created: false, reminderId: null, message: null, error: 'Could not parse time: ' + timeStr };
  } catch (err) {
    return { created: false, reminderId: null, message: null, error: err.message };
  }
}

/**
 * Try to create a recurring reminder from AI
 */
export async function createRecurringReminderFromAI(message, recurrence) {
  try {
    const now = new Date();
    let reminderTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0);
    if (reminderTime.getTime() <= Date.now()) {
      reminderTime.setDate(reminderTime.getDate() + 1);
    }
    
    const reminder = createReminder(message, Math.floor(reminderTime.getTime() / 1000), recurrence);
    const recurText = recurrence === 'daily' ? 'Daily' : 'Weekly';
    
    return { 
      created: true, 
      reminderId: reminder.id,
      message: `✅ *${recurText} reminder created!*\n\n"${message}"\nTime: ${formatTime(reminder.reminder_time)}\nID: \`${reminder.id}\``,
      error: null
    };
  } catch (err) {
    return { created: false, reminderId: null, message: null, error: err.message };
  }
}