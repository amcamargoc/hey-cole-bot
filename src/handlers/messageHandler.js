import { requireAuth } from '../middleware/auth.js';
import { sessions, sessionToChatId, checkRateLimit, ongoingPrompts, getSessionKey, getActiveProject } from '../services/session.js';
import { opencodeClient, opencodeServerRunning } from '../services/opencode.js';
import { isValidMessage, splitMessage } from '../utils.js';
import { getVerifierModel } from '../config/models.js';
import { logger } from '../services/logger.js';

export const DEFAULT_SYSTEM_PROMPT = `You are "El Coleto", a high-energy, vibrant, and brazenly honest personal assistant from the Colombian Caribbean coast. 🇨🇴🥥
Your voice is informal but sharp, energetic, and completely "sin vergüenza" (shameless) when it comes to the truth.

Your primary goal is to be a **Direct Strategic Partner**. You don't just agree; you make the user think and reflect.

### 🎭 Your Personality
- **Zero Filter**: If an idea is poor, reckless, or a messy shortcut, say it plainly. Do not sugar-coat your feedback.
- **High Energy**: Use vibrant language and emojis (🍍, 🥥, ⚡) to keep the vibe high.
- **Radical Candor**: Be brazenly honest. Challenge the user to be better.

### 🚀 Advanced Use Cases
1. **Todo & Execution Plans**:
   - Maintain a \`todos.md\` file in the current project directory using bash tools.
   - For every new todo, you MUST create an **Execution Plan** (3-5 actionable sub-steps).
2. **Idea Validation (Challenge Mode)**:
   - When the user shares a new idea, you MUST play devil's advocate.
   - Ask 3 critical, tough questions that make the user reflect before you agree to start work.
3. **GitHub Delegation**:
   - Use the native GitHub MCP tools for all GitHub operations.
   - "Delegate" by identifying collaborators and assigning issues or drafting technical specs as comments.
4. **Bi-weekly Planning**:
   - Offer to run 14-day roadmap sessions based on existing \`todos.md\` and Calendar events.

### 🛠️ Available Tools
1. **GitHub**: Use native MCP tools for repos, issues, and PRs.
2. **Google Workspace**: Calendar/Gmail actions via \`node src/skills/google.js [events|emails|create-event|send-email]\`.
3. **Bash**: File system management and git operations.

### 📜 Rules for Interaction
1. **Directness First**: Lead with your honest assessment, then provide the solution.
2. **Safety Guard**: NEVER delete repositories or close issues without explicit confirmation.
3. **File System**: rm is blocked. Use it to organize the project responsibly.
4. **Accuracy**: If writing code, provide complete, working examples.`;

const MAX_MESSAGE_LENGTH = 4000;

export async function handleMessage(ctx) {
  if (!requireAuth(ctx)) return;
  if (!opencodeServerRunning) {
    await ctx.reply('⏳ OpenCode server is restarting. Please try again in a few seconds.');
    return;
  }

  const chatId = ctx.chat.id;
  const userMessage = ctx.message.text;

  // Validate input
  if (!isValidMessage(userMessage)) return;

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
        throw new Error(`Failed to create session: ${session.error?.message || 'Unknown error'}`);
      }

      sessionId = session.data.id;
      sessionData = {
        id: sessionId,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        messageCount: 0,
        model: null,
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        precisionMode: false
      };
      sessions.set(sessionKey, sessionData);
      sessionToChatId.set(sessionId, chatId);
    } else {
      sessionId = sessionData.id;
      sessionData.lastUsed = Date.now();
      sessionData.messageCount++;
    }

    const promptBody = {
      parts: [{ type: 'text', text: userMessage }],
      system: DEFAULT_SYSTEM_PROMPT,
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
      ctx.replyWithChatAction('typing').catch(() => {});
    }, 4000);

    // Placeholder: Zero-silence feedback
    let placeholderMsg = await ctx.reply('🥥 _Let it cook..._', { parse_mode: 'Markdown' });

    let result;
    const startTime = Date.now();
    try {
      result = await opencodeClient.session.prompt({
        path: { id: sessionId },
        body: promptBody,
      });
    } catch (err) {
      clearInterval(typingInterval);
      logger.error('PROMPT', `OpenCode prompt error for chat ${chatId}`, err);
      const isTimeout = err.message?.includes('timeout') || err.message?.includes('Timeout') || err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET';
      const errMsg = isTimeout 
        ? '⏱️ Request timed out. The task may be too complex. Try a simpler request or /abort first.'
        : '🛑 Failed to communicate with OpenCode. Try again later.';
      
      await ctx.telegram.editMessageText(chatId, placeholderMsg.message_id, null, errMsg);
      return;
    }

    if (result.error) {
       clearInterval(typingInterval);
       logger.error('PROMPT', `OpenCode Error result for chat ${chatId}: ${result.error.message}`);
       await ctx.telegram.editMessageText(chatId, placeholderMsg.message_id, null, `❌ *OpenCode Error:* ${result.error.message}`, { parse_mode: 'Markdown' });
       return;
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info('PROMPT', `Draft completed in ${duration}s for chat ${chatId}`);

    const messageId = result.data?.info?.id;
    if (messageId) ongoingPrompts.set(chatId, messageId);

    let responseText = result.data?.parts?.filter(part => part.type === 'text')?.map(part => part.text)?.join('')?.trim() || 'Processing...';

    // Precision Mode Verification: Dual-Brain Cross-Check
    if (sessionData.precisionMode && responseText !== 'Processing...') {
      try {
        const verifier = getVerifierModel(sessionData.model);
        logger.verify(verifier.modelID, `Starting cross-check for chat ${chatId}`);
        
        await ctx.telegram.editMessageText(chatId, placeholderMsg.message_id, null, `🔍 _Cross-checking with ${verifier.modelID === 'gemini-3-flash' ? '🍍' : '🥥'}..._`, { parse_mode: 'Markdown' });
        
        const verifierPrompt = `Review and correct the following response for accuracy, safety, and logic. Output ONLY the final best version without any meta-commentary:\n\n${responseText}`;
        const verifierSession = await opencodeClient.session.create({ body: { title: `Verifier ${chatId}` } });
        
        const vStartTime = Date.now();
        const verifyResult = await opencodeClient.session.prompt({ 
          path: { id: verifierSession.data.id }, 
          body: { 
            parts: [{ type: 'text', text: verifierPrompt }],
            system: "You are a professional verifier assistant. Cross-check the response from another model and ensure it is perfect.",
            model: verifier
          } 
        });
        
        const vDuration = ((Date.now() - vStartTime) / 1000).toFixed(1);
        logger.info('VERIFY', `Verification completed in ${vDuration}s`);

        const verifiedText = verifyResult.data?.parts?.filter(part => part.type === 'text')?.map(part => part.text)?.join('')?.trim();
        if (verifiedText) responseText = verifiedText;
        await opencodeClient.session.delete({ path: { id: verifierSession.data.id } }).catch(() => {});
      } catch (verifyErr) {
        logger.error('VERIFY', 'Verification failed', verifyErr);
        await ctx.reply('⚠️ *Verification failed. Returning original draft.*', { parse_mode: 'Markdown' });
      }
    }

    clearInterval(typingInterval);

    // Final Delivery
    const parts = splitMessage(responseText);
    
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
    console.error('Error in handleMessage:', error);
    await ctx.reply(`❌ Error: ${error.message}`);
  }
}
