const Database = require('better-sqlite3');
const path = require('path');

let db = null;

function getDb() {
  if (!db) {
    const dbPath = path.resolve(__dirname, '../../', process.env.DB_PATH || './data/polysights.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

// Upsert traders from scraped data
function upsertTraders(traders) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO traders (pseudonym, score, total_pnl, total_volume, total_trades, 
      avg_profit_per_trade, win_rate, active_positions, trend, markets_count, last_active, updated_at)
    VALUES (@pseudonym, @score, @total_pnl, @total_volume, @total_trades,
      @avg_profit_per_trade, @win_rate, @active_positions, @trend, @markets_count, @last_active, datetime('now'))
    ON CONFLICT(pseudonym) DO UPDATE SET
      score = @score, total_pnl = @total_pnl, total_volume = @total_volume,
      total_trades = @total_trades, avg_profit_per_trade = @avg_profit_per_trade,
      win_rate = @win_rate, active_positions = @active_positions, trend = @trend,
      markets_count = @markets_count, last_active = @last_active, updated_at = datetime('now')
  `);

  const insertMany = db.transaction((traders) => {
    for (const t of traders) {
      const avgProfit = t.total_trades > 0 ? t.total_pnl / t.total_trades : 0;
      const winRate = calculateWinRate(t);
      const trend = determineTrend(t);
      
      stmt.run({
        pseudonym: t.pseudonym || 'Unknown',
        score: t.score || 0,
        total_pnl: t.total_pnl || 0,
        total_volume: t.total_volume || 0,
        total_trades: t.total_trades || 0,
        avg_profit_per_trade: avgProfit,
        win_rate: winRate,
        active_positions: (t.current_positions || []).length,
        trend: trend,
        markets_count: t.markets_count || 0,
        last_active: new Date().toISOString()
      });
    }
  });

  insertMany(traders);
}

function calculateWinRate(trader) {
  const positions = trader.current_positions || [];
  if (positions.length === 0) return 0;
  const wins = positions.filter(p => p.pnl > 0).length;
  return wins / positions.length;
}

function determineTrend(trader) {
  if (trader.score >= 80 && trader.total_pnl > 5000) return 'hot';
  if (trader.score >= 60 && trader.total_pnl > 0) return 'warm';
  if (trader.total_pnl < 0) return 'cold';
  return 'neutral';
}

// Insert opportunities
function insertOpportunities(opportunities) {
  const db = getDb();
  
  // Clear today's opportunities first
  db.prepare(`DELETE FROM opportunities WHERE snapshot_date = date('now')`).run();
  
  const stmt = db.prepare(`
    INSERT INTO opportunities (market, outcome, side, current_price, trader_pseudonym,
      trader_score, entry_price, price_movement, pnl, position_size, copy_appeal, 
      risk, slug, polymarket_url, snapshot_date)
    VALUES (@market, @outcome, @side, @current_price, @trader_pseudonym,
      @trader_score, @entry_price, @price_movement, @pnl, @position_size, @copy_appeal,
      @risk, @slug, @polymarket_url, date('now'))
  `);

  const insertMany = db.transaction((opps) => {
    for (const o of opps) {
      const risk = o.performer_score >= 80 ? 'low' : o.performer_score >= 60 ? 'medium' : 'high';
      stmt.run({
        market: o.market || 'Unknown',
        outcome: o.outcome || '',
        side: o.side || '',
        current_price: o.current_price || 0,
        trader_pseudonym: o.performer || 'Unknown',
        trader_score: o.performer_score || 0,
        entry_price: o.performer_entry || 0,
        price_movement: o.price_movement || 0,
        pnl: o.position_pnl || 0,
        position_size: o.position_size || 0,
        copy_appeal: o.copy_appeal || 0,
        risk: risk,
        slug: o.slug || '',
        polymarket_url: o.slug ? `https://polymarket.com/event/${o.slug}` : ''
      });
    }
  });

  insertMany(opportunities);
}

