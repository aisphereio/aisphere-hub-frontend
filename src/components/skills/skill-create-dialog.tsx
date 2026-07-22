'use client';

import { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ResourceIdInput } from '@/components/shared';
import { useSkillDraft } from '@/hooks/use-skills';
import { useMe } from '@/hooks/use-auth';
import { useT } from '@/lib/i18n';
import { isValidResourceId } from '@/lib/utils';
import { toast } from 'sonner';
import type { SkillDraft } from '@/lib/api/types';

interface SkillCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (name: string) => void;
}

export function SkillCreateDialog({ open, onOpenChange, onCreated }: SkillCreateDialogProps) {
  const t = useT();
  const { data: principal } = useMe();
  const principalRecord = (principal || {}) as Record<string, unknown>;
  const orgId =
    (principalRecord.orgId as string | undefined) ||
    (principalRecord.org_id as string | undefined) ||
    (principalRecord.organization as string | undefined) ||
    '';
  const [form, setForm] = useState<SkillDraft>({
    name: '',
    description: '',
    visibility: 'private',
  });
  const draftMutation = useSkillDraft();

  const canSubmit = Boolean(orgId && form.name && isValidResourceId(form.name) && !draftMutation.isPending);

  const handleCreate = async () => {
    if (!form.name) {
      toast.error(t('id.required'));
      return;
    }
    if (!isValidResourceId(form.name)) {
      toast.error(t('id.invalid'));
      return;
    }
    if (!orgId) {
      toast.error(t('create.organizationRequired') || 'Your account is not assigned to an organization');
      return;
    }
    try {
      const data: SkillDraft = {
        ...form,
        orgId,
        visibility: form.visibility || 'private',
      };
      await draftMutation.mutateAsync(data);
      toast.success(t('create.created', { name: form.name }));
      onCreated?.(form.name);
      setForm({ name: '', description: '', visibility: 'private' });
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('create.createFailed'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('create.title')}</DialogTitle>
          <DialogDescription>{t('create.desc')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <ResourceIdInput
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            label={t('id.label')}
            placeholder={t('create.namePlaceholder')}
            disabled={draftMutation.isPending}
            required
          />
          <div className="space-y-1.5">
            <Label>{t('create.description')}</Label>
            <Textarea
              value={form.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t('create.descriptionPlaceholder')}
              rows={3}
              disabled={draftMutation.isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('create.scope')}</Label>
            <Select
              value={form.visibility || 'private'}
              onValueChange={(value) => setForm({ ...form, visibility: value as SkillDraft['visibility'] })}
              disabled={draftMutation.isPending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">
                  <div><div>{t('accessMode.public')}</div><div className="text-xs text-muted-foreground">{t('accessMode.publicDesc')}</div></div>
                </SelectItem>
                <SelectItem value="internal">
                  <div><div>{t('accessMode.internal')}</div><div className="text-xs text-muted-foreground">{t('accessMode.internalDesc')}</div></div>
                </SelectItem>
                <SelectItem value="private">
                  <div><div>{t('accessMode.private')}</div><div className="text-xs text-muted-foreground">{t('accessMode.privateDesc')}</div></div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={draftMutation.isPending}>{t('create.cancel')}</Button>
          <Button
            onClick={handleCreate}
            disabled={!canSubmit}
            className="bg-gradient-to-r from-violet-600 to-fuchsia-500"
          >
            {draftMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            {t('create.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
