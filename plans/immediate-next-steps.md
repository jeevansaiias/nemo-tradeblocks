# Immediate Next Steps - Upload Processing Focus

## 🎯 Current Status
We have built the core infrastructure (Phases 1-4):
- ✅ Data models and validation
- ✅ IndexedDB persistence layer
- ✅ CSV parsing pipeline
- ✅ Basic calculations engine

## 🚨 Critical Gaps for Upload Processing

### Priority 1: Core Data Processing Fixes (MUST HAVE for uploads to work)

#### Initial Capital Calculation
- [x] Implement `calculateInitialCapital()` using first trade's `fundsAtClose - pl`
- [x] Add fallback to daily log if available
- [x] Store initial capital with block metadata

#### Data Normalization & Edge Cases
- [x] Handle empty strategy names → default to "Unknown"
- [x] Handle missing/NaN VIX data gracefully
- [x] Handle BOM character in CSV files (already done ✓)
- [x] Default missing commission columns to 0 (already done ✓)
- [x] Handle simultaneous trades (sort by time, then fundsAtClose)

#### Daily Log Integration
- [x] Properly link daily log entries to blocks in IndexedDB
- [x] Use daily log for portfolio value when available
- [x] Fall back to trade data when daily log missing

### Priority 2: UI Integration (Wire up what we built)

#### Update BlockDialog Component (`/components/block-dialog.tsx`)
- [ ] Connect file drop/select to CSV processors
- [ ] Show real-time progress during parsing
- [ ] Display validation errors inline
- [ ] Preview parsed data (row count, date range, strategies)
- [ ] Save processed data to IndexedDB on confirmation

#### Update Block Store (`/lib/stores/block-store.ts`)
- [ ] Replace mock data with IndexedDB queries
- [ ] Add async loading states
- [ ] Handle errors gracefully
- [ ] Implement optimistic updates

#### Update Sidebar (`/components/sidebar-active-blocks.tsx`)
- [ ] Display real calculated stats from IndexedDB
- [ ] Show actual file names and row counts
- [ ] Display real last modified dates

### Priority 3: Essential Calculations Only

#### For Block Stats Page (minimum viable)
- [ ] Total P/L ✅ (already done)
- [ ] Win rate ✅ (already done)
- [ ] Average win/loss ✅ (already done)
- [ ] Max drawdown ✅ (already done)
- [ ] Trade count by strategy ✅ (already done)
- [ ] Basic Sharpe ratio ✅ (already done)

## 📋 Implementation Checklist

### Step 1: Data Processing Fixes ✅ COMPLETED
```typescript
// /lib/processing/capital-calculator.ts
- [x] Create initial capital calculator
- [x] Add daily log fallback logic
- [x] Test with sample data

// /lib/processing/trade-processor.ts
- [x] Add strategy name normalization
- [x] Handle NaN values properly
- [x] Add simultaneous trade sorting

// /lib/processing/daily-log-processor.ts
- [x] Link entries to block ID
- [x] Add interpolation logic
```

### Step 2: Wire BlockDialog ✅ COMPLETED
```typescript
// /components/block-dialog.tsx
- [x] Import TradeProcessor and DailyLogProcessor
- [x] Add file processing on drop/select
- [x] Create progress state management
- [x] Add error display
- [x] Implement preview UI
- [x] Connect save to IndexedDB
```

### Step 3: Connect Block Store ✅ COMPLETED
```typescript
// /lib/stores/block-store.ts
- [x] Import IndexedDB functions
- [x] Replace mock data initialization
- [x] Add async actions with loading states
- [x] Implement error boundaries
- [x] Add data refresh logic
```

### Step 4: Basic Testing ✅ COMPLETED
- [x] Test upload with sample files
- [x] Verify data appears in IndexedDB
- [x] Confirm stats calculate correctly
- [x] Test error handling
- [x] Verify UI updates

### Step 5: Runtime Error Fixes ✅ COMPLETED
- [x] Fix convertProcessedBlockToBlock null reference errors
- [x] Add graceful error handling for malformed blocks
- [x] Ensure block loading doesn't crash on individual block errors
- [x] Test that existing uploaded blocks display correctly

## 🚀 What This Enables

Once complete, users can:
1. Upload trade and daily log CSV files
2. See files processing with progress feedback
3. Preview data before saving
4. Store multiple blocks persistently
5. Switch between blocks
6. View basic stats in the sidebar
7. Have data ready for Block Stats page

## 🔮 Future Enhancements (Can Wait)

### Advanced Calculations (implement as needed per page)
- **Risk Simulator**: Monte Carlo simulation
- **Position Sizing**: Kelly criterion, position optimization
- **Correlation Matrix**: Strategy correlation calculations
- **Performance Blocks**: Advanced metrics (CAGR, Sortino, Calmar)

### Nice-to-Have Features
- Web Worker processing for large files
- Data compression for storage efficiency
- Export/import for backup
- Bulk operations
- Search and filtering

## 📊 Success Criteria

✅ **Minimum Viable Product**: **ACHIEVED**
- ✅ Can upload both CSV types
- ✅ Data persists across sessions
- ✅ Basic stats display correctly
- ✅ Can switch between blocks
- ✅ No crashes on edge cases

## 🏃 Status: MVP COMPLETE!

**All core functionality is now working:**
- File upload processing ✅
- IndexedDB persistence ✅
- Block management ✅
- Stats calculation ✅
- Error handling ✅

**Ready for advanced features development or production use.**