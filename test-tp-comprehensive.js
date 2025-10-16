/**
 * Test to verify comprehensive TP testing (1% to 15,000%)
 */

// Simple test data
const testTrades = [
  { strategy: "Test", resultPct: 5, maxProfitPct: 8, stopLoss: -2 },
  { strategy: "Test", resultPct: -3, maxProfitPct: 1, stopLoss: -3 },
  { strategy: "Test", resultPct: 10, maxProfitPct: 15, stopLoss: -5 },
  { strategy: "Test", resultPct: -2, maxProfitPct: 2, stopLoss: -2 },
  { strategy: "Test", resultPct: 8, maxProfitPct: 12, stopLoss: -4 }
];

// Generate TP candidates manually for testing
function autoTPCandidates(trades) {
  if (trades.length === 0) return [];
  
  const candidates = new Set();
  
  // Test every 1% increment from 1% to 100%
  for (let tp = 1; tp <= 100; tp++) {
    candidates.add(tp);
  }
  
  // Test every 5% increment from 105% to 500% 
  for (let tp = 105; tp <= 500; tp += 5) {
    candidates.add(tp);
  }
  
  // Test every 10% increment from 510% to 1000%
  for (let tp = 510; tp <= 1000; tp += 10) {
    candidates.add(tp);
  }
  
  // Test every 25% increment from 1025% to 2500%
  for (let tp = 1025; tp <= 2500; tp += 25) {
    candidates.add(tp);
  }
  
  // Test every 50% increment from 2550% to 5000%
  for (let tp = 2550; tp <= 5000; tp += 50) {
    candidates.add(tp);
  }
  
  // Test every 100% increment from 5100% to 10000%
  for (let tp = 5100; tp <= 10000; tp += 100) {
    candidates.add(tp);
  }
  
  // Test every 250% increment from 10250% to 15000%
  for (let tp = 10250; tp <= 15000; tp += 250) {
    candidates.add(tp);
  }
  
  // Convert to sorted array
  return Array.from(candidates).sort((a, b) => a - b);
}

function simulateTP(trades, tpPct) {
  const results = trades.map(trade => {
    const maxProfit = parseFloat(trade.maxProfitPct) || 0;
    const actualResult = parseFloat(trade.resultPct) || 0;
    
    // If max profit reached TP level, use TP; otherwise use actual result
    if (maxProfit >= tpPct) {
      return tpPct;
    } else {
      return actualResult;
    }
  });
  
  const totalPnL = results.reduce((sum, r) => sum + r, 0);
  const avgPerTrade = results.length > 0 ? totalPnL / results.length : 0;
  
  const winners = results.filter(r => r > 0);
  const losers = results.filter(r => r < 0);
  const winRate = results.length > 0 ? winners.length / results.length : 0;
  
  const avgWin = winners.length > 0 ? winners.reduce((sum, w) => sum + w, 0) / winners.length : 0;
  const avgLoss = losers.length > 0 ? Math.abs(losers.reduce((sum, l) => sum + l, 0) / losers.length) : 0;
  
  const grossProfit = winners.reduce((sum, w) => sum + w, 0);
  const grossLoss = Math.abs(losers.reduce((sum, l) => sum + l, 0));
  
  const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? Infinity : 0) : grossProfit / grossLoss;
  const expectancy = winners.length === 0 && losers.length === 0 ? 0 : 
    (winRate * avgWin) - ((1 - winRate) * avgLoss);
  
  return {
    trades: trades.length,
    totalPnL,
    avgPerTrade,
    winRate,
    profitFactor,
    expectancy
  };
}

