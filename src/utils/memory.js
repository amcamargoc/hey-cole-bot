import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const MEMORY_PATH = join(__dirname, '../../data/memory.md');

export function loadMemory() {
  if (!existsSync(MEMORY_PATH)) return null;
  try {
    return readFileSync(MEMORY_PATH, 'utf-8');
  } catch {
    return null;
  }
}

export function saveMemory(content) {
  try {
    writeFileSync(MEMORY_PATH, content, 'utf-8');
    return true;
  } catch {
    return false;
  }
}

export function updateMemoryField(field, value) {
  let content = loadMemory() || '# Memory\n\n## Last Updated\n\n## User Profile\n\n## Current Projects\n\n## Recent Context\n\n## Preferences\n\n## Notes';
  
  const date = new Date().toISOString().split('T')[0];
  content = content.replace(/## Last Updated[\s\S]*?(?=##|$)/, `## Last Updated\n${date}\n`);
  
  const fieldPattern = new RegExp(`(## ${field}[\\s\\S]*?)(?=##|$)`, 'i');
  const fieldMatch = content.match(fieldPattern);
  
  if (fieldMatch) {
    content = content.replace(fieldPattern, `$1${value}\n`);
  }
  
  return saveMemory(content);
}