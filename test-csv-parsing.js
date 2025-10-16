// Simple test to debug CSV parsing
import { parseTradingCSV } from './lib/processing/tp-optimizer';
import fs from 'fs';

async function testCSVParsing() {
  try {
    const csvPath = '/Users/jeevansai/Downloads/Jeevan-Trimeed-Latest-V2-updated-1-Con (4).csv';
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    console.log('First few lines of CSV:');
    console.log(csvContent.split('\n').slice(0, 3).join('\n'));
    console.log('\n');
    
    const trades = parseTradingCSV(csvContent);
    
    console.log(`Successfully parsed ${trades.length} trades`);
    
    if (trades.length > 0) {
      console.log('\nFirst trade:');
      console.log(JSON.stringify(trades[0], null, 2));
      
      console.log('\nSample of all trades:');
      trades.slice(0, 5).forEach((trade, index) => {
        console.log(`Trade ${index + 1}: ${trade.symbol} | P&L: $${trade.pnl} | Entry: $${trade.entryPrice} | Exit: $${trade.exitPrice}`);
      });
    }
  } catch (error) {
    console.error('Error parsing CSV:', error);
  }
}

testCSVParsing();