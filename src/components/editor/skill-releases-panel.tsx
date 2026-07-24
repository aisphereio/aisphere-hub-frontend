'use client';

import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  FileDiff,
  History,
  Loader2,
  RefreshCw,
  RotateCcw,
  Tag,
} from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  useCompareSkillRefs,
  useCreateSkillRelease,
  useRestoreSkillRef,
  useSkillCommits,
  useSkillRefs,
  useSkillReleases,
} from '@/hooks/use-skill-releases';
import type { SkillCommit, SkillRelease } from '@/lib/api/adapters/skill-release';
import { HubApiError } from '@/lib/api/hub-fetch';
import { buildSkillReleaseViews } from '@/lib/skill-versions';
import { fmtTime } from '@/lib/utils';

import { SkillVersionBrowserDialog } from './skill-version-browser-dialog';

type SkillReleasesPanelProps = {
  skillName: string;
};

function shortSha(sha?: string): string {
  return sha ? sha.slice(0, 10) : '-';
}

function releaseTime(release: SkillRelease): string {
  return release.createTime ? fmtTime(release.createTime) : '-';
}

function publishErrorMessage(error: unknown): string {
  if (error instanceof HubApiError && error.code === 'SKILL_RELEASE_STALE') {
    return '发布失败：草稿已有新修改，请刷新后重新确认发布。';
  }
  return error instanceof Error ? error.message : 'Skill 发布失败';
}

