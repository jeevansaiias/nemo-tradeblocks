# File Upload & Processing Implementation Plan

## Overview
Implementation plan for client-side CSV processing with IndexedDB persistence for TradeBlocks React application.

## Phase 1: Core Data Models & Types

### TypeScript Data Models (`/lib/models/`)
- [ ] Create `Trade` interface matching legacy Trade model
- [ ] Create `DailyLogEntry` interface for daily log data
- [ ] Extend `Block` interface to include processed data references
- [ ] Create `PortfolioStats` interface for calculated metrics
- [ ] Create `StrategyStats` interface for per-strategy analysis

### Validation Schemas
- [ ] Create Zod schema for Trade validation
- [ ] Create Zod schema for DailyLogEntry validation
- [ ] Add error type definitions for parsing failures

## Phase 2: IndexedDB Infrastructure

### Database Service (`/lib/db/`)
- [ ] Create database initialization with stores: `blocks`, `trades`, `dailyLogs`
- [ ] Implement CRUD operations for blocks
- [ ] Add versioning and migration strategy
- [ ] Create indexes for querying (blockId, date, strategy)
- [ ] Implement transaction helpers

### Storage Abstraction Layer
- [ ] Create wrapper functions for common operations
- [ ] Add error handling and retry logic
- [ ] Implement data compression for large datasets
- [ ] Add storage quota management

## Phase 3: CSV Processing Pipeline

### CSV Parser Service (`/lib/processing/`)
- [ ] Implement trade log parser with column mapping
- [ ] Implement daily log parser
- [ ] Handle column name variations (commission aliases)
- [ ] Add progress tracking for large files
- [ ] Implement streaming parser for memory efficiency

### Data Validation & Cleaning
- [ ] Handle missing columns (default commissions to 0)
- [ ] Implement date/time parsing with timezone handling
- [ ] Add numeric field validation and coercion
- [ ] Implement strategy name normalization
- [ ] Add data integrity checks

## Phase 4: Local Calculations Engine

### Performance Calculations (`/lib/calculations/`)
- [ ] Implement portfolio stats calculator (P/L, win rate, avg win/loss)
- [ ] Add drawdown calculations (peak-to-trough)
- [ ] Create cumulative P/L tracking
- [ ] Implement strategy breakdown analysis
- [ ] Add time-based aggregations (daily, weekly, monthly)

### Caching Strategy
- [ ] Implement calculation memoization
- [ ] Store computed results in IndexedDB
- [ ] Add cache invalidation on data changes
- [ ] Create cache key generation strategy

## Phase 5: Block Management Integration

### Update BlockDialog Component
- [ ] Integrate CSV parsing on file drop/select
- [ ] Add upload progress indicator
- [ ] Display validation errors inline
- [ ] Show preview of parsed data
- [ ] Add confirmation step before saving

### Update Block Store
- [ ] Connect to IndexedDB instead of mock data
- [ ] Add async actions for file processing
- [ ] Implement loading states
- [ ] Add error handling
- [ ] Create optimistic updates

## Phase 6: Testing Infrastructure

### Unit Tests (`/__tests__/`)
- [ ] Create CSV parsing tests with sample files
- [ ] Add calculation accuracy tests
- [ ] Implement IndexedDB operations tests
- [ ] Add validation edge case tests
- [ ] Create integration tests

### Test Utilities
- [ ] Create mock file generator
- [ ] Add test data fixtures
- [ ] Implement IndexedDB test helpers
- [ ] Add performance benchmarks

## File Structure

### New Files to Create
```
/lib/models/
├── trade.ts              # Trade data model and types
├── daily-log.ts          # Daily log model and types
├── portfolio-stats.ts    # Statistics interfaces
└── index.ts              # Re-exports

/lib/db/
├── index.ts              # Database initialization
├── blocks-store.ts       # Block CRUD operations
├── trades-store.ts       # Trade operations
├── daily-logs-store.ts   # Daily log operations
└── migrations.ts         # Schema migrations

/lib/processing/
├── csv-parser.ts         # Base CSV parsing logic
├── trade-processor.ts    # Trade-specific processing
├── daily-log-processor.ts # Daily log processing
├── validators.ts         # Zod schemas
└── index.ts              # Processing pipeline

/lib/calculations/
├── portfolio-stats.ts    # Portfolio statistics
├── performance.ts        # Performance metrics
├── drawdown.ts          # Drawdown calculations
├── aggregations.ts      # Time-based aggregations
└── index.ts             # Calculation exports

/__tests__/
├── processing/
│   ├── trade-parser.test.ts
│   └── daily-log-parser.test.ts
├── calculations/
│   ├── portfolio-stats.test.ts
│   └── performance.test.ts
└── db/
    └── indexeddb.test.ts
```

### Files to Update
- [ ] `/components/block-dialog.tsx` - Add file processing
- [ ] `/lib/stores/block-store.ts` - Connect to IndexedDB
- [ ] `/components/sidebar-active-blocks.tsx` - Show real stats
- [ ] `/app/(platform)/blocks/page.tsx` - Load from IndexedDB

## Technical Considerations

### Performance
- [ ] Use Web Workers for CSV processing (files > 10MB)
- [ ] Implement chunked processing (batch size: 1000 trades)
- [ ] Add debouncing for recalculations
- [ ] Use virtual scrolling for large datasets

### Storage
- [ ] Handle browser storage quotas (request persistent storage)
- [ ] Implement data compression for trades
- [ ] Add storage usage monitoring
- [ ] Create data export functionality

### Error Handling
- [ ] Add comprehensive error boundaries
- [ ] Implement retry logic for failed operations
- [ ] Create user-friendly error messages
- [ ] Add error reporting/logging

### Data Integrity
- [ ] Implement data validation on import
- [ ] Add duplicate detection
- [ ] Create data recovery mechanisms
- [ ] Add import/export for backup

## Implementation Order

1. **Week 1**: Core models and IndexedDB setup
2. **Week 1-2**: CSV processing pipeline
3. **Week 2**: Calculations engine
4. **Week 2-3**: UI integration
5. **Week 3**: Testing and refinement

## Success Criteria

- [ ] Successfully parse and store trade/daily log CSV files
- [ ] All calculations match legacy Python implementation
- [ ] Performance: Process 10,000 trades in < 5 seconds
- [ ] Storage: Handle up to 100MB of data per block
- [ ] Tests: > 80% code coverage
- [ ] UX: Clear error messages and progress feedback

## Notes

- Priority is on accuracy over performance initially
- All processing happens client-side (no server calls)
- Maintain compatibility with OptionOmega CSV format
- Consider future migration path to server-side processing

## References

- Legacy models: `/legacy/app/data/models.py`
- Legacy processor: `/legacy/app/data/processor.py`
- Sample files: `/samplefiles/`
- Legacy tests: `/legacy/tests/unit/test_processor.py`