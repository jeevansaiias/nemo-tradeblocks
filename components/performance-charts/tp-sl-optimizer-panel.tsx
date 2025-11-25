'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, RefreshCcw, Trash2 } from 'lucide-react'

import { usePerformanceStore } from '@/lib/stores/performance-store'
import { NORMALIZATION_BASES, type NormalizationBasis } from '@/lib/calculations/mfe-mae'
import type { TPSlScenarioConfig } from '@/lib/types/exit-optimization'

import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'

const BASIS_LABELS: Record<NormalizationBasis, string> = {
	margin: 'Margin Requirement',
	premium: 'Collected Premium'
}

type EditableScenario = TPSlScenarioConfig & { id: string }

const generateScenarioId = () => {
	if (typeof globalThis !== 'undefined') {
		const cryptoRef = globalThis.crypto
		if (cryptoRef?.randomUUID) {
			return cryptoRef.randomUUID()
		}
	}

	return Math.random().toString(36).slice(2)
}

const formatPercent = (value?: number, digits = 1) => {
	if (typeof value !== 'number' || Number.isNaN(value)) {
		return '—'
	}

	const rounded = value.toFixed(digits)
	return `${value >= 0 ? '+' : ''}${rounded}%`
}

const formatNumber = (value?: number, digits = 0) => {
	if (typeof value !== 'number' || Number.isNaN(value)) {
		return '—'
	}

	return value.toLocaleString(undefined, {
		maximumFractionDigits: digits,
		minimumFractionDigits: digits
	})
}

const createScenario = (tpPct = 20, slPct = -10): EditableScenario => ({
	id: generateScenarioId(),
	tpPct,
	slPct
})

interface TPSLOptimizerPanelProps {
	className?: string
}

