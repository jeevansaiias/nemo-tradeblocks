/**
 * Test script to validate upload functionality
 * Tests the processing pipeline with sample files
 */

import fs from 'fs';

// Mock File object for testing
class MockFile {
  constructor(filePath, name) {
    this.arrayBuffer = async () => {
      const buffer = fs.readFileSync(filePath);
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    };
    this.name = name;
    this.size = fs.statSync(filePath).size;
    this.type = 'text/csv';
  }
}

async function testUpload() {
  try {
    console.log('Testing upload functionality...');

    // Create mock file objects
    const tradeLogPath = '/Users/davidromeo/Code/tradeblocks/samplefiles/tradelog.csv';
    const dailyLogPath = '/Users/davidromeo/Code/tradeblocks/samplefiles/dailylog.csv';

    const tradeLogFile = new MockFile(tradeLogPath, 'tradelog.csv');
    const dailyLogFile = new MockFile(dailyLogPath, 'dailylog.csv');

    console.log(`Trade log file: ${tradeLogFile.name} (${tradeLogFile.size} bytes)`);
    console.log(`Daily log file: ${dailyLogFile.name} (${dailyLogFile.size} bytes)`);

    // Test file type detection
    const { detectFileType } = await import('./lib/processing/index.js');

    const tradeLogType = detectFileType(tradeLogFile);
    const dailyLogType = detectFileType(dailyLogFile);

    console.log(`Detected types: ${tradeLogFile.name} -> ${tradeLogType}, ${dailyLogFile.name} -> ${dailyLogType}`);

    // Test CSV parsing
    const { CSVParser } = await import('./lib/processing/csv-parser.js');
    const parser = new CSVParser();

    console.log('Testing CSV parsing...');

    // Parse trade log
    const tradeLogBuffer = await tradeLogFile.arrayBuffer();
    const tradeLogText = new TextDecoder().decode(tradeLogBuffer);
    const tradeLogResult = await parser.parseCSV(tradeLogText, {
      progressCallback: (progress) => {
        console.log(`Trade log parsing: ${Math.round(progress.progress * 100)}%`);
      }
    });

    console.log(`Trade log parsed: ${tradeLogResult.data.length} rows, ${tradeLogResult.errors.length} errors`);

    // Parse daily log
    const dailyLogBuffer = await dailyLogFile.arrayBuffer();
    const dailyLogText = new TextDecoder().decode(dailyLogBuffer);
    const dailyLogResult = await parser.parseCSV(dailyLogText, {
      progressCallback: (progress) => {
        console.log(`Daily log parsing: ${Math.round(progress.progress * 100)}%`);
      }
    });

    console.log(`Daily log parsed: ${dailyLogResult.data.length} rows, ${dailyLogResult.errors.length} errors`);

    console.log('Upload functionality test completed successfully!');

  } catch (error) {
    console.error('Upload test failed:', error);
    process.exit(1);
  }
}

testUpload();