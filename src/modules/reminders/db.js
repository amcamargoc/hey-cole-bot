import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data directory (project root/data)
const dataDir = path.resolve(__dirname, '../../../data');
const dbPath = path.join(dataDir, 'reminders.db');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message TEXT NOT NULL,
    reminder_time INTEGER NOT NULL,
    recurrence TEXT,
    status TEXT DEFAULT 'active',
    completed_at INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS reminder_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reminder_id INTEGER NOT NULL,
    delivered_at INTEGER DEFAULT (strftime('%s', 'now')),
    status TEXT DEFAULT 'delivered',
    FOREIGN KEY (reminder_id) REFERENCES reminders(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
  CREATE INDEX IF NOT EXISTS idx_reminders_time ON reminders(reminder_time);
  CREATE INDEX IF NOT EXISTS idx_reminder_logs_reminder ON reminder_logs(reminder_id);
`);

export default db;
export { db, dbPath };