const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const dbPath = path.resolve(__dirname, '../../', process.env.DB_PATH || './data/polysights.db');

console.log(`Setting up database at: ${dbPath}`);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS traders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pseudonym TEXT NOT NULL,
    score REAL DEFAULT 0,
    total_pnl REAL DEFAULT 0,
    total_volume REAL DEFAULT 0,
    total_trades INTEGER DEFAULT 0,
    avg_profit_per_trade REAL DEFAULT 0,
    win_rate REAL DEFAULT 0,
    active_positions INTEGER DEFAULT 0,
    trend TEXT DEFAULT 'neutral',
    markets_count INTEGER DEFAULT 0,
    last_active TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(pseudonym)
  );

  CREATE TABLE IF NOT EXISTS opportunities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    market TEXT NOT NULL,
    outcome TEXT,
    side TEXT,
    current_price REAL,
    trader_pseudonym TEXT,
    trader_score REAL,
    entry_price REAL,
    price_movement REAL,
    pnl REAL DEFAULT 0,
    position_size REAL DEFAULT 0,
    copy_appeal REAL DEFAULT 0,
    risk TEXT DEFAULT 'medium',
    slug TEXT,
    polymarket_url TEXT,
    snapshot_date TEXT DEFAULT (date('now')),
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (trader_pseudonym) REFERENCES traders(pseudonym)
  );

  CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_date TEXT NOT NULL,
    total_traders INTEGER DEFAULT 0,
    total_opportunities INTEGER DEFAULT 0,
    avg_score REAL DEFAULT 0,
    total_market_pnl REAL DEFAULT 0,
    raw_data TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS trader_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pseudonym TEXT NOT NULL,
    score REAL,
    total_pnl REAL,
    total_volume REAL,
    total_trades INTEGER,
    snapshot_date TEXT DEFAULT (date('now')),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_traders_score ON traders(score DESC);
  CREATE INDEX IF NOT EXISTS idx_traders_pnl ON traders(total_pnl DESC);
  CREATE INDEX IF NOT EXISTS idx_opportunities_appeal ON opportunities(copy_appeal DESC);
  CREATE INDEX IF NOT EXISTS idx_opportunities_date ON opportunities(snapshot_date);
  CREATE INDEX IF NOT EXISTS idx_trader_history_date ON trader_history(snapshot_date);
  CREATE INDEX IF NOT EXISTS idx_trader_history_pseudonym ON trader_history(pseudonym);
`);

console.log('Database schema created successfully!');
db.close();
