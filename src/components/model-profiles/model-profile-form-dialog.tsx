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
import { useCreateModelProfile, useUpdateModelProfile } from '@/hooks/use-model-profiles';
import { useT } from '@/lib/i18n';
import { toast } from 'sonner';
import type { ModelProfile } from '@/lib/api/types';

interface ModelProfileFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** when set, the dialog edits this profile; otherwise it creates a new one */
  editing?: ModelProfile | null;
  onSaved?: () => void;
}

const PROVIDERS = ['openai', 'vllm', 'vertex', 'custom'];
const API_FORMATS = ['openai_responses', 'openai_chat_completions', 'gemini'];

function emptyForm(): ModelProfile {
  return {
    id: '',
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
    defaultParameters: '',
  };
}

export function ModelProfileFormDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: ModelProfileFormDialogProps) {
  const t = useT();
  const tr = (key: string, fallback: string) => {
    const v = t(key);
    return v === key ? fallback : v;
  };
  const isEdit = Boolean(editing);
  // Form is initialized from the editing prop via a lazy initializer; the
  // parent supplies a key derived from editing.id so switching profiles or
  // reopening remounts the dialog and resets state (no effect-setState).
  const [form, setForm] = useState<ModelProfile>(() =>
    editing ? { ...emptyForm(), ...editing } : emptyForm(),
  );
  const [jsonError, setJsonError] = useState('');
  const createMut = useCreateModelProfile();
  const updateMut = useUpdateModelProfile();
  const isPending = createMut.isPending || updateMut.isPending;

  const set = <K extends keyof ModelProfile>(key: K, value: ModelProfile[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const setLimit = (key: 'maxInputTokens' | 'maxOutputTokens', value: number) =>
    setForm((f) => ({ ...f, limits: { ...f.limits, maxInputTokens: 0, maxOutputTokens: 0, ...f.limits, [key]: value } }));

  const validateDefaultParameters = (raw: string): string => {
    const v = raw.trim();
    if (!v) return '';
    try {
      const parsed = JSON.parse(v);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return tr('model-profiles.form.defaultParametersHint', 'must be a JSON object');
      }
      return '';
    } catch {
      return tr('model-profiles.form.defaultParametersHint', 'must be a JSON object');
    }
  };

  const canSubmit =
    Boolean(
      form.id &&
        form.provider &&
        form.apiFormat &&
        form.endpoint &&
        form.upstreamModel &&
        !isPending,
    ) && !jsonError;

  const handleSubmit = async () => {
    const err = validateDefaultParameters(form.defaultParameters || '');
    if (err) {
      setJsonError(err);
      return;
    }
    try {
      if (isEdit && editing) {
        await updateMut.mutateAsync({ id: editing.id, profile: form });
      } else {
        await createMut.mutateAsync(form);
      }
      toast.success(t('model-profiles.saved'));
      onSaved?.();
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('model-profiles.saveFailed'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('model-profiles.form.editTitle') : t('model-profiles.form.createTitle')}
          </DialogTitle>
          <DialogDescription>{t('model-profiles.hint')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Basic */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('model-profiles.form.basic')}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('model-profiles.form.id')} *</Label>
                <Input
                  value={form.id}
                  onChange={(e) => set('id', e.target.value)}
                  placeholder="openai-prod"
                  disabled={isEdit || isPending}
                  className="font-mono"
                />
                <p className="text-[11px] text-muted-foreground">{t('model-profiles.form.idHint')}</p>
              </div>
              <div className="space-y-1.5">
                <Label>{t('model-profiles.form.displayName')}</Label>
                <Input
                  value={form.displayName || ''}
                  onChange={(e) => set('displayName', e.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t('model-profiles.form.description')}</Label>
              <Textarea
                value={form.description || ''}
                onChange={(e) => set('description', e.target.value)}
                rows={2}
                disabled={isPending}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('model-profiles.form.status')}</Label>
                <Select
                  value={form.status || 'active'}
                  onValueChange={(v) => set('status', v)}
                  disabled={isPending}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t('model-profiles.status.active')}</SelectItem>
                    <SelectItem value="disabled">{t('model-profiles.status.disabled')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Access */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('model-profiles.form.access')}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('model-profiles.form.provider')} *</Label>
                <Select
                  value={form.provider || 'openai'}
                  onValueChange={(v) => set('provider', v)}
                  disabled={isPending}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((p) => (
                      <SelectItem key={p} value={p}>{t(`model-profiles.provider.${p}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('model-profiles.form.apiFormat')} *</Label>
                <Select
                  value={form.apiFormat || 'openai_responses'}
                  onValueChange={(v) => set('apiFormat', v)}
                  disabled={isPending}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {API_FORMATS.map((f) => (
                      <SelectItem key={f} value={f} className="font-mono text-xs">{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t('model-profiles.form.endpoint')} *</Label>
              <Input
                value={form.endpoint || ''}
                onChange={(e) => set('endpoint', e.target.value)}
                placeholder="https://api.openai.com"
                disabled={isPending}
                className="font-mono"
              />
              <p className="text-[11px] text-muted-foreground">{t('model-profiles.form.endpointHint')}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('model-profiles.form.upstreamModel')} *</Label>
                <Input
                  value={form.upstreamModel || ''}
                  onChange={(e) => set('upstreamModel', e.target.value)}
                  placeholder="gpt-4o"
                  disabled={isPending}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('model-profiles.form.upstreamPath')}</Label>
                <Input
                  value={form.upstreamPath || ''}
                  onChange={(e) => set('upstreamPath', e.target.value)}
                  placeholder="/v1/chat/completions"
                  disabled={isPending}
                  className="font-mono"
                />
                <p className="text-[11px] text-muted-foreground">{t('model-profiles.form.upstreamPathHint')}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t('model-profiles.form.secretRef')}</Label>
              <Input
                value={form.secretRef || ''}
                onChange={(e) => set('secretRef', e.target.value)}
                placeholder="env://OPENAI_KEY 或 secret://model/openai-prod"
                disabled={isPending}
                className="font-mono"
              />
              <p className="text-[11px] text-muted-foreground">{t('model-profiles.form.secretRefHint')}</p>
            </div>
          </section>

          {/* Context Configuration */}
          <section className="space-y-3 rounded-lg border bg-muted/20 p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('model-profiles.form.contextConfig')}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('model-profiles.form.maxInputTokens')}</Label>
                <Input
                  type="number"
                  value={form.limits?.maxInputTokens ?? 0}
                  onChange={(e) => setLimit('maxInputTokens', Number(e.target.value) || 0)}
                  disabled={isPending}
                  placeholder="131072"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('model-profiles.form.maxOutputTokens')}</Label>
                <Input
                  type="number"
                  value={form.limits?.maxOutputTokens ?? 0}
                  onChange={(e) => setLimit('maxOutputTokens', Number(e.target.value) || 0)}
                  disabled={isPending}
                  placeholder="8192"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t('model-profiles.form.defaultParameters')}</Label>
              <Textarea
                value={form.defaultParameters || ''}
                onChange={(e) => {
                  set('defaultParameters', e.target.value);
                  setJsonError(validateDefaultParameters(e.target.value));
                }}
                rows={3}
                disabled={isPending}
                placeholder='{"temperature":0.2,"top_p":0.9}'
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">{t('model-profiles.form.defaultParametersHint')}</p>
              {jsonError ? <p className="text-[11px] text-destructive">{jsonError}</p> : null}
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t('model-profiles.form.cancel')}
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={!canSubmit}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEdit ? t('model-profiles.form.save') : t('model-profiles.form.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
