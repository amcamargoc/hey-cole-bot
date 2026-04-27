/**
 * El Coleto Logger 🛰️👁️
 * Provides high-energy, traceable logging for the bot's internal engine.
 */

const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
  red: "\x1b[31m"
};

class Logger {
  formatDate() {
    return new Date().toLocaleTimeString('en-US', { hour12: false });
  }

  log(emoji, tag, message, color = COLORS.cyan) {
    const time = this.formatDate();
    console.log(`${COLORS.bright}[${time}] ${emoji} [${tag}]${COLORS.reset} ${color}${message}${COLORS.reset}`);
  }

  info(tag, message) {
    this.log('🥥', tag, message, COLORS.green);
  }

  warn(tag, message) {
    this.log('⚠️', tag, message, COLORS.yellow);
  }

  error(tag, message, err) {
    this.log('🚨', tag, message, COLORS.red);
    if (err) console.error(err);
  }

  // Dual-Brain specific logs
  draft(model, message) {
    this.log('✍️', 'DRAFT', `Model: ${model} | ${message}`, COLORS.magenta);
  }

  verify(model, message) {
    this.log('🛡️', 'VERIFY', `Model: ${model} | ${message}`, COLORS.yellow);
  }

  tool(toolName, args) {
    this.log('🛠️', 'TOOL', `${toolName} called with: ${JSON.stringify(args)}`, COLORS.blue);
  }

  // Thinking/thought process logs (for user visibility)
  thinking(thought) {
    this.log('💭', 'THINKING', thought, COLORS.cyan);
  }

  // AI reasoning steps
  reason(step, details) {
    this.log('🧠', 'REASON', `[${step}] ${details}`, COLORS.blue);
  }

  // Tool execution updates
  toolStart(toolName, params) {
    this.log('⏳', 'TOOL', `Starting: ${toolName}`, COLORS.yellow);
    if (params) {
      console.log(`   └─ Params: ${JSON.stringify(params).slice(0, 200)}`);
    }
  }

  toolResult(toolName, success, details) {
    const status = success ? '✅' : '❌';
    this.log(status, 'TOOL', `${toolName} finished: ${details}`, success ? COLORS.green : COLORS.red);
  }

  // Phase transitions
  phase(phaseName, description) {
    this.log('🔄', 'PHASE', `${phaseName}: ${description}`, COLORS.magenta);
  }

  // User-facing status updates
  status(message) {
    this.log('📍', 'STATUS', message, COLORS.green);
  }

  // Interactive prompt logs (TUI control bridge)
  interact(message, details = '') {
    const fullMessage = details ? `${details}: ${message}` : message;
    this.log('🎯', 'INTERACT', fullMessage, COLORS.cyan);
  }
}

export const logger = new Logger();
