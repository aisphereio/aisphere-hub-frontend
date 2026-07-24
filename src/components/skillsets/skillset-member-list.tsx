'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSkillReleases } from '@/hooks/use-skill-releases';
import {
  useResolveSkillSet,
  useSkillSetBind,
  useSkillSetUnbind,
  useSkillSetUpdateMember,
} from '@/hooks/use-skillsets';
import { useSkills } from '@/hooks/use-skills';
import type { SkillSet, SkillSetMember } from '@/lib/api/types';
import { useT } from '@/lib/i18n';

interface SkillSetMemberListProps {
  group: SkillSet;
  onUpdate: () => void;
}

function shortSha(sha?: string): string {
  return sha ? sha.slice(0, 10) : '-';
}

export function SkillSetMemberList({ group, onUpdate }: SkillSetMemberListProps) {
  const t = useT();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const [newVersion, setNewVersion] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [quickPickQuery, setQuickPickQuery] = useState('');

  const bindMutation = useSkillSetBind();
  const unbindMutation = useSkillSetUnbind();
  const updateMemberMutation = useSkillSetUpdateMember();
  const resolveMutation = useResolveSkillSet();
  const selectedSkillReleases = useSkillReleases(
    showAddDialog && newSkillName ? newSkillName : null,
  );
  const { data: allSkills, isLoading: skillsLoading } = useSkills({ pageNo: 1, pageSize: 200 });

  const members = [...(group.members || [])].sort((a, b) =>
    (a.order ?? 0) - (b.order ?? 0) || a.skillName.localeCompare(b.skillName),
  );
  const unresolvedCount = members.filter(
    (member) =>
      !member.version ||
      !member.commitSha ||
      !member.treeSha ||
      !member.manifestSha256,
  ).length;

  const selectSkill = (skillName: string) => {
    setNewSkillName(skillName);
    setNewVersion('');
  };

  const handleBind = async () => {
    if (!newSkillName || !newVersion) return;
    try {
      await bindMutation.mutateAsync({
        skillSetName: group.name,
        member: {
          skillName: newSkillName,
          version: newVersion,
          order: members.length,
        },
      });
      toast.success(`${t('skillset.member.bound')}: ${newSkillName}@${newVersion}`);
      setNewSkillName('');
      setNewVersion('');
      setQuickPickQuery('');
      setShowAddDialog(false);
      onUpdate();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t('skillset.member.bindFailed'));
    }
  };

  const handleUnbind = async (skillName: string) => {
    try {
      await unbindMutation.mutateAsync({ skillSetName: group.name, skillName });
      toast.success(`${t('skillset.member.unbound')}: ${skillName}`);
      setDeleteConfirm(null);
      onUpdate();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t('skillset.member.unbindFailed'));
    }
  };

  const updateVersion = async (member: SkillSetMember, version: string) => {
    try {
      await updateMemberMutation.mutateAsync({
        skillSetName: group.name,
        skillName: member.skillName,
        member: { version },
      });
      toast.success(`${member.skillName} 已锁定到 ${version}`);
      onUpdate();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t('skillset.detail.updateFailed'));
    }
  };

  const moveMember = async (member: SkillSetMember, direction: -1 | 1) => {
    const index = members.findIndex((item) => item.skillName === member.skillName);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= members.length) return;

    const target = members[targetIndex];
    try {
      await Promise.all([
        updateMemberMutation.mutateAsync({
          skillSetName: group.name,
          skillName: member.skillName,
          member: { order: target.order ?? targetIndex },
        }),
        updateMemberMutation.mutateAsync({
          skillSetName: group.name,
          skillName: target.skillName,
          member: { order: member.order ?? index },
        }),
      ]);
      onUpdate();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t('skillset.detail.updateFailed'));
    }
  };

  const validateLock = async () => {
    try {
      const lock = await resolveMutation.mutateAsync(group.name);
      toast.success(`锁定快照有效：revision ${lock.skillSet.revision}，${lock.skills.length} 个 Skill`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : '锁定快照校验失败');
    }
  };

  const quickPickSkills = (allSkills || [])
    .filter((skill) => !members.some((member) => member.skillName === skill.name))
    .filter((skill) => {
      const text = `${skill.name} ${skill.displayName || ''}`.toLowerCase();
      return !quickPickQuery || text.includes(quickPickQuery.toLowerCase());
    })
    .slice(0, 12);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">
            {members.length} {t('skillset.detail.skills')}
          </Badge>
          {unresolvedCount > 0 && (
            <Badge variant="destructive" className="text-[10px]">
              {unresolvedCount} 未锁定
            </Badge>
          )}
          {updateMemberMutation.isPending && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            disabled={resolveMutation.isPending || members.length === 0}
            onClick={validateLock}
          >
            {resolveMutation.isPending ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="mr-1 h-3.5 w-3.5" />
            )}
            校验锁
          </Button>
          <Button
            size="sm"
            onClick={() => setShowAddDialog(true)}
            className="bg-gradient-to-r from-violet-600 to-fuchsia-500"
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> {t('skillset.member.add')}
          </Button>
        </div>
      </div>

      {showAddDialog && (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium">Skill</div>
            <Input
              placeholder={t('skillset.member.skillName')}
              value={newSkillName}
              onChange={(event) => selectSkill(event.target.value)}
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <div className="text-[11px] font-medium">不可变 Release</div>
            <Select value={newVersion} onValueChange={setNewVersion}>
              <SelectTrigger className="h-8 font-mono text-xs">
                <SelectValue
                  placeholder={
                    selectedSkillReleases.isLoading
                      ? '读取 Release…'
                      : '选择精确 SemVer Tag'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {(selectedSkillReleases.data ?? []).map((release) => (
                  <SelectItem key={release.tag} value={release.tag!}>
                    {release.tag} · {shortSha(release.commitSha)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {newSkillName && !selectedSkillReleases.isLoading && (selectedSkillReleases.data ?? []).length === 0 && (
              <div className="text-[10px] text-destructive">该 Skill 尚无可锁定的 Release，请先发布版本。</div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowAddDialog(false);
                setNewSkillName('');
                setNewVersion('');
              }}
            >
              {t('skillset.cancel')}
            </Button>
            <Button
              size="sm"
              onClick={handleBind}
              disabled={!newSkillName || !newVersion || bindMutation.isPending}
              className="bg-gradient-to-r from-violet-600 to-fuchsia-500"
            >
              {bindMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              锁定并添加
            </Button>
          </div>

          {allSkills && allSkills.length > 0 && (
            <div className="space-y-1.5 border-t pt-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜索可添加的 Skill"
                  value={quickPickQuery}
                  onChange={(event) => setQuickPickQuery(event.target.value)}
                  className="h-7 pl-7 text-xs"
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {quickPickSkills.length === 0 && !skillsLoading && (
                  <span className="text-[10px] text-muted-foreground">没有匹配的 Skill</span>
                )}
                {quickPickSkills.map((skill) => (
                  <Badge
                    key={skill.name}
                    variant={newSkillName === skill.name ? 'secondary' : 'outline'}
                    className="cursor-pointer text-[10px] hover:border-violet-500/40 hover:bg-violet-500/10"
                    onClick={() => selectSkill(skill.name)}
                  >
                    {skill.displayName || skill.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {members.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          {t('skillset.member.empty')}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">{t('skillset.member.skillName')}</TableHead>
              <TableHead className="text-xs">锁定版本</TableHead>
              <TableHead className="text-xs">排序</TableHead>
              <TableHead className="w-10 text-xs" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member, index) => (
              <TableRow key={member.skillName}>
                <TableCell className="text-xs">
                  <div className="font-medium">
                    {member.displayName || member.label || member.skillName}
                  </div>
                  {(member.displayName || member.label) && (
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {member.skillName}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <MemberVersionSelect
                    member={member}
                    pending={updateMemberMutation.isPending}
                    onChange={(value) => updateVersion(member, value)}
                  />
                </TableCell>
                <TableCell className="text-xs">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={index === 0}
                      onClick={() => moveMember(member, -1)}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <span className="min-w-5 text-center tabular-nums">{index + 1}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={index === members.length - 1}
                      onClick={() => moveMember(member, 1)}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 text-destructive"
                    onClick={() => setDeleteConfirm(member.skillName)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {unresolvedCount > 0 ? (
        <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>存在旧数据或未解析成员。为每个 Skill 选择精确 Release 后，才能生成 Runtime 锁定快照。</span>
        </div>
      ) : (
        <div className="rounded-md border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
          每个成员都固定到 Tag、Commit、Tree 和 SKILL.md Hash。Skill 后续更新不会改变已生成的运行快照。
        </div>
      )}

      {resolveMutation.data && (
        <pre className="max-h-64 overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-[10px]">
          {JSON.stringify(resolveMutation.data, null, 2)}
        </pre>
      )}

      <ConfirmDialog
        open={Boolean(deleteConfirm)}
        onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}
        title={t('skillset.member.removeTitle')}
        description={t('skillset.member.removeDesc', { name: deleteConfirm || '' })}
        confirmLabel={t('skillset.member.remove')}
        variant="destructive"
        onConfirm={() => deleteConfirm && handleUnbind(deleteConfirm)}
      />
    </div>
  );
}

function MemberVersionSelect({
  member,
  pending,
  onChange,
}: {
  member: SkillSetMember;
  pending: boolean;
  onChange: (version: string) => void;
}) {
  const releases = useSkillReleases(member.skillName);

  return (
    <div className="min-w-40 space-y-1">
      <Select value={member.version || ''} onValueChange={onChange} disabled={pending}>
        <SelectTrigger className="h-7 font-mono text-[10px]">
          <SelectValue placeholder="选择 Release" />
        </SelectTrigger>
        <SelectContent>
          {(releases.data ?? []).map((release) => (
            <SelectItem key={release.tag} value={release.tag!}>
              {release.tag} · {shortSha(release.commitSha)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="font-mono text-[9px] text-muted-foreground">
        commit {shortSha(member.commitSha)}
      </div>
    </div>
  );
}
