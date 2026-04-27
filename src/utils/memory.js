import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DATA_DIR = join(__dirname, '../../data');

export function loadMemory() {
  const path = join(DATA_DIR, 'memory.md');
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return null;
  }
}

export function loadTodos() {
  const path = join(DATA_DIR, 'todos.md');
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return null;
  }
}

export function loadProjects() {
  const projectsDir = join(DATA_DIR, 'projects');
  if (!existsSync(projectsDir)) return null;
  try {
    const files = readdirSync(projectsDir).filter(f => f.endsWith('.md'));
    const projects = {};
    for (const file of files) {
      const name = file.replace('.md', '');
      projects[name] = readFileSync(join(projectsDir, file), 'utf-8');
    }
    return projects;
  } catch {
    return null;
  }
}

export function loadMemories() {
  const memoriesDir = join(DATA_DIR, 'memories');
  if (!existsSync(memoriesDir)) return null;
  try {
    const files = readdirSync(memoriesDir).filter(f => f.endsWith('.md'));
    const memories = {};
    for (const file of files) {
      const name = file.replace('.md', '');
      memories[name] = readFileSync(join(memoriesDir, file), 'utf-8');
    }
    return memories;
  } catch {
    return null;
  }
}

export function loadAllContext() {
  const memory = loadMemory();
  const todos = loadTodos();
  const projects = loadProjects();
  const memories = loadMemories();

  let context = '';
  
  if (memory) {
    context += `\n## 📝 PERSISTENT MEMORY\n${memory}\n`;
  }
  
  if (todos) {
    context += `\n## 📋 DAILY TASKS (todos.md)\n${todos}\n`;
  }
  
  if (projects) {
    context += `\n## 📁 PROJECT FILES\n`;
    for (const [name, content] of Object.entries(projects)) {
      context += `\n### ${name}\n${content}\n`;
    }
  }
  
  if (memories) {
    context += `\n## 📚 PERSONAL MEMORIES & RESEARCH\n`;
    for (const [name, content] of Object.entries(memories)) {
      context += `\n### ${name}\n${content}\n`;
    }
  }
  
  return context;
}

export function saveMemory(content) {
  try {
    writeFileSync(join(DATA_DIR, 'memory.md'), content, 'utf-8');
    return true;
  } catch {
    return false;
  }
}

export function updateMemoryField(field, value) {
  let content = loadMemory() || '# Memory\n\n## Last Updated\n\n## User Profile\n\n## Current Projects\n\n## Preferences\n\n## Notes';
  
  const date = new Date().toISOString().split('T')[0];
  content = content.replace(/## Last Updated[\s\S]*?(?=##|$)/, `## Last Updated\n${date}\n`);
  
  const fieldPattern = new RegExp(`(## ${field}[\\s\\S]*?)(?=##|$)`, 'i');
  const fieldMatch = content.match(fieldPattern);
  
  if (fieldMatch) {
    content = content.replace(fieldPattern, `$1${value}\n`);
  }
  
  return saveMemory(content);
}