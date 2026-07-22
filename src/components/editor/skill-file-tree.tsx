"use client";

/**
 * SkillFileTree — left-pane file explorer for the skill editor.
 *
 * Renders one directory level at a time. The backend ListFiles returns
 * the immediate children of the requested path only (files + folders,
 * not a recursive flatten), so folders show up here as navigable rows.
 * Clicking a folder calls onNavigate to descend; the breadcrumb and the
 * ".." row walk back up. Files open in the editor via onSelectFile. The
 * "new file" button opens the create-file dialog in the parent.
 */
import { useState } from "react";
import { ChevronRight, File, Folder, FilePlus2, CornerLeftUp, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { SkillFileEntry } from "@/lib/api/types";

export type SkillFileTreeProps = {
  skillName: string;
  path: string;
  entries: SkillFileEntry[] | undefined;
  isLoading?: boolean;
  selectedPath?: string;
  /** Path currently being deleted (disables its row + shows spinner). */
  deletingPath?: string | null;
  onNavigate: (path: string) => void;
  onSelectFile: (path: string) => void;
  onCreateFile: () => void;
  /** Called after the user confirms deletion in the dialog. */
  onDeleteFile?: (path: string, sha: string) => void;
};

function parentPath(p: string): string {
  if (!p) return "";
  const idx = p.lastIndexOf("/");
  return idx < 0 ? "" : p.slice(0, idx);
}

function breadcrumbSegments(p: string): { label: string; path: string }[] {
  if (!p) return [];
  const parts = p.split("/").filter(Boolean);
  const out: { label: string; path: string }[] = [];
  let acc = "";
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : part;
    out.push({ label: part, path: acc });
  }
  return out;
}

export function SkillFileTree({
  skillName,
  path,
  entries,
  isLoading,
  selectedPath,
  deletingPath,
  onNavigate,
  onSelectFile,
  onCreateFile,
  onDeleteFile,
}: SkillFileTreeProps) {
  const t = useT();
  const segments = breadcrumbSegments(path);
  // The entry the user is currently confirming deletion for. The dialog
  // is local to the tree so the parent only hears about confirmed
  // deletions, not every trash click.
  const [pendingDelete, setPendingDelete] = useState<SkillFileEntry | null>(null);

  // Directories first, then files, both alphabetical — matches the
  // canonical git tree sort the backend already applies, but we re-sort
  // here so the UI is stable even if the API changes ordering.
  const sorted = (entries ?? []).slice().sort((a, b) => {
    if (a.type === "dir" && b.type !== "dir") return -1;
    if (a.type !== "dir" && b.type === "dir") return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-1 border-b bg-muted/30 px-2">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2 text-xs"
          onClick={onCreateFile}
          title={t("editor.newFile")}
        >
          <FilePlus2 className="h-3.5 w-3.5" />
          {t("editor.newFile")}
        </Button>
      </div>
      {/* Breadcrumb */}
      <div className="flex shrink-0 flex-wrap items-center gap-0.5 border-b px-2 py-1.5 text-xs text-muted-foreground">
        <button
          type="button"
          className="rounded px-1.5 py-0.5 hover:bg-muted"
          onClick={() => onNavigate("")}
        >
          {skillName}
        </button>
        {segments.map((seg) => (
          <span key={seg.path} className="inline-flex items-center">
            <ChevronRight className="h-3 w-3 opacity-50" />
            <button
              type="button"
              className="rounded px-1.5 py-0.5 hover:bg-muted"
              onClick={() => onNavigate(seg.path)}
            >
              {seg.label}
            </button>
          </span>
        ))}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="py-1">
          {path && (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted"
              onClick={() => onNavigate(parentPath(path))}
            >
              <CornerLeftUp className="h-3.5 w-3.5 opacity-70" />
              ..
            </button>
          )}
          {isLoading && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {t("common.loading") ?? "Loading…"}
            </div>
          )}
          {!isLoading && sorted.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {t("editor.empty") ?? "No files"}
            </div>
          )}
          {sorted.map((entry) => {
            const isDir = entry.type === "dir";
            const selected = entry.path === selectedPath;
            const isDeleting = entry.path === deletingPath;
            const canDelete = !isDir && onDeleteFile && !isDeleting;
            return (
              <div
                key={entry.path}
                role="button"
                tabIndex={0}
                className={cn(
                  "group flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted",
                  selected && "bg-muted font-medium",
                  isDeleting && "opacity-50",
                )}
                onClick={() => {
                  if (isDeleting) return;
                  if (isDir) onNavigate(entry.path);
                  else onSelectFile(entry.path);
                }}
                onKeyDown={(e) => {
                  if (isDeleting) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (isDir) onNavigate(entry.path);
                    else onSelectFile(entry.path);
                  }
                }}
              >
                {isDir ? (
                  <Folder className="h-3.5 w-3.5 shrink-0 text-sky-500" />
                ) : (
                  <File className="h-3.5 w-3.5 shrink-0 opacity-70" />
                )}
                <span className="truncate">{entry.name}</span>
                {!isDir && entry.size > 0 && (
                  <span className="ml-auto shrink-0 text-[10px] opacity-50 group-hover:opacity-0">
                    {formatSize(entry.size)}
                  </span>
                )}
                {canDelete && (
                  <AlertDialog
                    open={pendingDelete?.path === entry.path}
                    onOpenChange={(open) =>
                      setPendingDelete(open ? entry : null)
                    }
                  >
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto hidden h-6 w-6 shrink-0 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:flex"
                        title={t("editor.delete")}
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("editor.delete")}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t("editor.confirmDelete", { name: entry.path })}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                          className={cn(
                            "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                          )}
                          onClick={() => {
                            onDeleteFile?.(entry.path, entry.sha);
                          }}
                        >
                          {t("common.delete")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                {isDeleting && (
                  <Loader2 className="ml-auto h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}
