'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  BrainCircuit,
  Cable,
  CheckCircle2,
  Cpu,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ConfirmDialog, EmptyState, StatCard } from '@/components/shared';
import { ModelConnectionDialog } from '@/components/model-management/model-connection-dialog';
import {
  type ModelConnection,
  useDeleteModelConnection,
  useModelEndpoints,
  useModelProfilesV2,
  useModels,
  useTestModelEndpoint,
} from '@/hooks/use-model-management';

export function ModelProfilesPage() {
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ModelConnection | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ModelConnection | null>(null);

  const modelsQuery = useModels({ pageSize: 200 });
  const endpointsQuery = useModelEndpoints({ pageSize: 200 });
  const profilesQuery = useModelProfilesV2({ pageSize: 200 });
  const testEndpoint = useTestModelEndpoint();
  const deleteConnection = useDeleteModelConnection();

  const models = modelsQuery.data ?? [];
  const endpoints = endpointsQuery.data ?? [];
  const profiles = profilesQuery.data ?? [];

  const connections = useMemo<ModelConnection[]>(() => {
    const modelById = new Map(models.map((item) => [item.id, item]));
    const endpointById = new Map(endpoints.map((item) => [item.id, item]));
    const usedEndpointIds = new Set<string>();
    const usedModelIds = new Set<string>();
    const result: ModelConnection[] = [];

    for (const profile of profiles) {
      const endpoint = endpointById.get(profile.endpointId);
      const model = endpoint ? modelById.get(endpoint.modelId) : undefined;
      if (!model) continue;
      if (endpoint) {
        usedEndpointIds.add(endpoint.id);
        usedModelIds.add(model.id);
      }
      result.push({ key: `profile:${profile.id}`, model, endpoint, profile });
    }

    for (const endpoint of endpoints) {
      if (usedEndpointIds.has(endpoint.id)) continue;
      const model = modelById.get(endpoint.modelId);
      if (!model) continue;
      usedModelIds.add(model.id);
      result.push({ key: `endpoint:${endpoint.id}`, model, endpoint });
    }

    for (const model of models) {
      if (usedModelIds.has(model.id)) continue;
      result.push({ key: `model:${model.id}`, model });
    }

    return result;
  }, [endpoints, models, profiles]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return connections;
    return connections.filter(({ model, endpoint, profile }) =>
      [
        profile?.displayName,
        profile?.code,
        model.displayName,
        model.vendor,
        model.family,
        endpoint?.providerModelId,
        endpoint?.baseUrl,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(value),
    );
  }, [connections, query]);

  const completeCount = connections.filter((item) => item.endpoint && item.profile).length;
  const activeCount = connections.filter((item) => connectionStatus(item) === 'active').length;
  const reasoningCount = connections.filter((item) => item.model.reasoning.supported).length;
  const healthyCount = connections.filter((item) => item.endpoint?.healthStatus === 'healthy').length;
  const incompleteCount = connections.length - completeCount;
  const loading = modelsQuery.isLoading || endpointsQuery.isLoading || profilesQuery.isLoading;
  const error = modelsQuery.error || endpointsQuery.error || profilesQuery.error;

  const refresh = () => {
    void modelsQuery.refetch();
    void endpointsQuery.refetch();
    void profilesQuery.refetch();
  };

  const handleTest = async (connection: ModelConnection) => {
    if (!connection.endpoint) return;
    try {
      const result = await testEndpoint.mutateAsync(connection.endpoint.id);
      if (result.healthy) {
        toast.success(`连接正常 · ${result.latencyMs} ms`);
      } else {
        const status = result.httpStatus ? `HTTP ${result.httpStatus}` : '网络请求失败';
        toast.error(`${status} · ${result.message.slice(0, 160)}`);
      }
    } catch (testError) {
      toast.error(testError instanceof Error ? testError.message : '连接测试失败');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteConnection.mutateAsync(deleteTarget);
      toast.success('模型接入已删除');
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : '删除失败');
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="mx-auto max-w-[1600px] space-y-5 p-4 md:p-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">模型管理</h1>
          <p className="text-sm text-muted-foreground">
            每张卡片就是一个可供 Agent 使用的模型接入。底层 Model、Endpoint 和 Profile 由系统自动维护。
          </p>
        </header>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard icon={<Cpu className="h-4 w-4" />} label="模型接入" value={connections.length} accent="violet" />
          <StatCard icon={<Activity className="h-4 w-4" />} label="已启用" value={activeCount} accent="emerald" />
          <StatCard icon={<BrainCircuit className="h-4 w-4" />} label="深度思考" value={reasoningCount} accent="amber" />
          <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="连接正常" value={healthyCount} accent="sky" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="max-w-sm"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索名称、模型 ID、API 地址"
          />
          <Button variant="ghost" size="icon" onClick={refresh} aria-label="刷新">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button className="ml-auto" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            添加模型
          </Button>
        </div>

        {incompleteCount > 0 ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
            检测到 {incompleteCount} 个历史未完成配置。打开编辑并保存后，系统会自动补齐 Endpoint 或默认 Profile。
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error.message}
          </div>
        ) : null}

        {loading ? (
          <div className="flex min-h-48 items-center justify-center rounded-lg border text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />加载模型配置…
          </div>
        ) : null}

        {!loading && filtered.length === 0 ? (
          <EmptyState
            icon={<Cable className="h-10 w-10" />}
            title={query ? '没有匹配的模型' : '暂无模型接入'}
            description={query ? '尝试更换搜索词。' : '添加一个模型，填写 API 地址、API Key 和服务端模型 ID。'}
            action={
              query ? undefined : (
                <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />添加模型
                </Button>
              )
            }
          />
        ) : null}

        {!loading && filtered.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((connection) => (
              <ModelConnectionCard
                key={connection.key}
                connection={connection}
                testing={testEndpoint.isPending && testEndpoint.variables === connection.endpoint?.id}
                onEdit={() => setEditing(connection)}
                onTest={() => void handleTest(connection)}
                onDelete={() => setDeleteTarget(connection)}
              />
            ))}
          </div>
        ) : null}

        <ModelConnectionDialog
          open={createOpen || editing !== null}
          onOpenChange={(open) => {
            if (!open) {
              setCreateOpen(false);
              setEditing(null);
            }
          }}
          editing={editing}
        />

        <ConfirmDialog
          open={deleteTarget !== null}
          onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
          title="删除模型接入"
          description="将删除默认使用配置，并清理不再被引用的 Endpoint 和 Model。该操作不可撤销。"
          confirmLabel="删除"
          variant="destructive"
          onConfirm={() => void handleDelete()}
        />
      </div>
    </div>
  );
}

