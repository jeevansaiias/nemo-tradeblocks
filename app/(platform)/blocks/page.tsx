"use client";

import { BlockDialog } from "@/components/block-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useBlockStore, type Block } from "@/lib/stores/block-store";
import { Activity, Calendar, Grid3X3, List, Plus, Search } from "lucide-react";
import { useState } from "react";

function BlockCard({
  block,
  onEdit,
}: {
  block: Block;
  onEdit: (block: Block) => void;
}) {
  const setActiveBlock = useBlockStore(state => state.setActiveBlock);

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
            <Button
              size="sm"
              className="flex-1"
              onClick={() => setActiveBlock(block.id)}
            >
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
  const blocks = useBlockStore(state => state.blocks);
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"new" | "edit">("new");
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);

  const handleNewBlock = () => {
    setDialogMode("new");
    setSelectedBlock(null);
    setIsBlockDialogOpen(true);
  };

  const handleEditBlock = (block: Block) => {
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
            {blocks.length} blocks
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {blocks.map((block) => (
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
