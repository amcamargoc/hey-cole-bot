#!/usr/bin/env node

/**
 * Auto-sync script that watches the data/ folder and syncs changes to remote repository
 * Usage: node scripts/sync-data.js
 */

import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync, cpSync, writeFileSync, readdirSync, statSync, utimesSync } from 'fs';
import { join } from 'path';
import chokidar from 'chokidar';
import Database from 'better-sqlite3';

function checkpointSqliteDBs(dataDir) {
  try {
    const files = readdirSync(dataDir);
    for (const file of files) {
      const filePath = join(dataDir, file);
      const stat = statSync(filePath);
      if (stat.isFile() && file.endsWith('.db')) {
        try {
          const db = new Database(filePath, { readonly: false });
          db.pragma('wal_checkpoint(TRUNCATE)');
          db.close();
          utimesSync(filePath, new Date(), new Date());
          console.log(`🔵 Checkpointed & touched: ${file}`);
        } catch (e) { }
      }
    }
  } catch (e) { }
}

const DATA_DIR = '/Users/beto/Documents/code/personal/hey-cole-bot/data';
const TEMP_REPO_DIR = '/tmp/memoria-del-cole';
const REMOTE_URL = 'git@github.com:amcamargoc/memoria-del-cole.git';
const DATA_SOURCE = '/Users/beto/Documents/code/personal/hey-cole-bot/data';

let syncTimeout = null;
let isSyncing = false;

// Ensure temp repo exists
function ensureRepo() {
  if (!existsSync(join(TEMP_REPO_DIR, '.git'))) {
    console.log('📦 Cloning remote repository...');
    execSync(`git clone ${REMOTE_URL} ${TEMP_REPO_DIR}`, { stdio: 'inherit' });
  }
}

// Sync files to remote
function syncToRemote() {
  if (isSyncing) return;
  isSyncing = true;

  console.log('🔄 Syncing to remote...');

  try {
    checkpointSqliteDBs(DATA_SOURCE);

    // Copy files from data to temp repo
    execSync(`cp -rf ${DATA_SOURCE}/* ${TEMP_REPO_DIR}/`, { stdio: 'ignore' });

    // Check for changes and commit
    const status = execSync('git status --porcelain', { cwd: TEMP_REPO_DIR, encoding: 'utf8' });

    if (status.trim()) {
      execSync('git add -A', { cwd: TEMP_REPO_DIR, stdio: 'ignore' });
      execSync(`git commit -m "Auto-sync: ${new Date().toISOString()}"`, { cwd: TEMP_REPO_DIR, stdio: 'ignore' });
      execSync('git push --force', { cwd: TEMP_REPO_DIR, stdio: 'inherit' });
      console.log('✅ Synced successfully!');
    } else {
      console.log('ℹ️ No changes to sync');
    }
  } catch (error) {
    console.error('❌ Sync failed:', error.message);
  } finally {
    isSyncing = false;
  }
}

// Debounce sync to avoid too many commits
function debouncedSync() {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(syncToRemote, 2000); // Wait 2 seconds after last change
}

// Initial setup
console.log('🚀 Starting auto-sync for data/ folder');
console.log(`   Watching: ${DATA_DIR}`);
console.log(`   Remote: ${REMOTE_URL}`);
ensureRepo();

// Initial sync
syncToRemote();

// Watch for changes in data folder (include all files, including .db)
const watcher = chokidar.watch(DATA_DIR, {
  ignored: /(^|[\/\\])\../, // Ignore dotfiles but watch .db files
  persistent: true,
  ignoreInitial: true,
  usePolling: true,  // More reliable for database files
  awaitWriteFinish: {
    stabilityThreshold: 1000,  // More time for db writes
    pollInterval: 200
  }
});

watcher
  .on('add', path => {
    console.log(`📄 File added: ${path}`);
    debouncedSync();
  })
  .on('change', path => {
    console.log(`📝 File changed: ${path}`);
    debouncedSync();
  })
  .on('unlink', path => {
    console.log(`🗑️ File removed: ${path}`);
    debouncedSync();
  })
  .on('error', error => console.error('❌ Watcher error:', error));

console.log('👀 Watching for changes...');

// Periodic check for database files (SQLite might not always trigger events)
setInterval(() => {
  const dbFiles = readdirSync(DATA_DIR).filter(f => f.endsWith('.db'));
  if (dbFiles.length > 0) {
    debouncedSync();
  }
}, 5000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping watcher...');
  watcher.close();
  process.exit(0);
});