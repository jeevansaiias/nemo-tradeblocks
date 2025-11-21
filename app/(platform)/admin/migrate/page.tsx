"use client"

import { useEffect, useState } from "react"
import { migrateDatabaseName } from "@/lib/db"
import type { MigrationResult } from "@/lib/db"

export default function DBMigrationPage() {
  const [allowed, setAllowed] = useState(false)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<MigrationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Opt-in: enable by env var NEXT_PUBLIC_ENABLE_DB_MIGRATION=true or query param ?dev-migrate-db=true
    try {
      const query = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams("")
      const viaQuery = query.get("dev-migrate-db") === "true"
      const viaEnv = (process.env.NEXT_PUBLIC_ENABLE_DB_MIGRATION || "") === "true"
      setAllowed(viaEnv || viaQuery)
    } catch {
      setAllowed(false)
    }
  }, [])

  const run = async () => {
    if (!allowed) return
    if (!confirm("This will copy your browser IndexedDB data from 'TradeBlocksDB' to 'NemoBlocksDB' in-place (non-destructive). Continue?")) return

    setRunning(true)
    setError(null)
    setResult(null)

    try {
      const res = await migrateDatabaseName('TradeBlocksDB', 'NemoBlocksDB')
      setResult(res)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">DB Migration (dev)</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Use this page to copy your browser IndexedDB from <code>TradeBlocksDB</code> to <code>NemoBlocksDB</code>.
        The operation is non-destructive: the original DB is left in place.
      </p>

      {!allowed ? (
        <div className="mt-4 rounded border p-4 bg-red-50">
          <p className="text-sm">This migration page is disabled. Enable by setting <code>NEXT_PUBLIC_ENABLE_DB_MIGRATION=true</code> or add <code>?dev-migrate-db=true</code> to the URL.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <button
            onClick={run}
            disabled={running}
            className={`inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-medium ${running ? 'bg-gray-400' : 'bg-primary text-white'}`}
          >
            {running ? 'Running migration...' : 'Run migration: TradeBlocksDB → NemoBlocksDB'}
          </button>

          {error && (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              Error: {error}
            </div>
          )}

          {result && (
            <div className="rounded border p-3 bg-green-50">
              <div className="text-sm font-medium">Migration completed</div>
              <pre className="mt-2 text-xs whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
