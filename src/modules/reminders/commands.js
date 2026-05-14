import { Markup } from 'telegraf';
import { 
  createReminder, 
  getReminders, 
  getReminderById,
  deleteReminder, 
  updateReminder,
  completeReminder,
  getStreakCount
} from './model.js';
import { startScheduler, isSchedulerRunning } from './scheduler.js';

let botInstance = null;
let ownerChatId = null;

/**
 * Setup reminder commands
 * @param {Telegraf} bot - The Telegraf bot instance
 * @param {number} chatId - The owner's chat ID
 */
export function setupReminderCommands(bot, chatId) {
  botInstance = bot;
  ownerChatId = chatId;
  
  // Start scheduler
  startScheduler(bot, chatId);

  // /remind - Create a reminder
  bot.command('remind', async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    
    if (args.length === 0) {
      return ctx.reply(`📝 *Reminder Commands:*\n\n` +
        `/remind <message> at <time> - One-time reminder\n` +
        `/remind daily <message> - Daily reminder at 9am\n` +
        `/remind weekly <message> - Weekly reminder on Sunday at 11:30pm\n\n` +
        `*Time formats:*\n` +
        `• 24-hour: 7:00, 19:30, 0 (midnight), 23:59\n` +
        `• 12-hour: 7am, 7pm, 12am (midnight), 12pm (noon)\n` +
        `• Day + time: monday 9am, friday 19:00\n` +
        `• tomorrow 7am\n\n` +
        `Examples:\n` +
        `/remind Drink water at 7am\n` +
        `/remind Call mom at 19:00\n` +
        `/remind daily Take vitamins\n` +
        `/remind weekly Review goals`,
        { parse_mode: 'Markdown' }
      );
    }
    
    const subcommand = args[0].toLowerCase();
    
    // /remind daily <message>
    if (subcommand === 'daily') {
      const message = args.slice(1).join(' ');
      if (!message) return ctx.reply('❌ Please provide a message.');
      
      // Default to 9am today (or tomorrow if passed)
      const now = new Date();
      let reminderTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0);
      if (reminderTime.getTime() <= Date.now()) {
        reminderTime.setDate(reminderTime.getDate() + 1);
      }
      
      const reminder = createReminder(message, Math.floor(reminderTime.getTime() / 1000), 'daily');
      return ctx.reply(`✅ *Daily reminder created!*\n\n` +
        `Message: ${message}\n` +
        `Time: ${formatTime(reminder.reminder_time)}\n` +
        `ID: \`${reminder.id}\``,
        { parse_mode: 'Markdown' }
      );
    }
    
    // /remind weekly <message>
    if (subcommand === 'weekly') {
      const message = args.slice(1).join(' ');
      if (!message) return ctx.reply('❌ Please provide a message.');
      
      // Default to Sunday 23:30
      const now = new Date();
      let reminderTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 30, 0);
      const dayOfWeek = reminderTime.getDay();
      const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
      reminderTime.setDate(reminderTime.getDate() + daysUntilSunday);
      
      const reminder = createReminder(message, Math.floor(reminderTime.getTime() / 1000), 'weekly');
      return ctx.reply(`✅ *Weekly reminder created!*\n\n` +
        `Message: ${message}\n` +
        `Time: ${formatTime(reminder.reminder_time)}\n` +
        `ID: \`${reminder.id}\``,
        { parse_mode: 'Markdown' }
      );
    }
    
    // /remind <message> at <time>
    const atIndex = args.indexOf('at');
    if (atIndex !== -1 && atIndex < args.length - 1) {
      const message = args.slice(0, atIndex).join(' ');
      const timeStr = args.slice(atIndex + 1).join(' ');
      
      const reminderTime = parseTime(timeStr);
      if (!reminderTime) {
        return ctx.reply('❌ Invalid time format. Try: 7am, 7:00am, tomorrow 7am, monday 9am');
      }
      
      const reminder = createReminder(message, reminderTime, null);
      return ctx.reply(`✅ *Reminder created!*\n\n` +
        `Message: ${message}\n` +
        `Time: ${formatTime(reminder.reminder_time)}\n` +
        `ID: \`${reminder.id}\``,
        { parse_mode: 'Markdown' }
      );
    }
    
    // Default: Create a one-time reminder for tomorrow 9am
    const message = args.join(' ');
    const now = new Date();
    let reminderTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0);
    
    const reminder = createReminder(message, Math.floor(reminderTime.getTime() / 1000), null);
    return ctx.reply(`✅ *Reminder created!*\n\n` +
      `Message: ${message}\n` +
      `Time: ${formatTime(reminder.reminder_time)} (tomorrow 9am default)\n` +
      `ID: \`${reminder.id}\``,
      { parse_mode: 'Markdown' }
    );
  });

  // /reminders - List all reminders
  bot.command('reminders', async (ctx) => {
    const reminders = getReminders();
    
    if (reminders.length === 0) {
      return ctx.reply('📭 No active reminders.');
    }
    
    let response = `🔔 *Your Reminders:*\n\n`;
    for (const reminder of reminders) {
      const streak = reminder.recurrence ? getStreakCount(reminder.id) : null;
      const streakText = streak !== null && streak > 0 ? ` 🔥${streak}` : '';
      const recurText = reminder.recurrence ? ` (${reminder.recurrence})` : '';
      response += `• \`${reminder.id}\` ${reminder.message}${recurText}${streakText}\n`;
      response += `  Next: ${formatTime(reminder.reminder_time)}\n\n`;
    }
    
    return ctx.reply(response, { parse_mode: 'Markdown' });
  });

  // /remind delete <id>
  bot.command('remind_delete', async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    const id = parseInt(args[0], 10);
    
    if (!id) {
      return ctx.reply('❌ Please provide a reminder ID.\nUsage: `/remind delete <id>`', { parse_mode: 'Markdown' });
    }
    
    const reminder = getReminderById(id);
    if (!reminder) {
      return ctx.reply(`❌ Reminder #${id} not found.`);
    }
    
    deleteReminder(id);
    return ctx.reply(`🗑️ Reminder #${id} deleted.`);
  });

  // /remind edit <id> <new message>
  bot.command('remind_edit', async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    const id = parseInt(args[0], 10);
    
    if (!id || args.length < 2) {
      return ctx.reply('❌ Please provide a reminder ID and new message.\nUsage: `/remind edit <id> <new message>`', { parse_mode: 'Markdown' });
    }
    
    const reminder = getReminderById(id);
    if (!reminder) {
      return ctx.reply(`❌ Reminder #${id} not found.`);
    }
    
    const newMessage = args.slice(1).join(' ');
    updateReminder(id, { message: newMessage });
    return ctx.reply(`✅ Reminder #${id} updated to:\n\n${newMessage}`);
  });

  // /remind done <id>
  bot.command('remind_done', async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    const id = parseInt(args[0], 10);
    
    if (!id) {
      return ctx.reply('❌ Please provide a reminder ID.\nUsage: `/remind done <id>`', { parse_mode: 'Markdown' });
    }
    
    const reminder = getReminderById(id);
    if (!reminder) {
      return ctx.reply(`❌ Reminder #${id} not found.`);
    }
    
    completeReminder(id);
    const streak = getStreakCount(id);
    
    return ctx.reply(`✅ Marked #${id} as completed!\n🔥 Streak: ${streak} day${streak > 1 ? 's' : ''}`);
  });
}

