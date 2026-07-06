'use client';

import { Trash2, Plus, Search, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
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
  const [search, setSearch] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const [newVersion, setNewVersion] = useState('');
  const [newLabel, setNewLabel] = useState('stable');
  const [newRequired, setNewRequired] = useState(true);
  const [newOrder, setNewOrder] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [quickPickQuery, setQuickPickQuery] = useState('');

  const bindMutation = useSkillSetBind();
  const unbindMutation = useSkillSetUnbind();
  const updateMemberMutation = useSkillSetUpdateMember();
  const { data: allSkills, isLoading: skillsLoading } = useSkills({ pageNo: 1, pageSize: 200 });

  const handleBind = async () => {
    if (!newSkillName) return;
    try {
      await bindMutation.mutateAsync({
        skillSetName: group.name,
        member: {
          skillName: newSkillName,
          version: newVersion || undefined,
          label: newLabel || undefined,
          required: newRequired,
          order: newOrder,
        } as SkillSetMember,
      });
      toast.success(t('skillset.member.bound') + ': ' + newSkillName);
      setNewSkillName('');
      setNewVersion('');
      setNewLabel('stable');
      setNewRequired(true);
      setNewOrder(0);
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

  const handleUpdateMember = async (skillName: string, patch: Partial<SkillSetMember>) => {
    try {
      await updateMemberMutation.mutateAsync({
        skillSetName: group.name,
        skillName,
        member: patch,
      });
      onUpdate();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    }
  };

  const members = group.members || [];

  const quickPickSkills = (allSkills || [])
    .filter((s) => !members.some((m) => m.skillName === s.name))
    .filter((s) => !quickPickQuery || s.name.toLowerCase().includes(quickPickQuery.toLowerCase()))
    .slice(0, 12);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">{members.length} {t('skillset.detail.skills')}</Badge>
          {updateMemberMutation.isPending && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
        </div>
        <Button size="sm" onClick={() => setShowAddDialog(true)} className="bg-gradient-to-r from-violet-600 to-fuchsia-500">
          <Plus className="h-3.5 w-3.5 mr-1" /> {t('skillset.member.add')}
        </Button>
      </div>

      {/* Add Skill form */}
      {showAddDialog && (
        <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
          <div className="flex items-center gap-2">
            <Input
              placeholder={t('skillset.member.skillName')}
              value={newSkillName}
              onChange={(e) => setNewSkillName(e.target.value)}
              className="h-8 text-xs flex-1"
            />
            <Input
              placeholder={t('skillset.member.version')}
              value={newVersion}
              onChange={(e) => setNewVersion(e.target.value)}
              className="h-8 text-xs w-24"
            />
            <Input
              placeholder={t('skillset.member.label')}
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="h-8 text-xs w-24"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch checked={newRequired} onCheckedChange={setNewRequired} />
              <span className="text-xs text-muted-foreground">{t('skillset.member.required')}</span>
            </div>
            <Input
              type="number"
              placeholder={t('skillset.member.order')}
              value={newOrder}
              onChange={(e) => setNewOrder(Number(e.target.value))}
              className="h-8 text-xs w-20"
            />
            <Button size="sm" onClick={handleBind} disabled={!newSkillName || bindMutation.isPending} className="bg-gradient-to-r from-violet-600 to-fuchsia-500">
              {bindMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
              {t('skillset.member.add')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAddDialog(false)}>{t('skillset.cancel')}</Button>
          </div>
          {/* Quick pick from registry */}
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
                {quickPickSkills.length === 0 && !skillsLoading && (
                  <span className="text-[10px] text-muted-foreground">No matching skills</span>
                )}
                {quickPickSkills.map((s) => (
                  <Badge
                    key={s.name}
                    variant="outline"
                    className="text-[10px] cursor-pointer hover:bg-violet-500/10 hover:border-violet-500/40"
                    onClick={() => setNewSkillName(s.name)}
                  >
                    {s.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Members table */}
      {members.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-6">
          {t('skillset.member.empty')}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">{t('skillset.member.skillName')}</TableHead>
              <TableHead className="text-xs">{t('skillset.member.version')}</TableHead>
              <TableHead className="text-xs">{t('skillset.member.label')}</TableHead>
              <TableHead className="text-xs">{t('skillset.member.required')}</TableHead>
              <TableHead className="text-xs">{t('skillset.member.order')}</TableHead>
              <TableHead className="text-xs w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m, i) => (
              <TableRow key={`${m.skillName}-${i}`}>
                <TableCell className="font-medium text-xs">{m.skillName}</TableCell>
                <TableCell className="text-xs font-mono">{m.version || '-'}</TableCell>
                <TableCell className="text-xs">{m.label || '-'}</TableCell>
                <TableCell>
                  <Switch
                    checked={!!m.required}
                    onCheckedChange={(checked) => handleUpdateMember(m.skillName, { required: checked })}
                  />
                </TableCell>
                <TableCell className="text-xs">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => handleUpdateMember(m.skillName, { order: (m.order || 0) - 1 })}
                    >
                      <ArrowUp className="h-2.5 w-2.5" />
                    </Button>
                    <span className="tabular-nums">{m.order || 0}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => handleUpdateMember(m.skillName, { order: (m.order || 0) + 1 })}
                    >
                      <ArrowDown className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 text-destructive"
                    onClick={() => setDeleteConfirm(m.skillName)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
