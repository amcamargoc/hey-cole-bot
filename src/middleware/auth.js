import 'dotenv/config';

const getOwnerChatId = () => process.env.OWNER_CHAT_ID;
const getBotPassword = () => process.env.BOT_PASSWORD;

// Rate limiting for auth attempts
const authAttempts = new Map(); // chatId -> { count, lockedUntil }
const AUTH_MAX_ATTEMPTS = 3;
const AUTH_LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes
const AUTH_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// Owner-only mode: If OWNER_CHAT_ID is set, only that user can access
const authorizedUsers = new Set();

function isLockedOut(chatId) {
  const attempts = authAttempts.get(chatId);
  if (!attempts) return false;
  if (attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
    return true;
  }
  // Reset after window
  if (attempts.count > 0 && Date.now() - attempts.lastAttempt > AUTH_WINDOW_MS) {
    authAttempts.delete(chatId);
    return false;
  }
  return false;
}

export function checkAuthRateLimit(chatId) {
  const attempts = authAttempts.get(chatId);
  if (isLockedOut(chatId)) return false;
  return true;
}

export function getAuthLockoutRemaining(chatId) {
  const attempts = authAttempts.get(chatId);
  if (!attempts || !attempts.lockedUntil) return 0;
  const remaining = Math.ceil((attempts.lockedUntil - Date.now()) / 1000);
  return remaining > 0 ? remaining : 0;
}

export function getRemainingAttempts(chatId) {
  const attempts = authAttempts.get(chatId);
  if (!attempts) return 3;
  return Math.max(0, 3 - attempts.count);
}

export function recordFailedAuthAttempt(chatId) {
  const attempts = authAttempts.get(chatId) || { count: 0, lastAttempt: 0 };
  attempts.count++;
  attempts.lastAttempt = Date.now();
  if (attempts.count >= AUTH_MAX_ATTEMPTS) {
    attempts.lockedUntil = Date.now() + AUTH_LOCKOUT_MS;
  }
  authAttempts.set(chatId, attempts);
}

function verifyPassword(input, correct) {
  if (!input || !correct) return false;
  const len = Math.max(input.length, correct.length);
  let result = 1;
  for (let i = 0; i < len; i++) {
    const inputChar = i < input.length ? input[i] : '';
    const correctChar = i < correct.length ? correct[i] : '';
    result &= inputChar === correctChar;
  }
  return result === 1;
}

export function isOwner(ctx) {
  const ownerId = getOwnerChatId();
  return ownerId && String(ctx.chat.id) === String(ownerId);
}

export function isOwnerOnlyMode() {
  return !!getOwnerChatId();
}

export function isAuthorized(ctx) {
  const ownerId = getOwnerChatId();
  // In owner-only mode, ONLY the owner can use the bot
  return isOwner(ctx) || authorizedUsers.has(String(ctx.chat.id));
}

export function requireAuth(ctx) {
  if (!isAuthorized(ctx)) {
    const ownerId = getOwnerChatId();
    if (ownerId) {
      ctx.reply(`🔐 This bot is in owner-only mode.\n\nYour Chat ID: ${ctx.chat.id}\n\nOnly the owner (${ownerId}) can access this bot.`).catch(console.error);
    } else {
      ctx.reply('🔐 This bot is private. Send /auth <password> to authorize.').catch(console.error);
    }
    return false;
  }
  return true;
}

export function authorizeUser(chatId) {
  authorizedUsers.add(String(chatId));
}

export function validatePassword(password) {
  const botPassword = getBotPassword();
  return verifyPassword(password, botPassword);
}

// Initialize authorized users if owner is set
const initialOwner = process.env.OWNER_CHAT_ID;
if (initialOwner) authorizedUsers.add(String(initialOwner));
