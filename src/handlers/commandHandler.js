import { Markup } from 'telegraf';
import { requireAuth, authorizeUser, validatePassword, checkAuthRateLimit, recordFailedAuthAttempt, getAuthLockoutRemaining, getRemainingAttempts } from '../middleware/auth.js';
import { sessions, getSessionKey, getActiveProject, switchProject } from '../services/session.js';
import { opencodeClient, opencodeServerRunning } from '../services/opencode.js';
import { DEFAULT_SYSTEM_PROMPT } from './messageHandler.js';
import { TIERS, DEFAULT_TIER } from '../config/models.js';
import { submitTuiResponse, getPendingQuestion } from '../services/tuiControl.js';

export function setupCommands(bot) {
  bot.start(async (ctx) => {
    if (!requireAuth(ctx)) return;
    const firstName = ctx.from.first_name || 'there';
    await ctx.reply(
      `Hi ${firstName}! 👋 I'm Hey Cole, your Elite Personal Assistant.\n\n` +
      `I can help with coding, brainstorming, scheduling, and more.\n\n` +
      `Available commands:\n` +
      `/project <name> - Switch to or create a project context\n` +
      `/models - Select AI model\n` +
      `/precision - Toggle Deep Verification Mode\n` +
      `/new - Start a new session (current project)\n` +
      `/abort - Cancel current generation\n` +
      `/summarize - Summarize conversation\n` +
      `/undo - Revert last message\n` +
      `/history - Show session info\n` +
      `/health - Check bot status`
    );
  });

  bot.command('project', async (ctx) => {
    if (!requireAuth(ctx)) return;
    const args = ctx.message.text.split(' ').slice(1);
    const projectName = args[0];

    if (!projectName) {
      const current = getActiveProject(ctx.chat.id);
      return ctx.reply(`📂 *Current Project:* \`${current}\`\n\nTo switch, use: \`/project <name>\``, { parse_mode: 'Markdown' });
    }

    const cleanName = projectName.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!cleanName) return ctx.reply('❌ Invalid project name.');

    switchProject(ctx.chat.id, cleanName);
    await ctx.reply(`🔄 Switched to project: *${cleanName}*\nConversation context is now isolated to this project.`, { parse_mode: 'Markdown' });
  });

  bot.command('models', async (ctx) => {
    if (!requireAuth(ctx)) return;
    if (!opencodeServerRunning) return ctx.reply('⏳ OpenCode server is restarting. Please try again in a few seconds.');
    
    const buttons = Object.values(TIERS).map(tier => ([
      Markup.button.callback(`${tier.name} - ${tier.description}`, `settier:${tier.id}`)
    ]));

    await ctx.reply(
      `🤖 *Select a Brain for El Coleto:*\n\n` +
      `Choose a model based on your needs ($0 budget).`, 
      { 
        parse_mode: 'Markdown', 
        ...Markup.inlineKeyboard(buttons) 
      }
    );
  });

  bot.action(/settier:(.+)/, async (ctx) => {
    if (!requireAuth(ctx)) return;
    const tierId = ctx.match[1];
    const tier = TIERS[tierId.toUpperCase()] || DEFAULT_TIER;
    const chatId = ctx.chat.id;
    const sessionKey = getSessionKey(chatId);

    let sessionData = sessions.get(sessionKey);
    if (!sessionData) {
      const activeProject = getActiveProject(chatId);
      const session = await opencodeClient.session.create({ body: { title: `Hey Cole: ${activeProject} (${chatId})` } });
      sessionData = { id: session.data.id, createdAt: Date.now(), lastUsed: Date.now(), messageCount: 0, model: null, precisionMode: false, developerMode: false, devModeStartedAt: null };
      sessions.set(sessionKey, sessionData);
    }
    
    sessionData.model = { providerID: tier.providerID, modelID: tier.modelID };
    sessionData.lastUsed = Date.now();

    await ctx.answerCbQuery();
    await ctx.editMessageText(`✅ Brain set to: *${tier.name}*\n\nMode: ${tier.description}`, { parse_mode: 'Markdown' });
  });

  bot.action(/allow_perm:(.+):(.+)/, async (ctx) => {
    if (!requireAuth(ctx)) return;
    try {
      await opencodeClient.postSessionIdPermissionsPermissionId({
        path: { id: ctx.match[1], permissionID: ctx.match[2] },
        body: { response: 'allow' }
      });
      await ctx.answerCbQuery('✅ Action allowed');
      await ctx.editMessageText(ctx.callbackQuery.message.text + '\n\n✅ *Status: Allowed*', { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Permission reply error:', err);
      await ctx.answerCbQuery('❌ Failed to send reply');
    }
  });

  bot.action(/deny_perm:(.+):(.+)/, async (ctx) => {
    if (!requireAuth(ctx)) return;
    try {
      await opencodeClient.postSessionIdPermissionsPermissionId({
        path: { id: ctx.match[1], permissionID: ctx.match[2] },
        body: { response: 'deny' }
      });
      await ctx.answerCbQuery('❌ Action denied');
      await ctx.editMessageText(ctx.callbackQuery.message.text + '\n\n❌ *Status: Denied*', { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Permission reply error:', err);
      await ctx.answerCbQuery('❌ Failed to send reply');
    }
  });

  // TUI Control response handler — user tapped an inline button for an interactive question
  bot.action(/tui_resp:(.+):(.+)/, async (ctx) => {
    if (!requireAuth(ctx)) return;
    const chatId = ctx.chat.id;
    const safeId = ctx.match[1];  // sanitized requestId
    const rawIndex = ctx.match[2];  // index or "skip"
    const index = decodeURIComponent(rawIndex);

    const pending = getPendingQuestion(chatId);
    if (!pending || pending.safeId !== safeId) {
      await ctx.answerCbQuery('⏱️ This question has expired');
      return;
    }

    try {
      let responseBody;

      if (index === 'skip') {
        responseBody = null;
        await ctx.answerCbQuery('⏭️ Skipped');
      } else {
        const optIndex = parseInt(index, 10);
        const selectedOption = pending.options?.[optIndex];
        responseBody = selectedOption?.value ?? selectedOption;
        await ctx.answerCbQuery(`✅ Selected: ${selectedOption?.label || index}`);
      }

      const success = await submitTuiResponse(opencodeClient, chatId, responseBody);

      if (success) {
        const selectedLabel = index === 'skip' ? 'Skipped' : (pending.options?.[parseInt(index, 10)]?.label || responseBody);
        await ctx.editMessageText(
          ctx.callbackQuery.message.text + `\n\n✅ *Response:* ${selectedLabel}`,
          { parse_mode: 'Markdown' }
        ).catch(() => {});
      } else {
        await ctx.editMessageText(
          ctx.callbackQuery.message.text + '\n\n⚠️ *Failed to send response*',
          { parse_mode: 'Markdown' }
        ).catch(() => {});
      }
    } catch (err) {
      console.error('TUI response handler error:', err);
      await ctx.answerCbQuery('❌ Failed to send response');
    }
  });

  bot.command('abort', async (ctx) => {
    if (!requireAuth(ctx)) return;
    if (!opencodeServerRunning) return ctx.reply('⏳ OpenCode server is restarting.');
    const sessionKey = getSessionKey(ctx.chat.id);
    const sessionData = sessions.get(sessionKey);
    if (!sessionData) return ctx.reply('❌ No active session.');
    try {
      await opencodeClient.session.abort({ path: { id: sessionData.id } });
      await ctx.reply('🛑 Generation aborted.');
    } catch (error) {
      await ctx.reply(`❌ Abort failed: ${error.message}`);
    }
  });

  bot.command('undo', async (ctx) => {
    if (!requireAuth(ctx)) return;
    if (!opencodeServerRunning) return ctx.reply('⏳ OpenCode server is restarting.');
    const sessionKey = getSessionKey(ctx.chat.id);
    const sessionData = sessions.get(sessionKey);
    if (!sessionData) return ctx.reply('❌ No active session.');
    try {
      await opencodeClient.session.revert({ path: { id: sessionData.id } });
      await ctx.reply('⏪ Last message reverted.');
    } catch (error) {
      await ctx.reply(`❌ Undo failed: ${error.message}`);
    }
  });

  bot.command('summarize', async (ctx) => {
    if (!requireAuth(ctx)) return;
    if (!opencodeServerRunning) return ctx.reply('⏳ OpenCode server is restarting.');
    const sessionKey = getSessionKey(ctx.chat.id);
    const sessionData = sessions.get(sessionKey);
    if (!sessionData) return ctx.reply('❌ No active session.');
    try {
      ctx.replyWithChatAction('typing');
      await opencodeClient.session.summarize({ 
        path: { id: sessionData.id },
        body: { providerID: sessionData.model?.providerID || 'default', modelID: sessionData.model?.modelID || 'default' }
      });
      await ctx.reply('📝 *Session Summary:* The session has been summarized in context.', { parse_mode: 'Markdown' });
    } catch (error) {
      await ctx.reply(`❌ Summarization failed: ${error.message}`);
    }
  });

  bot.command('new', async (ctx) => {
    if (!requireAuth(ctx)) return;
    const sessionKey = getSessionKey(ctx.chat.id);
    sessions.delete(sessionKey);
    await ctx.reply('🔄 Started a new session for current project!');
  });

  bot.command('clear', async (ctx) => {
    if (!requireAuth(ctx)) return;
    const sessionKey = getSessionKey(ctx.chat.id);
    sessions.delete(sessionKey);
    await ctx.reply('🗑️ Session cleared for current project!');
  });

  bot.command('help', async (ctx) => {
    if (!requireAuth(ctx)) return;
    await ctx.reply(
      `📚 *Available Commands:*\n\n` +
      `/help - Show this message\n` +
      `/project <name> - Switch context\n` +
      `/models - Select AI model\n` +
      `/new - Start a fresh session\n` +
      `/abort - Cancel current generation\n` +
      `/summarize - Summarize conversation\n` +
      `/undo - Revert last message\n` +
      `/clear - Clear current conversation\n` +
      `/history - Show session details\n` +
      `/system - View system prompt\n` +
      `/precision - Toggle deep verification\n` +
      `/dev - Toggle Developer (Code-Edit) Mode\n` +
      `/health - Check bot status\n` +
      `/start - Welcome message`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('precision', async (ctx) => {
    if (!requireAuth(ctx)) return;
    const sessionKey = getSessionKey(ctx.chat.id);
    const sessionData = sessions.get(sessionKey);
    if (!sessionData) return ctx.reply('❌ Send a message first to establish an active session.');
    sessionData.precisionMode = !sessionData.precisionMode;
    if (sessionData.precisionMode) {
      await ctx.reply('🎯 *Precision Mode: ON*\nYour future responses will now be double-checked by a secondary AI agent for maximum accuracy. Note: This will increase response time.', { parse_mode: 'Markdown' });
    } else {
      await ctx.reply('🚀 *Precision Mode: OFF*\nResponses will be generated instantly from the primary model.', { parse_mode: 'Markdown' });
    }
  });

  bot.command('dev', async (ctx) => {
    if (!requireAuth(ctx)) return;
    const sessionKey = getSessionKey(ctx.chat.id);
    const sessionData = sessions.get(sessionKey);
    if (!sessionData) return ctx.reply('❌ Send a message first to establish an active session.');
    
    sessionData.developerMode = !sessionData.developerMode;
    if (sessionData.developerMode) {
      sessionData.devModeStartedAt = Date.now();
      await ctx.reply('🛠️ *Developer Mode: ON*\nEl Coleto now has permission to modify the codebase. Use with caution! Mode will auto-expire in 1 hour.', { parse_mode: 'Markdown' });
    } else {
      sessionData.devModeStartedAt = null;
      await ctx.reply('🔒 *Developer Mode: OFF*\nCode-editing tools are now locked.', { parse_mode: 'Markdown' });
    }
  });

  bot.command('system', async (ctx) => {
    if (!requireAuth(ctx)) return;
    const sessionKey = getSessionKey(ctx.chat.id);
    const sessionData = sessions.get(sessionKey);
    const prompt = sessionData?.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    await ctx.reply(`🧠 *Current System Prompt:*\n\n\`\`\`\n${prompt}\n\`\`\``, { parse_mode: 'Markdown' });
  });

  bot.command('history', async (ctx) => {
    if (!requireAuth(ctx)) return;
    const sessionKey = getSessionKey(ctx.chat.id);
    const sessionData = sessions.get(sessionKey);
    if (!sessionData) return ctx.reply('📭 No active session. Send a message to start one.');
    const uptime = Math.floor((Date.now() - sessionData.createdAt) / 1000);
    const minutes = Math.floor(uptime / 60);
    const seconds = uptime % 60;
    try {
      await ctx.reply(
        `📊 *Session Info:*\n\n` +
        `Project: \`${getActiveProject(ctx.chat.id)}\`\n` +
        `Session ID: \`${sessionData.id.substring(0, 8)}...\`\n` +
        `Model: \`${sessionData.model ? sessionData.model.modelID : 'Default'}\`\n` +
        `Messages: ${sessionData.messageCount}\n` +
        `Uptime: ${minutes}m ${seconds}s`,
        { parse_mode: 'Markdown' }
      );
    } catch (e) {
      await ctx.reply(`📊 Session Info:\n\nProject: ${getActiveProject(ctx.chat.id)}\nSession ID: ${sessionData.id.substring(0, 8)}...\nModel: ${sessionData.model ? sessionData.model.modelID : 'Default'}\nMessages: ${sessionData.messageCount}\nUptime: ${minutes}m ${seconds}s`);
    }
  });

  bot.command('health', async (ctx) => {
    if (!requireAuth(ctx)) return;
    const activeSessions = sessions.size;
    if (!opencodeServerRunning || !opencodeClient) {
      return ctx.reply(`⚠️ Status: Starting...\nActive Sessions: ${activeSessions}`);
    }
    try {
      await opencodeClient.provider.list({ timeout: 5000 });
      await ctx.reply(`✅ Status: Running\nActive Sessions: ${activeSessions}\nServer: http://localhost:4096`);
    } catch (err) {
      await ctx.reply(`⚠️ Status: Server may be unresponsive\nActive Sessions: ${activeSessions}`);
    }
  });

  bot.command('myid', async (ctx) => ctx.reply(`Your chat ID: ${ctx.chat.id}`));

  bot.command('auth', async (ctx) => {
    const chatId = ctx.chat.id;
    
    // Check rate limit
    if (!checkAuthRateLimit(chatId)) {
      const lockoutTime = getAuthLockoutRemaining(chatId);
      return ctx.reply(`⏳ Too many failed attempts. Please try again in ${lockoutTime} seconds.`);
    }
    
    const args = ctx.message.text.split(' ').slice(1);
    const password = args[0];
    const hasPassword = process.env.BOT_PASSWORD;
    
    if (!hasPassword) {
      return ctx.reply('❌ No password configured. Set BOT_PASSWORD in .env to enable authorization.');
    }
    
    if (validatePassword(password)) {
      authorizeUser(chatId);
      await ctx.reply('✅ Authorized! You can now use the bot.');
    } else {
      recordFailedAuthAttempt(chatId);
      const attemptsLeft = getRemainingAttempts(chatId);
      if (attemptsLeft <= 0) {
        await ctx.reply('⏳ Too many failed attempts. You are locked out for 5 minutes.');
      } else {
        await ctx.reply(`❌ Invalid password. ${attemptsLeft} attempts remaining.`);
      }
    }
  });
}
