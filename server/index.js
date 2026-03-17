require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const apiRoutes = require('./routes/api');
const db = require('./db/database');
const { runScraper, loadFromFile, findLatestDataFile } = require('./scripts/fetch-data');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api', apiRoutes);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);
  
  // Send current stats on connect
  try {
    const stats = db.getDashboardStats();
    socket.emit('stats-update', stats);
  } catch(e) {}
  
  socket.on('request-refresh', async () => {
    console.log(`[WS] Refresh requested by ${socket.id}`);
    await refreshData();
  });

  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected: ${socket.id}`);
  });
});

// Data refresh function
async function refreshData() {
  try {
    let data;
    
    try {
      data = await runScraper();
      console.log(`[REFRESH] Live scraper: ${data.performers.length} traders`);
    } catch(e) {
      console.warn('[REFRESH] Scraper failed, using file fallback');
      const latestFile = findLatestDataFile();
      if (latestFile) {
        data = loadFromFile(latestFile);
        console.log(`[REFRESH] Loaded from file: ${data.performers.length} traders`);
      } else {
        console.error('[REFRESH] No data available');
        return;
      }
    }

    if (data.performers) db.upsertTraders(data.performers);
    if (data.opportunities) db.insertOpportunities(data.opportunities);
    if (data.performers) db.saveSnapshot(data.performers, data.opportunities || []);

    // Broadcast update to all connected clients
    const stats = db.getDashboardStats();
    const traders = db.getTopTraders(20);
    const opportunities = db.getOpportunities(0, 50);
    const markets = db.getMarketAnalysis();
    
    io.emit('stats-update', stats);
    io.emit('traders-update', traders);
    io.emit('opportunities-update', opportunities);
    io.emit('markets-update', markets);
    
    console.log(`[REFRESH] Broadcast complete - ${traders.length} traders, ${opportunities.length} opportunities`);
  } catch(e) {
    console.error('[REFRESH] Error:', e.message);
  }
}

// Auto-refresh every 15 minutes
const refreshMs = parseInt(process.env.REFRESH_INTERVAL_MS) || 900000;
setInterval(refreshData, refreshMs);

// Also schedule with cron for reliability (every 15 min)
cron.schedule('*/15 * * * *', () => {
  console.log('[CRON] Scheduled refresh triggered');
  refreshData();
});

// Ensure DB is set up
try {
  require('./db/migrate');
  console.log('[DB] Schema verified');
} catch(e) {
  console.error('[DB] Migration error:', e.message);
}

// Initial data load
async function initialLoad() {
  console.log('[INIT] Loading initial data...');
  await refreshData();
}

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║  POLYSIGHTS INSIDER TRADING DASHBOARD               ║
║  Running on http://localhost:${PORT}                    ║
║  Auto-refresh: every ${refreshMs / 60000} minutes                     ║
╚══════════════════════════════════════════════════════╝
  `);
  
  // Load data after server starts
  setTimeout(initialLoad, 1000);
});
