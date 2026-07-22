'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Boxes,
  Play,
  Plus,
  RefreshCw,
  Search,
  Terminal,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState, ListSkeleton, StatCard } from '@/components/shared';
import { useMe } from '@/hooks/use-auth';
import {
  useCreateSandbox,
  useCreateSandboxClaim,
  useCreateWarmPool,
  useSandboxClaims,
  useSandboxDelete,
  useSandboxToolCall,
  useSandboxTools,
  useSandboxes,
  useSandboxTemplates,
  useSyncSandboxes,
  useWarmPools,
} from '@/hooks/use-sandboxes';
import {
  clusterServiceListClusters,
} from '@/lib/api/generated/cluster-service/cluster-service';
import {
  namespaceServiceListClusterNamespaces,
} from '@/lib/api/generated/namespace-service/namespace-service';
import {
  V1SandboxLifecycle,
  V1SandboxNetworkMode,
} from '@/lib/api/generated/model';
import type { V1Sandbox, V1SandboxToolSchema } from '@/lib/api/generated/model';

/** Pretty-print a value as 2-space JSON. */
function pretty(v: unknown): string {
  return JSON.stringify(v, null, 2);
}

/** Map a sandbox lifecycle enum to a Badge variant. */
function lifecycleVariant(
  lifecycle?: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (lifecycle === V1SandboxLifecycle.SANDBOX_LIFECYCLE_READY) return 'default';
  if (
    lifecycle === V1SandboxLifecycle.SANDBOX_LIFECYCLE_FAILED ||
    lifecycle === V1SandboxLifecycle.SANDBOX_LIFECYCLE_DELETED
  )
    return 'destructive';
  if (
    lifecycle === V1SandboxLifecycle.SANDBOX_LIFECYCLE_CREATING ||
    lifecycle === V1SandboxLifecycle.SANDBOX_LIFECYCLE_SUSPENDED ||
    lifecycle === V1SandboxLifecycle.SANDBOX_LIFECYCLE_TERMINATING
  )
    return 'secondary';
  return 'outline';
}

/** Shorten a lifecycle enum label for display (drops the SANDBOX_LIFECYCLE_ prefix). */
function lifecycleLabel(lifecycle?: string): string {
  if (!lifecycle) return 'UNKNOWN';
  return lifecycle.replace(/^SANDBOX_LIFECYCLE_/, '');
}

function SandboxCard({
  item,
  active,
  onClick,
}: {
  item: V1Sandbox;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg border p-3 transition-colors ${
        active ? 'border-violet-500 bg-violet-500/5' : 'hover:bg-accent/50'
      }`}
    >
      <div className="flex items-start gap-2">
        <Boxes className="h-4 w-4 mt-0.5 text-violet-500" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">
              {item.name || item.kubernetesName || item.id}
            </span>
            <Badge variant={lifecycleVariant(item.lifecycle)} className="text-[10px]">
              {lifecycleLabel(item.lifecycle)}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            image: {item.image || '-'}
          </p>
          <p className="text-xs text-muted-foreground truncate font-mono">
            pod: {item.podName || '-'}
          </p>
        </div>
      </div>
    </button>
  );
}

function ToolRow({
  tool,
  selected,
  onClick,
}: {
  tool: V1SandboxToolSchema;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-md border px-3 py-2 text-left ${
        selected ? 'border-violet-500 bg-violet-500/5' : 'hover:bg-accent/50'
      }`}
    >
      <div className="font-mono text-xs font-medium">{tool.name}</div>
      {tool.description ? (
        <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {tool.description}
        </div>
      ) : null}
    </button>
  );
}

/** Default tool input for the tool-call panel, keyed by tool name. */
function defaultInputFor(tool: string): Record<string, unknown> {
  switch (tool) {
    case 'workspace.list':
      return { path: '.', recursive: false };
    case 'workspace.read':
      return { path: 'README.md', limit: 65536 };
    case 'workspace.write':
      return { path: 'notes/demo.txt', content: 'hello from aisphere sandbox\n', append: false };
    case 'workspace.search_files':
      return { path: '.', query: '', glob: '*', maxResults: 100 };
    case 'workspace.search_text':
      return { path: '.', query: 'TODO', maxResults: 50 };
    case 'workspace.mkdir':
      return { path: 'notes' };
    case 'workspace.delete':
      return { path: 'notes/demo.txt', recursive: false };
    case 'browser.open':
      return { url: 'about:blank' };
    default:
      return { path: '.', recursive: false };
  }
}

