'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
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
  useCreateModelProfile,
  useUpdateModelProfile,
} from '@/hooks/use-model-profiles';
import { useModelProfileT } from './i18n';
import { toast } from 'sonner';
import type { ModelProfile } from '@/lib/api/types';

interface ModelProfileFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: ModelProfile | null;
  onSaved?: () => void;
}

const PROVIDERS = ['openai', 'vllm', 'vertex', 'custom'];
const API_FORMATS = [
  'openai_responses',
  'openai_chat_completions',
  'gemini',
];

function emptyForm(): ModelProfile {
  return {
    id: '',
    version: 'v1',
    displayName: '',
    description: '',
    status: 'active',
    provider: 'openai',
    apiFormat: 'openai_responses',
    endpoint: '',
    upstreamModel: '',
    upstreamPath: '',
    secretRef: '',
    limits: { maxInputTokens: 0, maxOutputTokens: 0 },
  };
}

export function ModelProfileFormDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: ModelProfileFormDialogProps) {
  const t = useModelProfileT();
  const isEdit = Boolean(editing);
  const [form, setForm] = useState<ModelProfile>(() =>
    editing ? { ...emptyForm(), ...editing } : emptyForm(),
  );
  const createMut = useCreateModelProfile();
  const updateMut = useUpdateModelProfile();
  const isPending = createMut.isPending || updateMut.isPending;

  const set = <K extends keyof ModelProfile>(
    key: K,
    value: ModelProfile[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const setLimit = (
    key: 'maxInputTokens' | 'maxOutputTokens',
    value: number,
  ) =>
    setForm((current) => ({
      ...current,
      limits: {
        ...(current.limits ?? {}),
        [key]: value,
      },
    }));

  const canSubmit = Boolean(
    form.id.trim() &&
      form.provider &&
      form.apiFormat &&
      form.endpoint?.trim() &&
      form.upstreamModel?.trim() &&
      !isPending,
  );

  const handleSubmit = async () => {
    try {
      const normalized: ModelProfile = {
        ...form,
        id: form.id.trim(),
        displayName: form.displayName?.trim(),
        description: form.description?.trim(),
        endpoint: form.endpoint?.trim(),
        upstreamModel: form.upstreamModel?.trim(),
        upstreamPath: form.upstreamPath?.trim(),
        secretRef: form.secretRef?.trim(),
      };

      if (isEdit && editing) {
        await updateMut.mutateAsync({
          id: editing.id,
          profile: normalized,
        });
      } else {
        await createMut.mutateAsync(normalized);
      }

      toast.success(t('saved'));
      onSaved?.();
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t('saveFailed'));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => !isPending && onOpenChange(nextOpen)}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('form.editTitle') : t('form.createTitle')}
          </DialogTitle>
          <DialogDescription>{t('hint')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('form.basic')}
            </h4>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t('form.id')} *</Label>
                <Input
                  value={form.id}
                  onChange={(event) => set('id', event.target.value)}
                  placeholder="openai-prod"
                  disabled={isEdit || isPending}
                  className="font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  {t('form.idHint')}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>{t('form.displayName')}</Label>
                <Input
                  value={form.displayName || ''}
                  onChange={(event) =>
                    set('displayName', event.target.value)
                  }
                  disabled={isPending}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t('form.description')}</Label>
              <Textarea
                value={form.description || ''}
                onChange={(event) => set('description', event.target.value)}
                rows={2}
                disabled={isPending}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t('form.status')}</Label>
                <Select
                  value={form.status || 'active'}
                  onValueChange={(value) => set('status', value)}
                  disabled={isPending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">
                      {t('status.active')}
                    </SelectItem>
                    <SelectItem value="disabled">
                      {t('status.disabled')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('form.access')}
            </h4>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t('form.provider')} *</Label>
                <Select
                  value={form.provider || 'openai'}
                  onValueChange={(value) => set('provider', value)}
                  disabled={isPending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((provider) => (
                      <SelectItem key={provider} value={provider}>
                        {t(`provider.${provider}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>{t('form.apiFormat')} *</Label>
                <Select
                  value={form.apiFormat || 'openai_responses'}
                  onValueChange={(value) => set('apiFormat', value)}
                  disabled={isPending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {API_FORMATS.map((format) => (
                      <SelectItem
                        key={format}
                        value={format}
                        className="font-mono text-xs"
                      >
                        {format}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t('form.endpoint')} *</Label>
              <Input
                value={form.endpoint || ''}
                onChange={(event) => set('endpoint', event.target.value)}
                placeholder="https://api.openai.com"
                disabled={isPending}
                className="font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                {t('form.endpointHint')}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t('form.upstreamModel')} *</Label>
                <Input
                  value={form.upstreamModel || ''}
                  onChange={(event) =>
                    set('upstreamModel', event.target.value)
                  }
                  placeholder="gpt-4o"
                  disabled={isPending}
                  className="font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t('form.upstreamPath')}</Label>
                <Input
                  value={form.upstreamPath || ''}
                  onChange={(event) =>
                    set('upstreamPath', event.target.value)
                  }
                  placeholder="/v1/responses"
                  disabled={isPending}
                  className="font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  {t('form.upstreamPathHint')}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t('form.secretRef')}</Label>
              <Input
                value={form.secretRef || ''}
                onChange={(event) => set('secretRef', event.target.value)}
                placeholder="env://OPENAI_KEY or secret://model/openai-prod"
                disabled={isPending}
                className="font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                {t('form.secretRefHint')}
              </p>
            </div>
          </section>

          <section className="space-y-3 rounded-lg border bg-muted/20 p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('form.contextConfig')}
            </h4>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t('form.maxInputTokens')}</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.limits?.maxInputTokens ?? 0}
                  onChange={(event) =>
                    setLimit(
                      'maxInputTokens',
                      Number(event.target.value) || 0,
                    )
                  }
                  disabled={isPending}
                  placeholder="131072"
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t('form.maxOutputTokens')}</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.limits?.maxOutputTokens ?? 0}
                  onChange={(event) =>
                    setLimit(
                      'maxOutputTokens',
                      Number(event.target.value) || 0,
                    )
                  }
                  disabled={isPending}
                  placeholder="8192"
                />
              </div>
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {t('form.cancel')}
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {isEdit ? t('form.save') : t('form.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
