'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSkillSetReplaceMembers } from '@/hooks/use-skillsets';
import { useSkills } from '@/hooks/use-skills';
import { useT } from '@/lib/i18n';
import { toast } from 'sonner';
import type { SkillSet } from '@/lib/api/types';

interface SkillSetMemberListProps {
  group: SkillSet;
  onUpdate: () => void;
}

type DraftMember = {
  skillName: string;
  order: number;
};

function normalizeMembers(group: SkillSet): DraftMember[] {
  return [...(group.members || [])]
    .map((member, index) => ({
      skillName: member.skillName,
      order: member.order ?? index,
    }))
    .sort((a, b) => a.order - b.order || a.skillName.localeCompare(b.skillName))
    .map((member, index) => ({ ...member, order: index }));
}

export function SkillSetMemberList({ group, onUpdate }: SkillSetMemberListProps) {
  const t = useT();
  const [members, setMembers] = useState<DraftMember[]>(() => normalizeMembers(group));
  const [showAdd, setShowAdd] = useState(false);
  const [query, setQuery] = useState('');
  const replaceMutation = useSkillSetReplaceMembers();
  const { data: allSkills = [], isLoading: skillsLoading } = useSkills({ pageNo: 1, pageSize: 200 });

  const persistedMembers = useMemo(() => normalizeMembers(group), [group]);
  const dirty = JSON.stringify(members) !== JSON.stringify(persistedMembers);

  const availableSkills = useMemo(() => {
    const selected = new Set(members.map((member) => member.skillName));
    const keyword = query.trim().toLowerCase();
    return allSkills
      .filter((skill) => !selected.has(skill.name))
      .filter((skill) => {
        if (!keyword) return true;
        return `${skill.name} ${skill.displayName || ''} ${skill.description || ''}`
          .toLowerCase()
          .includes(keyword);
      })
      .slice(0, 30);
  }, [allSkills, members, query]);

  const addSkill = (skillName: string) => {
    if (!skillName || members.some((member) => member.skillName === skillName)) return;
    setMembers((current) => [...current, { skillName, order: current.length }]);
    setQuery('');
  };

  const removeSkill = (skillName: string) => {
    setMembers((current) =>
      current
        .filter((member) => member.skillName !== skillName)
        .map((member, index) => ({ ...member, order: index })),
    );
  };

  const moveSkill = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= members.length) return;
    setMembers((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((member, order) => ({ ...member, order }));
    });
  };

  const saveMembers = async () => {
    try {
      const saved = await replaceMutation.mutateAsync({ skillSetName: group.name, members });
      setMembers(normalizeMembers(saved));
      toast.success(t('skillset.detail.settingsUpdated'));
      onUpdate();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t('skillset.detail.updateFailed'));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">
            {members.length} {t('skillset.detail.skills')}
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            SkillSet 仅保存 Skill 引用和顺序，各 Skill 独立发版。
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowAdd((value) => !value)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> {t('skillset.member.add')}
          </Button>
          <Button
            size="sm"
            onClick={saveMembers}
            disabled={!dirty || replaceMutation.isPending}
            className="bg-gradient-to-r from-violet-600 to-fuchsia-500"
          >
            {replaceMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1" />
            )}
            {t('skillset.detail.saveSettings')}
          </Button>
        </div>
      </div>

      {showAdd && (
        <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('skillsets.searchPlaceholder')}
              className="h-8 pl-8 text-xs"
            />
          </div>
          <div className="max-h-44 overflow-auto rounded-md border bg-background">
            {skillsLoading ? (
              <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Loading skills...
              </div>
            ) : availableSkills.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">No available skills</div>
            ) : (
              availableSkills.map((skill) => (
                <button
                  type="button"
                  key={skill.name}
                  onClick={() => addSkill(skill.name)}
                  className="flex w-full items-start justify-between gap-3 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/60"
                >
                  <div>
                    <div className="text-xs font-medium">{skill.displayName || skill.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{skill.name}</div>
                  </div>
                  <Plus className="mt-1 h-3.5 w-3.5 text-muted-foreground" />
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {members.length === 0 ? (
        <div className="rounded-lg border border-dashed py-8 text-center text-xs text-muted-foreground">
          {t('skillset.member.empty')}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">{t('skillset.member.skillName')}</TableHead>
              <TableHead className="w-24 text-xs">{t('skillset.member.order')}</TableHead>
              <TableHead className="w-28 text-xs" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member, index) => (
              <TableRow key={member.skillName}>
                <TableCell>
                  <div className="text-xs font-medium">{member.skillName}</div>
                  <div className="text-[10px] text-muted-foreground">跟随 Skill 自身当前发布版本</div>
                </TableCell>
                <TableCell className="text-xs tabular-nums">{index + 1}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={index === 0}
                      onClick={() => moveSkill(index, -1)}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={index === members.length - 1}
                      onClick={() => moveSkill(index, 1)}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeSkill(member.skillName)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
