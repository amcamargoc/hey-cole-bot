export const sessions = new Map(); // Stores session metadata keyed by "chatId:projectId"
export const userProject = new Map(); // Track active projectId for each chatId
export const userActivity = new Map(); // Track last activity for rate limiting
export const ongoingPrompts = new Map(); // Track ongoing prompt IDs per chat for aborting
export const sessionToChatId = new Map(); // Map sessionID -> chatId for routing events

export const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
export const RATE_LIMIT = 500; // 500ms between messages per user

// Utility: Get session key
export function getSessionKey(chatId, projectId = null) {
  const activeProject = projectId || userProject.get(chatId) || 'main';
  return `${chatId}:${activeProject}`;
}

// Utility: Get active project name
export function getActiveProject(chatId) {
  return userProject.get(chatId) || 'main';
}

// Utility: Switch project
export function switchProject(chatId, projectId) {
  userProject.set(chatId, projectId);
}

// Utility: Check rate limit
export async function checkRateLimit(chatId) {
  const now = Date.now();
  const lastActivity = userActivity.get(chatId) || 0;
  
  if (now - lastActivity < RATE_LIMIT) {
    return false;
  }
  
  userActivity.set(chatId, now);
  return true;
}

// Cleanup old sessions
export async function cleanupOldSessions() {
  const now = Date.now();
  for (const [key, data] of sessions.entries()) {
    if (now - data.lastUsed > SESSION_TIMEOUT) {
      sessions.delete(key);
      console.log(`Cleaned up session for ${key}`);
      // Also cleanup mapping if possible, though we don't store sessionID -> key easily
    }
  }
}
