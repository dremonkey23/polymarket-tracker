const https = require('https');

// Authentication cookies for Polysights API
const POLYSIGHTS_COOKIES = process.env.POLYSIGHTS_COOKIES || '_ga=GA1.1.1260151225.1773767022; privy-session=t; privy-token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImsyVEtEVnYzeGZKeGZVckNBbGJOVldROG01TkhQMm9yQVhxV0pJa3VXelEifQ.eyJzaWQiOiJjbW11djNncWQwNmZoMGNsZDZpZjJwOHYxIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NzM3OTY1OTksImF1ZCI6ImNtNXJ2dGJ1NjBjOWI4MXY1Zmtpcm1oZHoiLCJzdWIiOiJkaWQ6cHJpdnk6Y21tdHhldDMxMDB4bDBiamlvczhxM2wwciIsImV4cCI6MTc3MzgwMDE5OX0.P8gloBD1Jm8XsExlZLmU-ZP04z3jsuKbiclVgOydB8e2EKurskdAlbEp6fnbOnce6B_Hqf1oIw0Ykb6eBJ8FMA; _ga_HF6FBXWYMQ=GS2.1.s1773787552$o3$g1$t1773788631$j60$l0$h0';

// Fetch data from Polysights API
function fetchPolysightsData() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.polysights.xyz',
      path: '/api/insider-finder?batch=0&skipCount=false&activeMarket=1&activeHold=1',
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cookie': POLYSIGHTS_COOKIES,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Referer': 'https://www.polysights.xyz/insider-finder',
        'Origin': 'https://www.polysights.xyz'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (error) {
          reject(new Error(`Failed to parse JSON: ${error.message}. Raw: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// Aggregate positions into unique traders
function aggregateTraders(positions) {
  const traderMap = {};
  
  for (const pos of positions) {
    const key = pos.pseudonym || pos.proxyWallet || 'Unknown';
    if (!key || key === '') continue;
    
    if (!traderMap[key]) {
      traderMap[key] = {
        pseudonym: pos.pseudonym || 'Anonymous',
        name: pos.name || '',
        total_pnl: 0,
        total_volume: 0,
        total_trades: pos.total_trades || 0,
        markets_traded: pos.markets_traded || 0,
        positions: [],
        wins: 0,
        losses: 0,
        proxyWallet: pos.proxyWallet || ''
      };
    }
    
    const trader = traderMap[key];
    // Use user-level P&L (not market-level, to avoid double counting)
    trader.total_pnl = pos.user_profit_loss || 0; // This is cumulative per user
    trader.total_volume = pos.user_volume_traded || 0; // Also cumulative
    trader.total_trades = pos.total_trades || trader.total_trades;
    trader.markets_traded = pos.markets_traded || trader.markets_traded;
    
    // Track market-level P&L for win/loss
    if (pos.market_profit_loss > 0) trader.wins++;
    else if (pos.market_profit_loss < 0) trader.losses++;
    
    // Add position detail
    trader.positions.push({
      market: pos.title || 'Unknown Market',
      slug: pos.slug || '',
      eventSlug: pos.eventSlug || '',
      outcome: pos.outcome || '',
      side: pos.side || '',
      current_price: pos.price || 0,
      entry_price: pos.avg_entry_price || pos.initial_entry || 0,
      pnl: pos.market_profit_loss || 0,
      position_size: pos.size || 0,
      positions_value: pos.positions_value || 0,
      volume: pos.market_volume_traded || 0,
      icon: pos.icon || ''
    });
  }
  
  return Object.values(traderMap);
}

// Calculate trader score
function calculateTraderScore(trader) {
  // Profitability: up to 50 points
  const profitScore = Math.min(50, Math.max(0, (trader.total_pnl + 500) / 20));
  
  // Activity: up to 20 points (based on trades and markets)
  const activityScore = Math.min(20, (trader.total_trades * 1.5) + (trader.markets_traded * 2));
  
  // Volume: up to 15 points
  const volumeScore = Math.min(15, trader.total_volume / 2000);
  
  // Win rate: up to 15 points
  const totalBets = trader.wins + trader.losses;
  const winRate = totalBets > 0 ? trader.wins / totalBets : 0.5;
  const winRateScore = winRate * 15;
  
  return Math.round(Math.max(0, Math.min(100, profitScore + activityScore + volumeScore + winRateScore)));
}

// Determine trend based on recent positions
function determineTrend(trader) {
  if (trader.positions.length === 0) return 'neutral';
  const recentPnl = trader.positions.reduce((sum, p) => sum + p.pnl, 0);
  const avgPnl = recentPnl / trader.positions.length;
  if (avgPnl > 50) return 'hot';
  if (avgPnl > 0) return 'warm';
  if (avgPnl > -50) return 'neutral';
  return 'cold';
}

// Process raw API data into scored traders for the frontend
function processTraders(rawData, limit = 20) {
  // API returns { data: [...], totalCount: N }
  const positions = rawData && rawData.data ? rawData.data : (Array.isArray(rawData) ? rawData : []);
  
  if (positions.length === 0) return [];
  
  const traders = aggregateTraders(positions);
  
  return traders
    .map(trader => {
      const score = calculateTraderScore(trader);
      const totalBets = trader.wins + trader.losses;
      const winRate = totalBets > 0 ? trader.wins / totalBets : 0;
      const avgProfit = trader.total_trades > 0 ? trader.total_pnl / trader.total_trades : 0;
      
      return {
        pseudonym: trader.pseudonym,
        name: trader.name,
        score,
        total_pnl: Math.round(trader.total_pnl * 100) / 100,
        total_volume: Math.round(trader.total_volume * 100) / 100,
        total_trades: trader.total_trades,
        markets_count: trader.markets_traded,
        avg_profit_per_trade: Math.round(avgProfit * 100) / 100,
        win_rate: Math.round(winRate * 100) / 100,
        active_positions: trader.positions.length,
        trend: determineTrend(trader),
        positions: trader.positions,
        proxyWallet: trader.proxyWallet
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// Generate betting opportunities from top traders' positions
function generateOpportunities(traders, limit = 100) {
  const opportunities = [];
  
  for (const trader of traders) {
    if (!trader.positions) continue;
    
    for (const pos of trader.positions) {
      const copyAppeal = Math.min(100, 
        (trader.score * 0.5) + 
        (Math.max(0, pos.pnl) / 50 * 0.3) + 
        (pos.position_size / 1000 * 0.2)
      );
      
      let risk = 'high';
      if (trader.score >= 70 && pos.pnl > 0) risk = 'low';
      else if (trader.score >= 50 || pos.pnl > 0) risk = 'medium';
      
      const polymarketUrl = pos.slug 
        ? `https://polymarket.com/event/${pos.eventSlug || pos.slug}` 
        : null;
      
      opportunities.push({
        market: pos.market,
        slug: pos.slug,
        eventSlug: pos.eventSlug,
        outcome: pos.outcome,
        side: pos.side,
        current_price: pos.current_price,
        entry_price: pos.entry_price,
        pnl: Math.round(pos.pnl * 100) / 100,
        position_size: Math.round(pos.position_size * 100) / 100,
        trader_pseudonym: trader.pseudonym,
        trader_score: trader.score,
        copy_appeal: Math.round(copyAppeal * 10) / 10,
        risk,
        polymarket_url: polymarketUrl,
        icon: pos.icon
      });
    }
  }
  
  return opportunities
    .sort((a, b) => b.copy_appeal - a.copy_appeal)
    .slice(0, limit);
}