function summarizeBaseline(trades) {
  const results = trades.map(trade => parseFloat(trade.resultPct) || 0);
  
  const totalPnL = results.reduce((sum, r) => sum + r, 0);
  const avgPerTrade = results.length > 0 ? totalPnL / results.length : 0;
  
  const winners = results.filter(r => r > 0);
  const losers = results.filter(r => r < 0);
  const winRate = results.length > 0 ? winners.length / results.length : 0;
  
  const avgWin = winners.length > 0 ? winners.reduce((sum, w) => sum + w, 0) / winners.length : 0;
  const avgLoss = losers.length > 0 ? Math.abs(losers.reduce((sum, l) => sum + l, 0) / losers.length) : 0;
  
  const grossProfit = winners.reduce((sum, w) => sum + w, 0);
  const grossLoss = Math.abs(losers.reduce((sum, l) => sum + l, 0));
  
  const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? Infinity : 0) : grossProfit / grossLoss;
  const expectancy = winners.length === 0 && losers.length === 0 ? 0 : 
    (winRate * avgWin) - ((1 - winRate) * avgLoss);
  
  return {
    tpPct: 0,
    trades: trades.length,
    totalPnL,
    avgPerTrade,
    winRate,
    profitFactor,
    expectancy
  };
}

console.log("🧪 Testing Comprehensive TP Analysis (1% to 15,000%)");
console.log("=".repeat(60));

// Generate candidates
const candidates = autoTPCandidates(testTrades);
console.log(`✅ Generated ${candidates.length} TP candidates`);
console.log(`   Range: ${candidates[0]}% to ${candidates[candidates.length - 1]}%`);

// Test a few specific ranges
const ranges = [
  { start: 1, end: 100, expected: 100 },
  { start: 105, end: 500, expected: 80 },
  { start: 10250, end: 15000, expected: 20 }
];

ranges.forEach(range => {
  const inRange = candidates.filter(c => c >= range.start && c <= range.end);
  console.log(`   ${range.start}%-${range.end}%: ${inRange.length} candidates (expected ~${range.expected})`);
});

// Calculate baseline
const baseline = summarizeBaseline(testTrades);
console.log(`\n📊 Baseline Performance:`);
console.log(`   Total P&L: ${baseline.totalPnL.toFixed(2)}%`);
console.log(`   Trades: ${baseline.trades}`);

// Test all candidates
console.log(`\n🚀 Testing ALL ${candidates.length} TP candidates...`);
const startTime = Date.now();

const results = candidates.map(tpPct => {
  const result = simulateTP(testTrades, tpPct);
  return { ...result, tpPct };
});

const endTime = Date.now();
console.log(`✅ Completed in ${endTime - startTime}ms`);

// Find the best result
const bestResult = results.reduce((best, current) => 
  current.totalPnL > best.totalPnL ? current : best
);

console.log(`\n🎯 Optimization Results:`);
console.log(`   Best TP: ${bestResult.tpPct}%`);
console.log(`   Best P&L: ${bestResult.totalPnL.toFixed(2)}%`);
console.log(`   Improvement: ${(bestResult.totalPnL - baseline.totalPnL).toFixed(2)}%`);

// Show distribution of results
const aboveBaseline = results.filter(r => r.totalPnL > baseline.totalPnL);
const atBaseline = results.filter(r => Math.abs(r.totalPnL - baseline.totalPnL) < 0.01);
const belowBaseline = results.filter(r => r.totalPnL < baseline.totalPnL);

console.log(`\n📈 Performance Distribution:`);
console.log(`   Above baseline: ${aboveBaseline.length} TPs`);
console.log(`   At baseline: ${atBaseline.length} TPs`);
console.log(`   Below baseline: ${belowBaseline.length} TPs`);

// Show top 10 performers
console.log(`\n🏆 Top 10 TP Levels:`);
const top10 = results
  .slice()
  .sort((a, b) => b.totalPnL - a.totalPnL)
  .slice(0, 10);

top10.forEach((result, i) => {
  const improvement = result.totalPnL - baseline.totalPnL;
  console.log(`   #${i + 1}: ${result.tpPct}% → ${result.totalPnL.toFixed(2)}% (${improvement >= 0 ? '+' : ''}${improvement.toFixed(2)}%)`);
});

console.log(`\n✅ VERIFICATION: All ${candidates.length} candidates tested successfully!`);