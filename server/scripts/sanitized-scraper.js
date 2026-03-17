#!/usr/bin/env node
/**
 * Sanitized Polysights Data Scraper (Demo Mode)
 * Returns sample data instead of live authentication
 */

const fs = require('fs');
const path = require('path');

function generateSampleData() {
    // Sample trader data for demonstration
    const sampleTraders = [
        {
            pseudonym: "Demo-Trader-Alpha",
            score: 95,
            totalPnL: 15420.50,
            totalVolume: 125000,
            totalTrades: 24,
            avgProfitPerTrade: 642.52,
            activePositions: 3,
            trend: "hot"
        },
        {
            pseudonym: "Beta-Performer",
            score: 88,
            totalPnL: 8750.25,
            totalVolume: 85000,
            totalTrades: 18,
            avgProfitPerTrade: 486.12,
            activePositions: 2,
            trend: "warm"
        },
        {
            pseudonym: "Gamma-Specialist",
            score: 92,
            totalPnL: 12300.75,
            totalVolume: 95000,
            totalTrades: 21,
            avgProfitPerTrade: 585.75,
            activePositions: 4,
            trend: "hot"
        }
    ];

    const sampleOpportunities = [
        {
            market: "Will Trump win 2028 election?",
            outcome: "Yes",
            currentPrice: 0.58,
            trader: "Demo-Trader-Alpha", 
            traderScore: 95,
            entryPrice: 0.52,
            pnl: 2840.50,
            positionSize: 15000,
            copyAppeal: 82.5,
            risk: "low",
            slug: "trump-2028-election"
        },
        {
            market: "S&P 500 above 6000 by EOY?",
            outcome: "No",
            currentPrice: 0.34,
            trader: "Gamma-Specialist",
            traderScore: 92,
            entryPrice: 0.38,
            pnl: -850.00,
            positionSize: 8500,
            copyAppeal: 75.2,
            risk: "medium", 
            slug: "sp500-6000-eoy"
        }
    ];

    return {
        timestamp: new Date().toISOString(),
        opportunities: sampleOpportunities,
        top_performers: sampleTraders
    };
}

function main() {
    console.log("🔧 DEMO MODE: Generating sample trading data...");
    
    const sampleData = generateSampleData();
    
    // Save to the expected output location
    const outputPath = path.join(__dirname, '../../polysights_sample_data.json');
    fs.writeFileSync(outputPath, JSON.stringify(sampleData, null, 2));
    
    console.log("✅ Sample data generated successfully!");
    console.log(`📁 Saved to: ${outputPath}`);
    console.log(`📊 Generated ${sampleData.top_performers.length} sample traders and ${sampleData.opportunities.length} opportunities`);
}

if (require.main === module) {
    main();
}