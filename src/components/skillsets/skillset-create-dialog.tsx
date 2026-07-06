'use client';

import { useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ResourceIdInput } from '@/components/shared';
import { useSkillSetSave } from '@/hooks/use-skillsets';
import { useT } from '@/lib/i18n';
import { isValidResourceId } from '@/lib/utils';
import { toast } from 'sonner';
import type { SkillSet } from '@/lib/api/types';

interface SkillSetCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editGroup?: SkillSet | null;
}

export function SkillSetCreateDialog({ open, onOpenChange, editGroup }: SkillSetCreateDialogProps) {
  const t = useT();
  const [name, setName] = useState(editGroup?.name || '');
  const [displayName, setDisplayName] = useState(editGroup?.displayName || '');
  const [description, setDescription] = useState(editGroup?.description || '');

  const saveMutation = useSkillSetSave();

  const handleSave = async () => {
    if (!name) {
      toast.error(t('skillset.nameRequired'));
      return;
    }
    if (!isValidResourceId(name)) {
      toast.error(t('id.invalid'));
      return;
    }
    try {
      await saveMutation.mutateAsync({
        name,
        displayName: displayName || undefined,
        description: description || undefined,
        // Note: scope is intentionally omitted 鈥?access mode is now
        // managed by the ResourceSharePanel via IAM ResourceGrants.
        members: editGroup?.members,
      });
      toast.success(editGroup ? t('skillset.updated') : t('skillset.created'));
      setName('');
      setDisplayName('');
      setDescription('');
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : (editGroup ? t('skillset.updateFailed') : t('skillset.createFailed')));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editGroup ? t('skillset.edit.title') : t('skillset.create.title')}</DialogTitle>
          <DialogDescription>
            {editGroup ? t('skillset.edit.desc') : t('skillset.create.desc')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <ResourceIdInput
            value={name}
            onChange={setName}
            label={t('skillset.name')}
            placeholder={t('skillset.namePlaceholder')}
            disabled={saveMutation.isPending || !!editGroup}
            required
          />
          <div className="space-y-1.5">
            <Label>{t('skillset.displayName')}</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('skillset.displayNamePlaceholder')}
              disabled={saveMutation.isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('skillset.description')}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('skillset.descriptionPlaceholder')}
              rows={3}
              disabled={saveMutation.isPending}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saveMutation.isPending}>{t('skillset.cancel')}</Button>
          <Button
            onClick={handleSave}
            disabled={!name || !isValidResourceId(name) || saveMutation.isPending}
            className="bg-gradient-to-r from-violet-600 to-fuchsia-500"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {editGroup ? t('skillset.update') : t('skillset.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