// Save daily snapshot
function saveSnapshot(traders, opportunities) {
  const db = getDb();
  const totalTraders = traders.length;
  const totalOpps = opportunities.length;
  const avgScore = traders.length > 0 
    ? traders.reduce((sum, t) => sum + (t.score || 0), 0) / traders.length 
    : 0;
  const totalPnl = traders.reduce((sum, t) => sum + (t.total_pnl || 0), 0);

  db.prepare(`
    INSERT INTO snapshots (snapshot_date, total_traders, total_opportunities, avg_score, total_market_pnl, raw_data)
    VALUES (date('now'), ?, ?, ?, ?, ?)
  `).run(totalTraders, totalOpps, avgScore, totalPnl, JSON.stringify({ traders: traders.length, opportunities: opportunities.length }));

  // Save trader history
  const histStmt = db.prepare(`
    INSERT INTO trader_history (pseudonym, score, total_pnl, total_volume, total_trades, snapshot_date)
    VALUES (?, ?, ?, ?, ?, date('now'))
  `);

  const saveHistory = db.transaction((traders) => {
    for (const t of traders) {
      histStmt.run(t.pseudonym, t.score, t.total_pnl, t.total_volume, t.total_trades);
    }
  });

  saveHistory(traders);
}

// Query functions
function getTopTraders(limit = 20) {
  return getDb().prepare(`
    SELECT * FROM traders ORDER BY score DESC, total_pnl DESC LIMIT ?
  `).all(limit);
}

function getOpportunities(minScore = 0, limit = 50) {
  return getDb().prepare(`
    SELECT * FROM opportunities 
    WHERE trader_score >= ? AND snapshot_date = date('now')
    ORDER BY copy_appeal DESC LIMIT ?
  `).all(minScore, limit);
}

function getMarketAnalysis() {
  return getDb().prepare(`
    SELECT market, slug,
      COUNT(*) as trader_count,
      GROUP_CONCAT(DISTINCT trader_pseudonym) as traders,
      AVG(trader_score) as avg_trader_score,
      AVG(current_price) as avg_price,
      SUM(pnl) as total_pnl,
      SUM(position_size) as total_volume,
      MAX(copy_appeal) as max_appeal,
      MIN(risk) as consensus_risk
    FROM opportunities
    WHERE snapshot_date = date('now')
    GROUP BY market
    ORDER BY trader_count DESC, avg_trader_score DESC
  `).all();
}

function getTraderHistory(pseudonym, days = 30) {
  return getDb().prepare(`
    SELECT * FROM trader_history 
    WHERE pseudonym = ? AND snapshot_date >= date('now', '-' || ? || ' days')
    ORDER BY snapshot_date ASC
  `).all(pseudonym, days);
}

function getDashboardStats() {
  const db = getDb();
  const traders = db.prepare(`SELECT COUNT(*) as count, AVG(score) as avg_score, SUM(total_pnl) as total_pnl FROM traders`).get();
  const opps = db.prepare(`SELECT COUNT(*) as count, AVG(copy_appeal) as avg_appeal FROM opportunities WHERE snapshot_date = date('now')`).get();
  const hotTraders = db.prepare(`SELECT COUNT(*) as count FROM traders WHERE trend = 'hot'`).get();
  const lastUpdate = db.prepare(`SELECT MAX(updated_at) as last_update FROM traders`).get();
  
  return {
    totalTraders: traders.count,
    avgScore: Math.round((traders.avg_score || 0) * 10) / 10,
    totalPnl: Math.round((traders.total_pnl || 0) * 100) / 100,
    totalOpportunities: opps.count,
    avgAppeal: Math.round((opps.avg_appeal || 0) * 10) / 10,
    hotTraders: hotTraders.count,
    lastUpdate: lastUpdate.last_update || 'Never'
  };
}

module.exports = {
  getDb,
  upsertTraders,
  insertOpportunities,
  saveSnapshot,
  getTopTraders,
  getOpportunities,
  getMarketAnalysis,
  getTraderHistory,
  getDashboardStats
};
