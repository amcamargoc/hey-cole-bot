import { requireAuth } from '../middleware/auth.js';
import { sessions, sessionToChatId, checkRateLimit, ongoingPrompts, getSessionKey, getActiveProject } from '../services/session.js';
import { opencodeClient, opencodeServerRunning } from '../services/opencode.js';
import { isValidMessage, splitMessage, cleanMarkdownForTelegram } from '../utils.js';
import { getVerifierModel } from '../config/models.js';
import { logger } from '../services/logger.js';
import { hasPendingFreeformQuestion, submitTuiResponse } from '../services/tuiControl.js';
import { loadAllContext } from '../utils/memory.js';

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
2. **Bot Feature Boundaries**: You are an assistant with built-in features. DO NOT modify your own source code to change your behavior unless explicitly in "Developer Mode" and tasked with "developing the bot".
3. **Command Awareness**: If a user mentions a feature like "precision", "models", or "projects", they are referring to your slash commands. Tell them to use the command or explain how it works.
4. **Whitelisted Workspaces**: You can freely create and edit files in "output/", "notes/", "docs/", and "data/" at any time.
5. **Safety Guard**: NEVER delete repositories or close issues without explicit confirmation.
6. **File System**: "rm" is blocked. Use it to organize the project responsibly.
7. **Accuracy**: If writing code, provide complete, working examples.
8. **Memory**: When the user shares personal info, preferences, or context worth remembering, update \`data/memory.md\` using bash tools to persist it. Keep it light.

### 📚 Bot Command Dictionary
  - \`/precision\`: Toggles "Deep Verification Mode" (Double Check).
  - \`/models\`: Selects the primary AI brain.
  - \`/project <name>\`: Switches the current folder context.
  - \`/dev\`: Toggles "Developer Mode" (Enabled editing of src/).
  - \`/new\`: Starts a fresh session.
  - \`/abort\`: Cancels the current generation.
  - \`/summarize\`: Condenses the conversation.
  - \`/undo\`: Reverts the last message.
  - \`/history\`: Shows session stats.
  - \`/health\`: Checks bot status.`;

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
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        precisionMode: false,
        developerMode: false,
        devModeStartedAt: null
      };
      sessions.set(sessionKey, sessionData);
      sessionToChatId.set(sessionId, chatId);
    } else {
      sessionId = sessionData.id;
      sessionData.lastUsed = Date.now();
      sessionData.messageCount++;
    }

    // Developer Mode Expiry Check (1 hour)
    const DEV_MODE_TIMEOUT = 60 * 60 * 1000;
    if (sessionData.developerMode && sessionData.devModeStartedAt) {
      if (Date.now() - sessionData.devModeStartedAt > DEV_MODE_TIMEOUT) {
        sessionData.developerMode = false;
        sessionData.devModeStartedAt = null;
        await ctx.reply('🔒 *Developer Mode Expired*\nCode-editing tools have been locked for safety. Use /dev to re-enable.', { parse_mode: 'Markdown' });
      }
    }

    const currentSystemPrompt = sessionData.developerMode 
      ? `${ DEFAULT_SYSTEM_PROMPT }${contextNote} \n\n⚠️ ** DEVELOPER MODE ACTIVE **: You have explicit permission to modify source code in \`src/\`. Use bash and file_edit tools responsibly.`
      : `${DEFAULT_SYSTEM_PROMPT}${contextNote}\n\n🔒 **DEVELOPER MODE DISABLED**: You are FORBIDDEN from modifying files in \`src/\`. If requested, explain that /dev mode must be enabled. You CAN still edit \`data/\`.`;

const promptBody = {
  parts: [{ type: 'text', text: userMessage }],
  system: currentSystemPrompt,
  tools: {
    "*": true
  }
};

// If Developer Mode is OFF, we could also try to explicitly disable dangerous tools 
// if the OpenCode provider supports it, or rely on the prompt + potential tool-call interception.
// For now, the system prompt reinforcement is the strongest guardrail supported by this client structure.

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

let result;
const startTime = Date.now();

result = await opencodeClient.session.prompt({
  path: { id: sessionId },
  body: promptBody,
});

if (result?.error) {
  clearInterval(typingInterval);
  logger.error('PROMPT', `OpenCode Error result for chat ${chatId}`, result.error);
  const errMsg = `❌ *OpenCode Error:* ${result.error.message}`;
  await ctx.telegram.editMessageText(chatId, placeholderMsg.message_id, null, errMsg, { parse_mode: 'Markdown' }).catch(() => {
    ctx.reply(errMsg, { parse_mode: 'Markdown' });
  });
  return;
}

const duration = ((Date.now() - startTime) / 1000).toFixed(1);
logger.info('PROMPT', `Draft completed in ${duration}s for chat ${chatId}`);

const messageId = result.data?.info?.id;
if (messageId) ongoingPrompts.set(chatId, messageId);

let responseText = result.data?.parts?.filter(part => part.type === 'text')?.map(part => part.text)?.join('')?.trim() || 'Processing...';

// Precision Mode Verification: Dual-Brain Cross-Check
if (sessionData.precisionMode && responseText !== 'Processing...') {
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

  const verifiedText = verifyResult?.data?.parts?.filter(part => part.type === 'text')?.map(part => part.text)?.join('')?.trim();
  if (verifiedText) responseText = verifiedText;
  await opencodeClient.session.delete({ path: { id: verifierSession.data.id } }).catch(() => { });
}

clearInterval(typingInterval);

// Final Delivery - clean markdown for Telegram before sending
const cleanText = cleanMarkdownForTelegram(responseText);
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
  console.error('Error in handleMessage:', error);
  await ctx.reply(`❌ Error: ${error.message}`);
}
}
