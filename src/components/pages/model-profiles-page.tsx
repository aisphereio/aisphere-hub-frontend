'use client';

import { useMemo, useState } from 'react';
import { useDeferredValue } from 'react';
import { AlertTriangle, Boxes, Cpu, Layers, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  StatCard,
  CardGridSkeleton,
  EmptyState,
  ConfirmDialog,
} from '@/components/shared';
import {
  ModelProfileCard,
  ModelProfileFormDialog,
} from '@/components/model-profiles';
import {
  useModelProfiles,
  useDeleteModelProfile,
  useTestModelProfile,
} from '@/hooks/use-model-profiles';
import { useT } from '@/lib/i18n';
import { toast } from 'sonner';
import type { ModelProfile } from '@/lib/api/types';
import type { V1TestModelProfileResponse } from '@/lib/api/generated/model';

const PROVIDERS = ['openai', 'vllm', 'vertex', 'custom'];

export function ModelProfilesPage() {
  const t = useT();
  const tr = (key: string, fallback: string) => {
    const v = t(key);
    return v === key ? fallback : v;
  };

  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ModelProfile | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ModelProfile | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, V1TestModelProfileResponse>>({});

  const deferredSearch = useDeferredValue(search);
  const { data: items = [], isLoading, error, refetch } = useModelProfiles({
    query: deferredSearch || undefined,
    provider: providerFilter !== 'all' ? providerFilter : undefined,
    pageSize: 100,
  });
  const deleteMut = useDeleteModelProfile();
  const testMut = useTestModelProfile();

  const stats = useMemo(() => {
    const active = items.filter((p) => (p.status || 'active') === 'active').length;
    const providers = new Set(items.map((p) => p.provider).filter(Boolean)).size;
    const ctxs = items.map((p) => p.limits?.maxInputTokens ?? 0).filter((n) => n > 0);
    const avgCtx = ctxs.length ? Math.round(ctxs.reduce((a, b) => a + b, 0) / ctxs.length) : 0;
    return { total: items.length, active, providers, avgCtx };
  }, [items]);

  const handleTest = async (profile: ModelProfile) => {
    setTestingId(profile.id);
    try {
      const res = await testMut.mutateAsync({ id: profile.id });
      setTestResults((prev) => ({ ...prev, [profile.id]: res }));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('model-profiles.testFail'));
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteMut.mutateAsync(confirmDelete.id);
      toast.success(t('model-profiles.deleted'));
      refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('model-profiles.delete'));
    }
    setConfirmDelete(null);
  };

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="p-4 md:p-6 space-y-5 max-w-[1600px] mx-auto">
        {/* Hero Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={<Boxes className="h-4 w-4" />}
            label={t('model-profiles.stats.total')}
            value={stats.total}
            accent="violet"
          />
          <StatCard
            icon={<Cpu className="h-4 w-4" />}
            label={t('model-profiles.stats.active')}
            value={stats.active}
            accent="emerald"
          />
          <StatCard
            icon={<Layers className="h-4 w-4" />}
            label={t('model-profiles.stats.providers')}
            value={stats.providers}
            accent="sky"
          />
          <StatCard
            icon={<Cpu className="h-4 w-4" />}
            label={t('model-profiles.stats.avgContext')}
            value={stats.avgCtx > 0 ? stats.avgCtx.toLocaleString() : 0}
            accent="amber"
          />
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('model-profiles.search')}
            className="max-w-xs"
          />
          <Select value={providerFilter} onValueChange={setProviderFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('model-profiles.filter.allProviders')}</SelectItem>
              {PROVIDERS.map((p) => (
                <SelectItem key={p} value={p}>{t(`model-profiles.provider.${p}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            className="ml-auto bg-gradient-to-r from-violet-600 to-fuchsia-500"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('model-profiles.create')}
          </Button>
        </div>

        {/* Error */}
        {error ? (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{error.message}</span>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>{tr('common.retry', 'Retry')}</Button>
          </div>
        ) : null}

        {/* Grid */}
        {isLoading ? (
          <CardGridSkeleton count={6} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Boxes className="h-10 w-10" />}
            title={
              search || providerFilter !== 'all'
                ? t('model-profiles.empty.filtered')
                : t('model-profiles.empty.title')
            }
            description={
              search || providerFilter !== 'all'
                ? undefined
                : t('model-profiles.empty.desc')
            }
            action={
              <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t('model-profiles.create')}
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {items.map((p) => (
              <ModelProfileCard
                key={p.id}
                profile={p}
                testing={testingId === p.id}
                testResult={testResults[p.id]}
                onTest={() => handleTest(p)}
                onEdit={() => setEditing(p)}
                onDelete={() => setConfirmDelete(p)}
              />
            ))}
          </div>
        )}

        {/* Create / Edit dialog */}
        <ModelProfileFormDialog
          open={createOpen || editing !== null}
          onOpenChange={(o) => {
            if (!o) {
              setCreateOpen(false);
              setEditing(null);
            }
          }}
          editing={editing}
          onSaved={() => refetch()}
        />

        {/* Delete confirm */}
        <ConfirmDialog
          open={confirmDelete !== null}
          onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}
          title={t('model-profiles.deleteConfirmTitle')}
          description={
            confirmDelete
              ? t('model-profiles.deleteConfirmDesc', { name: confirmDelete.displayName || confirmDelete.id })
              : ''
          }
          confirmLabel={t('model-profiles.delete')}
          variant="destructive"
          onConfirm={() => void handleDelete()}
        />
      </div>
    </div>
  );
}
