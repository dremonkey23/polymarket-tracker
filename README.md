# 🎯 Polysights Insider Trading Dashboard

A professional trading intelligence dashboard that displays profitable trader picks from Polysights data, ranked by trader performance and profit potential.

## Features

- **🏆 Trader Leaderboard** — Top 20 performers ranked by profitability score (0-100)
- **🎯 Live Opportunities** — Current positions from top-rated traders with copy appeal scores
- **📊 Market Analysis** — Consensus view with multiple trader positions per market
- **⚡ Real-Time Updates** — WebSocket-powered live data refresh
- **📱 Mobile Responsive** — Bloomberg Terminal aesthetic, works on all devices
- **🔗 Polymarket Links** — Direct links for one-click copy trading

## Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm start

# Open in browser
# http://localhost:3000
```

## Configuration

Edit `.env`:

```env
PORT=3000
DB_PATH=./data/polysights.db
PYTHON_PATH=python
SCRAPER_PATH=../polysights-betting-tracker.py
REFRESH_INTERVAL_MS=900000
```

## Architecture

```
polysights-dashboard/
├── server/
│   ├── index.js          # Express + Socket.io server
│   ├── db/
│   │   ├── database.js   # SQLite data layer
│   │   └── migrate.js    # Schema migrations
│   ├── routes/
│   │   └── api.js        # REST API endpoints
│   └── scripts/
│       └── fetch-data.js # Python scraper integration
├── public/
│   └── index.html        # SPA dashboard (no build step)
├── data/                  # SQLite database
├── Dockerfile             # Docker deployment
└── .env                   # Configuration
```

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/stats` | GET | Dashboard summary statistics |
| `/api/traders?limit=20` | GET | Top traders leaderboard |
| `/api/traders/:name/history` | GET | Trader performance history |
| `/api/opportunities?minScore=90` | GET | Filtered betting opportunities |
| `/api/markets` | GET | Market consensus analysis |
| `/api/refresh` | POST | Trigger data refresh from scraper |

## Docker

```bash
docker build -t polysights-dashboard .
docker run -p 3000:3000 polysights-dashboard
```

## Data Flow

1. **Python scraper** fetches live data from Polysights API
2. **Node.js server** processes and stores in SQLite
3. **REST API** serves data to the frontend
4. **Socket.io** pushes real-time updates to connected clients
5. **Auto-refresh** runs every 15 minutes via cron

## Color Coding

- 🟢 **Green** — Profitable positions, hot traders (score 80+)
- 🔴 **Red** — Losing positions, cold streaks
- 🟡 **Yellow** — Neutral/flat, warm traders (score 60-79)
- 🔵 **Blue** — High-value opportunities

## Tech Stack

- **Backend:** Node.js, Express, Socket.io, better-sqlite3
- **Frontend:** Vanilla JS SPA (no build step), Chart.js
- **Database:** SQLite with WAL mode
- **Styling:** Custom CSS (dark theme, Bloomberg Terminal aesthetic)
- **Data:** Python scraper integration via child_process
