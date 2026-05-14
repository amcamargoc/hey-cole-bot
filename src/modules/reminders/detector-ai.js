import { opencodeClient } from '../../services/opencode.js';
import { createReminderFromAI } from './detector.js';
import { logger } from '../../services/logger.js';

const DETECTION_MODEL = 'gemini-2-flash';

export async function detectAndCreateReminder(userMessage, chatId) {
  const detectionPrompt = `You are a reminder detector. Analyze this message and determine if the user wants to set a reminder or be reminded about something.

Message: "${userMessage}"

Respond with ONLY a JSON object (no other text):
- If it's a reminder request: {"detected": true, "reminderMessage": "what to remind", "timeExpression": "when to remind"}
- If NOT a reminder: {"detected": false}

Examples:
- "in 10 seconds, say hello" → {"detected": true, "reminderMessage": "say hello", "timeExpression": "in 10 seconds"}
- "recuerdame comprar leche mañana" → {"detected": true, "reminderMessage": "comprar leche", "timeExpression": "tomorrow"}
- "dime hola en 2 min" → {"detected": true, "reminderMessage": "decir hola", "timeExpression": "in 2 min"}
- "hola como estas" → {"detected": false}`;

  try {
    const session = await opencodeClient.session.create({
      body: { title: `ReminderDetector-${chatId}` }
    });

    const result = await opencodeClient.session.prompt({
      path: { id: session.data.id },
      body: {
        parts: [{ type: 'text', text: detectionPrompt }],
        system: 'You are a JSON-only assistant. Always respond with valid JSON.',
        model: DETECTION_MODEL
      }
    });

    await opencodeClient.session.delete({ path: { id: session.data.id } }).catch(() => {});

    const responseText = result?.data?.parts?.filter(p => p.type === 'text')?.map(p => p.text)?.join('').trim();
    
    if (!responseText) {
      return null;
    }

    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      logger.error('DETECT', 'Failed to parse AI detection response', responseText);
      return null;
    }

    if (!parsed.detected) {
      return null;
    }

    logger.info('DETECT', `Reminder detected: "${parsed.reminderMessage}" at "${parsed.timeExpression}"`);

    const reminderResult = await createReminderFromAI(parsed.reminderMessage, parsed.timeExpression);
    
    return reminderResult;

  } catch (err) {
    logger.error('DETECT', 'Reminder detection failed', err.message);
    return null;
  }
}