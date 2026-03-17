const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { runScraper, loadFromFile, findLatestDataFile } = require('../scripts/fetch-data');

// GET /api/stats - Dashboard summary stats
router.get('/stats', (req, res) => {
  try {
    const stats = db.getDashboardStats();
    res.json(stats);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/traders - Top traders leaderboard
router.get('/traders', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const traders = db.getTopTraders(limit);
    res.json(traders);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/traders/:pseudonym/history - Trader performance history
router.get('/traders/:pseudonym/history', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const history = db.getTraderHistory(req.params.pseudonym, days);
    res.json(history);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/opportunities - Live betting opportunities
router.get('/opportunities', (req, res) => {
  try {
    const minScore = parseInt(req.query.minScore) || 0;
    const limit = parseInt(req.query.limit) || 50;
    const opportunities = db.getOpportunities(minScore, limit);
    res.json(opportunities);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/markets - Market analysis with consensus
router.get('/markets', (req, res) => {
  try {
    const markets = db.getMarketAnalysis();
    res.json(markets);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/refresh - Trigger data refresh
router.post('/refresh', async (req, res) => {
  try {
    let data;
    
    // Try live scraper first
    try {
      console.log('[REFRESH] Running live scraper...');
      data = await runScraper();
      console.log(`[REFRESH] Scraper returned ${data.performers.length} traders, ${data.opportunities.length} opportunities`);
    } catch(scraperErr) {
      console.warn('[REFRESH] Live scraper failed, falling back to latest file:', scraperErr.message);
      
      // Fallback to latest JSON file
      const latestFile = findLatestDataFile();
      if (latestFile) {
        console.log(`[REFRESH] Loading from file: ${latestFile}`);
        data = loadFromFile(latestFile);
      } else {
        throw new Error('No data source available');
      }
    }

    // Store in database
    if (data.performers && data.performers.length > 0) {
      db.upsertTraders(data.performers);
    }
    if (data.opportunities && data.opportunities.length > 0) {
      db.insertOpportunities(data.opportunities);
    }
    if (data.performers) {
      db.saveSnapshot(data.performers, data.opportunities || []);
    }

    const stats = db.getDashboardStats();
    res.json({ 
      success: true, 
      message: `Loaded ${data.performers.length} traders, ${data.opportunities.length} opportunities`,
      stats 
    });
  } catch(e) {
    console.error('[REFRESH] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