// Generate market-level aggregation
function generateMarkets(traders) {
  const marketMap = {};
  
  for (const trader of traders) {
    if (!trader.positions) continue;
    
    for (const pos of trader.positions) {
      const key = pos.slug || pos.market;
      if (!key) continue;
      
      if (!marketMap[key]) {
        marketMap[key] = {
          market: pos.market,
          slug: pos.slug,
          eventSlug: pos.eventSlug,
          icon: pos.icon,
          total_pnl: 0,
          total_volume: 0,
          traders: [],
          trader_scores: [],
          appeals: [],
          positions: 0
        };
      }
      
      const m = marketMap[key];
      m.total_pnl += pos.pnl || 0;
      m.total_volume += pos.volume || 0;
      m.positions++;
      
      if (!m.traders.includes(trader.pseudonym)) {
        m.traders.push(trader.pseudonym);
        m.trader_scores.push(trader.score);
      }
      
      m.avg_price = pos.current_price;
    }
  }
  
  return Object.values(marketMap)
    .map(m => ({
      market: m.market,
      slug: m.slug,
      eventSlug: m.eventSlug,
      icon: m.icon,
      avg_price: m.avg_price || 0,
      total_pnl: Math.round(m.total_pnl * 100) / 100,
      total_volume: Math.round(m.total_volume * 100) / 100,
      traders: m.traders.join(', '),
      avg_trader_score: m.trader_scores.length > 0 
        ? Math.round(m.trader_scores.reduce((a, b) => a + b, 0) / m.trader_scores.length) 
        : 0,
      consensus_risk: m.trader_scores.length > 1 && m.total_pnl > 0 ? 'low' : m.total_pnl > 0 ? 'medium' : 'high',
      max_appeal: m.trader_scores.length > 0 ? Math.max(...m.trader_scores) : 0,
      trader_count: m.traders.length
    }))
    .sort((a, b) => b.trader_count - a.trader_count || b.total_pnl - a.total_pnl)
    .slice(0, 30);
}

