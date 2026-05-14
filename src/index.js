import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { startOpenCodeServer, opencodeClient, opencodeServer, connectToServer, opencodeServerRunning } from './services/opencode.js';
import { cleanupOldSessions } from './services/session.js';
import { setupCommands } from './handlers/commandHandler.js';
import { handleMessage } from './handlers/messageHandler.js';
import { isStrongPassword, validatePasswordRequirements } from './utils.js';
import { setupReminderCommands, stopScheduler } from './modules/reminders/index.js';
import { closeDb } from './modules/reminders/model.js';
import { spawn } from 'child_process';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BOT_PASSWORD = process.env.BOT_PASSWORD;

// Security Check on Startup
console.log('\n🔒 Hey Cole Security Check...\n');

// Get all env vars
const OWNER_CHAT_ID = process.env.OWNER_CHAT_ID;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (OWNER_CHAT_ID) {
  console.log('🔐 Owner-Only Mode: ENABLED');
  console.log(`   Only chat ID ${OWNER_CHAT_ID} can access this bot.`);
  console.log('   Password check skipped (not needed in owner-only mode).\n');
} else if (!BOT_PASSWORD) {
  console.log('⚠️  WARNING: No BOT_PASSWORD set.');
  console.log('   Hey Cole is running in PUBLIC mode.');
  console.log('   Anyone with your bot link can use it.');
  console.log('   Set BOT_PASSWORD in .env to enable protection.\n');
} else if (!isStrongPassword(BOT_PASSWORD)) {
  console.log('🚨 SECURITY ALERT: Your BOT_PASSWORD is weak.');
  console.log('   For your safety, the following are required:');
  const requirements = validatePasswordRequirements(BOT_PASSWORD);
  requirements.forEach(req => console.log(`   - ${req}`));
  console.log('\n   Consider changing it before going public.\n');
} else {
  console.log('✅ Password strength: STRONG');
  console.log('   Hey Cole is protected.\n');
}

if (!TELEGRAM_BOT_TOKEN) {
  console.error('Please set TELEGRAM_BOT_TOKEN environment variable');
  process.exit(1);
}

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

// Initialize open code server and related listeners
await startOpenCodeServer(bot);

// Setup command handlers and message handlers
setupCommands(bot);
bot.on('text', handleMessage);

// Setup reminder commands (if owner is configured)
if (OWNER_CHAT_ID) {
  setupReminderCommands(bot, parseInt(OWNER_CHAT_ID, 10));
}

// Global Error Handler
bot.catch((err, ctx) => {
  console.error(`Telegraf error for ${ctx.updateType}:`, err);
});

// Periodic Tasks
setInterval(cleanupOldSessions, 5 * 60 * 1000);

setInterval(async () => {
  if (!opencodeClient) return;
  try {
    await opencodeClient.provider.list({ timeout: 10000 });
  } catch (err) {
    console.error('Server health check failed:', err.message);
    if (opencodeServerRunning) { 
      // Need a way to set opencodeServerRunning = false, but it's bound. 
      // Ideally we call a method on the service. For now, just reconnect.
      await connectToServer(bot);
    }
  }
}, 2 * 60 * 1000);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  stopScheduler();
  closeDb();
  if (opencodeServer) opencodeServer.close();
  syncProcess.kill();
  process.exit();
});

async function startBot() {
  try {
    console.log('Telegram bot starting...');
    await bot.launch({
      allowedUpdates: ['message', 'callback_query'],
      dropPendingUpdates: true,
    });
    console.log('Bot is running! Press Ctrl+C to stop');
  } catch (err) {
    console.error('Failed to launch bot:', err);
    console.log('Retrying in 5 seconds...');
    setTimeout(startBot, 5000);
  }
}

startBot();

// Start data folder sync watcher (auto-sync to remote repository)
const syncProcess = spawn('node', ['scripts/sync-data.js'], {
  cwd: process.cwd(),
  detached: true,
  stdio: 'ignore'
});

syncProcess.unref();
console.log('📦 Data sync watcher started');

process.once('SIGINT', () => {
  stopScheduler();
  closeDb();
  syncProcess.kill();
  bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
  stopScheduler();
  closeDb();
  syncProcess.kill();
  bot.stop('SIGTERM');
});
