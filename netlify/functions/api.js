const https = require('https');

// Authentication cookies for Polysights API
const POLYSIGHTS_COOKIES = process.env.POLYSIGHTS_COOKIES || '_ga=GA1.1.1260151225.1773767022; privy-session=t; privy-token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImsyVEtEVnYzeGZKeGZVckNBbGJOVldROG01TkhQMm9yQVhxV0pJa3VXelEifQ.eyJzaWQiOiJjbW11djNncWQwNmZoMGNsZDZpZjJwOHYxIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NzM3ODc1NTQsImF1ZCI6ImNtNXJ2dGJ1NjBjOWI4MXY1Zmtpcm1oZHoiLCJzdWIiOiJkaWQ6cHJpdnk6Y21tdHhldDMxMDB4bDBiamlvczhxM2wwciIsImV4cCI6MTc3Mzc5MTE1NH0.HM0ZZhTl8vIVvLWav1xOSkugOcQtsjUR_ZPSsdu3BhUTam664VFQyn6Q5REGLcE5ojoznCpLNFk-Z7N8yuXc0w; _ga_HF6FBXWYMQ=GS2.1.s1773787552$o3$g1$t1773788631$j60$l0$h0';

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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
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
          reject(new Error(`Failed to parse JSON: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// Calculate trader score based on performance
function calculateTraderScore(trader) {
  const profitabilityScore = Math.min(100, Math.max(0, trader.total_pnl / 100)); // $1 = 1 point, max 100
  const activityScore = Math.min(30, trader.total_trades * 2); // 2 points per trade, max 30
  const volumeScore = Math.min(20, trader.total_volume / 1000); // $1000 volume = 1 point, max 20
  
  return Math.round(profitabilityScore + activityScore + volumeScore);
}

// Process and score traders
function processTraders(rawData) {
  if (!rawData || !Array.isArray(rawData)) {
    return [];
  }

  return rawData
    .map(trader => ({
      pseudonym: trader.pseudonym || 'Unknown',
      score: calculateTraderScore(trader),
      total_pnl: trader.total_pnl || 0,
      total_volume: trader.total_volume || 0,
      total_trades: trader.total_trades || 0,
      markets_count: trader.markets_count || 0,
      current_positions: trader.current_positions || []
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10); // Top 10 performers
}

// Generate betting opportunities
function generateOpportunities(performers) {
  const opportunities = [];
  
  performers.forEach(trader => {
    if (trader.current_positions && trader.current_positions.length > 0) {
      trader.current_positions.forEach(position => {
        if (position.pnl > 100) { // Only profitable positions > $100
          const copyAppeal = Math.min(100, (trader.score * 0.6) + (position.pnl / 100 * 0.4));
          
          opportunities.push({
            market: position.market,
            outcome: position.outcome,
            current_price: position.current_price,
            trader: trader.pseudonym,
            trader_score: trader.score,
            entry_price: position.entry_price,
            pnl: position.pnl,
            position_size: position.position_size || 0,
            copy_appeal: Math.round(copyAppeal * 10) / 10,
            risk: copyAppeal > 80 ? 'low' : copyAppeal > 60 ? 'medium' : 'high'
          });
        }
      });
    }
  });
  
  return opportunities
    .sort((a, b) => b.copy_appeal - a.copy_appeal)
    .slice(0, 20); // Top 20 opportunities
}

// Netlify Function Handler
exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const path = event.path.replace('/.netlify/functions/api', '');
    
    if (path === '/performers' || path === '/api/performers') {
      const rawData = await fetchPolysightsData();
      const performers = processTraders(rawData);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(performers)
      };
    }
    
    if (path === '/opportunities' || path === '/api/opportunities') {
      const rawData = await fetchPolysightsData();
      const performers = processTraders(rawData);
      const opportunities = generateOpportunities(performers);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(opportunities)
      };
    }
    
    if (path === '/stats' || path === '/api/stats') {
      const rawData = await fetchPolysightsData();
      const performers = processTraders(rawData);
      const opportunities = generateOpportunities(performers);
      
      const stats = {
        totalTraders: performers.length,
        totalPnL: performers.reduce((sum, p) => sum + (p.total_pnl || 0), 0),
        avgScore: performers.length > 0 ? Math.round(performers.reduce((sum, p) => sum + p.score, 0) / performers.length) : 0,
        activeOpportunities: opportunities.length,
        lastUpdated: new Date().toISOString()
      };
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(stats)
      };
    }
    
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Not found' })
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