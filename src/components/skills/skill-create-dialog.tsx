'use client';

import { useState } from 'react';
import { FileArchive, Loader2, Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResourceIdInput } from '@/components/shared';
import { useSkillArchiveImport, useSkillDraft } from '@/hooks/use-skills';
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
  const tr = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };
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
  const [mode, setMode] = useState<'manual' | 'zip'>('manual');
  const [zipFile, setZipFile] = useState<File | null>(null);
  const draftMutation = useSkillDraft();
  const archiveMutation = useSkillArchiveImport();
  const isPending = draftMutation.isPending || archiveMutation.isPending;

  const canSubmit = mode === 'manual'
    ? Boolean(orgId && form.name && isValidResourceId(form.name) && !isPending)
    : Boolean(orgId && zipFile && !isPending);

  const handleCreate = async () => {
    if (mode === 'zip') {
      await handleImportArchive();
      return;
    }
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

  const handleImportArchive = async () => {
    if (!zipFile) {
      toast.error(tr('create.archiveRequired', 'Select a ZIP archive'));
      return;
    }
    if (!zipFile.name.toLowerCase().endsWith('.zip')) {
      toast.error(tr('create.archiveInvalidType', 'Only .zip archives are supported'));
      return;
    }
    if (!orgId) {
      toast.error(t('create.organizationRequired') || 'Your account is not assigned to an organization');
      return;
    }
    try {
      const created = await archiveMutation.mutateAsync({
        archiveZip: await fileToBase64(zipFile),
        orgId,
        visibility: form.visibility || 'private',
      });
      toast.success(t('create.created', { name: created.name }));
      onCreated?.(created.name);
      setForm({ name: '', description: '', visibility: 'private' });
      setZipFile(null);
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
        <Tabs value={mode} onValueChange={(value) => setMode(value as 'manual' | 'zip')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">
              <Plus className="h-3.5 w-3.5" />
              {tr('create.manual', 'Manual')}
            </TabsTrigger>
            <TabsTrigger value="zip">
              <FileArchive className="h-3.5 w-3.5" />
              {tr('skills.uploadZip', 'Upload ZIP')}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="manual" className="space-y-4">
            <ResourceIdInput
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              label={t('id.label')}
              placeholder={t('create.namePlaceholder')}
              disabled={isPending}
              required
            />
            <div className="space-y-1.5">
              <Label>{t('create.description')}</Label>
              <Textarea
                value={form.description || ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t('create.descriptionPlaceholder')}
                rows={3}
                disabled={isPending}
              />
            </div>
          </TabsContent>
          <TabsContent value="zip" className="space-y-4">
            <div className="space-y-1.5">
              <Label>{tr('create.archiveZip', 'Skill ZIP')}</Label>
              <Input
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                disabled={isPending}
                onChange={(event) => setZipFile(event.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                {zipFile
                  ? `${zipFile.name} (${formatBytes(zipFile.size)})`
                  : tr('create.archiveHint', 'The ZIP root must contain SKILL.md with name and description.')}
              </p>
            </div>
          </TabsContent>
          <div className="space-y-1.5">
            <Label>{t('create.scope')}</Label>
            <Select
              value={form.visibility || 'private'}
              onValueChange={(value) => setForm({ ...form, visibility: value as SkillDraft['visibility'] })}
              disabled={isPending}
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
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>{t('create.cancel')}</Button>
          <Button
            onClick={handleCreate}
            disabled={!canSubmit}
            className="bg-gradient-to-r from-violet-600 to-fuchsia-500"
          >
            {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : mode === 'zip' ? <Upload className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            {mode === 'zip' ? tr('create.importArchive', 'Import ZIP') : t('create.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
