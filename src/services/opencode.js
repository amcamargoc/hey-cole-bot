import { createOpencode } from '@opencode-ai/sdk';
import { sessionToChatId } from './session.js';
import { Markup } from 'telegraf';
import { startPoller as startTuiPoller, stopPoller as stopTuiPoller, setBot as setTuiBot } from './tuiControl.js';

export let opencodeClient = null;
export let opencodeServer = null;
export let opencodeServerRunning = false;

// Helper for testing
export const setOpencodeClient = (client) => { opencodeClient = client; opencodeServerRunning = !!client; };

export async function connectToServer(bot) {
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempting to connect to OpenCode server (attempt ${attempt}/${maxRetries})...`);
      const result = await createOpencode({
        hostname: '127.0.0.1',
        port: 4096,
        provider: {
          default: {
            options: {
              timeout: false,
            },
          },
        },
      });
      opencodeClient = result.client;
      if (result.server) {
        opencodeServer = result.server;
      }
      opencodeServerRunning = true;
      console.log('OpenCode client connected successfully');
      
      // Setup global event listener for permissions
      setupEventListeners(bot);
      
      // Start TUI control poller for interactive questions
      setTuiBot(bot);
      startTuiPoller();
      
      // Ensure all skills are registered
      await ensureSkills();
      
      return true;
    } catch (err) {
      console.error(`Connection attempt ${attempt} failed:`, err.message);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }
  return false;
}

export async function startOpenCodeServer(bot) {
  const connected = await connectToServer(bot);
  if (!connected) {
    console.log('Could not connect to OpenCode server. Starting server manually...');
    const { spawn } = await import('child_process');
    const serverProc = spawn('opencode', ['serve', '--hostname=127.0.0.1', '--port=4096'], {
      detached: true,
      stdio: 'ignore'
    });
    serverProc.unref();
    
    await new Promise(r => setTimeout(r, 3000));
    const retryConnected = await connectToServer(bot);
    if (!retryConnected) {
      console.log('Retrying server connection in 15 seconds...');
      setTimeout(() => startOpenCodeServer(bot), 15000);
      return;
    }
  }
}

async function setupEventListeners(bot) {
  if (!opencodeClient) return;
  
  try {
    const streamRes = await opencodeClient.global.event();
    const stream = streamRes.data || streamRes; // Handled depending on SDK behavior
    
    if (!stream || typeof stream[Symbol.asyncIterator] !== 'function') {
      throw new TypeError('Stream returned is not async iterable (might not be supported in this environment).');
    }
    
    for await (const event of stream) {
      if (event.type === 'permission.updated') {
        const permission = event.properties;
        const sessionId = permission.sessionID;
        const chatId = sessionToChatId.get(sessionId);
        
        if (chatId) {
          const title = permission.title || 'Permission Required';
          const command = permission.metadata?.command || 'Unknown action';
          
          await bot.telegram.sendMessage(chatId, 
            `🔐 *Permission Requested*\n\n` +
            `*Action:* ${title}\n` +
            `*Command:* \`${command}\`\n\n` +
            `Do you want to allow this?`, 
            {
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([
                [
                  Markup.button.callback('✅ Allow', `allow_perm:${sessionId}:${permission.id}`),
                  Markup.button.callback('❌ Deny', `deny_perm:${sessionId}:${permission.id}`)
                ]
              ])
            }
          ).catch(console.error);
        }
      }
    }
  } catch (err) {
    if (err instanceof TypeError || err.name === 'TypeError' || err.message?.includes('iterable')) {
      console.error('Event stream is not supported in this open code client implementation:', err.message);
      return; // DO NOT retry endlessly if it's a structural type error.
    }
    console.error('Event stream error:', err.message);
    setTimeout(() => setupEventListeners(bot), 5000);
  }
}


/**
 * Ensures all connected skills and MCP servers are registered
 */
async function ensureSkills() {
  if (!opencodeClient) return;
  
  // 1. GitHub MCP
  if (process.env.GITHUB_TOKEN) {
    try {
      const status = await opencodeClient.mcp.status();
      const serversData = status.data || [];
      const servers = Array.isArray(serversData) ? serversData : Object.values(serversData);
      const hasGithub = servers.some(s => s.name === 'github');
      
      if (!hasGithub) {
        console.log('Registering GitHub MCP server...');
        await opencodeClient.mcp.add({
          body: {
            name: 'github',
            config: {
              type: "local",
              command: ['npx', '-y', '@modelcontextprotocol/server-github'],
              environment: {
                GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN
              }
            }
          }
        });
        console.log('✅ GitHub MCP server registered.');
      }
    } catch (err) {
      console.warn('⚠️ GitHub MCP registration failed (continuing):', err.message);
    }
  } else {
    console.warn('⚠️ GITHUB_TOKEN missing. GitHub skills disabled.');
  }

  // 2. Local Skills Verification
  // We don't "register" Bash tools, but we can verify dependencies if needed.
  // For example, checking if Google Workspace CLI dependencies are installed is done in person logic.
}
