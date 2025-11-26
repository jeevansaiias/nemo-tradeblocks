import { create } from "zustand";
import { devtools } from "zustand/middleware";

// New simplified types for Auto Take-Profit optimizer
export interface TradeRecord {
  strategy: string;
  entryDate: string;  // ISO date string
  exitDate: string;   // ISO date string
  maxProfitPct: number;
  maxLossPct: number;
  resultPct: number;  // realized (baseline) percentage
  pl?: number;        // realized P/L in dollars
  premium?: number;   // premium collected/paid in dollars
  marginReq?: number; // margin requirement in dollars
}

export interface TPResult {
  tpPct: number;
  trades: number;
  totalPnL: number;
  avgPerTrade: number;
  winRate: number;      // 0..1
  profitFactor: number; // winsum / |losssum|
  expectancy: number;   // (p*avgWin) - ((1-p)*|avgLoss|)
}

export interface TPOptimizerState {
  // Data state
  data: TradeRecord[];
  candidates: number[];          // auto-generated TP candidates
  results: TPResult[];
  baseline: TPResult | null;
  best: TPResult | null;
  objective: "totalPnL" | "expectancy" | "profitFactor";
  
  // Scope state
  scope: "overall" | "byStrategy";
  selectedStrategy?: string;
  
  // UI state
  isOptimizing: boolean;
  error: string | null;
  activeTab: string;
  
  // Actions
  setData: (data: TradeRecord[]) => void;
  setObjective: (objective: "totalPnL" | "expectancy" | "profitFactor") => void;
  setScope: (scope: "overall" | "byStrategy") => void;
  setSelectedStrategy: (strategy?: string) => void;
  setResults: (results: TPResult[]) => void;
  setBaseline: (baseline: TPResult) => void;
  setBest: (best: TPResult) => void;
  setCandidates: (candidates: number[]) => void;
  setActiveTab: (tab: string) => void;
  runOptimization: () => Promise<void>;
  clearData: () => void;
  getStrategies: () => string[];
  getScopedData: () => TradeRecord[];
}

export const useTPOptimizerStore = create<TPOptimizerState>()(
  devtools(
    (set, get) => ({
      // Initial state
      data: [],
      candidates: [],
      results: [],
      baseline: null,
      best: null,
      objective: "totalPnL",
      
      // Scope state
      scope: "overall",
      selectedStrategy: undefined,
      
      // UI state
      isOptimizing: false,
      error: null,
      activeTab: "upload",
      
      // Actions
      setData: (data) => set({ data, error: null }),
      setObjective: (objective) => set({ objective }),
      setScope: (scope) => set({ scope }),
      setSelectedStrategy: (strategy) => set({ selectedStrategy: strategy }),
      setResults: (results) => set({ results }),
      setBaseline: (baseline) => set({ baseline }),
      setBest: (best) => set({ best }),
      setCandidates: (candidates) => set({ candidates }),
      setActiveTab: (activeTab) => set({ activeTab }),
      
      getStrategies: () => {
        const { data } = get();
        const strategies = Array.from(new Set(data.map(trade => trade.strategy)));
        return strategies.sort();
      },
      
      getScopedData: () => {
        const { data, scope, selectedStrategy } = get();
        if (scope === "byStrategy" && selectedStrategy) {
          return data.filter(trade => trade.strategy === selectedStrategy);
        }
        return data;
      },
      
      runOptimization: async () => {
        const { getScopedData, objective } = get();
        const scopedData = getScopedData();
        
        if (scopedData.length === 0) {
          set({ error: "No data available for optimization" });
          return;
        }
        
        set({ isOptimizing: true, error: null });
        
        try {
          // Import the optimization functions dynamically
          const { autoTPCandidates, simulateTP, summarizeBaseline, pickBest } = await import("@/lib/processing/auto-tp");
          
          // Generate candidates using scoped data
          const candidates = autoTPCandidates(scopedData);
          
          // Calculate baseline using scoped data
          const baseline = summarizeBaseline(scopedData);
          
          // Calculate results for all candidates using scoped data
          const results = candidates.map((tpPct: number) => simulateTP(scopedData, tpPct));
          
          // Pick the best result
          const best = pickBest(results, objective);
          
          set({
            candidates,
            baseline,
            results,
            best,
            isOptimizing: false
          });
          
        } catch (error) {
          console.error("Optimization failed:", error);
          set({
            error: error instanceof Error ? error.message : "Optimization failed",
            isOptimizing: false
          });
        }
      },
      
      clearData: () => set({
        data: [],
        candidates: [],
        results: [],
        baseline: null,
        best: null,
        error: null,
        scope: "overall",
        selectedStrategy: undefined,
        activeTab: "upload"
      })
    }),
    {
      name: "tp-optimizer-store"
    }
  )
);