import { requireAuth } from '../middleware/auth.js';
import { sessions, sessionToChatId, checkRateLimit, ongoingPrompts, getSessionKey, getActiveProject, updateSession, updateSessionToChatMapping } from '../services/session.js';
import { opencodeClient, opencodeServerRunning } from '../services/opencode.js';
import { isValidMessage, splitMessage } from '../utils/textUtils.js';
import { cleanMarkdownForTelegram } from '../utils/markdownUtils.js';
import { getVerifierModel } from '../config/models.js';
import { promptLLM } from '../services/llmService.js';
import { logger } from '../services/logger.js';
import { hasPendingFreeformQuestion, submitTuiResponse } from '../services/tuiControl.js';
import { loadAllContext } from '../utils/memory.js';

import { buildSystemPrompt } from '../services/promptService.js';

const MAX_MESSAGE_LENGTH = 4000;

export async function handleMessage(ctx) {
  if (!requireAuth(ctx)) return;
  if (!opencodeServerRunning) {
    await ctx.reply('⏳ OpenCode server is restarting. Please try again in a few seconds.');
    return;
  }

  const chatId = ctx.chat.id;
  const userMessage = ctx.message.text;

  const contextData = loadAllContext();
  const contextNote = contextData ? `\n\n## 📁 DATA FOLDER CONTEXT\nThe following files are stored in the private \`data/\` folder (gitignored for security):\n${contextData}\n\nAlways read from \`data/\` for user's personal context, projects, tasks, and personal memories/research.` : '';

  // Validate input
  if (!isValidMessage(userMessage)) return;

  // Check if there's a pending free-form TUI question for this chat.
  // If so, treat this message as the answer instead of a new prompt.
  if (hasPendingFreeformQuestion(chatId)) {
    logger.interact(`Intercepted message as TUI answer for chat ${chatId}: "${userMessage.substring(0, 80)}"`);
    const success = await submitTuiResponse(opencodeClient, chatId, userMessage);
    if (success) {
      await ctx.reply('✅ _Answer received. Continuing..._', { parse_mode: 'Markdown' });
    } else {
      await ctx.reply('⚠️ _Failed to submit answer. The question may have expired._', { parse_mode: 'Markdown' });
    }
    return;
  }

  // Check rate limit
  if (!(await checkRateLimit(chatId))) {
    await ctx.reply('⏱️ Please wait a moment before sending another message.');
    return;
  }

  try {
    ctx.replyWithChatAction('typing');

    const sessionKey = getSessionKey(chatId);
    let sessionData = sessions.get(sessionKey);
    let sessionId;

    if (!sessionData) {
      const activeProject = getActiveProject(chatId);
      const session = await opencodeClient.session.create({
        body: { 
          title: `Hey Cole: ${activeProject} (${chatId})`
        },
      });

      if (!session.data || !session.data.id) {
        throw new Error(`Failed to create session: ${ session.error?.message || 'Unknown error' } `);
      }

      sessionId = session.data.id;
      sessionData = {
        id: sessionId,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        messageCount: 0,
        model: null,
        systemPrompt: buildSystemPrompt(false),
        precisionMode: false,
        developerMode: false,
        devModeStartedAt: null
      };
      updateSession(sessionKey, sessionData);
      updateSessionToChatMapping(sessionId, chatId);
    } else {
      sessionId = sessionData.id;
      sessionData.lastUsed = Date.now();
      sessionData.messageCount++;
      updateSession(sessionKey, sessionData);
    }

    // Developer Mode Expiry Check (1 hour)
    const DEV_MODE_TIMEOUT = 60 * 60 * 1000;
    if (sessionData.developerMode && sessionData.devModeStartedAt) {
      if (Date.now() - sessionData.devModeStartedAt > DEV_MODE_TIMEOUT) {
        sessionData.developerMode = false;
        sessionData.devModeStartedAt = null;
        updateSession(sessionKey, sessionData);
        await ctx.reply('🔒 *Developer Mode Expired*\nCode-editing tools have been locked for safety. Use /dev to re-enable.', { parse_mode: 'Markdown' });
      }
    }

    const currentSystemPrompt = buildSystemPrompt(sessionData.developerMode, contextNote);

    const promptBody = {
      parts: [{ type: 'text', text: userMessage }],
      system: currentSystemPrompt,
      tools: {
        "*": true
      }
    };

    if (sessionData.model) {
      promptBody.model = sessionData.model;
    }

    // Observability & Feedback
    logger.draft(sessionData.model?.modelID || 'default', `Processing message for chat ${chatId}`);

    // Pulse: Keep typing indicator alive
    await ctx.replyWithChatAction('typing');
    const typingInterval = setInterval(() => {
      ctx.replyWithChatAction('typing').catch(() => { });
    }, 4000);

    // Placeholder: Zero-silence feedback
    let placeholderMsg = await ctx.reply('🥥 _Let it cook..._', { parse_mode: 'Markdown' });

    try {
      const { text: responseText, messageId } = await promptLLM(
        sessionId,
        promptBody,
        sessionData.precisionMode,
        sessionData.model
      );

      clearInterval(typingInterval);
      if (messageId) ongoingPrompts.set(chatId, messageId);

      // Final Delivery - clean markdown for Telegram before sending
      const cleanText = cleanMarkdownForTelegram(responseText || 'No response generated.');
      const parts = splitMessage(cleanText);

      // Edit the placeholder with the first part
      if (parts.length > 0) {
        await ctx.telegram.editMessageText(chatId, placeholderMsg.message_id, null, parts[0], { parse_mode: 'Markdown' }).catch(async () => {
          // Fallback if markdown failing
          await ctx.telegram.editMessageText(chatId, placeholderMsg.message_id, null, parts[0]);
        });

        // Send remaining parts
        for (let i = 1; i < parts.length; i++) {
          await ctx.reply(parts[i], { parse_mode: 'Markdown' }).catch(() => {
            ctx.reply(parts[i]);
          });
        }
      }
    } catch (error) {
      clearInterval(typingInterval);
      logger.error('PROMPT', `Error processing prompt for chat ${chatId}`, error);
      const errMsg = `❌ *Error:* ${error.message}`;
      await ctx.telegram.editMessageText(chatId, placeholderMsg.message_id, null, errMsg, { parse_mode: 'Markdown' }).catch(() => {
        ctx.reply(errMsg, { parse_mode: 'Markdown' });
      });
    }
  } catch (error) {
  console.error('Error in handleMessage:', error);
  await ctx.reply(`❌ Error: ${error.message}`);
}
}
