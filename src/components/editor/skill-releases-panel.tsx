'use client';

import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  FileDiff,
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
  useResolveSkillRelease,
  useRestoreSkillRef,
  useSkillCommits,
  useSkillRefs,
  useSkillReleases,
} from '@/hooks/use-skill-releases';
import type {
  SkillCommit,
  SkillGitRef,
  SkillRelease,
} from '@/lib/api/adapters/skill-release';
import { HubApiError } from '@/lib/api/hub-fetch';
import { fmtTime } from '@/lib/utils';

type SkillReleasesPanelProps = {
  skillName: string;
};

function shortSha(sha?: string): string {
  return sha ? sha.slice(0, 10) : '-';
}

function releaseTime(release: SkillRelease): string {
  return release.createTime ? fmtTime(release.createTime) : '-';
}

function refLabel(ref: SkillGitRef): string {
  return `${ref.type === 'tag' ? 'Tag' : '分支'} · ${ref.name || ref.fullRef || '-'}`;
}

function publishErrorMessage(error: unknown): string {
  if (error instanceof HubApiError && error.code === 'SKILL_RELEASE_STALE') {
    return '发布失败：源分支已有新提交，请刷新分支后重新确认发布。';
  }
  return error instanceof Error ? error.message : 'Skill 发布失败';
}

