import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROMPTS_DIR = path.join(__dirname, '../prompts');

/**
 * Loads a prompt from a markdown file
 * @param {string} filename The name of the file (e.g. 'persona.md')
 * @returns {string} The content of the file
 */
function loadPrompt(filename) {
  try {
    return fs.readFileSync(path.join(PROMPTS_DIR, filename), 'utf-8');
  } catch (error) {
    console.error(`Failed to load prompt: ${filename}`, error);
    return '';
  }
}

/**
 * Builds the complete system prompt dynamically based on the session state
 * @param {boolean} isDeveloperMode Whether developer mode is active
 * @param {string} contextNote Optional context note string to append
 * @returns {string} The formatted system prompt
 */
export function buildSystemPrompt(isDeveloperMode = false, contextNote = '') {
  const basePersona = loadPrompt('persona.md');
  const devModeText = loadPrompt('dev_mode.md');
  
  const devModeAdditions = isDeveloperMode 
    ? `\n\n${devModeText}`
    : `\n\n🔒 **DEVELOPER MODE DISABLED**: You are FORBIDDEN from modifying files in \`src/\`. If requested, explain that /dev mode must be enabled. You CAN still edit \`data/\`.`;

  return `${basePersona}${contextNote}${devModeAdditions}`;
}
