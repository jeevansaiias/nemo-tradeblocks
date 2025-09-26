"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Activity,
  AlertCircle,
  Calendar,
  CheckCircle,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface Block {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  created: Date;
  lastModified: Date;
  tradeLog: {
    fileName: string;
    rowCount: number;
    fileSize: number;
  };
  dailyLog?: {
    fileName: string;
    rowCount: number;
    fileSize: number;
  };
  stats: {
    totalPnL: number;
    winRate: number;
    totalTrades: number;
    avgWin: number;
    avgLoss: number;
  };
  tags?: string[];
  color?: string;
}

interface FileUploadState {
  file: File | null;
  status: "empty" | "dragover" | "uploaded" | "error" | "existing";
  error?: string;
  existingFileName?: string;
  existingRowCount?: number;
}

interface BlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "new" | "edit";
  block?: Block | null;
}

export function BlockDialog({
  open,
  onOpenChange,
  mode,
  block,
}: BlockDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [setAsActive, setSetAsActive] = useState(true);
  const [tradeLog, setTradeLog] = useState<FileUploadState>({
    file: null,
    status: "empty",
  });
  const [dailyLog, setDailyLog] = useState<FileUploadState>({
    file: null,
    status: "empty",
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Reset form when dialog opens/closes or mode changes
  useEffect(() => {
    if (!open) {
      // Reset when closing
      setName("");
      setDescription("");
      setSetAsActive(true);
      setTradeLog({ file: null, status: "empty" });
      setDailyLog({ file: null, status: "empty" });
      return;
    }

    if (mode === "edit" && block) {
      // Pre-populate for edit mode
      setName(block.name);
      setDescription(block.description || "");
      setSetAsActive(block.isActive);

      setTradeLog({
        file: null,
        status: "existing",
        existingFileName: block.tradeLog.fileName,
        existingRowCount: block.tradeLog.rowCount,
      });

      if (block.dailyLog) {
        setDailyLog({
          file: null,
          status: "existing",
          existingFileName: block.dailyLog.fileName,
          existingRowCount: block.dailyLog.rowCount,
        });
      } else {
        setDailyLog({
          file: null,
          status: "empty",
        });
      }
    } else {
      // Reset for new mode
      setName("");
      setDescription("");
      setSetAsActive(true);
      setTradeLog({ file: null, status: "empty" });
      setDailyLog({ file: null, status: "empty" });
    }
  }, [open, mode, block]);

  const handleDragOver = useCallback(
    (e: React.DragEvent, type: "trade" | "daily") => {
      e.preventDefault();
      e.stopPropagation();

      const setState = type === "trade" ? setTradeLog : setDailyLog;
      setState((prev) => ({ ...prev, status: "dragover" }));
    },
    []
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent, type: "trade" | "daily") => {
      e.preventDefault();
      e.stopPropagation();

      const setState = type === "trade" ? setTradeLog : setDailyLog;
      setState((prev) => ({
        ...prev,
        status: prev.file
          ? "uploaded"
          : prev.existingFileName
          ? "existing"
          : "empty",
      }));
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, type: "trade" | "daily") => {
      e.preventDefault();
      e.stopPropagation();

      const files = Array.from(e.dataTransfer.files);
      const file = files[0];

      const setState = type === "trade" ? setTradeLog : setDailyLog;

      if (!file) {
        setState((prev) => ({
          ...prev,
          status: prev.existingFileName ? "existing" : "empty",
        }));
        return;
      }

      // Validate file type
      if (!file.name.toLowerCase().endsWith(".csv")) {
        setState((prev) => ({
          ...prev,
          file: null,
          status: "error",
          error: "Please upload a CSV file",
        }));
        return;
      }

      setState({
        file,
        status: "uploaded",
        error: undefined,
        existingFileName: undefined,
        existingRowCount: undefined,
      });
    },
    []
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, type: "trade" | "daily") => {
      const file = e.target.files?.[0];
      const setState = type === "trade" ? setTradeLog : setDailyLog;

      if (!file) {
        setState((prev) => ({
          ...prev,
          status: prev.existingFileName ? "existing" : "empty",
        }));
        return;
      }

      if (!file.name.toLowerCase().endsWith(".csv")) {
        setState((prev) => ({
          ...prev,
          file: null,
          status: "error",
          error: "Please upload a CSV file",
        }));
        return;
      }

      setState({
        file,
        status: "uploaded",
        error: undefined,
        existingFileName: undefined,
        existingRowCount: undefined,
      });

      // Reset the input
      e.target.value = "";
    },
    []
  );

  const removeFile = useCallback((type: "trade" | "daily") => {
    const setState = type === "trade" ? setTradeLog : setDailyLog;
    setState({
      file: null,
      status: "empty",
      error: undefined,
      existingFileName: undefined,
      existingRowCount: undefined,
    });
  }, []);

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const handleSubmit = async () => {
    if (mode === "edit" && !block) return;

    const blockData = {
      id: mode === "edit" ? block!.id : undefined,
      name,
      description,
      setAsActive,
      tradeLog: tradeLog.file || tradeLog.existingFileName,
      dailyLog: dailyLog.file || dailyLog.existingFileName,
    };

    // TODO: Implement actual block creation/update
    console.log(
      mode === "edit" ? "Updating block:" : "Creating block:",
      blockData
    );

    // Close dialog
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!block) return;

    // TODO: Implement actual block deletion
    console.log("Deleting block:", block.id);

    // Close dialogs
    setShowDeleteConfirm(false);
    onOpenChange(false);
  };

  const canSubmit = name.trim() && (tradeLog.file || tradeLog.existingFileName);

  const getDialogTitle = () =>
    mode === "edit" ? "Edit Trading Block" : "Create New Trading Block";
  const getDialogDescription = () =>
    mode === "edit"
      ? "Update block details and replace files as needed."
      : "Upload your trade log and daily log files to create a new trading block for analysis.";

  const getSubmitButtonText = () =>
    mode === "edit" ? "Save Changes" : "Create Block";
  const getSubmitButtonIcon = () => (mode === "edit" ? Save : Plus);

  const SubmitIcon = getSubmitButtonIcon();

  const renderFileUpload = (
    type: "trade" | "daily",
    fileState: FileUploadState,
    isRequired: boolean
  ) => {
    const isTradeLog = type === "trade";
    const Icon = isTradeLog ? Activity : Calendar;
    const label = isTradeLog ? "Trade Log" : "Daily Log";
    const inputId = `${mode}-${type}-file-input`;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>{label}</Label>
          <Badge
            variant={isRequired ? "destructive" : "secondary"}
            className="text-xs"
          >
            {isRequired ? "Required" : "Optional"}
          </Badge>
        </div>

        <div
          className={`
            relative border-2 border-dashed rounded-lg p-6 transition-all cursor-pointer
            ${
              fileState.status === "dragover"
                ? "border-primary bg-primary/5"
                : ""
            }
            ${
              fileState.status === "uploaded"
                ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                : ""
            }
            ${
              fileState.status === "existing"
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                : ""
            }
            ${
              fileState.status === "error"
                ? "border-red-500 bg-red-50 dark:bg-red-950/20"
                : ""
            }
            ${
              fileState.status === "empty"
                ? "border-muted-foreground/25 hover:border-muted-foreground/50"
                : ""
            }
          `}
          onDragOver={(e) => handleDragOver(e, type)}
          onDragLeave={(e) => handleDragLeave(e, type)}
          onDrop={(e) => handleDrop(e, type)}
          onClick={() => document.getElementById(inputId)?.click()}
        >
          <input
            id={inputId}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => handleFileSelect(e, type)}
          />

          {fileState.status === "uploaded" && fileState.file ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium">{fileState.file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(fileState.file.size)} •{" "}
                    {mode === "edit" ? "New file" : "CSV file"}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(type);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : fileState.status === "existing" && fileState.existingFileName ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded">
                  <Icon className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium">{fileState.existingFileName}</p>
                  <p className="text-sm text-muted-foreground">
                    {fileState.existingRowCount} rows • Current file
                  </p>
                  <p className="text-xs text-muted-foreground/75">
                    Click to replace with new file
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  Current
                </Badge>
                <Upload className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          ) : fileState.status === "error" ? (
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="font-medium text-red-700 dark:text-red-400">
                {fileState.error}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Click to try again
              </p>
            </div>
          ) : (
            <div className="text-center">
              <div className="p-3 bg-muted rounded-full w-fit mx-auto mb-4">
                <Icon className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="font-medium">
                {mode === "edit" && fileState.existingFileName
                  ? `Replace ${label}`
                  : mode === "edit" && !fileState.existingFileName
                  ? `Add ${label}`
                  : `Upload ${label}`}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Drag & drop your CSV file here or click to browse
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{getDialogTitle()}</DialogTitle>
            <DialogDescription>{getDialogDescription()}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Block Details */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="block-name">Block Name</Label>
                <Input
                  id="block-name"
                  placeholder="e.g., 2025 Q1 Strategy"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="block-description">
                  Description (Optional)
                </Label>
                <Textarea
                  id="block-description"
                  placeholder="Brief description of this trading block..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            {mode === "edit" && <Separator />}

            {/* File Uploads */}
            <div className="space-y-4">
              {mode === "edit" && (
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">File Management</h3>
                  <p className="text-xs text-muted-foreground">
                    Upload new files to replace existing ones
                  </p>
                </div>
              )}

              {renderFileUpload("trade", tradeLog, true)}
              {renderFileUpload("daily", dailyLog, false)}
            </div>

            {/* Options */}
            {mode === "new" && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="set-active"
                  checked={setAsActive}
                  onCheckedChange={setSetAsActive}
                />
                <Label htmlFor="set-active">
                  Set as active block after creation
                </Label>
              </div>
            )}
          </div>

          <Separator />

          <DialogFooter>
            <div className="flex w-full justify-between items-center">
              {mode === "edit" ? (
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Block
                </Button>
              ) : (
                <div />
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={!canSubmit}>
                  <SubmitIcon className="w-4 h-4 mr-2" />
                  {getSubmitButtonText()}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {mode === "edit" && (
        <AlertDialog
          open={showDeleteConfirm}
          onOpenChange={setShowDeleteConfirm}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Trading Block</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &quot;{block?.name}&quot;? This
                action cannot be undone and will permanently remove all data
                associated with this block.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Block
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