// Generate mock latest trades data
function generateLatestTrades(allTraders, limit = 50) {
  if (!allTraders || allTraders.length === 0) return [];
  
  const trades = [];
  const actions = ['buy', 'sell', 'open', 'close'];
  const outcomes = ['Yes', 'No'];
  const sides = ['Long', 'Short'];
  
  // Base time - start from now and go backwards
  let currentTime = new Date();
  
  for (let i = 0; i < limit; i++) {
    const trader = allTraders[Math.floor(Math.random() * Math.min(allTraders.length, 10))]; // Focus on top 10 traders
    const action = actions[Math.floor(Math.random() * actions.length)];
    const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
    const side = sides[Math.floor(Math.random() * sides.length)];
    
    // Generate realistic trade times (random intervals between 1 min and 6 hours ago)
    const minutesAgo = Math.floor(Math.random() * 360) + 1;
    const tradeTime = new Date(currentTime.getTime() - (minutesAgo * 60 * 1000));
    
    // Pick a random position from trader for realistic market data
    const position = trader.positions && trader.positions.length > 0 
      ? trader.positions[Math.floor(Math.random() * trader.positions.length)]
      : null;
      
    const market = position ? position.market : `Sample Market ${Math.floor(Math.random() * 100)}`;
    const slug = position ? position.slug : `sample-market-${i}`;
    const currentPrice = position ? position.current_price : (Math.random() * 0.8 + 0.1);
    
    // Generate realistic trade size based on trader's typical volume
    const avgPositionSize = trader.positions && trader.positions.length > 0
      ? trader.positions.reduce((sum, p) => sum + (p.position_size || 0), 0) / trader.positions.length
      : 1000;
    const tradeSize = Math.round(avgPositionSize * (0.5 + Math.random() * 1.5));
    
    // Calculate expected P&L for the trade
    const priceChange = (Math.random() - 0.5) * 0.2; // -10% to +10% price movement
    const expectedPnl = tradeSize * priceChange;
    
    trades.push({
      id: `trade_${i}_${Date.now()}`,
      timestamp: tradeTime.toISOString(),
      trader_pseudonym: trader.pseudonym,
      trader_rank: allTraders.findIndex(t => t.pseudonym === trader.pseudonym) + 1,
      trader_score: trader.score,
      action: action,
      market: market,
      slug: slug,
      outcome: outcome,
      side: side,
      price: currentPrice,
      size: tradeSize,
      expected_pnl: expectedPnl
    });
    
    // Slightly adjust time for next trade
    currentTime = new Date(currentTime.getTime() - (Math.random() * 30 * 60 * 1000)); // 0-30 min earlier
  }
  
  // Sort by most recent first
  return trades.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// Netlify Function Handler
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Normalize path: strip the function prefix
    let path = event.path
      .replace('/.netlify/functions/api', '')
      .replace(/^\/api/, '')  // strip leading /api
      .replace(/\/$/, '');     // strip trailing slash
    
    if (!path) path = '/';
    
    console.log('Request path:', event.path, '→ normalized:', path);

    // Fetch raw data from Polysights
    const rawData = await fetchPolysightsData();
    const recordCount = rawData && rawData.data ? rawData.data.length : 0;
    console.log(`Polysights API returned ${recordCount} records, totalCount: ${rawData.totalCount || 'N/A'}`);
    
    // Process into traders (get more for opportunities/markets)
    const allTraders = processTraders(rawData, 50);
    const topTraders = allTraders.slice(0, 20);
    
    // === ROUTES ===
    
    if (path === '/stats' || path === '') {
      const opportunities = generateOpportunities(allTraders);
      const hotTraders = topTraders.filter(t => t.trend === 'hot' || t.trend === 'warm').length;
      const avgAppeal = opportunities.length > 0
        ? Math.round(opportunities.reduce((sum, o) => sum + o.copy_appeal, 0) / opportunities.length * 10) / 10
        : 0;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          totalTraders: topTraders.length,
          hotTraders,
          avgScore: topTraders.length > 0 
            ? Math.round(topTraders.reduce((sum, t) => sum + t.score, 0) / topTraders.length)
            : 0,
          totalPnl: Math.round(topTraders.reduce((sum, t) => sum + t.total_pnl, 0) * 100) / 100,
          totalOpportunities: opportunities.length,
          avgAppeal,
          lastUpdate: new Date().toISOString(),
          _debug: { rawRecords: recordCount, uniqueTraders: allTraders.length }
        })
      };
    }
    
    if (path === '/traders' || path === '/performers') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(topTraders)
      };
    }
    
    if (path === '/opportunities') {
      const opportunities = generateOpportunities(allTraders);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(opportunities)
      };
    }
    
    if (path === '/markets') {
      const markets = generateMarkets(allTraders);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(markets)
      };
    }
    
    if (path === '/trades') {
      const limit = parseInt(params.get('limit')) || 50;
      const trades = generateLatestTrades(allTraders, limit);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(trades)
      };
    }
    
    if (path === '/refresh') {
      // Re-fetch and return success - data is always live
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: `Refreshed: ${recordCount} positions from ${allTraders.length} traders`,
          timestamp: new Date().toISOString()
        })
      };
    }
    
    // Debug endpoint
    if (path === '/debug') {
      const positions = rawData && rawData.data ? rawData.data : [];
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          apiResponseKeys: Object.keys(rawData || {}),
          totalCount: rawData.totalCount,
          positionsReturned: positions.length,
          firstRecord: positions[0] ? Object.keys(positions[0]) : [],
          samplePseudonyms: [...new Set(positions.map(p => p.pseudonym).filter(Boolean))].slice(0, 10),
          processedTraders: allTraders.length,
          topTraderSample: allTraders[0] || null
        })
      };
    }
    
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Not found', path, availableRoutes: ['/stats', '/traders', '/opportunities', '/markets', '/refresh', '/debug'] })
    };
    
  } catch (error) {
    console.error('API Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};
