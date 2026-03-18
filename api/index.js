require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Mock data for demo
const sampleData = {
  "performers": [
    {
      "pseudonym": "Demo-Trader-Alpha",
      "score": 95,
      "total_pnl": 15420.50,
      "total_volume": 125000,
      "total_trades": 24,
      "markets_count": 8,
      "current_positions": [
        {
          "market": "Will Trump win 2028 election?",
          "outcome": "Yes", 
          "entry_price": 0.52,
          "current_price": 0.58,
          "pnl": 2840.50
        }
      ]
    },
    {
      "pseudonym": "Beta-Performer", 
      "score": 88,
      "total_pnl": 8750.25,
      "total_volume": 85000,
      "total_trades": 18,
      "markets_count": 6,
      "current_positions": []
    },
    {
      "pseudonym": "Gamma-Specialist",
      "score": 92, 
      "total_pnl": 12300.75,
      "total_volume": 95000,
      "total_trades": 21,
      "markets_count": 7,
      "current_positions": []
    }
  ],
  "opportunities": [
    {
      "market": "Will Trump win 2028 election?",
      "outcome": "Yes",
      "current_price": 0.58,
      "trader": "Demo-Trader-Alpha",
      "trader_score": 95,
      "entry_price": 0.52, 
      "pnl": 2840.50,
      "position_size": 15000,
      "copy_appeal": 82.5,
      "risk": "low"
    },
    {
      "market": "S&P 500 above 6000 by EOY?",
      "outcome": "No",
      "current_price": 0.34,
      "trader": "Gamma-Specialist",
      "trader_score": 92,
      "entry_price": 0.38,
      "pnl": -850.00,
      "position_size": 8500,
      "copy_appeal": 75.2,
      "risk": "medium"
    }
  ]
};

// API routes
app.get('/api/performers', (req, res) => {
  res.json(sampleData.performers);
});

app.get('/api/opportunities', (req, res) => {
  res.json(sampleData.opportunities);
});

app.get('/api/stats', (req, res) => {
  const stats = {
    totalTraders: sampleData.performers.length,
    totalPnL: sampleData.performers.reduce((sum, p) => sum + (p.total_pnl || 0), 0),
    avgScore: Math.round(sampleData.performers.reduce((sum, p) => sum + p.score, 0) / sampleData.performers.length),
    activeOpportunities: sampleData.opportunities.length,
    lastUpdated: new Date().toISOString()
  };
  res.json(stats);
});

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

module.exports = app;