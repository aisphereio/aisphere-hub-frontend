'use client';

import { useDeferredValue, useMemo, useState } from 'react';
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
  CardGridSkeleton,
  ConfirmDialog,
  EmptyState,
  StatCard,
} from '@/components/shared';
import {
  ModelProfileCard,
  ModelProfileFormDialog,
  useModelProfileT,
} from '@/components/model-profiles';
import {
  useDeleteModelProfile,
  useModelProfiles,
} from '@/hooks/use-model-profiles';
import { toast } from 'sonner';
import type { ModelProfile } from '@/lib/api/types';

const PROVIDERS = ['openai', 'vllm', 'vertex', 'custom'];

export function ModelProfilesPage() {
  const t = useModelProfileT();
  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ModelProfile | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ModelProfile | null>(null);

  const deferredSearch = useDeferredValue(search);
  const {
    data: items = [],
    isLoading,
    error,
    refetch,
  } = useModelProfiles({
    query: deferredSearch || undefined,
    provider: providerFilter !== 'all' ? providerFilter : undefined,
    pageSize: 100,
  });
  const deleteMutation = useDeleteModelProfile();

  const stats = useMemo(() => {
    const active = items.filter(
      (profile) => (profile.status || 'active') === 'active',
    ).length;
    const providers = new Set(
      items.map((profile) => profile.provider).filter(Boolean),
    ).size;
    const contextWindows = items
      .map((profile) => profile.limits?.maxInputTokens ?? 0)
      .filter((tokens) => tokens > 0);
    const averageContext = contextWindows.length
      ? Math.round(
          contextWindows.reduce((sum, tokens) => sum + tokens, 0) /
            contextWindows.length,
        )
      : 0;

    return {
      total: items.length,
      active,
      providers,
      averageContext,
    };
  }, [items]);

  const handleDelete = async () => {
    if (!confirmDelete) return;

    try {
      await deleteMutation.mutateAsync(confirmDelete.id);
      toast.success(t('deleted'));
    } catch (deleteError: unknown) {
      toast.error(
        deleteError instanceof Error
          ? deleteError.message
          : t('delete'),
      );
    } finally {
      setConfirmDelete(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="mx-auto max-w-[1600px] space-y-5 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('hint')}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            icon={<Boxes className="h-4 w-4" />}
            label={t('stats.total')}
            value={stats.total}
            accent="violet"
          />
          <StatCard
            icon={<Cpu className="h-4 w-4" />}
            label={t('stats.active')}
            value={stats.active}
            accent="emerald"
          />
          <StatCard
            icon={<Layers className="h-4 w-4" />}
            label={t('stats.providers')}
            value={stats.providers}
            accent="sky"
          />
          <StatCard
            icon={<Cpu className="h-4 w-4" />}
            label={t('stats.avgContext')}
            value={
              stats.averageContext > 0
                ? stats.averageContext.toLocaleString()
                : 0
            }
            accent="amber"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('search')}
            className="max-w-xs"
          />
          <Select value={providerFilter} onValueChange={setProviderFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t('filter.allProviders')}
              </SelectItem>
              {PROVIDERS.map((provider) => (
                <SelectItem key={provider} value={provider}>
                  {t(`provider.${provider}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void refetch()}
            aria-label={t('retry')}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            className="ml-auto bg-gradient-to-r from-violet-600 to-fuchsia-500"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('create')}
          </Button>
        </div>

        {error ? (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{error.message}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void refetch()}
            >
              {t('retry')}
            </Button>
          </div>
        ) : null}

        {isLoading ? (
          <CardGridSkeleton count={6} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Boxes className="h-10 w-10" />}
            title={
              search || providerFilter !== 'all'
                ? t('empty.filtered')
                : t('empty.title')
            }
            description={
              search || providerFilter !== 'all'
                ? undefined
                : t('empty.desc')
            }
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t('create')}
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((profile) => (
              <ModelProfileCard
                key={profile.id}
                profile={profile}
                onEdit={() => setEditing(profile)}
                onDelete={() => setConfirmDelete(profile)}
              />
            ))}
          </div>
        )}

        <ModelProfileFormDialog
          key={editing?.id ?? '__new__'}
          open={createOpen || editing !== null}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setCreateOpen(false);
              setEditing(null);
            }
          }}
          editing={editing}
          onSaved={() => void refetch()}
        />

        <ConfirmDialog
          open={confirmDelete !== null}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setConfirmDelete(null);
          }}
          title={t('deleteConfirmTitle')}
          description={
            confirmDelete
              ? t('deleteConfirmDesc', {
                  name: confirmDelete.displayName || confirmDelete.id,
                })
              : ''
          }
          confirmLabel={t('delete')}
          variant="destructive"
          onConfirm={() => void handleDelete()}
        />
      </div>
    </div>
  );
}