export function SandboxesPage() {
  const queryClient = useQueryClient();
  const { data: principal } = useMe();
  const principalId =
    (principal?.id as string | undefined) ||
    (principal?.subjectId as string | undefined) ||
    (principal?.sub as string | undefined) ||
    '';

  // ── Cluster + namespace selectors ───────────────────────────────────────
  const clustersQuery = useQuery({
    queryKey: ['kubernetes', 'clusters'],
    queryFn: () => clusterServiceListClusters({ pageSize: 100 }),
  });
  const clusters = clustersQuery.data?.clusters ?? [];

  const [selectedClusterId, setSelectedClusterId] = useState('');
  const activeClusterId = clusters.some((c) => c.id === selectedClusterId)
    ? selectedClusterId
    : clusters[0]?.id ?? '';

  const namespacesQuery = useQuery({
    queryKey: ['kubernetes', 'namespaces', activeClusterId],
    queryFn: () =>
      namespaceServiceListClusterNamespaces(activeClusterId, { pageSize: 200 }),
    enabled: Boolean(activeClusterId),
  });
  const namespaces = namespacesQuery.data?.namespaces ?? [];

  const [selectedNamespaceId, setSelectedNamespaceId] = useState('');
  const activeNamespaceId = namespaces.some((n) => n.id === selectedNamespaceId)
    ? selectedNamespaceId
    : namespaces[0]?.id ?? '';

  // ── Sandbox data (scoped to the active namespace) ───────────────────────
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sandboxesQuery = useSandboxes(activeNamespaceId);
  const sandboxes = sandboxesQuery.data?.sandboxes ?? [];

  const filtered = useMemo(
    () =>
      sandboxes.filter(
        (s) =>
          !search ||
          `${s.name ?? ''} ${s.kubernetesName ?? ''} ${s.image ?? ''} ${
            s.lifecycle ?? ''
          }`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [sandboxes, search],
  );

  const selected = useMemo(
    () =>
      filtered.find((s) => s.id === selectedId) ||
      sandboxes.find((s) => s.id === selectedId) ||
      null,
    [filtered, sandboxes, selectedId],
  );

  useEffect(() => {
    if (!selectedId && filtered.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- selects the first sandbox after async data arrives.
      setSelectedId(filtered[0].id ?? null);
    }
  }, [filtered, selectedId]);

  // ── Templates (cluster-scoped) ──────────────────────────────────────────
  const templatesQuery = useSandboxTemplates(activeClusterId);
  const templates = templatesQuery.data?.templates ?? [];

  // ── Mutations ───────────────────────────────────────────────────────────
  const [sandboxForm, setSandboxForm] = useState({
    name: '',
    templateId: '',
  });
  const createSandbox = useCreateSandbox();
  const removeSandbox = useSandboxDelete();
  const syncSandboxes = useSyncSandboxes();
  const callTool = useSandboxToolCall();

  const { data: toolList } = useSandboxTools(selected?.id ?? null);
  const tools = toolList?.tools ?? [];
  const [selectedTool, setSelectedTool] = useState('workspace.list');
  const [toolInput, setToolInput] = useState(
    pretty(defaultInputFor('workspace.list')),
  );

  useEffect(() => {
    const current = tools.find((t) => t.name === selectedTool);
    if (!current && tools.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- keeps the tool selection valid after a sandbox refresh.
      setSelectedTool(tools[0].name ?? 'workspace.list');
      setToolInput(pretty(defaultInputFor(tools[0].name ?? 'workspace.list')));
    }
  }, [tools, selectedTool]);

  // ── Warm pools + claims (optional section) ──────────────────────────────
  const warmPoolsQuery = useWarmPools(activeNamespaceId);
  const warmPools = warmPoolsQuery.data?.warmPools ?? [];
  const claimsQuery = useSandboxClaims(activeNamespaceId);
  const claims = claimsQuery.data?.claims ?? [];

  const [warmPoolForm, setWarmPoolForm] = useState({
    name: '',
    templateId: '',
    replicas: '2',
  });
  const createWarmPool = useCreateWarmPool();

  const [claimForm, setClaimForm] = useState({ name: '', warmPoolId: '' });
  const createSandboxClaim = useCreateSandboxClaim();

  // ── Handlers ────────────────────────────────────────────────────────────
  const refreshSandboxes = () =>
    activeNamespaceId
      ? queryClient.invalidateQueries({
          queryKey: ['sandboxes', 'list', activeNamespaceId],
        })
      : Promise.resolve();

  const handleCreateSandbox = () => {
    if (!activeNamespaceId || !sandboxForm.name.trim()) return;
    createSandbox.mutate(
      {
        namespaceId: activeNamespaceId,
        name: sandboxForm.name.trim(),
        templateId: sandboxForm.templateId || undefined,
        ownerId: principalId || undefined,
        ownerType: principalId ? 'user' : undefined,
      },
      {
        onSuccess: (sandbox) => {
          toast.success(`沙箱 ${sandbox.name || sandbox.id || ''} 已创建`);
          setSandboxForm({ name: '', templateId: '' });
          if (sandbox.id) setSelectedId(sandbox.id);
        },
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : '创建沙箱失败'),
      },
    );
  };

  const handleSync = () => {
    if (!activeNamespaceId) return;
    syncSandboxes.mutate(activeNamespaceId, {
      onSuccess: (result) => {
        toast.success(
          `同步完成：导入 ${result.imported ?? 0}，更新 ${result.updated ?? 0}，移除 ${result.removed ?? 0}`,
        );
      },
      onError: (error) =>
        toast.error(error instanceof Error ? error.message : '同步沙箱失败'),
    });
  };

  const handleDelete = () => {
    if (!selected?.id) return;
    removeSandbox.mutate(
      {
        id: selected.id,
        expectedRevision: selected.revision,
        deletePolicy: 'DELETE_POLICY_CASCADE',
      },
      {
        onSuccess: () => {
          toast.success(`沙箱 ${selected.name || selected.id} 删除请求已提交`);
          setSelectedId(null);
        },
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : '删除沙箱失败'),
      },
    );
  };

  const handleCreateWarmPool = () => {
    if (
      !activeNamespaceId ||
      !warmPoolForm.name.trim() ||
      !warmPoolForm.templateId ||
      !warmPoolForm.replicas
    )
      return;
    createWarmPool.mutate(
      {
        namespaceId: activeNamespaceId,
        name: warmPoolForm.name.trim(),
        templateId: warmPoolForm.templateId,
        replicas: Number(warmPoolForm.replicas) || 1,
        ownerId: principalId || undefined,
        ownerType: principalId ? 'user' : undefined,
      },
      {
        onSuccess: (wp) => {
          toast.success(`预热池 ${wp.name || wp.id || ''} 已创建`);
          setWarmPoolForm({ name: '', templateId: '', replicas: '2' });
        },
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : '创建预热池失败'),
      },
    );
  };

  const handleCreateClaim = () => {
    if (!activeNamespaceId || !claimForm.name.trim() || !claimForm.warmPoolId)
      return;
    createSandboxClaim.mutate(
      {
        namespaceId: activeNamespaceId,
        name: claimForm.name.trim(),
        warmPoolId: claimForm.warmPoolId,
        ownerId: principalId || undefined,
        ownerType: principalId ? 'user' : undefined,
      },
      {
        onSuccess: (claim) => {
          toast.success(
            `申领 ${claim.name || claim.id || ''} 已创建${
              claim.sandboxId ? `（沙箱 ${claim.sandboxId}）` : ''
            }`,
          );
          setClaimForm({ name: '', warmPoolId: '' });
        },
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : '申领沙箱失败'),
      },
    );
  };

  const runTool = () => {
    if (!selected?.id || !selectedTool) return;
    const inputJson = toolInput.trim()
      ? (() => {
          try {
            return JSON.stringify(JSON.parse(toolInput));
          } catch {
            return toolInput.trim();
          }
        })()
      : undefined;
    callTool.mutate(
      {
        id: selected.id,
        tool: selectedTool,
        inputJson,
        traceId: `console-${Date.now()}`,
      },
      {
        onSuccess: (out) => {
          if (out.ok) toast.success(`工具 ${selectedTool} 调用成功`);
          else toast.error(`工具 ${selectedTool} 调用失败：${out.error || ''}`);
        },
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : '工具调用失败'),
      },
    );
  };

  const runningCount = sandboxes.filter(
    (s) => s.lifecycle === V1SandboxLifecycle.SANDBOX_LIFECYCLE_READY,
  ).length;
  const offlineCount = sandboxes.filter(
    (s) => s.networkMode === V1SandboxNetworkMode.SANDBOX_NETWORK_MODE_OFFLINE,
  ).length;

  const canCreate = Boolean(
    activeNamespaceId && sandboxForm.name.trim() && (sandboxForm.templateId || warmPools.length),
  );

  return (
    <div className="h-full overflow-auto p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Boxes className="h-5 w-5" /> 沙箱运行环境
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            选择集群与命名空间，管理沙箱实例、模板、预热池与申领。
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={!activeNamespaceId || syncSandboxes.isPending}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 mr-1 ${
              syncSandboxes.isPending ? 'animate-spin' : ''
            }`}
          />{' '}
          同步
        </Button>
      </div>

      {/* ── Selectors ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">集群</CardTitle>
          </CardHeader>
          <CardContent>
            {clustersQuery.isLoading ? (
              <Skeleton className="h-9" />
            ) : (
              <Select value={activeClusterId} onValueChange={setSelectedClusterId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择集群" />
                </SelectTrigger>
                <SelectContent>
                  {clusters.map((c) => (
                    <SelectItem key={c.id} value={c.id ?? ''}>
                      {c.displayName || c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">命名空间</CardTitle>
          </CardHeader>
          <CardContent>
            {namespacesQuery.isLoading ? (
              <Skeleton className="h-9" />
            ) : (
              <Select value={activeNamespaceId} onValueChange={setSelectedNamespaceId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择命名空间" />
                </SelectTrigger>
                <SelectContent>
                  {namespaces.map((n) => (
                    <SelectItem key={n.id} value={n.id ?? ''}>
                      {n.displayName || n.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Stat cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Boxes className="h-4 w-4" />}
          label="沙箱总数"
          value={sandboxes.length}
        />
        <StatCard
          icon={<Play className="h-4 w-4" />}
          label="就绪"
          value={runningCount}
          accent="emerald"
        />
        <StatCard
          icon={<WifiOff className="h-4 w-4" />}
          label="离线"
          value={offlineCount}
          accent="amber"
        />
        <StatCard
          icon={<Terminal className="h-4 w-4" />}
          label="工具"
          value={tools.length}
          accent="sky"
        />
      </div>

      {!activeNamespaceId ? (
        <Card>
          <CardContent className="py-10">
            <EmptyState
              icon={<Boxes className="h-10 w-10" />}
              title="请选择命名空间"
              description="先选择集群与命名空间，再查看沙箱实例。"
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-4">
          {/* ── Sandbox list ────────────────────────────────────────────────── */}
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm">沙箱实例</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refreshSandboxes()}
                  disabled={sandboxesQuery.isFetching}
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 mr-1 ${
                      sandboxesQuery.isFetching ? 'animate-spin' : ''
                    }`}
                  />
                  刷新
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="搜索沙箱..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {sandboxesQuery.isLoading ? (
                <ListSkeleton count={4} />
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon={<Boxes className="h-10 w-10" />}
                  title="暂无沙箱"
                  description="选择模板并创建一个沙箱实例。"
                />
              ) : (
                <ScrollArea className="h-[480px] pr-2">
                  <div className="space-y-2">
                    {filtered.map((item) => (
                      <SandboxCard
                        key={item.id}
                        item={item}
                        active={item.id === selectedId}
                        onClick={() => setSelectedId(item.id ?? null)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            {/* ── Create sandbox form ────────────────────────────────────────── */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Plus className="h-4 w-4" /> 创建沙箱
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="沙箱名称"
                    value={sandboxForm.name}
                    onChange={(e) =>
                      setSandboxForm({ ...sandboxForm, name: e.target.value })
                    }
                  />
                  <Select
                    value={sandboxForm.templateId}
                    onValueChange={(v) =>
                      setSandboxForm({ ...sandboxForm, templateId: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择模板" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id ?? ''}>
                          {t.displayName || t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={handleCreateSandbox}
                    disabled={!canCreate || createSandbox.isPending}
                  >
                    <Play className="h-3.5 w-3.5 mr-1" /> 创建
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* ── Sandbox detail + tool panel ────────────────────────────────── */}
            {selected ? (
              <Card>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm">
                      {selected.name || selected.kubernetesName || selected.id}
                    </CardTitle>
                    <div className="flex gap-2">
                      {selected.permissions?.canDelete ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (
                              window.confirm(
                                `确认删除沙箱 ${
                                  selected.name || selected.id
                                }？`,
                              )
                            )
                              handleDelete();
                          }}
                          disabled={removeSandbox.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> 删除
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-3 text-xs">
                    <div>
                      <Label className="text-muted-foreground">生命周期</Label>
                      <div>
                        <Badge variant={lifecycleVariant(selected.lifecycle)}>
                          {lifecycleLabel(selected.lifecycle)}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">网络</Label>
                      <div className="flex items-center gap-1">
                        {selected.networkMode ===
                        V1SandboxNetworkMode.SANDBOX_NETWORK_MODE_ONLINE ? (
                          <Wifi className="h-3 w-3" />
                        ) : (
                          <WifiOff className="h-3 w-3" />
                        )}
                        {selected.networkMode
                          ? selected.networkMode.replace(
                              /^SANDBOX_NETWORK_MODE_/,
                              '',
                            )
                          : '-'}
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Pod</Label>
                      <div className="font-mono break-all">
                        {selected.podName || '-'}
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">PVC</Label>
                      <div className="font-mono break-all">
                        {selected.workspacePvc || '-'}
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">镜像</Label>
                      <div className="font-mono break-all">
                        {selected.image || '-'}
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">节点</Label>
                      <div className="font-mono break-all">
                        {selected.nodeName || '-'}
                      </div>
                    </div>
                  </div>
                  {selected.healthMessage ? (
                    <div className="text-xs text-destructive">
                      {selected.healthMessage}
                    </div>
                  ) : null}
                  <Separator />
                  <div className="grid lg:grid-cols-[260px_1fr] gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>沙箱工具</Label>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            selected.id &&
                            queryClient.invalidateQueries({
                              queryKey: ['sandboxes', 'tools', selected.id],
                            })
                          }
                        >
                          刷新
                        </Button>
                      </div>
                      <ScrollArea className="h-[360px] pr-2">
                        <div className="space-y-2">
                          {tools.map((tool) => (
                            <ToolRow
                              key={tool.name}
                              tool={tool}
                              selected={tool.name === selectedTool}
                              onClick={() => {
                                setSelectedTool(tool.name ?? 'workspace.list');
                                setToolInput(
                                  pretty(
                                    defaultInputFor(tool.name ?? 'workspace.list'),
                                  ),
                                );
                              }}
                            />
                          ))}
                          {!tools.length ? (
                            <div className="text-xs text-muted-foreground text-center py-4">
                              暂无工具
                            </div>
                          ) : null}
                        </div>
                      </ScrollArea>
                    </div>
                    <div className="space-y-2">
                      <Label>调用工具</Label>
                      <Select
                        value={selectedTool}
                        onValueChange={(v) => {
                          setSelectedTool(v);
                          setToolInput(pretty(defaultInputFor(v)));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择工具" />
                        </SelectTrigger>
                        <SelectContent>
                          {tools.map((t) => (
                            <SelectItem key={t.name} value={t.name ?? ''}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Textarea
                        className="font-mono text-xs min-h-[160px]"
                        value={toolInput}
                        onChange={(e) => setToolInput(e.target.value)}
                      />
                      <Button
                        onClick={runTool}
                        disabled={!selectedTool || callTool.isPending}
                      >
                        <Terminal className="h-3.5 w-3.5 mr-1" /> 调用
                      </Button>
                      {callTool.data ? (
                        <pre className="max-h-[260px] overflow-auto rounded-lg border bg-muted p-3 text-xs">
                          {callTool.data.outputJson
                            ? (() => {
                                try {
                                  return pretty(JSON.parse(callTool.data.outputJson));
                                } catch {
                                  return callTool.data.outputJson;
                                }
                              })()
                            : pretty(callTool.data)}
                        </pre>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Warm pools + claims ────────────────────────────────────────────── */}
      {activeNamespaceId ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>预热池</span>
                <Badge variant="secondary">{warmPools.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <Input
                  placeholder="名称"
                  value={warmPoolForm.name}
                  onChange={(e) =>
                    setWarmPoolForm({ ...warmPoolForm, name: e.target.value })
                  }
                />
                <Select
                  value={warmPoolForm.templateId}
                  onValueChange={(v) =>
                    setWarmPoolForm({ ...warmPoolForm, templateId: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="模板" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id ?? ''}>
                        {t.displayName || t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="1"
                  placeholder="副本数"
                  value={warmPoolForm.replicas}
                  onChange={(e) =>
                    setWarmPoolForm({ ...warmPoolForm, replicas: e.target.value })
                  }
                />
              </div>
              <Button
                className="w-full"
                onClick={handleCreateWarmPool}
                disabled={
                  !warmPoolForm.name.trim() ||
                  !warmPoolForm.templateId ||
                  createWarmPool.isPending
                }
              >
                <Plus className="h-4 w-4 mr-1" /> 创建预热池
              </Button>
              <div className="space-y-2">
                {warmPools.map((wp) => (
                  <div
                    key={wp.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-xs"
                  >
                    <div>
                      <span className="font-medium">{wp.name}</span>
                      <span className="text-muted-foreground ml-2">
                        模板 {wp.templateId || '-'}
                      </span>
                    </div>
                    <Badge variant="outline">
                      {wp.readyReplicas ?? 0}/{wp.replicas ?? 0}
                    </Badge>
                  </div>
                ))}
                {!warmPools.length ? (
                  <div className="text-xs text-muted-foreground text-center py-3">
                    暂无预热池
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>沙箱申领</span>
                <Badge variant="secondary">{claims.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="申领名称"
                  value={claimForm.name}
                  onChange={(e) =>
                    setClaimForm({ ...claimForm, name: e.target.value })
                  }
                />
                <Select
                  value={claimForm.warmPoolId}
                  onValueChange={(v) =>
                    setClaimForm({ ...claimForm, warmPoolId: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="预热池" />
                  </SelectTrigger>
                  <SelectContent>
                    {warmPools.map((wp) => (
                      <SelectItem key={wp.id} value={wp.id ?? ''}>
                        {wp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={handleCreateClaim}
                disabled={
                  !claimForm.name.trim() ||
                  !claimForm.warmPoolId ||
                  createSandboxClaim.isPending
                }
              >
                <Plus className="h-4 w-4 mr-1" /> 申领沙箱
              </Button>
              <div className="space-y-2">
                {claims.map((claim) => (
                  <div
                    key={claim.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-xs"
                  >
                    <div>
                      <span className="font-medium">{claim.name}</span>
                      <span className="text-muted-foreground ml-2">
                        沙箱 {claim.sandboxId || '-'}
                      </span>
                    </div>
                    <Badge variant="outline">
                      {claim.status
                        ? claim.status.replace(/^SANDBOX_CLAIM_STATUS_/, '')
                        : 'UNKNOWN'}
                    </Badge>
                  </div>
                ))}
                {!claims.length ? (
                  <div className="text-xs text-muted-foreground text-center py-3">
                    暂无申领
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
