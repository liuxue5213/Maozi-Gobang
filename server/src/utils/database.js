/**
 * 数据库模块 (使用 Node.js 内置 node:sqlite)
 * 生产环境可替换为 PostgreSQL
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// 确保数据目录存在
const dbDir = path.dirname(config.db.path);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(config.db.path);

// 启用 WAL 模式
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// 初始化表结构
function initDatabase() {
  db.exec(`
    -- 用户表
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      nickname TEXT,
      avatar TEXT,
      rating INTEGER DEFAULT 1000,
      games_played INTEGER DEFAULT 0,
      games_won INTEGER DEFAULT 0,
      games_lost INTEGER DEFAULT 0,
      games_drawn INTEGER DEFAULT 0,
      current_streak INTEGER DEFAULT 0,
      best_streak INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      last_login TEXT
    );

    -- 对局记录表
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      player_black TEXT,
      player_white TEXT,
      winner INTEGER DEFAULT 0,
      is_ai_game INTEGER DEFAULT 0,
      ai_difficulty INTEGER,
      moves TEXT,
      total_moves INTEGER DEFAULT 0,
      duration INTEGER DEFAULT 0,
      rating_change_black INTEGER DEFAULT 0,
      rating_change_white INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (player_black) REFERENCES users(id),
      FOREIGN KEY (player_white) REFERENCES users(id)
    );

    -- 积分变动历史
    CREATE TABLE IF NOT EXISTS rating_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      game_id TEXT,
      old_rating INTEGER,
      new_rating INTEGER,
      change INTEGER,
      reason TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- 排行榜索引
    CREATE INDEX IF NOT EXISTS idx_users_rating ON users(rating DESC);
    CREATE INDEX IF NOT EXISTS idx_games_created ON games(created_at DESC);
  `);
}

initDatabase();

module.exports = db;