function ModelConnectionCard({
  connection,
  testing,
  onEdit,
  onTest,
  onDelete,
}: {
  connection: ModelConnection;
  testing: boolean;
  onEdit: () => void;
  onTest: () => void;
  onDelete: () => void;
}) {
  const { model, endpoint, profile } = connection;
  const name = profile?.displayName ?? endpoint?.displayName ?? model.displayName;
  const status = connectionStatus(connection);
  const complete = Boolean(endpoint && profile);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-base">{name}</CardTitle>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {profile ? `aisphere://model-profiles/${profile.code}` : model.code}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge variant={status === 'active' ? 'default' : 'secondary'}>
              {status === 'active' ? '启用' : '停用'}
            </Badge>
            {!complete ? <Badge variant="outline">未完成</Badge> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 text-sm">
        <div className="space-y-1 rounded-md bg-muted/40 p-3 text-xs">
          <p>
            <span className="text-muted-foreground">模型 ID：</span>
            <span className="font-mono">{endpoint?.providerModelId ?? '尚未配置'}</span>
          </p>
          <p className="truncate">
            <span className="text-muted-foreground">API 地址：</span>
            <span className="font-mono">{endpoint?.baseUrl ?? '尚未配置'}</span>
          </p>
          <p>
            <span className="text-muted-foreground">协议：</span>
            {endpoint?.apiFormat ?? '尚未配置'}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <HealthBadge value={endpoint?.healthStatus ?? 'unknown'} />
          {model.capabilities.streaming ? <Badge variant="outline">流式</Badge> : null}
          {model.reasoning.supported ? <Badge variant="outline">深度思考</Badge> : null}
          {model.capabilities.toolCalling ? <Badge variant="outline">Tools</Badge> : null}
          {model.capabilities.structuredOutput ? <Badge variant="outline">结构化</Badge> : null}
          {endpoint?.credentialRef ? <Badge variant="outline">已配置 Key</Badge> : null}
        </div>

        {!complete ? (
          <p className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
            该记录来自旧版三层配置，编辑保存即可自动补齐为可供 Agent 使用的模型接入。
          </p>
        ) : null}

        <div className="mt-auto flex items-center gap-1 border-t pt-3">
          <Button size="sm" variant="ghost" onClick={onEdit}>
            <Pencil className="mr-1 h-3.5 w-3.5" />编辑
          </Button>
          <Button size="sm" variant="outline" onClick={onTest} disabled={!endpoint || testing}>
            {testing ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Activity className="mr-1 h-3.5 w-3.5" />}
            测试连接
          </Button>
          <Button className="ml-auto" size="icon" variant="ghost" onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function connectionStatus(connection: ModelConnection): 'active' | 'disabled' {
  if (
    connection.model.status === 'disabled' ||
    connection.endpoint?.status === 'disabled' ||
    connection.profile?.status === 'disabled'
  ) {
    return 'disabled';
  }
  return 'active';
}

function HealthBadge({ value }: { value: string }) {
  if (value === 'healthy') return <Badge>连接正常</Badge>;
  if (value === 'degraded') return <Badge variant="secondary">连接异常</Badge>;
  if (value === 'unhealthy') return <Badge variant="secondary">连接失败</Badge>;
  return <Badge variant="outline">未测试</Badge>;
}