export function SkillReleasesPanel({ skillName }: SkillReleasesPanelProps) {
  const releases = useSkillReleases(skillName);
  const refs = useSkillRefs(skillName);
  const createRelease = useCreateSkillRelease(skillName);
  const resolveRelease = useResolveSkillRelease(skillName);
  const compareRefs = useCompareSkillRefs(skillName);
  const restoreRef = useRestoreSkillRef(skillName);

  const [version, setVersion] = useState('');
  const [publishRef, setPublishRef] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [historyRef, setHistoryRef] = useState('');
  const [baseRef, setBaseRef] = useState('');
  const [targetRef, setTargetRef] = useState('');
  const [restoreCommit, setRestoreCommit] = useState<SkillCommit | null>(null);

  const branchRefs = useMemo(
    () => (refs.data ?? []).filter((ref) => ref.type === 'branch'),
    [refs.data],
  );
  const defaultBranch = useMemo(
    () => branchRefs.find((ref) => ref.isDefault) ?? branchRefs[0],
    [branchRefs],
  );
  const firstTag = (refs.data ?? []).find((ref) => ref.type === 'tag');
  const effectivePublishRef = publishRef || defaultBranch?.fullRef || '';
  const effectiveHistoryRef = historyRef || defaultBranch?.fullRef || '';
  const effectiveBaseRef = baseRef || firstTag?.fullRef || defaultBranch?.fullRef || '';
  const effectiveTargetRef = targetRef || defaultBranch?.fullRef || '';
  const selectedPublishRef = branchRefs.find(
    (ref) => ref.fullRef === effectivePublishRef,
  );
  const commits = useSkillCommits(skillName, effectiveHistoryRef);

  const canPublish = Boolean(version.trim() && selectedPublishRef?.commitSha);

  const publish = async () => {
    if (!canPublish || !selectedPublishRef?.commitSha) return;
    try {
      const release = await createRelease.mutateAsync({
        version: version.trim(),
        sourceRef: selectedPublishRef.fullRef,
        expectedCommitSha: selectedPublishRef.commitSha,
        releaseNotes: releaseNotes.trim() || undefined,
      });
      toast.success(`已发布 ${release.tag || version.trim()}`);
      setVersion('');
      setReleaseNotes('');
      await refs.refetch();
    } catch (error) {
      toast.error(publishErrorMessage(error));
    }
  };

  const verify = async (release: SkillRelease) => {
    if (!release.tag) return;
    try {
      const resolved = await resolveRelease.mutateAsync(release.tag);
      toast.success(`${resolved.tag || release.tag} → ${shortSha(resolved.commitSha)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '版本解析失败');
    }
  };

  const compare = async () => {
    if (!effectiveBaseRef || !effectiveTargetRef) return;
    try {
      await compareRefs.mutateAsync({
        baseRef: effectiveBaseRef,
        targetRef: effectiveTargetRef,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '版本对比失败');
    }
  };

  const restore = async () => {
    if (!restoreCommit?.commitSha || !defaultBranch?.commitSha) return;
    try {
      const commit = await restoreRef.mutateAsync({
        sourceRef: restoreCommit.commitSha,
        targetBranch: defaultBranch.name,
        expectedHeadSha: defaultBranch.commitSha,
        commitMessage: `restore: ${restoreCommit.subject || shortSha(restoreCommit.commitSha)}`,
      });
      toast.success(`已创建恢复提交 ${shortSha(commit.commitSha)}`);
      setRestoreCommit(null);
      await Promise.all([refs.refetch(), commits.refetch()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '恢复版本失败');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 text-sm font-medium">
          <Tag className="h-4 w-4" /> Git 版本管理
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          分支用于开发，SemVer Tag 用于不可变发布；恢复操作会创建新提交，不会移动历史 Tag。
        </p>
      </div>

      <Tabs defaultValue="publish">
        <TabsList className="grid h-auto w-full grid-cols-4">
          <TabsTrigger value="publish" className="px-1 text-[10px]">发布</TabsTrigger>
          <TabsTrigger value="releases" className="px-1 text-[10px]">版本</TabsTrigger>
          <TabsTrigger value="history" className="px-1 text-[10px]">历史</TabsTrigger>
          <TabsTrigger value="compare" className="px-1 text-[10px]">对比</TabsTrigger>
        </TabsList>

        <TabsContent value="publish" className="space-y-3">
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
              <Label className="text-xs">源分支</Label>
              <Select value={effectivePublishRef} onValueChange={setPublishRef}>
                <SelectTrigger className="font-mono text-xs">
                  <SelectValue placeholder="选择分支" />
                </SelectTrigger>
                <SelectContent>
                  {branchRefs.map((ref) => (
                    <SelectItem key={ref.fullRef} value={ref.fullRef!}>
                      {ref.name}{ref.isDefault ? '（默认）' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded border bg-background px-2.5 py-2">
              <div className="text-[10px] text-muted-foreground">当前 HEAD（自动获取）</div>
              <div className="mt-1 break-all font-mono text-[10px]">
                {selectedPublishRef?.commitSha || (refs.isLoading ? '读取中…' : '-')}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">发布说明</Label>
              <Textarea
                rows={3}
                value={releaseNotes}
                placeholder="说明本版本的主要变更"
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
              发布不可变版本
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="releases" className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium">已发布版本</div>
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
          ) : (releases.data ?? []).length === 0 ? (
            <Empty>还没有发布版本</Empty>
          ) : (
            <div className="space-y-2">
              {(releases.data ?? []).map((release) => (
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
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> 校验
                    </Button>
                  </div>
                  <div className="mt-2 font-mono text-[10px]">
                    commit {shortSha(release.commitSha)} · tree {shortSha(release.treeSha)}
                  </div>
                  <div className="mt-1 break-all font-mono text-[9px] text-muted-foreground">
                    manifest {release.manifestSha256 || '-'}
                  </div>
                  {release.releaseNotes && (
                    <div className="mt-2 whitespace-pre-wrap text-[11px]">{release.releaseNotes}</div>
                  )}
                  <div className="mt-2 text-[10px] text-muted-foreground">
                    {release.publisherName || release.publisherId || '未知发布人'} · {releaseTime(release)}
                  </div>
                  {release.sourceRef && (
                    <div className="mt-1 font-mono text-[9px] text-muted-foreground">
                      {release.sourceRef}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-3">
          <Select value={effectiveHistoryRef} onValueChange={setHistoryRef}>
            <SelectTrigger className="font-mono text-xs">
              <SelectValue placeholder="选择分支或 Tag" />
            </SelectTrigger>
            <SelectContent>
              {(refs.data ?? []).map((ref) => (
                <SelectItem key={ref.fullRef} value={ref.fullRef!}>
                  {refLabel(ref)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {commits.isLoading ? (
            <Loading />
          ) : (commits.data ?? []).length === 0 ? (
            <Empty>没有提交记录</Empty>
          ) : (
            <div className="space-y-2">
              {(commits.data ?? []).map((commit) => (
                <div key={commit.commitSha} className="rounded-md border p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium">{commit.subject || '无提交说明'}</div>
                      <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                        {shortSha(commit.commitSha)}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 shrink-0 px-2 text-[10px]"
                      disabled={!commit.commitSha || restoreRef.isPending}
                      onClick={() => setRestoreCommit(commit)}
                    >
                      <RotateCcw className="mr-1 h-3 w-3" /> 恢复
                    </Button>
                  </div>
                  <div className="mt-2 text-[10px] text-muted-foreground">
                    {commit.authorName || commit.authorEmail || '未知作者'}
                    {commit.createTime ? ` · ${fmtTime(commit.createTime)}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="compare" className="space-y-3">
          <div className="space-y-2">
            <RefSelect label="基准版本" value={effectiveBaseRef} refs={refs.data ?? []} onChange={setBaseRef} />
            <RefSelect label="目标版本" value={effectiveTargetRef} refs={refs.data ?? []} onChange={setTargetRef} />
            <Button
              className="w-full"
              variant="secondary"
              disabled={!effectiveBaseRef || !effectiveTargetRef || compareRefs.isPending}
              onClick={compare}
            >
              {compareRefs.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <FileDiff className="mr-1.5 h-4 w-4" />
              )}
              生成 Diff
            </Button>
          </div>
          {compareRefs.data && (
            <>
              <Separator />
              <div className="text-[10px] text-muted-foreground">
                {shortSha(compareRefs.data.baseCommitSha)} → {shortSha(compareRefs.data.targetCommitSha)}
              </div>
              <div className="space-y-1.5">
                {(compareRefs.data.files ?? []).map((file) => (
                  <div key={`${file.status}:${file.path}`} className="flex items-center justify-between rounded border px-2 py-1.5 text-[10px]">
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

      <ConfirmDialog
        open={Boolean(restoreCommit)}
        onOpenChange={(open) => { if (!open) setRestoreCommit(null); }}
        title="创建恢复提交"
        description={`把 ${defaultBranch?.name || '默认分支'} 的文件树恢复到 ${shortSha(restoreCommit?.commitSha)}。历史和已发布 Tag 不会被覆盖。`}
        confirmLabel="确认恢复"
        onConfirm={restore}
      />
    </div>
  );
}

function RefSelect({
  label,
  value,
  refs,
  onChange,
}: {
  label: string;
  value: string;
  refs: SkillGitRef[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="font-mono text-xs">
          <SelectValue placeholder="选择分支或 Tag" />
        </SelectTrigger>
        <SelectContent>
          {refs.map((ref) => (
            <SelectItem key={ref.fullRef} value={ref.fullRef!}>
              {refLabel(ref)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
