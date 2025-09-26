"use client";

import { BlockDialog } from "@/components/block-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Activity, Calendar, Grid3X3, List, Plus, Search } from "lucide-react";
import { useState } from "react";

// Mock data - will be replaced with real data later
const mockBlocks = [
  {
    id: "2025-demo",
    name: "2025 Over 100k Trials",
    description: "High-volume testing with over 100k trial runs",
    isActive: true,
    created: new Date("2025-01-15"),
    lastModified: new Date("2025-09-18"),
    tradeLog: {
      fileName: "2025-Over-100k-With-Trial-Tests.csv",
      rowCount: 749,
      fileSize: 1.2 * 1024 * 1024,
    },
    dailyLog: {
      fileName: "2025-Over-100k-With-Trial-Tests (1).csv",
      rowCount: 178,
      fileSize: 0.3 * 1024 * 1024,
    },
  },
  {
    id: "2024-swing",
    name: "2024 Swing Book",
    description: "Swing trading strategy performance for 2024",
    isActive: false,
    created: new Date("2024-01-01"),
    lastModified: new Date("2025-08-02"),
    tradeLog: {
      fileName: "2024-Swing-Trades.csv",
      rowCount: 553,
      fileSize: 0.9 * 1024 * 1024,
    },
    dailyLog: {
      fileName: "2024-Swing-Notes.csv",
      rowCount: 211,
      fileSize: 0.2 * 1024 * 1024,
    },
  },
  {
    id: "scalp-tests",
    name: "Scalp Tests",
    description: "Short-term scalping experiments",
    isActive: false,
    created: new Date("2025-03-10"),
    lastModified: new Date("2025-07-15"),
    tradeLog: {
      fileName: "Scalp-Tests.csv",
      rowCount: 234,
      fileSize: 0.4 * 1024 * 1024,
    },
  },
];

function BlockCard({
  block,
  onEdit,
}: {
  block: (typeof mockBlocks)[0];
  onEdit: (block: (typeof mockBlocks)[0]) => void;
}) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);

  return (
    <Card
      className={`relative transition-all hover:shadow-md ${
        block.isActive ? "ring-2 ring-primary" : ""
      }`}
    >
      {block.isActive && (
        <Badge className="absolute -top-2 -right-2 bg-primary">ACTIVE</Badge>
      )}

      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold leading-tight">
              {block.name}
            </CardTitle>
            {block.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {block.description}
              </p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* File Indicators */}
        <div className="flex gap-2">
          <Badge variant="secondary" className="text-xs">
            <Activity className="w-3 h-3 mr-1" />
            Trade Log ({block.tradeLog.rowCount})
          </Badge>
          {block.dailyLog && (
            <Badge variant="outline" className="text-xs">
              <Calendar className="w-3 h-3 mr-1" />
              Daily Log ({block.dailyLog.rowCount})
            </Badge>
          )}
        </div>

        {/* Last Modified */}
        <div className="text-xs text-muted-foreground border-t pt-3">
          Last updated: {formatDate(block.lastModified)}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {!block.isActive && (
            <Button size="sm" className="flex-1">
              Activate
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => onEdit(block)}
          >
            Edit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function BlockManagementPage() {
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"new" | "edit">("new");
  const [selectedBlock, setSelectedBlock] = useState<
    (typeof mockBlocks)[0] | null
  >(null);

  const handleNewBlock = () => {
    setDialogMode("new");
    setSelectedBlock(null);
    setIsBlockDialogOpen(true);
  };

  const handleEditBlock = (block: (typeof mockBlocks)[0]) => {
    setDialogMode("edit");
    setSelectedBlock(block);
    setIsBlockDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Search and Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input placeholder="Search blocks..." className="pl-10" />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Grid3X3 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <List className="w-4 h-4" />
          </Button>
          <Button onClick={handleNewBlock}>
            <Plus className="w-4 h-4 mr-2" />
            New Block
          </Button>
        </div>
      </div>

      {/* Blocks Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Trading Blocks</h2>
          <span className="text-sm text-muted-foreground">
            {mockBlocks.length} blocks
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockBlocks.map((block) => (
            <BlockCard key={block.id} block={block} onEdit={handleEditBlock} />
          ))}
        </div>
      </div>

      <BlockDialog
        open={isBlockDialogOpen}
        onOpenChange={setIsBlockDialogOpen}
        mode={dialogMode}
        block={selectedBlock}
      />
    </div>
  );
}
