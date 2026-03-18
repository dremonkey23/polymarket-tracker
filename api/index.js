const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ── Demo Data ──────────────────────────────────────────────
const performers = [
  {
    pseudonym: "Demo-Trader-Alpha",
    score: 95,
    total_pnl: 15420.50,
    total_volume: 125000,
    total_trades: 24,
    markets_count: 8,
    current_positions: [
      {
        market: "Will Trump win 2028 election?",
        outcome: "Yes",
        entry_price: 0.52,
        current_price: 0.58,
        pnl: 2840.50
      }
    ]
  },
  {
    pseudonym: "Beta-Performer",
    score: 88,
    total_pnl: 8750.25,
    total_volume: 85000,
    total_trades: 18,
    markets_count: 6,
    current_positions: [
      {
        market: "Fed rate cut before July 2026?",
        outcome: "Yes",
        entry_price: 0.61,
        current_price: 0.72,
        pnl: 3200.00
      }
    ]
  },
  {
    pseudonym: "Gamma-Specialist",
    score: 92,
    total_pnl: 12300.75,
    total_volume: 95000,
    total_trades: 21,
    markets_count: 7,
    current_positions: [
      {
        market: "S&P 500 above 6000 by EOY?",
        outcome: "No",
        entry_price: 0.38,
        current_price: 0.34,
        pnl: -850.00
      }
    ]
  },
  {
    pseudonym: "Delta-Whale",
    score: 85,
    total_pnl: 22150.00,
    total_volume: 310000,
    total_trades: 45,
    markets_count: 12,
    current_positions: []
  },
  {
    pseudonym: "Epsilon-Sniper",
    score: 91,
    total_pnl: 9800.30,
    total_volume: 67000,
    total_trades: 15,
    markets_count: 5,
    current_positions: []
  }
];

const opportunities = [
  {
    market: "Will Trump win 2028 election?",
    outcome: "Yes",
    current_price: 0.58,
    trader: "Demo-Trader-Alpha",
    trader_pseudonym: "Demo-Trader-Alpha",
    trader_score: 95,
    entry_price: 0.52,
    pnl: 2840.50,
    position_size: 15000,
    copy_appeal: 82.5,
    risk: "low"
  },
  {
    market: "Fed rate cut before July 2026?",
    outcome: "Yes",
    current_price: 0.72,
    trader: "Beta-Performer",
    trader_pseudonym: "Beta-Performer",
    trader_score: 88,
    entry_price: 0.61,
    pnl: 3200.00,
    position_size: 12000,
    copy_appeal: 76.8,
    risk: "low"
  },
  {
    market: "S&P 500 above 6000 by EOY?",
    outcome: "No",
    current_price: 0.34,
    trader: "Gamma-Specialist",
    trader_pseudonym: "Gamma-Specialist",
    trader_score: 92,
    entry_price: 0.38,
    pnl: -850.00,
    position_size: 8500,
    copy_appeal: 75.2,
    risk: "medium"
  },
  {
    market: "Bitcoin above $150K by Dec 2026?",
    outcome: "Yes",
    current_price: 0.41,
    trader: "Delta-Whale",
    trader_pseudonym: "Delta-Whale",
    trader_score: 85,
    entry_price: 0.35,
    pnl: 5400.00,
    position_size: 25000,
    copy_appeal: 88.1,
    risk: "medium"
  },
  {
    market: "AI regulation bill passed 2026?",
    outcome: "No",
    current_price: 0.62,
    trader: "Epsilon-Sniper",
    trader_pseudonym: "Epsilon-Sniper",
    trader_score: 91,
    entry_price: 0.55,
    pnl: 1890.00,
    position_size: 9000,
    copy_appeal: 71.3,
    risk: "high"
  }
];

const markets = [
  {
    market: "Will Trump win 2028 election?",
    slug: "will-trump-win-2028-election",
    trader_count: 2,
    traders: "Demo-Trader-Alpha, Delta-Whale",
    avg_price: 0.55,
    total_pnl: 8240.50,
    total_volume: 140000,
    avg_trader_score: 90,
    max_appeal: 82.5,
    trend: "hot",
    risk: "low"
  },
  {
    market: "Fed rate cut before July 2026?",
    slug: "fed-rate-cut-before-july-2026",
    trader_count: 1,
    traders: "Beta-Performer",
    avg_price: 0.72,
    total_pnl: 3200.00,
    total_volume: 85000,
    avg_trader_score: 88,
    max_appeal: 76.8,
    trend: "warm",
    risk: "low"
  },
  {
    market: "S&P 500 above 6000 by EOY?",
    slug: "sp-500-above-6000-by-eoy",
    trader_count: 1,
    traders: "Gamma-Specialist",
    avg_price: 0.34,
    total_pnl: -850.00,
    total_volume: 95000,
    avg_trader_score: 92,
    max_appeal: 75.2,
    trend: "cold",
    risk: "medium"
  },
  {
    market: "Bitcoin above $150K by Dec 2026?",
    slug: "bitcoin-above-150k-by-dec-2026",
    trader_count: 1,
    traders: "Delta-Whale",
    avg_price: 0.41,
    total_pnl: 5400.00,
    total_volume: 310000,
    avg_trader_score: 85,
    max_appeal: 88.1,
    trend: "hot",
    risk: "medium"
  },
  {
    market: "AI regulation bill passed 2026?",
    slug: "ai-regulation-bill-passed-2026",
    trader_count: 1,
    traders: "Epsilon-Sniper",
    avg_price: 0.62,
    total_pnl: 1890.00,
    total_volume: 67000,
    avg_trader_score: 91,
    max_appeal: 71.3,
    trend: "warm",
    risk: "high"
  }
];

// ── API Routes ─────────────────────────────────────────────

app.get('/api/stats', (req, res) => {
  const stats = {
    totalTraders: performers.length,
    totalPnL: performers.reduce((sum, p) => sum + (p.total_pnl || 0), 0),
    avgScore: Math.round(performers.reduce((sum, p) => sum + p.score, 0) / performers.length),
    activeOpportunities: opportunities.length,
    lastUpdated: new Date().toISOString()
  };
  res.json(stats);
});

app.get('/api/traders', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  res.json(performers.slice(0, limit));
});

app.get('/api/performers', (req, res) => {
  res.json(performers);
});

app.get('/api/opportunities', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  res.json(opportunities.slice(0, limit));
});

app.get('/api/markets', (req, res) => {
  res.json(markets);
});

app.post('/api/refresh', (req, res) => {
  res.json({ success: true, message: 'Demo mode - data refreshed', timestamp: new Date().toISOString() });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mode: 'demo', timestamp: new Date().toISOString() });
});

// DO NOT serve static files — Vercel handles public/ automatically
module.exports = app;
