'use client';

import { useMemo, useState } from 'react';
import {
  ChevronRight,
  CornerLeftUp,
  File,
  Folder,
  Loader2,
  PackageOpen,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

export function SkillVersionBrowserDialog({
  skillName,
  releases,
  initialTag,
  open,
  onOpenChange,
}: SkillVersionBrowserDialogProps) {
  const versions = useMemo(() => buildSkillReleaseViews(releases), [releases]);
  const [selectedTag, setSelectedTag] = useState(initialTag);
  const [currentPath, setCurrentPath] = useState('');
  const [selectedFile, setSelectedFile] = useState('SKILL.md');

  const selectedVersion =
    versions.find((version) => version.tag === selectedTag) ?? versions[0];
  const selectedRef = selectedVersion?.ref ?? '';
  const tree = useFileTree(skillName, currentPath, selectedRef, {
    enabled: open && Boolean(selectedRef),
  });
  const file = useFileContent(skillName, selectedFile, selectedRef, {
    enabled: open && Boolean(selectedRef && selectedFile),
  });

  const entries = (tree.data ?? []).slice().sort((left, right) => {
    if (left.type === 'dir' && right.type !== 'dir') return -1;
    if (left.type !== 'dir' && right.type === 'dir') return 1;
    return left.name.localeCompare(right.name);
  });
  const segments = breadcrumb(currentPath);

  const switchVersion = (tag: string) => {
    setSelectedTag(tag);
    setCurrentPath('');
    setSelectedFile('SKILL.md');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[88vh] w-[96vw] max-w-[1280px] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-5 py-4 text-left">
          <div className="flex flex-wrap items-center gap-3 pr-8">
            <div className="min-w-0 flex-1">
              <DialogTitle className="flex items-center gap-2">
                <PackageOpen className="h-4 w-4" />
                查看已发布版本
              </DialogTitle>
              <DialogDescription className="mt-1">
                已发布内容由不可变 Tag 固定，只能浏览，不能直接修改。
              </DialogDescription>
            </div>
            <Select value={selectedVersion?.tag} onValueChange={switchVersion}>
              <SelectTrigger className="w-[240px] font-mono text-xs">
                <SelectValue placeholder="选择版本" />
              </SelectTrigger>
              <SelectContent>
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
          </div>
        </DialogHeader>

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

        <div className="flex shrink-0 items-center justify-between border-t bg-muted/20 px-4 py-2 text-[11px] text-muted-foreground">
          <span>{selectedVersion?.tag ?? '-'}</span>
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
