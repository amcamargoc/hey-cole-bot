import { opencodeClient, opencodeServerRunning } from './opencode.js';
import { sessionToChatId, sessions, getSessionKey } from './session.js';
import { logger } from './logger.js';

let bot = null;
let running = false;
let pollerInterval = null;

const TUI_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export const pendingTuiQuestions = new Map(); // chatId -> { request, timestamp }

export function setBot(botInstance) {
  bot = botInstance;
}

export function isRunning() {
  return running;
}

export async function startPoller() {
  if (running || !opencodeServerRunning || !opencodeClient) {
    logger.warn('TUI', 'Cannot start poller: server not running or client not available');
    return false;
  }

  running = true;
  logger.info('TUI', 'Starting TUI Control Poller...');
  
  pollLoop();
  return true;
}

export function stopPoller() {
  running = false;
  if (pollerInterval) {
    clearTimeout(pollerInterval);
    pollerInterval = null;
  }
  logger.info('TUI', 'TUI Control Poller stopped');
}

async function pollLoop() {
  if (!running) return;

  try {
    if (!opencodeClient) {
      scheduleNextPoll(2000);
      return;
    }

    const result = await opencodeClient.tui.control.next();
    
    if (result?.data) {
      await handleTuiRequest(result.data);
    }
  } catch (err) {
    // Handle empty queue or no more questions - common, not an error
    const isEmptyQueue = err.message?.includes('no more') || 
                      err.message?.includes('empty') || 
                      err.code === 404;
    
    // Handle timeout errors - these are common when server is slow
    const isTimeout = err.name?.includes('Timeout') || 
                    err.message?.includes('Headers Timeout') ||
                    err.message?.includes('HeadersTimeoutError') ||
                    err.cause?.name?.includes('Timeout');
    
    if (isEmptyQueue || isTimeout) {
      // No pending questions or timeout - normal, continue polling with backoff
      scheduleNextPoll(isTimeout ? 3000 : 1500);
      return;
    }
    
    // Log other unexpected errors
    logger.warn('TUI', 'Polling error (will retry)', err);
    scheduleNextPoll(5000); // Back off on unexpected errors
    return;
  }

  scheduleNextPoll(1000);
}

function scheduleNextPoll(delay) {
  if (!running) return;
  pollerInterval = setTimeout(pollLoop, delay);
}

async function handleTuiRequest(request) {
  const sessionId = request.body?.sessionID || request.sessionID;
  const chatId = sessionId ? sessionToChatId.get(sessionId) : null;

  if (!chatId) {
    logger.warn('TUI', `No chatId found for session ${sessionId}`);
    if (bot) {
      await bot.telegram.sendMessage(
        process.env.OWNER_CHAT_ID, 
        '❌ TUI request but session not found. Session may have expired.'
      );
    }
    return;
  }

  const question = request.body?.question || request.question || 'Continue?';
  const options = request.body?.options || request.options || [];
  const requestId = request.id || request.body?.id || Date.now().toString();
  
  // Sanitize requestId to prevent callback data injection
  const safeId = requestId.replace(/[:|]/g, '_').substring(0, 32);

  logger.interact(`"${question}"`, `chat ${chatId}`);

  pendingTuiQuestions.set(chatId, {
    requestId,
    safeId,
    sessionId,
    question,
    options,
    timestamp: Date.now()
  });

  const timeoutMsg = `\n\n⏱️ *Timeout:* Auto-cancel in 5 minutes.`;
  
  if (!bot) {
    logger.error('TUI', 'No bot instance available');
    return;
  }

  if (options && options.length > 0) {
    const keyboard = {
      reply_markup: {
        inline_keyboard: options.map((opt, idx) => [
          { text: opt.label || opt, callback_data: `tui_resp:${safeId}:${idx}` }
        ])
      }
    };
    
    // Add Skip button
    keyboard.reply_markup.inline_keyboard.push([
      { text: '⏭️ Skip', callback_data: `tui_resp:${safeId}:skip` }
    ]);

    await bot.telegram.sendMessage(
      chatId,
      `🎯 *Question*\n\n${question}${timeoutMsg}`,
      { parse_mode: 'Markdown', ...keyboard }
    );
  } else {
    // Free-form text input
    await bot.telegram.sendMessage(
      chatId,
      `🎯 *Question*\n\n${question}${timeoutMsg}\n\n_Reply with your answer._`,
      { parse_mode: 'Markdown' }
    );
  }

  // Set up auto-timeout
  setTimeout(async () => {
    const pending = pendingTuiQuestions.get(chatId);
    if (pending && pending.requestId === requestId) {
      pendingTuiQuestions.delete(chatId);
      await bot.telegram.sendMessage(
        chatId,
        '⏭️ *Timed out*\n\nYour response was not received in time. The session has been canceled.',
        { parse_mode: 'Markdown' }
      );
      await submitResponse(requestId, 'timeout', chatId);
    }
  }, TUI_TIMEOUT_MS);
}

export async function submitResponse(requestId, response, chatId) {
  if (!opencodeClient) {
    logger.error('TUI', 'No OpenCode client to submit response');
    return false;
  }

  try {
    const body = typeof response === 'object' ? response : { answer: response };
    
    await opencodeClient.tui.control.response({
      path: { id: requestId },
      body
    });

    logger.interact(`"${response}"`, `User responded chat ${chatId}`);
    pendingTuiQuestions.delete(chatId);
    return true;
  } catch (err) {
    logger.error('TUI', `Failed to submit response for ${requestId}`, err);
    return false;
  }
}

export function hasPendingQuestion(chatId) {
  return pendingTuiQuestions.has(chatId);
}

export function getPendingQuestion(chatId) {
  return pendingTuiQuestions.get(chatId);
}

export function clearPendingQuestion(chatId) {
  pendingTuiQuestions.delete(chatId);
}

// Check if there's a pending free-form question (no options)
export function hasPendingFreeformQuestion(chatId) {
  const pending = pendingTuiQuestions.get(chatId);
  return pending && (!pending.options || pending.options.length === 0);
}

// Submit TUI response - handles both button clicks and free-form text
export async function submitTuiResponse(client, chatId, response) {
  const pending = pendingTuiQuestions.get(chatId);
  if (!pending) {
    return false;
  }
  
  return await submitResponse(pending.requestId, response, chatId);
}