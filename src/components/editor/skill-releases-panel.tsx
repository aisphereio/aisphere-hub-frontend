'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw, Tag } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  useCreateSkillRelease,
  useSkillReleaseRef,
  useResolveSkillRelease,
  useSkillReleases,
} from '@/hooks/use-skill-releases';
import type { SkillRelease } from '@/lib/api/adapters/skill-release';
import { HubApiError } from '@/lib/api/hub-fetch';
import { fmtTime } from '@/lib/utils';

type SkillReleasesPanelProps = {
  skillName: string;
};

function releaseTime(release: SkillRelease): string {
  return release.createTime ? fmtTime(release.createTime) : '-';
}

function shortSha(commitSha: string | undefined): string {
  return commitSha ? commitSha.slice(0, 12) : '-';
}

function publishErrorMessage(error: unknown): string {
  if (error instanceof HubApiError && error.code === 'SKILL_RELEASE_STALE') {
    return '发布失败：源分支已有新提交，请刷新提交后重新确认发布。';
  }
  return error instanceof Error ? error.message : 'Skill 发布失败';
}

export function SkillReleasesPanel({ skillName }: SkillReleasesPanelProps) {
  const releases = useSkillReleases(skillName);
  const createRelease = useCreateSkillRelease(skillName);
  const resolveRelease = useResolveSkillRelease(skillName);
  const [version, setVersion] = useState('');
  const [sourceRef, setSourceRef] = useState('refs/heads/main');
  const [releaseNotes, setReleaseNotes] = useState('');
  const normalizedSourceRef = sourceRef.trim() || 'refs/heads/main';
  const sourceHead = useSkillReleaseRef(skillName, normalizedSourceRef);
  const currentCommitSha = sourceHead.data?.commitSha;

  const orderedReleases = useMemo(
    () => [...(releases.data ?? [])].sort((left, right) =>
      String(right.tag ?? '').localeCompare(String(left.tag ?? '')),
    ),
    [releases.data],
  );

  const canPublish = Boolean(version.trim() && currentCommitSha);

  const publish = async () => {
    if (!canPublish) return;
    try {
      const release = await createRelease.mutateAsync({
        version: version.trim(),
        sourceRef: normalizedSourceRef,
        expectedCommitSha: currentCommitSha!,
        releaseNotes: releaseNotes.trim() || undefined,
      });
      toast.success(`已发布 ${release.tag || version.trim()}`);
      setVersion('');
      setReleaseNotes('');
    } catch (error) {
      toast.error(publishErrorMessage(error));
    }
  };

  const verify = async (release: SkillRelease) => {
    if (!release.tag) return;
    try {
      const resolved = await resolveRelease.mutateAsync(release.tag);
      toast.success(`${resolved.tag || release.tag} 已解析到 ${resolved.commitSha || '-'}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '版本解析失败');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 text-sm font-medium">
          <Tag className="h-4 w-4" /> 发布上线
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          发布会在 Git 仓库创建不可覆盖的 SemVer Tag。系统会自动锁定当前分支提交，避免误发到其他提交。
        </p>
      </div>

      <div className="space-y-3 rounded-md border bg-muted/20 p-3">
        <div className="space-y-1.5">
          <Label className="text-xs">版本</Label>
          <Input
            value={version}
            placeholder="例如 1.0.0 或 v1.0.0"
            onChange={(event) => setVersion(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">发布来源</Label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[11px]"
              onClick={() => sourceHead.refetch()}
              disabled={sourceHead.isFetching}
            >
              <RefreshCw className={`mr-1 h-3.5 w-3.5 ${sourceHead.isFetching ? 'animate-spin' : ''}`} />
              刷新提交
            </Button>
          </div>
          <Input
            className="font-mono text-xs"
            value={sourceRef}
            placeholder="refs/heads/main"
            onChange={(event) => setSourceRef(event.target.value)}
          />
          <div className="rounded-md border bg-background px-2.5 py-2 text-[11px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">当前提交</span>
              {sourceHead.isFetching ? (
                <span className="inline-flex items-center text-muted-foreground">
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  解析中
                </span>
              ) : (
                <span className="font-mono">{shortSha(currentCommitSha)}</span>
              )}
            </div>
            {currentCommitSha ? (
              <div className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
                {currentCommitSha}
              </div>
            ) : sourceHead.isError ? (
              <div className="mt-1 text-[10px] text-destructive">
                无法解析该发布来源，请确认分支存在并刷新。
              </div>
            ) : null}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">发布说明</Label>
          <Textarea
            rows={3}
            value={releaseNotes}
            placeholder="可选"
            onChange={(event) => setReleaseNotes(event.target.value)}
          />
        </div>
        <Button
          className="w-full"
          disabled={!canPublish || createRelease.isPending || sourceHead.isFetching}
          onClick={publish}
        >
          {createRelease.isPending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Tag className="mr-1.5 h-4 w-4" />
          )}
          发布上线
        </Button>
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <div className="text-xs font-medium">已发布版本</div>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          title="刷新版本"
          onClick={() => releases.refetch()}
          disabled={releases.isFetching}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${releases.isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {releases.isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : orderedReleases.length === 0 ? (
        <div className="rounded-md border border-dashed p-5 text-center text-xs text-muted-foreground">
          还没有发布版本
        </div>
      ) : (
        <div className="space-y-2">
          {orderedReleases.map((release) => (
            <div key={`${release.tag}:${release.commitSha}`} className="rounded-md border p-2.5">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {release.tag || '-'}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px]"
                  disabled={!release.tag || resolveRelease.isPending}
                  onClick={() => verify(release)}
                >
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> 精确解析
                </Button>
              </div>
              <div className="mt-2 break-all font-mono text-[10px] text-muted-foreground">
                {release.commitSha || '-'}
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                {releaseTime(release)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
