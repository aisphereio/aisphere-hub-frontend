'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronRight,
  CornerLeftUp,
  File,
  Folder,
  Loader2,
  PackageOpen,
  RotateCcw,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFileContent, useFileTree } from '@/hooks/use-skill-files';
import type { SkillRelease } from '@/lib/api/adapters/skill-release';
import { buildSkillReleaseViews } from '@/lib/skill-versions';
import { cn } from '@/lib/utils';

import { MonacoSkillEditor } from './monaco-skill-editor';

const DRAFT_VALUE = '__draft__';

type SkillVersionBrowserDialogProps = {
  skillName: string;
  releases: SkillRelease[];
  initialTag: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function parentPath(path: string): string {
  const index = path.lastIndexOf('/');
  return index < 0 ? '' : path.slice(0, index);
}

function breadcrumb(path: string): { label: string; path: string }[] {
  if (!path) return [];
  let current = '';
  return path.split('/').filter(Boolean).map((label) => {
    current = current ? `${current}/${label}` : label;
    return { label, path: current };
  });
}

/**
 * Locate the left-hand editor workspace from the version panel marker.
 *
 * SkillEditor renders a root with two direct children: the header and the
 * main horizontal body. The first child of that body is the editable file
 * workspace. Keeping this lookup local lets the release panel remain
 * decoupled from the editor's internal tab state while still rendering the
 * immutable preview in the primary workspace instead of a second window.
 */
function findMainEditorPane(marker: HTMLElement | null): HTMLElement | null {
  let candidate = marker?.parentElement ?? null;

  while (candidate) {
    const directChildren = Array.from(candidate.children);
    const hasHeader = directChildren.some((child) => child.tagName === 'HEADER');
    const body = directChildren.find(
      (child) =>
        child instanceof HTMLElement &&
        child.classList.contains('flex-1') &&
        child.classList.contains('min-h-0') &&
        child.classList.contains('flex'),
    );

    if (hasHeader && body instanceof HTMLElement) {
      const mainPane = body.firstElementChild;
      return mainPane instanceof HTMLElement ? mainPane : null;
    }

    candidate = candidate.parentElement;
  }

  return null;
}

/**
 * Compatibility note: this component keeps its historical export name so
 * callers do not need to change, but it no longer renders a Dialog. It mounts
 * a read-only release workspace into SkillEditor's primary content pane.
 */
export function SkillVersionBrowserDialog({
  skillName,
  releases,
  initialTag,
  open,
  onOpenChange,
}: SkillVersionBrowserDialogProps) {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const versions = useMemo(() => buildSkillReleaseViews(releases), [releases]);
  const [selectedTag, setSelectedTag] = useState(initialTag);
  const [currentPath, setCurrentPath] = useState('');
  const [selectedFile, setSelectedFile] = useState('SKILL.md');

  const attachMarker = useCallback((node: HTMLSpanElement | null) => {
    setPortalTarget(open && node ? findMainEditorPane(node) : null);
  }, [open]);

  useEffect(() => {
    if (!portalTarget) return;

    const previousPosition = portalTarget.style.position;
    if (window.getComputedStyle(portalTarget).position === 'static') {
      portalTarget.style.position = 'relative';
    }

    return () => {
      portalTarget.style.position = previousPosition;
    };
  }, [portalTarget]);

  const selectedVersion =
    versions.find((version) => version.tag === selectedTag) ?? versions[0];
  const selectedRef = selectedVersion?.ref ?? '';
  const tree = useFileTree(skillName, currentPath, selectedRef, {
    enabled: open && Boolean(portalTarget && selectedRef),
  });
  const file = useFileContent(skillName, selectedFile, selectedRef, {
    enabled: open && Boolean(portalTarget && selectedRef && selectedFile),
  });

  const entries = (tree.data ?? []).slice().sort((left, right) => {
    if (left.type === 'dir' && right.type !== 'dir') return -1;
    if (left.type !== 'dir' && right.type === 'dir') return 1;
    return left.name.localeCompare(right.name);
  });
  const segments = breadcrumb(currentPath);

  const switchVersion = (value: string) => {
    if (value === DRAFT_VALUE) {
      onOpenChange(false);
      return;
    }
    setSelectedTag(value);
    setCurrentPath('');
    setSelectedFile('SKILL.md');
  };

  const workspace = portalTarget && open ? createPortal(
    <div
      data-testid="skill-version-inline-preview"
      className="absolute inset-0 z-30 flex min-h-0 flex-col overflow-hidden bg-background"
    >
      <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b bg-card/95 px-3 py-2 backdrop-blur-sm">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <PackageOpen className="h-4 w-4 shrink-0 text-violet-500" />
          <div className="min-w-0">
            <div className="truncate text-xs font-medium">已发布版本预览</div>
            <div className="truncate text-[10px] text-muted-foreground">
              版本内容已由不可变 Tag 固定，当前工作区为只读模式。
            </div>
          </div>
        </div>

        <Select value={selectedVersion?.tag ?? ''} onValueChange={switchVersion}>
          <SelectTrigger aria-label="切换查看版本" className="h-8 w-[250px] font-mono text-xs">
            <SelectValue placeholder="选择版本" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DRAFT_VALUE}>当前草稿（可编辑）</SelectItem>
            {versions.map((version) => (
              <SelectItem key={version.tag} value={version.tag}>
                {version.kind === 'stable' ? '稳定版' : '预发布'} · {version.version}
                {version.latestStable ? '（最新）' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedVersion && (
          <Badge variant={selectedVersion.kind === 'stable' ? 'default' : 'secondary'}>
            {selectedVersion.kind === 'stable' ? '稳定版' : '预发布'}
          </Badge>
        )}
        <Badge variant="outline">只读</Badge>
        <Button
          size="sm"
          variant="outline"
          className="h-8 shrink-0"
          onClick={() => onOpenChange(false)}
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          返回草稿
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col border-r bg-muted/10">
          <div className="flex min-h-9 shrink-0 flex-wrap items-center gap-0.5 border-b px-2 py-1.5 text-xs text-muted-foreground">
            <button
              type="button"
              className="rounded px-1.5 py-0.5 hover:bg-muted"
              onClick={() => setCurrentPath('')}
            >
              {skillName}
            </button>
            {segments.map((segment) => (
              <span key={segment.path} className="inline-flex items-center">
                <ChevronRight className="h-3 w-3 opacity-50" />
                <button
                  type="button"
                  className="max-w-28 truncate rounded px-1.5 py-0.5 hover:bg-muted"
                  onClick={() => setCurrentPath(segment.path)}
                >
                  {segment.label}
                </button>
              </span>
            ))}
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="py-1">
              {currentPath && (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted"
                  onClick={() => setCurrentPath(parentPath(currentPath))}
                >
                  <CornerLeftUp className="h-3.5 w-3.5 opacity-70" />
                  ..
                </button>
              )}
              {tree.isLoading && (
                <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> 读取文件…
                </div>
              )}
              {!tree.isLoading && entries.length === 0 && (
                <div className="px-3 py-3 text-xs text-muted-foreground">没有文件</div>
              )}
              {entries.map((entry) => {
                const isDirectory = entry.type === 'dir';
                return (
                  <button
                    key={entry.path}
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted',
                      !isDirectory && selectedFile === entry.path && 'bg-muted font-medium',
                    )}
                    onClick={() => {
                      if (isDirectory) setCurrentPath(entry.path);
                      else setSelectedFile(entry.path);
                    }}
                  >
                    {isDirectory ? (
                      <Folder className="h-3.5 w-3.5 shrink-0 text-sky-500" />
                    ) : (
                      <File className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    )}
                    <span className="truncate">{entry.name}</span>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <div className="min-h-0 min-w-0">
          {!selectedFile ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              选择文件查看内容
            </div>
          ) : file.isLoading ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> 读取版本内容…
            </div>
          ) : file.isError ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
              无法读取 {selectedFile}
            </div>
          ) : (
            <MonacoSkillEditor
              key={`${selectedVersion?.tag}:${selectedFile}:${file.data?.sha ?? 'loading'}`}
              skillName={skillName}
              filePath={selectedFile}
              branch={selectedRef}
              initialContent={file.data?.content ?? ''}
              sha={file.data?.sha}
              readOnly
            />
          )}
        </div>
      </div>

      <div className="flex min-h-8 shrink-0 items-center justify-between border-t bg-muted/20 px-3 text-[10px] text-muted-foreground">
        <span className="font-mono">{selectedVersion?.tag ?? '-'}</span>
        <span>切换版本会重置到 SKILL.md；草稿编辑状态保留在后台。</span>
      </div>
    </div>,
    portalTarget,
  ) : null;

  return (
    <>
      <span ref={attachMarker} className="hidden" aria-hidden="true" />
      {workspace}
    </>
  );
}
