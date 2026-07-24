'use client';

import { useMemo, useState } from 'react';
import {
  Loader2,
  Maximize2,
  Minimize2,
  PackageOpen,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFileContent } from '@/hooks/use-skill-files';
import type { SkillRelease } from '@/lib/api/adapters/skill-release';
import { buildSkillReleaseViews } from '@/lib/skill-versions';

import { MonacoSkillEditor } from './monaco-skill-editor';

type SkillVersionBrowserDialogProps = {
  skillName: string;
  releases: SkillRelease[];
  initialTag: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SkillVersionBrowserDialog({
  skillName,
  releases,
  initialTag,
  open,
  onOpenChange,
}: SkillVersionBrowserDialogProps) {
  const versions = useMemo(() => buildSkillReleaseViews(releases), [releases]);
  const [selectedTag, setSelectedTag] = useState(initialTag);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const selectedVersion =
    versions.find((version) => version.tag === selectedTag) ?? versions[0];
  const selectedRef = selectedVersion?.ref ?? '';
  const file = useFileContent(skillName, 'SKILL.md', selectedRef, {
    enabled: open && Boolean(selectedRef),
  });

  const switchVersion = (tag: string) => {
    setSelectedTag(tag);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          isFullscreen
            ? "flex h-screen w-screen max-h-screen max-w-screen flex-col gap-0 overflow-hidden rounded-none border-0 p-0"
            : "flex h-[85vh] w-[90vw] max-h-[85vh] max-w-[90vw] flex-col gap-0 overflow-hidden p-0"
        }
        showCloseButton={false}
      >
        <DialogHeader className="shrink-0 border-b px-5 py-3">
          <div className="flex flex-wrap items-center gap-3 justify-center">
            <div className="flex items-center gap-3 min-w-0">
              <PackageOpen className="h-4 w-4 shrink-0" />
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
          </div>
        </DialogHeader>

        {/* Full-height Monaco preview — no file tree */}
        <div className="min-h-0 flex-1">
          {file.isLoading ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> 读取版本内容…
            </div>
          ) : file.isError ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
              无法读取 SKILL.md
            </div>
          ) : (
            <MonacoSkillEditor
              key={`${selectedVersion?.tag}:SKILL.md:${file.data?.sha ?? 'loading'}`}
              skillName={skillName}
              filePath="SKILL.md"
              branch={selectedRef}
              initialContent={file.data?.content ?? ''}
              sha={file.data?.sha}
              readOnly
            />
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between border-t bg-muted/20 px-4 py-2 text-[11px] text-muted-foreground">
          <span>{selectedVersion?.tag ?? '-'}</span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[11px]"
              title={isFullscreen ? '退出全屏' : '全屏'}
              aria-label={isFullscreen ? '退出全屏' : '全屏'}
              onClick={() => setIsFullscreen((v) => !v)}
            >
              {isFullscreen ? <Minimize2 className="mr-1 h-3.5 w-3.5" /> : <Maximize2 className="mr-1 h-3.5 w-3.5" />}
              {isFullscreen ? '退出全屏' : '全屏'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
              关闭
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
