import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_DIR = path.join(__dirname, '../../.opencode');
const STORAGE_FILE = path.join(STORAGE_DIR, 'sessions.json');

export const sessions = new Map(); // Stores session metadata keyed by "chatId:projectId"
export const userProject = new Map(); // Track active projectId for each chatId
export const userActivity = new Map(); // Track last activity for rate limiting
export const ongoingPrompts = new Map(); // Track ongoing prompt IDs per chat for aborting
export const sessionToChatId = new Map(); // Map sessionID -> chatId for routing events

export const SESSION_TIMEOUT = 30 * 24 * 60 * 60 * 1000; // 30 days
export const RATE_LIMIT = 500; // 500ms between messages per user

// Initialize: Load from disk
loadSessions();

function saveSessions() {
  try {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
    
    const data = {
      sessions: Array.from(sessions.entries()),
      userProject: Array.from(userProject.entries()),
      sessionToChatId: Array.from(sessionToChatId.entries())
    };
    
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Failed to save sessions:', err);
  }
}

function loadSessions() {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
      const data = JSON.parse(raw);
      
      if (data.sessions) data.sessions.forEach(([k, v]) => sessions.set(k, v));
      if (data.userProject) data.userProject.forEach(([k, v]) => userProject.set(k, v));
      if (data.sessionToChatId) data.sessionToChatId.forEach(([k, v]) => sessionToChatId.set(k, v));
      
      console.log(`Loaded ${sessions.size} sessions from disk.`);
      // Perform immediate cleanup of expired ones
      cleanupOldSessions();
    }
  } catch (err) {
    console.error('Failed to load sessions:', err);
  }
}

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
  saveSessions();
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

// Session state update wrapper
export function updateSession(key, data) {
  sessions.set(key, data);
  saveSessions();
}

// Session-ChatId mapping update wrapper
export function updateSessionToChatMapping(sessionId, chatId) {
  sessionToChatId.set(sessionId, chatId);
  saveSessions();
}

// Delete session wrapper
export function deleteSession(key) {
  sessions.delete(key);
  saveSessions();
}

// Cleanup old sessions
export async function cleanupOldSessions() {
  const now = Date.now();
  let deletedCount = 0;
  
  for (const [key, data] of sessions.entries()) {
    if (now - data.lastUsed > SESSION_TIMEOUT) {
      sessions.delete(key);
      deletedCount++;
    }
  }
  
  if (deletedCount > 0) {
    console.log(`Garbage Collector: Pruned ${deletedCount} expired sessions.`);
    saveSessions();
  }
}
