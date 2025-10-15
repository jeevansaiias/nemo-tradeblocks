"use client"

import { useState } from "react"
import { format } from "date-fns"
import { ChevronDown, ChevronUp, Filter } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  formatCurrency,
  type PersonalTrade
} from "@/lib/processing/personal-trade-parser"

interface PersonalTradeTableProps {
  trades: PersonalTrade[]
}

interface SortConfig {
  key: keyof PersonalTrade | 'none'
  direction: 'asc' | 'desc'
}

export function PersonalTradeTable({ trades }: PersonalTradeTableProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', direction: 'desc' })
  const [filter, setFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 50

  // Get unique trade types for filter
  const tradeTypes = Array.from(new Set(trades.map(trade => trade.type))).sort()

  // Filter trades
  const filteredTrades = trades.filter(trade => {
    const matchesSearch = trade.description.toLowerCase().includes(filter.toLowerCase()) ||
                         trade.type.toLowerCase().includes(filter.toLowerCase())
    const matchesType = typeFilter === 'all' || trade.type === typeFilter
    
    return matchesSearch && matchesType
  })

  // Sort trades
  const sortedTrades = [...filteredTrades].sort((a, b) => {
    if (sortConfig.key === 'none') return 0
    
    let aValue = a[sortConfig.key]
    let bValue = b[sortConfig.key]
    
    // Handle different data types
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      aValue = aValue.toLowerCase()
      bValue = bValue.toLowerCase()
    }
    
    if (aValue < bValue) {
      return sortConfig.direction === 'asc' ? -1 : 1
    }
    if (aValue > bValue) {
      return sortConfig.direction === 'asc' ? 1 : -1
    }
    return 0
  })

  // Pagination
  const totalPages = Math.ceil(sortedTrades.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedTrades = sortedTrades.slice(startIndex, startIndex + itemsPerPage)

  const handleSort = (key: keyof PersonalTrade) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const getSortIcon = (key: keyof PersonalTrade) => {
    if (sortConfig.key !== key) return null
    return sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Trade History</CardTitle>
          <Badge variant="outline">
            {filteredTrades.length} of {trades.length} trades
          </Badge>
        </div>
        
        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search trades..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="max-w-sm"
            />
          </div>
          
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {tradeTypes.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Table */}
        <div className="rounded-md border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 text-left">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('date')}
                    className="h-auto p-0 font-semibold"
                  >
                    Date {getSortIcon('date')}
                  </Button>
                </th>
                <th className="p-3 text-left">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('type')}
                    className="h-auto p-0 font-semibold"
                  >
                    Type {getSortIcon('type')}
                  </Button>
                </th>
                <th className="p-3 text-left">Description</th>
                <th className="p-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('amount')}
                    className="h-auto p-0 font-semibold"
                  >
                    P/L {getSortIcon('amount')}
                  </Button>
                </th>
                <th className="p-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('fees')}
                    className="h-auto p-0 font-semibold"
                  >
                    Fees {getSortIcon('fees')}
                  </Button>
                </th>
                <th className="p-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('balance')}
                    className="h-auto p-0 font-semibold"
                  >
                    Balance {getSortIcon('balance')}
                  </Button>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedTrades.map((trade, index) => (
                <tr key={index} className="border-b hover:bg-muted/30">
                  <td className="p-3">
                    <Badge variant="outline" className="font-mono text-xs">
                      {format(new Date(trade.date), 'MMM dd')}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Badge variant="secondary" className="text-xs">
                      {trade.type}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <div className="max-w-xs truncate text-sm" title={trade.description}>
                      {trade.description}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <span className={`font-semibold ${
                      trade.amount >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(trade.amount)}
                    </span>
                  </td>
                  <td className="p-3 text-right text-sm text-muted-foreground">
                    {trade.fees > 0 ? formatCurrency(trade.fees) : '-'}
                  </td>
                  <td className="p-3 text-right font-mono text-sm">
                    {trade.balance > 0 ? formatCurrency(trade.balance) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {paginatedTrades.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              No trades found matching your filters.
            </div>
          )}
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, sortedTrades.length)} of {sortedTrades.length} trades
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => 
                    page === 1 || 
                    page === totalPages || 
                    Math.abs(page - currentPage) <= 2
                  )
                  .map((page, index, array) => (
                    <div key={page} className="flex items-center">
                      {index > 0 && array[index - 1] !== page - 1 && (
                        <span className="px-2 text-muted-foreground">...</span>
                      )}
                      <Button
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="w-8 h-8 p-0"
                      >
                        {page}
                      </Button>
                    </div>
                  ))
                }
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}