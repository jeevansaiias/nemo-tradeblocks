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
  
  // UI state
  isOptimizing: boolean;
  error: string | null;
  activeTab: string;
  
  // Actions
  setData: (data: TradeRecord[]) => void;
  setObjective: (objective: "totalPnL" | "expectancy" | "profitFactor") => void;
  setResults: (results: TPResult[]) => void;
  setBaseline: (baseline: TPResult) => void;
  setBest: (best: TPResult) => void;
  setCandidates: (candidates: number[]) => void;
  setActiveTab: (tab: string) => void;
  runOptimization: () => Promise<void>;
  clearData: () => void;
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
      
      // UI state
      isOptimizing: false,
      error: null,
      activeTab: "upload",
      
      // Actions
      setData: (data) => set({ data, error: null }),
      setObjective: (objective) => set({ objective }),
      setResults: (results) => set({ results }),
      setBaseline: (baseline) => set({ baseline }),
      setBest: (best) => set({ best }),
      setCandidates: (candidates) => set({ candidates }),
      setActiveTab: (activeTab) => set({ activeTab }),
      
      runOptimization: async () => {
        const { data, objective } = get();
        if (data.length === 0) {
          set({ error: "No data available for optimization" });
          return;
        }
        
        set({ isOptimizing: true, error: null });
        
        try {
          // Import the optimization functions dynamically
          const { autoTPCandidates, simulateTP, summarizeBaseline, pickBest } = await import("@/lib/processing/auto-tp");
          
          // Generate candidates
          const candidates = autoTPCandidates(data);
          
          // Calculate baseline
          const baseline = summarizeBaseline(data);
          
          // Calculate results for all candidates
          const results = candidates.map((tpPct: number) => simulateTP(data, tpPct));
          
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
        activeTab: "upload"
      })
    }),
    {
      name: "tp-optimizer-store"
    }
  )
);