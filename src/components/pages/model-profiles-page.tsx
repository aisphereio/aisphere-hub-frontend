'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  Boxes,
  BrainCircuit,
  Cable,
  Cpu,
  Pencil,
  Plus,
  RefreshCw,
  Server,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ConfirmDialog, EmptyState, StatCard } from '@/components/shared';
import {
  EndpointFormDialog,
  ModelFormDialog,
  ProfileFormDialog,
} from '@/components/model-management/model-management-dialogs';
import {
  useDeleteModel,
  useDeleteModelEndpoint,
  useDeleteModelProfileV2,
  useModelEndpoints,
  useModelProfilesV2,
  useModels,
  useResolveModelProfileV2,
} from '@/hooks/use-model-management';
import type {
  ModelEndpoint,
  ModelProfileV2,
  ModelResource,
} from '@/lib/api/model-management';

type View = 'models' | 'endpoints' | 'profiles';
type DeleteTarget =
  | { kind: 'model'; item: ModelResource }
  | { kind: 'endpoint'; item: ModelEndpoint }
  | { kind: 'profile'; item: ModelProfileV2 };

export function ModelProfilesPage() {
  const [view, setView] = useState<View>('models');
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<ModelResource | null>(null);
  const [editingEndpoint, setEditingEndpoint] = useState<ModelEndpoint | null>(null);
  const [editingProfile, setEditingProfile] = useState<ModelProfileV2 | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [snapshotText, setSnapshotText] = useState('');

  const modelsQuery = useModels({ q: query || undefined, pageSize: 200 });
  const endpointsQuery = useModelEndpoints({ pageSize: 200 });
  const profilesQuery = useModelProfilesV2({ q: query || undefined, pageSize: 200 });
  const deleteModel = useDeleteModel();
  const deleteEndpoint = useDeleteModelEndpoint();
  const deleteProfile = useDeleteModelProfileV2();
  const resolveProfile = useResolveModelProfileV2();

  const models = modelsQuery.data ?? [];
  const endpoints = endpointsQuery.data ?? [];
  const profiles = profilesQuery.data ?? [];

  const filteredEndpoints = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return endpoints;
    return endpoints.filter((item) =>
      [item.displayName, item.providerModelId, item.baseUrl, item.adapter]
        .join(' ')
        .toLowerCase()
        .includes(value),
    );
  }, [endpoints, query]);

  const modelById = useMemo(
    () => new Map(models.map((item) => [item.id, item])),
    [models],
  );
  const endpointById = useMemo(
    () => new Map(endpoints.map((item) => [item.id, item])),
    [endpoints],
  );

  const activeCount =
    view === 'models'
      ? models.filter((item) => item.status === 'active').length
      : view === 'endpoints'
        ? endpoints.filter((item) => item.status === 'active').length
        : profiles.filter((item) => item.status === 'active').length;

  const refresh = () => {
    void modelsQuery.refetch();
    void endpointsQuery.refetch();
    void profilesQuery.refetch();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.kind === 'model') {
        await deleteModel.mutateAsync(deleteTarget.item.id);
      } else if (deleteTarget.kind === 'endpoint') {
        await deleteEndpoint.mutateAsync(deleteTarget.item.id);
      } else {
        await deleteProfile.mutateAsync(deleteTarget.item.id);
      }
      toast.success('资源已删除');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleResolve = async (profile: ModelProfileV2) => {
    try {
      const snapshot = await resolveProfile.mutateAsync({ id: profile.id });
      setSnapshotText(JSON.stringify(snapshot, null, 2));
      toast.success(`已解析 ${profile.displayName} 的运行时快照`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '解析失败');
    }
  };

  const openCreate = () => {
    setEditingModel(null);
    setEditingEndpoint(null);
    setEditingProfile(null);
    setCreateOpen(true);
  };

  const loading =
    modelsQuery.isLoading || endpointsQuery.isLoading || profilesQuery.isLoading;
  const error = modelsQuery.error || endpointsQuery.error || profilesQuery.error;
  const visibleCount =
    view === 'models'
      ? models.length
      : view === 'endpoints'
        ? filteredEndpoints.length
        : profiles.length;

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="mx-auto max-w-[1600px] space-y-5 p-4 md:p-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">模型管理</h1>
          <p className="text-sm text-muted-foreground">
            Model 定义模型身份和公共能力；Endpoint 定义服务端模型 ID 与厂商字段映射；Profile 定义 Agent 使用策略。
          </p>
        </header>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard icon={<Cpu className="h-4 w-4" />} label="模型" value={models.length} accent="violet" />
          <StatCard icon={<Server className="h-4 w-4" />} label="服务接入" value={endpoints.length} accent="sky" />
          <StatCard icon={<Boxes className="h-4 w-4" />} label="使用配置" value={profiles.length} accent="amber" />
          <StatCard icon={<Activity className="h-4 w-4" />} label="当前视图启用" value={activeCount} accent="emerald" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border p-1">
            <ViewButton active={view === 'models'} icon={<Cpu className="h-4 w-4" />} onClick={() => setView('models')}>模型目录</ViewButton>
            <ViewButton active={view === 'endpoints'} icon={<Cable className="h-4 w-4" />} onClick={() => setView('endpoints')}>服务接入</ViewButton>
            <ViewButton active={view === 'profiles'} icon={<BrainCircuit className="h-4 w-4" />} onClick={() => setView('profiles')}>使用配置</ViewButton>
          </div>
          <Input
            className="max-w-sm"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索名称、编码、服务端模型 ID"
          />
          <Button variant="ghost" size="icon" onClick={refresh} aria-label="刷新">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button className="ml-auto" onClick={openCreate} disabled={view === 'endpoints' && models.length === 0 || view === 'profiles' && endpoints.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            {view === 'models' ? '新增模型' : view === 'endpoints' ? '新增接入' : '新增配置'}
          </Button>
        </div>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error.message}
          </div>
        ) : null}

        {!loading && visibleCount === 0 ? (
          <EmptyState
            icon={<Boxes className="h-10 w-10" />}
            title={
              view === 'models'
                ? '暂无模型'
                : view === 'endpoints'
                  ? '暂无服务接入'
                  : '暂无使用配置'
            }
            description={
              view === 'models'
                ? '先登记模型身份、公共能力和推理能力。'
                : view === 'endpoints'
                  ? '为模型添加一个可调用 Endpoint，并配置服务端模型 ID。'
                  : '为 Agent 创建稳定的逻辑模型配置。'
            }
            action={<Button size="sm" variant="outline" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />开始创建</Button>}
          />
        ) : null}

        {view === 'models' ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {models.map((model) => (
              <Card key={model.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">{model.displayName}</CardTitle>
                      <p className="truncate font-mono text-xs text-muted-foreground">{model.code} · {model.id}</p>
                    </div>
                    <StatusBadge status={model.status} />
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3 text-sm">
                  <p className="line-clamp-2 text-muted-foreground">{model.description || '暂无描述'}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">{model.vendor}</Badge>
                    {model.family ? <Badge variant="outline">{model.family}</Badge> : null}
                    <Badge variant="secondary">{model.modelType}</Badge>
                    {model.capabilities.toolCalling ? <Badge variant="outline">Tools</Badge> : null}
                    {model.capabilities.visionInput ? <Badge variant="outline">Vision</Badge> : null}
                  </div>
                  <div className="rounded-md bg-muted/40 p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">推理能力</span>
                      <Badge variant={model.reasoning.supported ? 'default' : 'secondary'}>
                        {model.reasoning.supported ? '支持' : '不支持'}
                      </Badge>
                    </div>
                    {model.reasoning.supported ? (
                      <p className="mt-2 text-muted-foreground">
                        默认 {model.reasoning.defaultMode} / {model.reasoning.defaultEffort}<br />
                        强度：{model.reasoning.effortLevels.join('、')}
                      </p>
                    ) : null}
                  </div>
                  <CardActions
                    onEdit={() => setEditingModel(model)}
                    onDelete={() => setDeleteTarget({ kind: 'model', item: model })}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}

        {view === 'endpoints' ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredEndpoints.map((endpoint) => {
              const model = modelById.get(endpoint.modelId);
              return (
                <Card key={endpoint.id} className="flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base">{endpoint.displayName}</CardTitle>
                        <p className="truncate text-xs text-muted-foreground">{model?.displayName ?? endpoint.modelId}</p>
                      </div>
                      <StatusBadge status={endpoint.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-3 text-sm">
                    <div className="space-y-1 rounded-md bg-muted/40 p-3 text-xs">
                      <p><span className="text-muted-foreground">服务端模型 ID：</span><span className="font-mono">{endpoint.providerModelId}</span></p>
                      <p className="truncate"><span className="text-muted-foreground">地址：</span><span className="font-mono">{endpoint.baseUrl}</span></p>
                      <p><span className="text-muted-foreground">协议：</span>{endpoint.adapter} / {endpoint.apiFormat}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline">{endpoint.healthStatus ?? 'unknown'}</Badge>
                      <Badge variant="outline">{endpoint.limits.contextWindow || 0} ctx</Badge>
                      <Badge variant="outline">{endpoint.reasoningMapping.strategy}</Badge>
                    </div>
                    <CardActions
                      onEdit={() => setEditingEndpoint(endpoint)}
                      onDelete={() => setDeleteTarget({ kind: 'endpoint', item: endpoint })}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : null}

        {view === 'profiles' ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {profiles.map((profile) => {
              const endpoint = endpointById.get(profile.endpointId);
              const model = endpoint ? modelById.get(endpoint.modelId) : undefined;
              return (
                <Card key={profile.id} className="flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base">{profile.displayName}</CardTitle>
                        <p className="truncate font-mono text-xs text-muted-foreground">aisphere://model-profiles/{profile.code}</p>
                      </div>
                      <StatusBadge status={profile.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-3 text-sm">
                    <div className="space-y-1 rounded-md bg-muted/40 p-3 text-xs">
                      <p><span className="text-muted-foreground">模型：</span>{model?.displayName ?? '未解析'}</p>
                      <p><span className="text-muted-foreground">Endpoint：</span>{endpoint?.displayName ?? profile.endpointId}</p>
                      <p><span className="text-muted-foreground">服务端 ID：</span><span className="font-mono">{endpoint?.providerModelId ?? '—'}</span></p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline">rev {profile.latestRevision}</Badge>
                      <Badge variant="outline">{profile.reasoningPolicy.mode}</Badge>
                      <Badge variant="outline">{profile.reasoningPolicy.effort}</Badge>
                    </div>
                    <div className="mt-auto flex items-center gap-1 border-t pt-3">
                      <Button size="sm" variant="ghost" onClick={() => setEditingProfile(profile)}><Pencil className="mr-1 h-3.5 w-3.5" />编辑</Button>
                      <Button size="sm" variant="outline" onClick={() => void handleResolve(profile)} disabled={resolveProfile.isPending}>解析快照</Button>
                      <Button className="ml-auto" size="icon" variant="ghost" onClick={() => setDeleteTarget({ kind: 'profile', item: profile })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : null}

        {snapshotText ? (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">最近解析的 Runtime 快照</CardTitle></CardHeader>
            <CardContent><pre className="max-h-96 overflow-auto rounded-md bg-muted p-4 text-xs">{snapshotText}</pre></CardContent>
          </Card>
        ) : null}

        <ModelFormDialog
          key={editingModel?.id ?? (view === 'models' && createOpen ? 'new-model' : 'model-closed')}
          open={(view === 'models' && createOpen) || editingModel !== null}
          onOpenChange={(open) => { if (!open) { setCreateOpen(false); setEditingModel(null); } }}
          editing={editingModel}
        />
        <EndpointFormDialog
          key={editingEndpoint?.id ?? (view === 'endpoints' && createOpen ? 'new-endpoint' : 'endpoint-closed')}
          open={(view === 'endpoints' && createOpen) || editingEndpoint !== null}
          onOpenChange={(open) => { if (!open) { setCreateOpen(false); setEditingEndpoint(null); } }}
          models={models}
          editing={editingEndpoint}
        />
        <ProfileFormDialog
          key={editingProfile?.id ?? (view === 'profiles' && createOpen ? 'new-profile' : 'profile-closed')}
          open={(view === 'profiles' && createOpen) || editingProfile !== null}
          onOpenChange={(open) => { if (!open) { setCreateOpen(false); setEditingProfile(null); } }}
          endpoints={endpoints}
          models={models}
          editing={editingProfile}
        />

        <ConfirmDialog
          open={deleteTarget !== null}
          onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
          title="删除模型资源"
          description="被下游资源引用的 Model 或 Endpoint 会被后端拒绝删除；该操作不会静默级联。"
          confirmLabel="删除"
          variant="destructive"
          onConfirm={() => void handleDelete()}
        />
      </div>
    </div>
  );
}

function ViewButton({ active, icon, onClick, children }: { active: boolean; icon: React.ReactNode; onClick: () => void; children: React.ReactNode }) {
  return <Button size="sm" variant={active ? 'secondary' : 'ghost'} onClick={onClick}>{icon}<span className="ml-2">{children}</span></Button>;
}

function StatusBadge({ status }: { status: string }) {
  return <Badge variant={status === 'active' ? 'default' : 'secondary'}>{status === 'active' ? '启用' : '停用'}</Badge>;
}

function CardActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="mt-auto flex items-center gap-1 border-t pt-3">
      <Button size="sm" variant="ghost" onClick={onEdit}><Pencil className="mr-1 h-3.5 w-3.5" />编辑</Button>
      <Button className="ml-auto" size="icon" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4 text-destructive" /></Button>
    </div>
  );
}