export function SkillReleasesPanel({ skillName }: SkillReleasesPanelProps) {
  const releases = useSkillReleases(skillName);
  const refs = useSkillRefs(skillName);
  const createRelease = useCreateSkillRelease(skillName);
  const compareRefs = useCompareSkillRefs(skillName);
  const restoreRef = useRestoreSkillRef(skillName);

  const [version, setVersion] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [compareBaseRef, setCompareBaseRef] = useState('');
  const [restoreCommit, setRestoreCommit] = useState<SkillCommit | null>(null);
  const [browserTag, setBrowserTag] = useState<string | null>(null);

  const defaultBranch = useMemo(() => {
    const branches = (refs.data ?? []).filter((ref) => ref.type === 'branch');
    return branches.find((ref) => ref.isDefault) ?? branches[0];
  }, [refs.data]);
  const draftRef = defaultBranch?.fullRef ?? '';
  const draftHead = defaultBranch?.commitSha ?? '';
  const commits = useSkillCommits(skillName, draftRef);
  const versionViews = useMemo(
    () => buildSkillReleaseViews<SkillRelease>(releases.data ?? []),
    [releases.data],
  );
  const effectiveCompareBase = compareBaseRef || versionViews[0]?.ref || '';
  const canPublish = Boolean(version.trim() && draftRef && draftHead);
  const versionLooksPrerelease = version.trim().replace(/^v/, '').includes('-');

  const publish = async () => {
    if (!canPublish) return;
    try {
      const release = await createRelease.mutateAsync({
        version: version.trim(),
        sourceRef: draftRef,
        expectedCommitSha: draftHead,
        releaseNotes: releaseNotes.trim() || undefined,
      });
      toast.success(`已发布 ${release.tag || version.trim()}`);
      setVersion('');
      setReleaseNotes('');
      await Promise.all([releases.refetch(), refs.refetch()]);
    } catch (error) {
      toast.error(publishErrorMessage(error));
    }
  };

  const compare = async () => {
    if (!effectiveCompareBase || !draftRef) return;
    try {
      await compareRefs.mutateAsync({
        baseRef: effectiveCompareBase,
        targetRef: draftRef,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '版本对比失败');
    }
  };

  const restore = async () => {
    if (!restoreCommit?.commitSha || !draftHead || !defaultBranch?.name) return;
    try {
      const commit = await restoreRef.mutateAsync({
        sourceRef: restoreCommit.commitSha,
        targetBranch: defaultBranch.name,
        expectedHeadSha: draftHead,
        commitMessage: `restore: ${restoreCommit.subject || shortSha(restoreCommit.commitSha)}`,
      });
      toast.success(`已创建恢复提交 ${shortSha(commit.commitSha)}`);
      setRestoreCommit(null);
      await Promise.all([refs.refetch(), commits.refetch()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '恢复草稿失败');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 text-sm font-medium">
          <Tag className="h-4 w-4" /> 版本发布
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          默认分支就是可编辑草稿；发布后生成不可变版本。普通使用无需管理 Git 分支。
        </p>
      </div>

      <div className="space-y-3 rounded-md border bg-muted/20 p-3">
        <div className="flex items-center justify-between gap-2 rounded border bg-background px-2.5 py-2">
          <div>
            <div className="text-xs font-medium">当前草稿</div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              发布固定取当前草稿内容，并在提交变化时阻止误发布。
            </div>
          </div>
          {refs.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : draftHead ? (
            <Badge variant="outline" className="gap-1">
              <CheckCircle2 className="h-3 w-3" /> 已就绪
            </Badge>
          ) : (
            <Badge variant="destructive">草稿不可用</Badge>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">版本号</Label>
            {version.trim() && (
              <Badge variant="secondary" className="text-[10px]">
                {versionLooksPrerelease ? '预发布版' : '稳定版'}
              </Badge>
            )}
          </div>
          <Input
            value={version}
            placeholder="例如 1.4.2 或 1.5.0-beta.1"
            onChange={(event) => setVersion(event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">更新说明</Label>
          <Textarea
            rows={3}
            value={releaseNotes}
            placeholder="说明本版本解决的问题和主要变化"
            onChange={(event) => setReleaseNotes(event.target.value)}
          />
        </div>

        <Button
          className="w-full"
          disabled={!canPublish || createRelease.isPending}
          onClick={publish}
        >
          {createRelease.isPending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Tag className="mr-1.5 h-4 w-4" />
          )}
          发布新版本
        </Button>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium">已发布版本</div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              稳定版用于正式安装，预发布版用于提前验证。
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="刷新版本"
            onClick={() => Promise.all([releases.refetch(), refs.refetch()])}
            disabled={releases.isFetching}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${releases.isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {releases.isLoading ? (
          <Loading />
        ) : versionViews.length === 0 ? (
          <Empty>还没有发布版本</Empty>
        ) : (
          <div className="space-y-2">
            {versionViews.map((view) => {
              const release = view.release;
              return (
                <div key={view.tag} className="rounded-md border p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {view.version}
                        </Badge>
                        <Badge
                          variant={view.kind === 'stable' ? 'default' : 'secondary'}
                          className="text-[9px]"
                        >
                          {view.kind === 'stable' ? '稳定版' : '预发布'}
                        </Badge>
                        {view.latestStable && (
                          <Badge variant="secondary" className="text-[9px]">最新稳定版</Badge>
                        )}
                      </div>
                      <div className="mt-1.5 text-[10px] text-muted-foreground">
                        {release.publisherName || release.publisherId || '未知发布人'} · {releaseTime(release)}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 shrink-0 px-2 text-[10px]"
                      onClick={() => setBrowserTag(view.tag)}
                    >
                      <Eye className="mr-1 h-3.5 w-3.5" /> 查看内容
                    </Button>
                  </div>

                  {release.releaseNotes && (
                    <div className="mt-2 whitespace-pre-wrap text-[11px]">{release.releaseNotes}</div>
                  )}

                  <details className="mt-2 rounded border bg-muted/20 px-2 py-1.5 text-[10px] text-muted-foreground">
                    <summary className="cursor-pointer select-none">完整性与发布来源</summary>
                    <div className="mt-2 space-y-1 font-mono text-[9px]">
                      <div>commit {release.commitSha || '-'}</div>
                      <div>tree {release.treeSha || '-'}</div>
                      <div className="break-all">manifest {release.manifestSha256 || '-'}</div>
                      {release.sourceRef && <div>{release.sourceRef}</div>}
                    </div>
                  </details>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <details className="rounded-md border bg-muted/10">
        <summary className="cursor-pointer select-none px-3 py-2.5 text-xs font-medium">
          高级工具：提交历史、恢复与 Diff
        </summary>
        <div className="border-t p-3">
          <p className="mb-3 text-[10px] text-muted-foreground">
            这里保留 Git 的审计和修复能力，但不会要求普通用户选择或管理分支。
          </p>
          <Tabs defaultValue="history">
            <TabsList className="grid h-8 w-full grid-cols-2">
              <TabsTrigger value="history" className="text-[10px]">
                <History className="mr-1 h-3 w-3" /> 草稿历史
              </TabsTrigger>
              <TabsTrigger value="compare" className="text-[10px]">
                <FileDiff className="mr-1 h-3 w-3" /> 与草稿对比
              </TabsTrigger>
            </TabsList>

            <TabsContent value="history" className="mt-3 space-y-2">
              {commits.isLoading ? (
                <Loading />
              ) : (commits.data ?? []).length === 0 ? (
                <Empty>没有提交记录</Empty>
              ) : (
                (commits.data ?? []).map((commit) => (
                  <div key={commit.commitSha} className="rounded-md border p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium">
                          {commit.subject || '无提交说明'}
                        </div>
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          {commit.authorName || commit.authorEmail || '未知作者'}
                          {commit.createTime ? ` · ${fmtTime(commit.createTime)}` : ''}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 shrink-0 px-2 text-[10px]"
                        disabled={!commit.commitSha || restoreRef.isPending}
                        onClick={() => setRestoreCommit(commit)}
                      >
                        <RotateCcw className="mr-1 h-3 w-3" /> 恢复为草稿
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="compare" className="mt-3 space-y-3">
              {versionViews.length === 0 ? (
                <Empty>发布版本后才能与草稿对比</Empty>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">选择已发布版本</Label>
                    <Select value={effectiveCompareBase} onValueChange={setCompareBaseRef}>
                      <SelectTrigger className="font-mono text-xs">
                        <SelectValue placeholder="选择版本" />
                      </SelectTrigger>
                      <SelectContent>
                        {versionViews.map((view) => (
                          <SelectItem key={view.ref} value={view.ref}>
                            {view.kind === 'stable' ? '稳定版' : '预发布'} · {view.version}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="rounded border bg-background px-2.5 py-2 text-[10px] text-muted-foreground">
                    对比目标：当前草稿
                  </div>
                  <Button
                    className="w-full"
                    variant="secondary"
                    disabled={!effectiveCompareBase || !draftRef || compareRefs.isPending}
                    onClick={compare}
                  >
                    {compareRefs.isPending ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <FileDiff className="mr-1.5 h-4 w-4" />
                    )}
                    生成 Diff
                  </Button>
                </>
              )}

              {compareRefs.data && (
                <>
                  <Separator />
                  <div className="text-[10px] text-muted-foreground">
                    {shortSha(compareRefs.data.baseCommitSha)} → {shortSha(compareRefs.data.targetCommitSha)}
                  </div>
                  <div className="space-y-1.5">
                    {(compareRefs.data.files ?? []).map((file) => (
                      <div
                        key={`${file.status}:${file.path}`}
                        className="flex items-center justify-between rounded border px-2 py-1.5 text-[10px]"
                      >
                        <span className="min-w-0 truncate font-mono">{file.path || '-'}</span>
                        <span className="ml-2 shrink-0">
                          <span className="text-emerald-600">+{file.additions || '0'}</span>
                          {' / '}
                          <span className="text-destructive">-{file.deletions || '0'}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                  {compareRefs.data.patch && (
                    <pre className="max-h-96 overflow-auto whitespace-pre rounded-md border bg-muted/30 p-2 font-mono text-[9px]">
                      {compareRefs.data.patch}
                      {compareRefs.data.patchTruncated ? '\n\n… Diff 已截断' : ''}
                    </pre>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </details>

      <ConfirmDialog
        open={Boolean(restoreCommit)}
        onOpenChange={(open) => { if (!open) setRestoreCommit(null); }}
        title="恢复为新的草稿提交"
        description={`把当前草稿恢复到 ${shortSha(restoreCommit?.commitSha)} 的文件内容。历史版本不会被覆盖。`}
        confirmLabel="确认恢复"
        onConfirm={restore}
      />

      {browserTag && (
        <SkillVersionBrowserDialog
          key={browserTag}
          skillName={skillName}
          releases={releases.data ?? []}
          initialTag={browserTag}
          open
          onOpenChange={(open) => { if (!open) setBrowserTag(null); }}
        />
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex justify-center py-6">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    </div>
  );
}

function Empty({ children }: { children: string }) {
  return (
    <div className="rounded-md border border-dashed p-5 text-center text-xs text-muted-foreground">
      {children}
    </div>
  );
}
