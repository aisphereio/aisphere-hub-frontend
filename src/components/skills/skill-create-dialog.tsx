'use client';

import { useState } from 'react';
import { FileArchive, Loader2, Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { ResourceIdInput } from '@/components/shared';
import { useSkillArchiveImport, useSkillDraft } from '@/hooks/use-skills';
import { useMe } from '@/hooks/use-auth';
import { useT } from '@/lib/i18n';
import { isValidResourceId } from '@/lib/utils';
import {
  buildSkillArchive,
  bytesToBase64,
  inspectSkillArchive,
  type SkillArchivePreview,
} from '@/lib/skill-archive';
import { toast } from 'sonner';
import type { SkillDraft } from '@/lib/api/types';

interface SkillCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (name: string) => void;
}

const emptyForm = (): SkillDraft => ({
  name: '',
  displayName: '',
  description: '',
  visibility: 'private',
});

export function SkillCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: SkillCreateDialogProps) {
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

  const [form, setForm] = useState<SkillDraft>(emptyForm);
  const [mode, setMode] = useState<'manual' | 'zip'>('manual');
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [archivePreview, setArchivePreview] =
    useState<SkillArchivePreview | null>(null);
  const [archiveError, setArchiveError] = useState('');
  const [isInspecting, setIsInspecting] = useState(false);
  const draftMutation = useSkillDraft();
  const archiveMutation = useSkillArchiveImport();
  const isPending =
    draftMutation.isPending || archiveMutation.isPending || isInspecting;

  const canSubmit =
    mode === 'manual'
      ? Boolean(
          orgId &&
            form.name &&
            isValidResourceId(form.name) &&
            !isPending,
        )
      : Boolean(
          orgId &&
            archivePreview &&
            form.name &&
            isValidResourceId(form.name) &&
            form.description?.trim() &&
            !isPending,
        );

  const reset = () => {
    setForm(emptyForm());
    setMode('manual');
    setZipFile(null);
    setArchivePreview(null);
    setArchiveError('');
    setIsInspecting(false);
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !isPending) {
      reset();
    }
    onOpenChange(nextOpen);
  };

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
      toast.error(
        t('create.organizationRequired') ||
          'Your account is not assigned to an organization',
      );
      return;
    }
    try {
      const data: SkillDraft = {
        ...form,
        orgId,
        visibility: form.visibility || 'private',
      };
      const created = await draftMutation.mutateAsync(data);
      toast.success(t('create.created', { name: created.name }));
      onCreated?.(created.name);
      reset();
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : t('create.createFailed'),
      );
    }
  };

  const handleZipSelected = async (file: File | null) => {
    setZipFile(file);
    setArchivePreview(null);
    setArchiveError('');
    if (!file) {
      return;
    }
    if (!file.name.toLowerCase().endsWith('.zip')) {
      const message = tr(
        'create.archiveInvalidType',
        'Only .zip archives are supported',
      );
      setArchiveError(message);
      toast.error(message);
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      const message = tr(
        'create.archiveTooLarge',
        'The ZIP archive cannot exceed 50 MB',
      );
      setArchiveError(message);
      toast.error(message);
      return;
    }

    setIsInspecting(true);
    try {
      const preview = await inspectSkillArchive(await file.arrayBuffer());
      setArchivePreview(preview);
      setForm((current) => ({
        ...current,
        name: preview.name,
        displayName: preview.displayName,
        description: preview.description,
      }));
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : tr('create.archiveInvalid', 'Invalid Skill ZIP archive');
      setArchiveError(message);
      toast.error(message);
    } finally {
      setIsInspecting(false);
    }
  };

  const handleImportArchive = async () => {
    if (!zipFile || !archivePreview) {
      toast.error(tr('create.archiveRequired', 'Select a valid ZIP archive'));
      return;
    }
    if (!form.name || !isValidResourceId(form.name)) {
      toast.error(t('id.invalid'));
      return;
    }
    if (!form.description?.trim()) {
      toast.error(
        tr('create.descriptionRequired', 'Skill description is required'),
      );
      return;
    }
    if (!orgId) {
      toast.error(
        t('create.organizationRequired') ||
          'Your account is not assigned to an organization',
      );
      return;
    }

    try {
      const archive = await buildSkillArchive(archivePreview, {
        name: form.name,
        displayName: form.displayName || form.name,
        description: form.description,
      });
      const created = await archiveMutation.mutateAsync({
        archiveZip: bytesToBase64(archive),
        orgId,
        projectId: form.projectId,
        visibility: form.visibility || 'private',
      });
      toast.success(t('create.created', { name: created.name }));
      onCreated?.(created.name);
      reset();
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : t('create.createFailed'),
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('create.title')}</DialogTitle>
          <DialogDescription>{t('create.desc')}</DialogDescription>
        </DialogHeader>
        <Tabs
          value={mode}
          onValueChange={(value) => setMode(value as 'manual' | 'zip')}
        >
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
              onChange={(value) => setForm({ ...form, name: value })}
              label={t('id.label')}
              placeholder={t('create.namePlaceholder')}
              disabled={isPending}
              required
            />
            <div className="space-y-1.5">
              <Label>{tr('create.displayName', 'Display Name')}</Label>
              <Input
                value={form.displayName || ''}
                onChange={(event) =>
                  setForm({ ...form, displayName: event.target.value })
                }
                placeholder={tr(
                  'create.displayNamePlaceholder',
                  'Human-readable Skill name',
                )}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('create.description')}</Label>
              <Textarea
                value={form.description || ''}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
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
                onChange={(event) =>
                  void handleZipSelected(event.target.files?.[0] ?? null)
                }
              />
              <p className="text-xs text-muted-foreground">
                {zipFile
                  ? `${zipFile.name} (${formatBytes(zipFile.size)})`
                  : tr(
                      'create.archiveHint',
                      'The ZIP must contain SKILL.md at its root or inside one top-level folder.',
                    )}
              </p>
              {archiveError ? (
                <p className="text-xs text-destructive">{archiveError}</p>
              ) : null}
            </div>

            {isInspecting ? (
              <div className="flex items-center gap-2 rounded-md border p-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {tr('create.archiveInspecting', 'Reading SKILL.md...')}
              </div>
            ) : null}

            {archivePreview ? (
              <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {tr('create.archiveFiles', 'Files')}: {archivePreview.fileCount}
                  </span>
                  <span>
                    {tr('create.archiveUnpackedSize', 'Unpacked')}:{' '}
                    {formatBytes(archivePreview.unpackedSize)}
                  </span>
                </div>
                <ResourceIdInput
                  value={form.name}
                  onChange={(value) => setForm({ ...form, name: value })}
                  label={tr('create.skillName', 'Skill Name')}
                  placeholder={t('create.namePlaceholder')}
                  disabled={isPending}
                  required
                />
                <div className="space-y-1.5">
                  <Label>{tr('create.displayName', 'Display Name')}</Label>
                  <Input
                    value={form.displayName || ''}
                    onChange={(event) =>
                      setForm({ ...form, displayName: event.target.value })
                    }
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>
                    {t('create.description')}{' '}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    value={form.description || ''}
                    onChange={(event) =>
                      setForm({ ...form, description: event.target.value })
                    }
                    placeholder={t('create.descriptionPlaceholder')}
                    rows={3}
                    disabled={isPending}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {tr(
                    'create.archiveMetadataHint',
                    'Your edits will be written back to SKILL.md before the archive is imported.',
                  )}
                </p>
              </div>
            ) : null}
          </TabsContent>

          <div className="space-y-1.5 pt-2">
            <Label>{t('create.scope')}</Label>
            <Select
              value={form.visibility || 'private'}
              onValueChange={(value) =>
                setForm({
                  ...form,
                  visibility: value as SkillDraft['visibility'],
                })
              }
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">
                  <div>
                    <div>{t('accessMode.public')}</div>
                    <div className="text-xs text-muted-foreground">
                      {t('accessMode.publicDesc')}
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="internal">
                  <div>
                    <div>{t('accessMode.internal')}</div>
                    <div className="text-xs text-muted-foreground">
                      {t('accessMode.internalDesc')}
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="private">
                  <div>
                    <div>{t('accessMode.private')}</div>
                    <div className="text-xs text-muted-foreground">
                      {t('accessMode.privateDesc')}
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Tabs>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleDialogOpenChange(false)}
            disabled={isPending}
          >
            {t('create.cancel')}
          </Button>
          <Button
            onClick={() => void handleCreate()}
            disabled={!canSubmit}
            className="bg-gradient-to-r from-violet-600 to-fuchsia-500"
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : mode === 'zip' ? (
              <Upload className="mr-2 h-4 w-4" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            {mode === 'zip'
              ? tr('create.importArchive', 'Create from ZIP')
              : t('create.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
