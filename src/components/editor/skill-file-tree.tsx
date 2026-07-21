"use client";

/**
 * SkillFileTree — left-pane file explorer for the skill editor.
 *
 * Renders a flat list of entries at the current path. Directories are
 * clickable (navigate into them); files are clickable (open in the
 * Monaco editor). A breadcrumb at the top shows the current path and
 * lets the user walk back up. A "new file" button at the top triggers
 * the create flow in the parent.
 *
 * The tree is deliberately non-recursive: a skill repo is small and
 * showing one directory at a time matches the GitLab/Gitea contents
 * UX the backend API mirrors. Recursive expansion can be added later.
 */
import { ChevronRight, File, Folder, FilePlus2, CornerLeftUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { SkillFileEntry } from "@/lib/api/types";

export type SkillFileTreeProps = {
  skillName: string;
  path: string;
  entries: SkillFileEntry[] | undefined;
  isLoading?: boolean;
  selectedPath?: string;
  onNavigate: (path: string) => void;
  onSelectFile: (path: string) => void;
  onCreateFile: () => void;
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
  onNavigate,
  onSelectFile,
  onCreateFile,
}: SkillFileTreeProps) {
  const t = useT();
  const segments = breadcrumbSegments(path);

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
            return (
              <button
                key={entry.path}
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted",
                  selected && "bg-muted font-medium",
                )}
                onClick={() =>
                  isDir ? onNavigate(entry.path) : onSelectFile(entry.path)
                }
              >
                {isDir ? (
                  <Folder className="h-3.5 w-3.5 shrink-0 text-sky-500" />
                ) : (
                  <File className="h-3.5 w-3.5 shrink-0 opacity-70" />
                )}
                <span className="truncate">{entry.name}</span>
                {!isDir && entry.size > 0 && (
                  <span className="ml-auto shrink-0 text-[10px] opacity-50">
                    {formatSize(entry.size)}
                  </span>
                )}
              </button>
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
