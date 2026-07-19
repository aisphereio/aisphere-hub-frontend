'use client';

import { Trash2, Plus, Search, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/shared';
import { useSkillSetBind, useSkillSetUnbind, useSkillSetUpdateMember } from '@/hooks/use-skillsets';
import { useSkills } from '@/hooks/use-skills';
import { useT } from '@/lib/i18n';
import { toast } from 'sonner';
import type { SkillSet, SkillSetMember } from '@/lib/api/types';
import { useState } from 'react';

interface SkillSetMemberListProps {
  group: SkillSet;
  onUpdate: () => void;
}

export function SkillSetMemberList({ group, onUpdate }: SkillSetMemberListProps) {
  const t = useT();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [quickPickQuery, setQuickPickQuery] = useState('');

  const bindMutation = useSkillSetBind();
  const unbindMutation = useSkillSetUnbind();
  const updateMemberMutation = useSkillSetUpdateMember();
  const { data: allSkills, isLoading: skillsLoading } = useSkills({ pageNo: 1, pageSize: 200 });

  const members = [...(group.members || [])].sort((a, b) =>
    (a.order ?? 0) - (b.order ?? 0) || a.skillName.localeCompare(b.skillName),
  );

  const handleBind = async (skillName = newSkillName) => {
    if (!skillName) return;
    try {
      await bindMutation.mutateAsync({
        skillSetName: group.name,
        member: { skillName, order: members.length },
      });
      toast.success(t('skillset.member.bound') + ': ' + skillName);
      setNewSkillName('');
      setQuickPickQuery('');
      setShowAddDialog(false);
      onUpdate();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('skillset.member.bindFailed'));
    }
  };

  const handleUnbind = async (skillName: string) => {
    try {
      await unbindMutation.mutateAsync({ skillSetName: group.name, skillName });
      toast.success(t('skillset.member.unbound') + ': ' + skillName);
      setDeleteConfirm(null);
      onUpdate();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('skillset.member.unbindFailed'));
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
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('skillset.detail.updateFailed'));
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">{members.length} {t('skillset.detail.skills')}</Badge>
          {updateMemberMutation.isPending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        <Button size="sm" onClick={() => setShowAddDialog(true)} className="bg-gradient-to-r from-violet-600 to-fuchsia-500">
          <Plus className="h-3.5 w-3.5 mr-1" /> {t('skillset.member.add')}
        </Button>
      </div>

      {showAddDialog && (
        <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
          <div className="flex items-center gap-2">
            <Input
              placeholder={t('skillset.member.skillName')}
              value={newSkillName}
              onChange={(e) => setNewSkillName(e.target.value)}
              className="h-8 text-xs flex-1"
            />
            <Button size="sm" onClick={() => handleBind()} disabled={!newSkillName || bindMutation.isPending} className="bg-gradient-to-r from-violet-600 to-fuchsia-500">
              {bindMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              {t('skillset.member.add')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAddDialog(false)}>{t('skillset.cancel')}</Button>
          </div>

          {allSkills && allSkills.length > 0 && (
            <div className="pt-1 space-y-1.5">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Search skills to add..."
                  value={quickPickQuery}
                  onChange={(e) => setQuickPickQuery(e.target.value)}
                  className="h-7 text-xs pl-7"
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {quickPickSkills.length === 0 && !skillsLoading && <span className="text-[10px] text-muted-foreground">No matching skills</span>}
                {quickPickSkills.map((skill) => (
                  <Badge
                    key={skill.name}
                    variant="outline"
                    className="text-[10px] cursor-pointer hover:bg-violet-500/10 hover:border-violet-500/40"
                    onClick={() => handleBind(skill.name)}
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
        <div className="text-xs text-muted-foreground text-center py-6">{t('skillset.member.empty')}</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">{t('skillset.member.skillName')}</TableHead>
              <TableHead className="text-xs">当前版本</TableHead>
              <TableHead className="text-xs">排序</TableHead>
              <TableHead className="text-xs w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member, index) => (
              <TableRow key={member.skillName}>
                <TableCell className="text-xs">
                  <div className="font-medium">{member.label || member.skillName}</div>
                  {member.label && <div className="font-mono text-[10px] text-muted-foreground">{member.skillName}</div>}
                </TableCell>
                <TableCell className="text-xs font-mono">{member.version || '-'}</TableCell>
                <TableCell className="text-xs">
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" disabled={index === 0} onClick={() => moveMember(member, -1)}>
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <span className="min-w-5 text-center tabular-nums">{index + 1}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" disabled={index === members.length - 1} onClick={() => moveMember(member, 1)}>
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" className="h-6 w-6 text-destructive" onClick={() => setDeleteConfirm(member.skillName)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="rounded-md border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
        SkillSet 仅维护 Skill 引用和展示顺序。版本来自 Skill 当前发版，不在集合中锁定。
      </div>

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
