'use client';

import { useState, useCallback, useMemo, useDeferredValue } from 'react';
import { Cpu, Globe, Download, AlertTriangle, Package, Layers, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard, CardGridSkeleton, EmptyState, ConfirmDialog } from '@/components/shared';
import {
  SkillCard, SkillCardCompact, SkillCreateDialog, SkillShareDialog, SkillFilters,
  type SkillViewMode,
} from '@/components/skills';
import { useOpenSkillEditor } from '@/components/layout/app-shell';
import { useSkills, useSkillDelete } from '@/hooks/use-skills';
import { useT } from '@/lib/i18n';
import { toast } from 'sonner';
import type { Skill } from '@/lib/api/types';

export function SkillsPage() {
  const t = useT();
  const openSkillEditor = useOpenSkillEditor();

  const [search, setSearch] = useState('');
  const [skillSetName, setSkillSetName] = useState('');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [viewMode, setViewMode] = useState<SkillViewMode>('grid');
  const [createOpen, setCreateOpen] = useState(false);
  const [shareSkill, setShareSkill] = useState<Skill | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ action: string; skill: Skill } | null>(null);

  // Debounce search so we don't hit the backend on every keystroke.
  const deferredSearch = useDeferredValue(search);

  const { data: items = [], isLoading, error, refetch } = useSkills({
    search: deferredSearch || undefined,
    skillName: deferredSearch || undefined,
    skillsetName: skillSetName || undefined,
    pageNo: 1,
    pageSize: 80,
  });

  const deleteMutation = useSkillDelete();

  // Filter items client-side for scope (visibility).
  // Status filtering (online/offline/draft/published) was removed — the
  // Git-native backend no longer populates these fields.
  const filteredItems = useMemo(() => items.filter((s) => {
    if (scopeFilter !== 'all') {
      if ((s.visibility || s.scope || 'private').toLowerCase() !== scopeFilter) return false;
    }
    return true;
  }), [items, scopeFilter]);

  const skillSetSkills = useMemo(() => {
    const skillsets = new Map<string, Skill[]>();
    const withoutSkillSet: Skill[] = [];

    filteredItems.forEach((skill) => {
      const names = Array.isArray(skill.groups) ? skill.groups : [];
      if (names.length === 0) {
        withoutSkillSet.push(skill);
        return;
      }

      names.forEach((name) => {
        const list = skillsets.get(name) || [];
        list.push(skill);
        skillsets.set(name, list);
      });
    });

    return {
      skillsets: Array.from(skillsets.entries()).sort(([a], [b]) => a.localeCompare(b)),
      withoutSkillSet,
    };
  }, [filteredItems]);

  const handleAction = (action: string, skill: Skill) => {
    if (action === 'share') {
      setShareSkill(skill);
      return;
    }
    if (action === 'delete') {
      setConfirmAction({ action, skill });
    }
  };

  const executeAction = async (action: string, skill: Skill) => {
    try {
      if (action === 'delete') {
        await deleteMutation.mutateAsync(skill.name);
        toast.success(`${skill.name} ${t('skills.deleted')}`);
      }
      refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('skills.actionFailed'));
    }
    setConfirmAction(null);
  };

  const openEditor = useCallback((skill: Skill) => {
    openSkillEditor(skill.name);
  }, [openSkillEditor]);

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="p-4 md:p-6 space-y-5 max-w-[1600px] mx-auto">
        {/* Hero Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={<Cpu className="h-4 w-4" />}
            label={t('skills.total')}
            value={items.length}
            trend={undefined}
            accent="violet"
          />
          <StatCard
            icon={<Globe className="h-4 w-4" />}
            label={t('skills.public')}
            value={items.filter(s => (s.visibility || s.scope || 'private').toLowerCase() === 'public').length}
            accent="emerald"
          />
          <StatCard
            icon={<Download className="h-4 w-4" />}
            label={t('skills.downloads')}
            value={items.reduce((a, s) => a + (s.downloadCount || 0), 0)}
            accent="sky"
          />
          <StatCard
            icon={<Layers className="h-4 w-4" />}
            label={t('skills.skillsets')}
            value={new Set(items.flatMap(s => Array.isArray(s.groups) ? s.groups : [])).size}
            accent="amber"
          />
        </div>

        {/* Toolbar */}
        <SkillFilters
          search={search}
          onSearchChange={setSearch}
          skillSetName={skillSetName}
          onGroupNameChange={setSkillSetName}
          scopeFilter={scopeFilter}
          onScopeFilterChange={setScopeFilter}
          onRefresh={() => refetch()}
          onCreateClick={() => setCreateOpen(true)}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{error.message}</span>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>{t('common.retry')}</Button>
          </div>
        )}

        {/* Skills Grid view */}
        {viewMode === 'grid' && (
          <>
            {isLoading ? (
              <CardGridSkeleton count={8} />
            ) : filteredItems.length === 0 ? (
              <EmptyState
                icon={<Package className="h-10 w-10" />}
                title={search || scopeFilter !== 'all' ? t('skills.empty.filtered') : t('skills.empty.title')}
                description={
                  search || scopeFilter !== 'all'
                    ? t('skills.empty.filteredDesc')
                    : t('skills.empty.desc')
                }
                action={
                  <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>{t('skills.createDraft')}</Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredItems.map((s) => (
                  <SkillCard
                    key={s.name}
                    skill={s}
                    onClick={() => openEditor(s)}
                    onAction={handleAction}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Skills Grouped view */}
        {viewMode === 'skillset' && (
          <>
            {isLoading ? (
              <CardGridSkeleton count={6} />
            ) : filteredItems.length === 0 ? (
              <EmptyState
                icon={<Package className="h-10 w-10" />}
                title={search || scopeFilter !== 'all' ? t('skills.empty.filtered') : t('skills.empty.title')}
                description={
                  search || scopeFilter !== 'all'
                    ? t('skills.empty.filteredDesc')
                    : t('skills.empty.desc')
                }
                action={
                  <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>{t('skills.createDraft')}</Button>
                }
              />
            ) : (
              <div className="space-y-6">
                {skillSetSkills.skillsets.length === 0 && skillSetSkills.withoutSkillSet.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">{t('skills.empty.filtered')}</p>
                )}

                {/* SkillSet skills */}
                {skillSetSkills.skillsets.map(([skillSetName, skills]) => (
                  <div key={skillSetName} className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                      <div className="flex items-center justify-center w-7 h-7 rounded-md bg-gradient-to-br from-violet-500/15 to-fuchsia-500/15 text-violet-600 dark:text-violet-300 shrink-0">
                        <FolderOpen className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm truncate">{skillSetName}</h3>
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                            {skills.length} {t('skills.skillsInSkillSet')}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 pl-1">
                      {skills.map((s) => (
                        <SkillCardCompact
                          key={`${skillSetName}-${s.name}`}
                          skill={s}
                          onClick={() => openEditor(s)}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {/* Ungrouped */}
                {skillSetSkills.withoutSkillSet.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                      <div className="flex items-center justify-center w-7 h-7 rounded-md bg-muted text-muted-foreground shrink-0">
                        <Layers className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm">{t('skills.withoutSkillSet')}</h3>
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                            {skillSetSkills.withoutSkillSet.length} {t('skills.skillsInSkillSet')}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 pl-1">
                      {skillSetSkills.withoutSkillSet.map((s) => (
                        <SkillCardCompact
                          key={`withoutSkillSet-${s.name}`}
                          skill={s}
                          onClick={() => openEditor(s)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Create Dialog */}
        <SkillCreateDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={(name) => {
            refetch();
            openSkillEditor(name);
          }}
        />

        {/* Share Dialog */}
        <SkillShareDialog
          skill={shareSkill}
          open={Boolean(shareSkill)}
          onOpenChange={(open) => { if (!open) setShareSkill(null); }}
          onChanged={() => refetch()}
        />

        {/* Confirm Dialog — delete only (online/offline was removed in the Git-native refactor) */}
        <ConfirmDialog
          open={Boolean(confirmAction)}
          onOpenChange={(open) => { if (!open) setConfirmAction(null); }}
          title={t('editor.deleteTitle')}
          description={confirmAction ? t('editor.deleteDesc', { name: confirmAction.skill.name }) : ''}
          confirmLabel={t('common.delete')}
          variant="destructive"
          onConfirm={() => confirmAction && executeAction(confirmAction.action, confirmAction.skill)}
        />
      </div>
    </div>
  );
}
