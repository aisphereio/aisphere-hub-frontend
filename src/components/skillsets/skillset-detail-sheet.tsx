'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { InfoItem, ConfirmDialog } from '@/components/shared';
import { SkillSetMemberList } from './skillset-member-list';
import { useSkillSetDetail, useSkillSetUpdate, useSkillSetDelete } from '@/hooks/use-skillsets';
import { useT } from '@/lib/i18n';
import { toast } from 'sonner';
import type { SkillSetDetailTab } from '@/lib/api/types';

interface SkillSetDetailSheetProps {
  skillSetName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SkillSetDetailSheet({ skillSetName, open, onOpenChange }: SkillSetDetailSheetProps) {
  const t = useT();
  const [detailTab, setDetailTab] = useState<SkillSetDetailTab>('overview');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const { data: detail, isLoading, refetch } = useSkillSetDetail(skillSetName);
  const updateMutation = useSkillSetUpdate();
  const deleteMutation = useSkillSetDelete();

  useEffect(() => {
    if (!detail) return;
    setEditDisplayName(detail.displayName || '');
    setEditDescription(detail.description || '');
  }, [detail]);

  const saveSettings = async () => {
    if (!detail) return;
    try {
      await updateMutation.mutateAsync({
        skillSetName: detail.name,
        data: {
          displayName: editDisplayName,
          description: editDescription,
        },
      });
      toast.success(t('skillset.detail.settingsUpdated'));
      refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('skillset.detail.updateFailed'));
    }
  };

  const handleDelete = async () => {
    if (!detail) return;
    try {
      await deleteMutation.mutateAsync(detail.name);
      toast.success(t('skillset.detail.deleted'));
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('skillset.detail.deleteFailed'));
    }
    setDeleteConfirmOpen(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
          <SheetHeader className="p-4 pb-0">
            <SheetTitle className="flex items-center gap-3">
              {detail ? (
                <>
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-fuchsia-500/10 to-violet-500/10 flex items-center justify-center text-sm font-bold text-fuchsia-600 dark:text-fuchsia-400">
                    {(detail.displayName || detail.name).slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div>{detail.displayName || detail.name}</div>
                    <div className="text-xs font-normal text-muted-foreground flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{detail.scope || 'private'}</Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {detail.members?.length || 0} {t('skillset.detail.skills')}
                      </Badge>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t('skillset.detail.loading')}
                </div>
              )}
            </SheetTitle>
          </SheetHeader>

          {detail && !isLoading && (
            <div className="flex flex-col h-[calc(100%-80px)]">
              <Tabs value={detailTab} onValueChange={(value) => setDetailTab(value as SkillSetDetailTab)} className="flex flex-col flex-1">
                <div className="px-4 border-b">
                  <TabsList className="h-9 bg-transparent p-0 gap-1">
                    <TabsTrigger value="overview" className="text-xs h-8 px-3 data-[state=active]:bg-violet-600/10 data-[state=active]:text-violet-600">
                      {t('skillset.tabOverview')}
                    </TabsTrigger>
                    <TabsTrigger value="members" className="text-xs h-8 px-3 data-[state=active]:bg-violet-600/10 data-[state=active]:text-violet-600">
                      {t('skillset.tabMembers')}
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="text-xs h-8 px-3 data-[state=active]:bg-violet-600/10 data-[state=active]:text-violet-600">
                      {t('skillset.tabSettings')}
                    </TabsTrigger>
                  </TabsList>
                </div>

                <ScrollArea className="flex-1">
                  <TabsContent value="overview" className="p-4 space-y-4 mt-0">
                    <div className="grid grid-cols-2 gap-3">
                      <InfoItem label={t('skillset.detail.name')} value={detail.name} mono />
                      <InfoItem label={t('skillset.detail.displayName')} value={detail.displayName || '-'} />
                      <InfoItem label={t('skillset.detail.owner')} value={detail.owner || '-'} />
                      <InfoItem label={t('skillset.detail.members')} value={String(detail.members?.length || 0)} />
                    </div>
                    {detail.description && (
                      <div className="rounded-lg bg-muted/50 p-3">
                        <div className="text-[10px] text-muted-foreground">{t('skillset.detail.description')}</div>
                        <div className="text-sm mt-0.5">{detail.description}</div>
                      </div>
                    )}
                    <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                      SkillSet 是轻量集合，只记录 Skill 引用和展示顺序。Skill 仍独立发版、独立授权、独立运行。
                    </div>
                  </TabsContent>

                  <TabsContent value="members" className="p-4 mt-0">
                    <SkillSetMemberList group={detail} onUpdate={() => refetch()} />
                  </TabsContent>

                  <TabsContent value="settings" className="p-4 space-y-4 mt-0">
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label>{t('skillset.detail.displayName')}</Label>
                        <Input value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} className="text-xs" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>{t('skillset.detail.description')}</Label>
                        <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} className="text-xs" />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={saveSettings} className="bg-gradient-to-r from-violet-600 to-fuchsia-500" disabled={updateMutation.isPending}>
                          {t('skillset.detail.saveSettings')}
                        </Button>
                        <Button variant="destructive" onClick={() => setDeleteConfirmOpen(true)}>
                          {t('skillset.detail.deleteSkillSet')}
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={t('skillset.detail.deleteTitle')}
        description={t('skillset.detail.deleteDesc', { name: detail?.name || '' })}
        confirmLabel={t('common.delete')}
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}