export function TPSLOptimizerPanel({ className }: TPSLOptimizerPanelProps) {
	const {
		data,
		tpSlBasis,
		tpSlGrid,
		setTpSlBasis,
		setTpSlGrid,
		runTpSlOptimizer,
		isLoading
	} = usePerformanceStore(state => ({
		data: state.data,
		tpSlBasis: state.tpSlBasis,
		tpSlGrid: state.tpSlGrid,
		setTpSlBasis: state.setTpSlBasis,
		setTpSlGrid: state.setTpSlGrid,
		runTpSlOptimizer: state.runTpSlOptimizer,
		isLoading: state.isLoading
	}))

	const tpSlResults = data?.tpSlResults
	const [gridDraft, setGridDraft] = useState<EditableScenario[]>(() => tpSlGrid.map(scenario => ({ ...scenario, id: generateScenarioId() })))
	const [gridError, setGridError] = useState<string | null>(null)

	useEffect(() => {
		setGridDraft(tpSlGrid.map(scenario => ({ ...scenario, id: generateScenarioId() })))
	}, [tpSlGrid])

	const tradesWithExcursions = data?.mfeMaeData?.length ?? 0
	const sortedResults = useMemo(() => {
		const results = tpSlResults ?? []
		if (results.length === 0) return []
		return [...results].sort((a, b) => b.totalReturnPct - a.totalReturnPct)
	}, [tpSlResults])

	const bestScenario = sortedResults[0]

	const handleScenarioChange = (index: number, field: keyof TPSlScenarioConfig, value: string) => {
		setGridDraft(prev => {
			const next = [...prev]
			const numericValue = Number(value)
			next[index] = {
				...next[index],
				[field]: Number.isFinite(numericValue) ? numericValue : next[index][field]
			}
			return next
		})
	}

	const handleAddScenario = () => {
		setGridDraft(prev => [...prev, createScenario(25, -12)])
	}

	const handleRemoveScenario = (index: number) => {
		setGridDraft(prev => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
	}

	const handleResetDraft = () => {
		setGridDraft(tpSlGrid.map(scenario => ({ ...scenario, id: generateScenarioId() })))
		setGridError(null)
	}

	const sanitizeGrid = () =>
		gridDraft
			.map(row => ({ tpPct: Number(row.tpPct), slPct: Number(row.slPct) }))
			.filter(row => Number.isFinite(row.tpPct) && Number.isFinite(row.slPct))

	const handleApplyGrid = () => {
		const sanitized = sanitizeGrid()
		if (sanitized.length === 0) {
			setGridError('Add at least one valid TP/SL combo before running the optimizer.')
			return
		}

		setGridError(null)
		setTpSlGrid(sanitized)
	}

	const rerunWithDraft = () => {
		const sanitized = sanitizeGrid()
		if (sanitized.length === 0) {
			setGridError('Add at least one valid TP/SL combo before running the optimizer.')
			return
		}

		setGridError(null)
		runTpSlOptimizer(sanitized, tpSlBasis)
	}

	const handleBasisChange = (value: NormalizationBasis) => {
		setTpSlBasis(value)
	}

	return (
		<Card className={cn('space-y-4', className)}>
			<CardHeader>
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<CardTitle className="text-xl">TP / SL Scenario Lab</CardTitle>
						<CardDescription>
							Replay every trade using excursion data to see how configurable take-profit and stop-loss pairs would have performed.
						</CardDescription>
					</div>
					<Badge variant="outline" className="text-xs">
						Basis: {BASIS_LABELS[tpSlBasis as NormalizationBasis] ?? tpSlBasis}
					</Badge>
				</div>
			</CardHeader>
			<CardContent className="space-y-6">
				{tradesWithExcursions === 0 ? (
					<Alert>
						<AlertDescription>
							Upload a trade log with Max Profit / Max Loss data to unlock excursion analysis. The optimizer reuses the same MAE/MFE dataset that powers the scatter plot.
						</AlertDescription>
					</Alert>
				) : (
					<>
						<section className="space-y-4">
							<div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
								<div className="space-y-2">
									<Label>Normalization basis</Label>
									<Select value={tpSlBasis} onValueChange={value => handleBasisChange(value as NormalizationBasis)}>
										<SelectTrigger>
											<SelectValue placeholder="Choose basis" />
										</SelectTrigger>
										<SelectContent>
											{NORMALIZATION_BASES.map(basis => (
												<SelectItem key={basis} value={basis}>
													{BASIS_LABELS[basis]}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<p className="text-xs text-muted-foreground">
										We normalize each trade&rsquo;s MFE/MAE against this denominator before applying TP/SL exits.
									</p>
								</div>
								<div className="space-y-3">
									<div className="flex items-center justify-between">
										<Label className="text-sm">Scenario grid</Label>
										<Button variant="outline" size="sm" onClick={handleResetDraft}>
											<RefreshCcw className="mr-2 h-3.5 w-3.5" />
											Reset edits
										</Button>
									</div>
									<div className="overflow-hidden rounded-md border">
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead className="w-32">Take-Profit %</TableHead>
													<TableHead className="w-32">Stop-Loss %</TableHead>
													<TableHead className="text-right">Actions</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{gridDraft.map((scenario, index) => (
													<TableRow key={scenario.id}>
														<TableCell>
															<Input
																type="number"
																inputMode="decimal"
																value={scenario.tpPct}
																onChange={event => handleScenarioChange(index, 'tpPct', event.target.value)}
																className="h-9"
																aria-label="Take profit percent"
															/>
														</TableCell>
														<TableCell>
															<Input
																type="number"
																inputMode="decimal"
																value={scenario.slPct}
																onChange={event => handleScenarioChange(index, 'slPct', event.target.value)}
																className="h-9"
																aria-label="Stop loss percent"
															/>
														</TableCell>
														<TableCell className="text-right">
															<Button
																variant="ghost"
																size="icon"
																onClick={() => handleRemoveScenario(index)}
																disabled={gridDraft.length === 1}
																aria-label="Remove scenario"
															>
																<Trash2 className="h-4 w-4" />
															</Button>
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</div>
									<div className="flex flex-wrap items-center justify-between gap-2">
										<Button variant="outline" size="sm" onClick={handleAddScenario}>
											<Plus className="mr-2 h-3.5 w-3.5" /> Add scenario
										</Button>
										<div className="flex gap-2">
											<Button variant="secondary" size="sm" onClick={rerunWithDraft}>
												Test without saving
											</Button>
											<Button size="sm" onClick={handleApplyGrid}>
												Apply grid &amp; run
											</Button>
										</div>
									</div>
									{gridError && <p className="text-xs text-destructive">{gridError}</p>}
								</div>
							</div>
						</section>

						{isLoading && !data ? (
							<Alert>
								<AlertDescription>Fetching trades… we&rsquo;ll run the optimizer once data is ready.</AlertDescription>
							</Alert>
						) : (tpSlResults?.length ?? 0) === 0 ? (
							<Alert>
								<AlertDescription>
									No scenarios have been simulated yet. Add at least one TP/SL pair and click &ldquo;Apply grid &amp; run&rdquo; to see results.
								</AlertDescription>
							</Alert>
						) : (
							<section className="space-y-4">
								<div className="grid gap-4 md:grid-cols-3">
									<div className="rounded-md border p-4">
										<p className="text-xs uppercase text-muted-foreground">Top scenario</p>
										<div className="mt-1 text-2xl font-semibold">
											{bestScenario ? `${bestScenario.tpPct}% / ${bestScenario.slPct}%` : '—'}
										</div>
										<p className="text-xs text-muted-foreground">
											TP / SL (percent of {BASIS_LABELS[tpSlBasis as NormalizationBasis]})
										</p>
									</div>
									<div className="rounded-md border p-4">
										<p className="text-xs uppercase text-muted-foreground">Avg Return per Trade</p>
										<div className="mt-1 text-2xl font-semibold">{formatPercent(bestScenario?.avgReturnPct)}</div>
										<p className="text-xs text-muted-foreground">ROM style return across {bestScenario?.trades ?? 0} trades</p>
									</div>
									<div className="rounded-md border p-4">
										<p className="text-xs uppercase text-muted-foreground">Hit Ratio</p>
										<div className="mt-1 text-2xl font-semibold">
											{formatPercent(bestScenario?.tpHitRate)} TP · {formatPercent(bestScenario?.slHitRate)} SL
										</div>
										<p className="text-xs text-muted-foreground">Distribution of exits when rules are imposed</p>
									</div>
								</div>

								<div className="rounded-lg border">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Rank</TableHead>
												<TableHead>TP %</TableHead>
												<TableHead>SL %</TableHead>
												<TableHead>Win Rate</TableHead>
												<TableHead>Avg Return</TableHead>
												<TableHead>Total Return</TableHead>
												<TableHead>TP Hits</TableHead>
												<TableHead>SL Hits</TableHead>
												<TableHead>Trades</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{sortedResults.map((result, index) => (
												<TableRow key={result.id} className={cn(result.id === bestScenario?.id && 'bg-muted/50')}>
													<TableCell className="font-medium">{index + 1}</TableCell>
													<TableCell>{result.tpPct}%</TableCell>
													<TableCell>{result.slPct}%</TableCell>
													<TableCell>{formatPercent(result.winRate)}</TableCell>
													<TableCell>{formatPercent(result.avgReturnPct)}</TableCell>
													<TableCell>{formatPercent(result.totalReturnPct)}</TableCell>
													<TableCell>{formatPercent(result.tpHitRate)}</TableCell>
													<TableCell>{formatPercent(result.slHitRate)}</TableCell>
													<TableCell>{formatNumber(result.trades)}</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
								<p className="text-xs text-muted-foreground">
									Simulated on {formatNumber(tradesWithExcursions)} trades with valid MFE/MAE data. Results compare rule exits against your actual exits without altering the underlying MAE/MFE calculations.
								</p>
							</section>
						)}
					</>
				)}
			</CardContent>
		</Card>
	)
}