// Helper: Parse time string to Unix timestamp
function parseTime(timeStr) {
  const now = new Date();
  const lower = timeStr.toLowerCase();
  
  // Handle 24-hour format: "19:00", "7:00", "19", "07"
  const time24Match = lower.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (time24Match) {
    let hours = parseInt(time24Match[1], 10);
    const minutes = time24Match[2] ? parseInt(time24Match[2], 10) : 0;
    
    // Validate 24-hour range (0-23)
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      const result = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
      if (result.getTime() <= Date.now()) {
        result.setDate(result.getDate() + 1);
      }
      return Math.floor(result.getTime() / 1000);
    }
    return null;
  }
  
  // Handle 12-hour format with am/pm: "7am", "7:00am", "7pm", "7:30pm"
  const timeMatch = lower.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const period = timeMatch[3];
    
    if (period === 'pm' && hours < 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    
    // For 12-hour without period, default to PM if > 6, otherwise AM (optional, but let's require am/pm for clarity)
    // Actually, let's require am/pm for 12-hour format to avoid ambiguity
    if (!period && hours < 12) return null;
    
    const result = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
    if (result.getTime() <= Date.now()) {
      result.setDate(result.getDate() + 1);
    }
    return Math.floor(result.getTime() / 1000);
  }
  
  // Handle "tomorrow 19:00" (24-hour)
  if (lower.startsWith('tomorrow ')) {
    const rest = lower.replace('tomorrow ', '');
    const match24 = rest.match(/^(\d{1,2})(?::(\d{2}))?$/);
    if (match24) {
      let hours = parseInt(match24[1], 10);
      const minutes = match24[2] ? parseInt(match24[2], 10) : 0;
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        const result = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hours, minutes, 0);
        return Math.floor(result.getTime() / 1000);
      }
    }
    // Handle "tomorrow 7am"
    const match = rest.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2] ? parseInt(match[2], 10) : 0;
      const period = match[3];
      
      if (period === 'pm' && hours < 12) hours += 12;
      if (period === 'am' && hours === 12) hours = 0;
      
      const result = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hours, minutes, 0);
      return Math.floor(result.getTime() / 1000);
    }
  }
  
  // Handle day names with 24-hour: "monday 19:00", "tuesday 9:00"
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < days.length; i++) {
    if (lower.startsWith(days[i])) {
      const rest = lower.replace(days[i] + ' ', '');
      
      // Try 24-hour first
      const match24 = rest.match(/^(\d{1,2})(?::(\d{2}))?$/);
      if (match24) {
        let hours = parseInt(match24[1], 10);
        const minutes = match24[2] ? parseInt(match24[2], 10) : 0;
        if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
          let targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
          let daysUntil = i - now.getDay();
          if (daysUntil <= 0) daysUntil += 7;
          targetDate.setDate(targetDate.getDate() + daysUntil);
          return Math.floor(targetDate.getTime() / 1000);
        }
      }
      
      // Try 12-hour with am/pm
      const match = rest.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
      if (match) {
        let hours = parseInt(match[1], 10);
        const minutes = match[2] ? parseInt(match[2], 10) : 0;
        const period = match[3];
        
        if (period === 'pm' && hours < 12) hours += 12;
        if (period === 'am' && hours === 12) hours = 0;
        
        let targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
        let daysUntil = i - now.getDay();
        if (daysUntil <= 0) daysUntil += 7;
        targetDate.setDate(targetDate.getDate() + daysUntil);
        
        return Math.floor(targetDate.getTime() / 1000);
      }
    }
  }
  
  return null;
}

// Helper: Format Unix timestamp to readable string
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

export default { setupReminderCommands };