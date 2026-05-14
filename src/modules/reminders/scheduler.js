import cron from 'node-cron';
import { 
  getDueReminders, 
  updateReminder, 
  logDelivery,
  getStreakCount 
} from './model.js';
import { opencodeClient } from '../../services/opencode.js';
import { logger } from '../../services/logger.js';
import { loadAllContext } from '../../utils/memory.js';

const NOTIFICATION_MODEL = null; // Use default model

let scheduler = null;
let botInstance = null;
let isRunning = false;
let ownerChatId = null;

/**
 * Initialize and start the scheduler
 * @param {Telegraf} bot - The Telegraf bot instance
 * @param {number} chatId - The owner's chat ID for deliveries
 */
export function startScheduler(bot, chatId) {
  if (isRunning) {
    console.log('⚠️ Reminder scheduler already running');
    return;
  }

  botInstance = bot;
  ownerChatId = chatId;

  // Run every minute
  scheduler = cron.schedule('* * * * *', async () => {
    console.log('🔔 SCHEDULER: Running check...');
    console.log('🔔 opencodeClient type:', typeof opencodeClient);
    console.log('🔔 opencodeClient value:', opencodeClient);
    
    const now = Math.floor(Date.now() / 1000);
    const dueReminders = getDueReminders(now);
    
    logger.info('SCHEDULER', `Checking for due reminders at ${new Date().toISOString()}`);
    logger.info('SCHEDULER', `Found ${dueReminders.length} due reminders`);

    for (const reminder of dueReminders) {
      try {
        logger.info('SCHEDULER', `Processing reminder #${reminder.id} through LLM with memory`);
        
        const streak = reminder.recurrence ? getStreakCount(reminder.id) : null;
        let notificationMessage = reminder.message;
        let llmSuccess = false;
        
        // Preload memory context
        const memoryContext = loadAllContext();
        
        if (opencodeClient) {
          logger.info('SCHEDULER', `opencodeClient available, proceeding with LLM call`);
          // First attempt
          try {
            logger.info('SCHEDULER', `LLM attempt 1 for reminder #${reminder.id}`);
            
            const session = await opencodeClient.session.create({
              body: { title: `Notification-${reminder.id}` }
            });

            const streakNote = streak !== null && streak > 0 
              ? `\nDay ${streak} of this recurring scheduled note.` 
              : '';

            const prompt = `You are a smart news digest. Process this scheduled note for the user.

SCHEDULED NOTE:
"${reminder.message}"
${streakNote}

USER CONTEXT:
${memoryContext || 'No additional context available'}

Transform into a concise, actionable smart note:
- Key info (2-3 bullets)
- Action item if applicable
- Keep under 150 words
- Be direct and practical`;

            logger.info('SCHEDULER', `Sending prompt to LLM for #${reminder.id}...`);

            const result = await opencodeClient.session.prompt({
              path: { id: session.data.id },
              body: {
                parts: [{ type: 'text', text: prompt }],
                system: 'You are a smart note formatter. Transform scheduled notes into concise, actionable digests.',
                ...(NOTIFICATION_MODEL && { model: NOTIFICATION_MODEL })
              }
            });

            await opencodeClient.session.delete({ path: { id: session.data.id } }).catch(() => {});

            const llmResponse = result?.data?.parts?.filter(p => p.type === 'text')?.map(p => p.text)?.join('').trim();
            if (llmResponse) {
              notificationMessage = llmResponse;
              llmSuccess = true;
              logger.info('SCHEDULER', `LLM response received for #${reminder.id}`);
            }
          } catch (llmErr) {
            logger.error('SCHEDULER', `LLM attempt 1 failed for #${reminder.id}`, llmErr.message);
            logger.error('SCHEDULER', `LLM Error details:`, {
              code: llmErr.code,
              status: llmErr.status,
              response: llmErr.response,
              stack: llmErr.stack?.split('\n').slice(0, 3).join('\n')
            });
            
            // Retry once
            try {
              logger.info('SCHEDULER', `LLM attempt 2 (retry) for reminder #${reminder.id}`);
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
              
              const session = await opencodeClient.session.create({
                body: { title: `Notification-retry-${reminder.id}` }
              });

              const prompt = `You are a smart news digest. Process this scheduled note for the user.

SCHEDULED NOTE:
"${reminder.message}"

USER CONTEXT:
${memoryContext || 'No additional context available'}

Transform into a concise, actionable smart note (under 150 words):`;

              const result = await opencodeClient.session.prompt({
                path: { id: session.data.id },
                body: {
                  parts: [{ type: 'text', text: prompt }],
                  system: 'You are a smart note formatter. Transform scheduled notes into concise, actionable digests.',
                  ...(NOTIFICATION_MODEL && { model: NOTIFICATION_MODEL })
                }
              });

              await opencodeClient.session.delete({ path: { id: session.data.id } }).catch(() => {});

              const llmResponse = result?.data?.parts?.filter(p => p.type === 'text')?.map(p => p.text)?.join('').trim();
              if (llmResponse) {
                notificationMessage = llmResponse;
                llmSuccess = true;
                logger.info('SCHEDULER', `LLM retry succeeded for #${reminder.id}`);
              }
            } catch (retryErr) {
              logger.error('SCHEDULER', `LLM retry also failed for #${reminder.id}`, retryErr.message);
            }
          }
        } else {
          logger.warn('SCHEDULER', 'opencodeClient not available, using raw message');
        }
        
        // Determine what to send
        let finalMessage;
        if (llmSuccess) {
          finalMessage = `📬 *Smart Note:*\n\n${notificationMessage}`;
          if (streak !== null && streak > 0) {
            finalMessage += `\n\n🔥 Day ${streak}`;
          }
        } else {
          finalMessage = `⚠️ Scheduled task notification failed\n\nOriginal: ${reminder.message}`;
          logger.error('SCHEDULER', `Both LLM attempts failed for #${reminder.id}, sent failure message`);
        }

        await botInstance.telegram.sendMessage(ownerChatId, finalMessage, { parse_mode: 'Markdown' });
        
        // Log delivery
        logDelivery(reminder.id, llmSuccess ? 'delivered' : 'delivered_failed_llm');
        logger.info('SCHEDULER', `Reminder #${reminder.id} delivered successfully`);

        // Handle recurrence
        if (reminder.recurrence === 'daily') {
          const nextTime = reminder.reminder_time + (24 * 60 * 60);
          updateReminder(reminder.id, { reminder_time: nextTime });
          logger.info('SCHEDULER', `Rescheduled daily reminder #${reminder.id} for ${new Date(nextTime * 1000).toISOString()}`);
        } else if (reminder.recurrence === 'weekly') {
          const nextTime = reminder.reminder_time + (7 * 24 * 60 * 60);
          updateReminder(reminder.id, { reminder_time: nextTime });
          logger.info('SCHEDULER', `Rescheduled weekly reminder #${reminder.id} for ${new Date(nextTime * 1000).toISOString()}`);
        } else {
          updateReminder(reminder.id, { status: 'completed' });
          logger.info('SCHEDULER', `Marked one-time reminder #${reminder.id} as completed`);
        }

      } catch (err) {
        logger.error('SCHEDULER', `Failed to deliver reminder #${reminder.id}`, err.message);
        logDelivery(reminder.id, 'failed');
      }
    }
  });

  isRunning = true;
  console.log('⏰ Reminder scheduler started with LLM processing + memory context');
}

/**
 * Stop the scheduler
 */
export function stopScheduler() {
  if (scheduler) {
    scheduler.stop();
    scheduler = null;
    isRunning = false;
    console.log('⏰ Reminder scheduler stopped');
  }
}

/**
 * Check if scheduler is running
 * @returns {boolean}
 */
export function isSchedulerRunning() {
  return isRunning;
}

export default { startScheduler, stopScheduler, isSchedulerRunning };