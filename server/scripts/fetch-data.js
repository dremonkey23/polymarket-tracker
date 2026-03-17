/**
 * Data fetcher - runs sanitized scraper and stores results in SQLite
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function runScraper() {
  return new Promise((resolve, reject) => {
    // In demo mode, use Node.js sanitized scraper
    if (process.env.DEMO_MODE === 'true') {
      const scraperPath = path.resolve(__dirname, 'sanitized-scraper.js');
      
      const childProcess = spawn('node', [scraperPath], {
        cwd: path.dirname(scraperPath),
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      childProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      childProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      childProcess.on('close', (code) => {
        if (code === 0) {
          try {
            // Read the generated sample data file
            const dataPath = path.join(__dirname, '../../polysights_sample_data.json');
            if (fs.existsSync(dataPath)) {
              const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
              
              // Transform to expected format
              const result = {
                performers: data.top_performers || [],
                opportunities: data.opportunities || []
              };
              
              resolve(result);
            } else {
              reject(new Error('Sample data file not found'));
            }
          } catch (error) {
            reject(new Error(`Failed to parse sample data: ${error.message}`));
          }
        } else {
          reject(new Error(`Scraper failed with code ${code}: ${errorOutput}`));
        }
      });

      childProcess.on('error', (error) => {
        reject(new Error(`Failed to start scraper: ${error.message}`));
      });
    } else {
      // Production mode would use real Python scraper (not included in public version)
      reject(new Error('Production mode requires authentication credentials'));
    }
  });
}

module.exports = {
  runScraper
};