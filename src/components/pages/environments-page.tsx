'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, CloudCog, KeyRound, Plus, RefreshCw, RotateCcw, Server, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { ClusterEditDialog } from '@/components/kubernetes/cluster-edit-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { getAccessSpace } from '@/lib/api/client';
import { useMe } from '@/hooks/use-auth';
import {
  clusterServiceCreateCluster,
  clusterServiceDeleteCluster,
  clusterServiceListClusters,
  clusterServiceProbeCluster,
  clusterServiceRotateCredential,
} from '@/lib/api/generated/cluster-service/cluster-service';
import {
  namespaceServiceCreateNamespace,
  namespaceServiceDeleteNamespace,
  namespaceServiceListClusterNamespaces,
  namespaceServiceSyncNamespaces,
  namespaceServiceUpdateNamespaceVisibility,
} from '@/lib/api/generated/namespace-service/namespace-service';
import {
  ClusterServiceDeleteClusterDeletePolicy,
  NamespaceServiceDeleteNamespaceDeletePolicy,
  V1CreateMode,
  V1NamespaceVisibility,
} from '@/lib/api/generated/model';
import type { V1Cluster, V1ClusterCredentialInput, V1Namespace } from '@/lib/api/generated/model';

type CredentialKind = 'kubeconfig' | 'service-account';
type NamespaceVisibility = typeof V1NamespaceVisibility[keyof typeof V1NamespaceVisibility];

const clusterQueryKey = ['kubernetes', 'clusters'] as const;

function utf8Base64(value: string): string {
  if (!value) return '';
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function credentialInput(kind: CredentialKind, kubeconfig: string, token: string, caCert: string): V1ClusterCredentialInput {
  if (kind === 'service-account') {
    return {
      serviceAccount: {
        token: token.trim(),
        caCert: caCert.trim() ? utf8Base64(caCert) : undefined,
      },
    };
  }
  return { kubeconfig: utf8Base64(kubeconfig) };
}

function statusVariant(status?: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status?.includes('READY') || status?.includes('SYNCED')) return 'default';
  if (status?.includes('FAILED') || status?.includes('DEGRADED')) return 'destructive';
  if (status?.includes('CREATING') || status?.includes('PROBING') || status?.includes('PUBLISHING')) return 'secondary';
  return 'outline';
}

export function EnvironmentsPage() {
  const queryClient = useQueryClient();
  const { data: principal } = useMe();
  const [selectedClusterId, setSelectedClusterId] = useState('');
  const [clusterForm, setClusterForm] = useState({
    name: '',
    displayName: '',
    description: '',
    orgId: getAccessSpace(),
    serverUrl: '',
    distribution: '',
    credentialKind: 'kubeconfig' as CredentialKind,
    kubeconfig: '',
    token: '',
    caCert: '',
  });
  // Keep the cluster form's orgId in sync with the authenticated principal.
  // getAccessSpace() may return "default" on first render before app-shell
  // syncs the org from /me; update the form once the principal arrives.
  useEffect(() => {
    const orgId = (principal?.orgId as string | undefined) || (principal?.org_id as string | undefined);
    if (orgId && orgId !== clusterForm.orgId) {
      const handle = window.setTimeout(() => setClusterForm((prev) => ({ ...prev, orgId })), 0);
      return () => window.clearTimeout(handle);
    }
  }, [principal, clusterForm.orgId]);
  const [rotateForm, setRotateForm] = useState({
    credentialKind: 'kubeconfig' as CredentialKind,
    kubeconfig: '',
    token: '',
    caCert: '',
  });
  const [namespaceForm, setNamespaceForm] = useState({
    name: '',
    displayName: '',
    description: '',
    visibility: V1NamespaceVisibility.NAMESPACE_VISIBILITY_PRIVATE as NamespaceVisibility,
  });

  const clustersQuery = useQuery({
    queryKey: clusterQueryKey,
    queryFn: () => clusterServiceListClusters({ pageSize: 100 }),
  });
  const clusters = clustersQuery.data?.clusters ?? [];
  const activeClusterId = clusters.some((cluster) => cluster.id === selectedClusterId)
    ? selectedClusterId
    : clusters[0]?.id ?? '';
  const selectedCluster = clusters.find((cluster) => cluster.id === activeClusterId);

  const namespacesQuery = useQuery({
    queryKey: ['kubernetes', 'namespaces', activeClusterId],
    queryFn: () => namespaceServiceListClusterNamespaces(activeClusterId, { pageSize: 200 }),
    enabled: Boolean(activeClusterId),
  });
  const namespaces = namespacesQuery.data?.namespaces ?? [];

  const refreshClusters = () => queryClient.invalidateQueries({ queryKey: clusterQueryKey });
  const refreshNamespaces = () => activeClusterId
    ? queryClient.invalidateQueries({ queryKey: ['kubernetes', 'namespaces', activeClusterId] })
    : Promise.resolve();

  const createCluster = useMutation({
    mutationFn: () => clusterServiceCreateCluster({
      name: clusterForm.name.trim(),
      displayName: clusterForm.displayName.trim() || undefined,
      description: clusterForm.description.trim() || undefined,
      orgId: clusterForm.orgId.trim(),
      serverUrl: clusterForm.serverUrl.trim(),
      distribution: clusterForm.distribution.trim() || undefined,
      credential: credentialInput(clusterForm.credentialKind, clusterForm.kubeconfig, clusterForm.token, clusterForm.caCert),
    }),
    onSuccess: async (cluster) => {
      toast.success(`集群 ${cluster.displayName || cluster.name || ''} 已接入`);
      setClusterForm((form) => ({
        ...form,
        name: '',
        displayName: '',
        description: '',
        serverUrl: '',
        distribution: '',
        kubeconfig: '',
        token: '',
        caCert: '',
      }));
      if (cluster.id) setSelectedClusterId(cluster.id);
      await refreshClusters();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : '集群接入失败'),
  });

  const probeCluster = useMutation({
    mutationFn: (id: string) => clusterServiceProbeCluster(id),
    onSuccess: async () => {
      toast.success('集群探测完成');
      await refreshClusters();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : '集群探测失败'),
  });

  const rotateCredential = useMutation({
    mutationFn: (cluster: V1Cluster) => clusterServiceRotateCredential(cluster.id ?? '', {
      expectedRevision: cluster.revision ?? '0',
      credential: credentialInput(rotateForm.credentialKind, rotateForm.kubeconfig, rotateForm.token, rotateForm.caCert),
    }),
    onSuccess: async () => {
      toast.success('凭据轮换成功，旧凭据将由后台任务清理');
      setRotateForm({ credentialKind: 'kubeconfig', kubeconfig: '', token: '', caCert: '' });
      await refreshClusters();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : '凭据轮换失败'),
  });

  const deleteCluster = useMutation({
    mutationFn: (cluster: V1Cluster) => clusterServiceDeleteCluster(cluster.id ?? '', {
      expectedRevision: cluster.revision ?? '0',
      deletePolicy: ClusterServiceDeleteClusterDeletePolicy.DELETE_POLICY_DETACH_ONLY,
    }),
    onSuccess: async () => {
      toast.success('集群已从 AISphere 分离，远端资源未删除');
      setSelectedClusterId('');
      await refreshClusters();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : '删除集群失败'),
  });

  const createNamespace = useMutation({
    mutationFn: () => namespaceServiceCreateNamespace(activeClusterId, {
      name: namespaceForm.name.trim(),
      displayName: namespaceForm.displayName.trim() || undefined,
      description: namespaceForm.description.trim() || undefined,
      visibility: namespaceForm.visibility,
      createMode: V1CreateMode.CREATE_MODE_CREATE_NEW,
    }),
    onSuccess: async () => {
      toast.success('Kubernetes Namespace 已创建');
      setNamespaceForm({
        name: '',
        displayName: '',
        description: '',
        visibility: V1NamespaceVisibility.NAMESPACE_VISIBILITY_PRIVATE,
      });
      await refreshNamespaces();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Namespace 创建失败'),
  });

  const syncNamespaces = useMutation({
    mutationFn: () => namespaceServiceSyncNamespaces(activeClusterId),
    onSuccess: async (result) => {
      toast.success(`同步完成：导入 ${result.imported ?? 0}，更新 ${result.updated ?? 0}，移除 ${result.removed ?? 0}`);
      await refreshNamespaces();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Namespace 同步失败'),
  });

  const updateVisibility = useMutation({
    mutationFn: ({ namespace, visibility }: { namespace: V1Namespace; visibility: NamespaceVisibility }) =>
      namespaceServiceUpdateNamespaceVisibility(namespace.id ?? '', { visibility }),
    onSuccess: async () => {
      toast.success('可见性已更新');
      await refreshNamespaces();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : '可见性更新失败'),
  });

  const deleteNamespace = useMutation({
    mutationFn: (namespace: V1Namespace) => namespaceServiceDeleteNamespace(namespace.id ?? '', {
      expectedRevision: namespace.revision ?? '0',
      deletePolicy: NamespaceServiceDeleteNamespaceDeletePolicy.DELETE_POLICY_CASCADE,
    }),
    onSuccess: async () => {
      toast.success('Namespace 删除请求已提交');
      await refreshNamespaces();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Namespace 删除失败'),
  });

  const clusterCredentialReady = clusterForm.credentialKind === 'kubeconfig'
    ? Boolean(clusterForm.kubeconfig.trim())
    : Boolean(clusterForm.token.trim());
  const canCreateCluster = Boolean(
    clusterForm.name.trim()
    && clusterForm.orgId.trim()
    && clusterForm.serverUrl.trim()
    && clusterCredentialReady,
  );

  return (
    <div className="h-full overflow-auto p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2"><CloudCog className="h-5 w-5" /> Kubernetes 运行环境</h1>
          <p className="text-xs text-muted-foreground mt-1">接入集群、编辑元数据、探测健康、轮换凭据，并管理远端 Namespace。</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refreshClusters()} disabled={clustersQuery.isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${clustersQuery.isFetching ? 'animate-spin' : ''}`} /> 刷新
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2"><Server className="h-4 w-4" /> 已接入集群</span>
              <Badge variant="secondary">{clusters.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {clustersQuery.isLoading ? <Skeleton className="h-44" /> : (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>集群</TableHead><TableHead>状态</TableHead><TableHead>版本</TableHead><TableHead className="text-right">操作</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {clusters.map((cluster) => (
                    <TableRow
                      key={cluster.id}
                      className={activeClusterId === cluster.id ? 'bg-accent/60' : 'cursor-pointer'}
                      onClick={() => setSelectedClusterId(cluster.id ?? '')}
                    >
                      <TableCell>
                        <div className="font-medium text-xs">{cluster.displayName || cluster.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{cluster.serverUrl}</div>
                        {cluster.healthMessage ? <div className="text-[10px] text-destructive mt-1">{cluster.healthMessage}</div> : null}
                      </TableCell>
                      <TableCell><Badge variant={statusVariant(cluster.status)}>{cluster.status || 'UNKNOWN'}</Badge></TableCell>
                      <TableCell className="text-xs">{cluster.kubernetesVersion || '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {cluster.permissions?.canManage ? <ClusterEditDialog cluster={cluster} /> : null}
                          {cluster.permissions?.canOperate ? (
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="探测" onClick={(event) => {
                              event.stopPropagation();
                              if (cluster.id) probeCluster.mutate(cluster.id);
                            }}><Activity className="h-3.5 w-3.5" /></Button>
                          ) : null}
                          {cluster.permissions?.canDelete ? (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="从平台分离" onClick={(event) => {
                              event.stopPropagation();
                              if (window.confirm(`确认从平台分离集群 ${cluster.displayName || cluster.name}？远端资源不会删除。`)) deleteCluster.mutate(cluster);
                            }}><Trash2 className="h-3.5 w-3.5" /></Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!clusters.length ? <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">还没有接入 Kubernetes 集群</TableCell></TableRow> : null}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Plus className="h-4 w-4" /> 接入集群</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="集群标识，如 dev-cluster" value={clusterForm.name} onChange={(event) => setClusterForm({ ...clusterForm, name: event.target.value })} />
              <Input placeholder="展示名称" value={clusterForm.displayName} onChange={(event) => setClusterForm({ ...clusterForm, displayName: event.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="组织 / Zone ID" value={clusterForm.orgId} onChange={(event) => setClusterForm({ ...clusterForm, orgId: event.target.value })} />
              <Input placeholder="发行版，如 k3s / rke2" value={clusterForm.distribution} onChange={(event) => setClusterForm({ ...clusterForm, distribution: event.target.value })} />
            </div>
            <Input placeholder="API Server，例如 https://10.0.0.10:6443" value={clusterForm.serverUrl} onChange={(event) => setClusterForm({ ...clusterForm, serverUrl: event.target.value })} />
            <Textarea rows={2} placeholder="说明" value={clusterForm.description} onChange={(event) => setClusterForm({ ...clusterForm, description: event.target.value })} />
            <Select value={clusterForm.credentialKind} onValueChange={(value: CredentialKind) => setClusterForm({ ...clusterForm, credentialKind: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="kubeconfig">Kubeconfig</SelectItem><SelectItem value="service-account">ServiceAccount Token</SelectItem></SelectContent>
            </Select>
            {clusterForm.credentialKind === 'kubeconfig' ? (
              <Textarea className="font-mono text-xs" rows={8} placeholder="粘贴 kubeconfig YAML；浏览器提交时自动 Base64 编码" value={clusterForm.kubeconfig} onChange={(event) => setClusterForm({ ...clusterForm, kubeconfig: event.target.value })} />
            ) : (
              <>
                <Textarea className="font-mono text-xs" rows={4} placeholder="ServiceAccount Bearer Token" value={clusterForm.token} onChange={(event) => setClusterForm({ ...clusterForm, token: event.target.value })} />
                <Textarea className="font-mono text-xs" rows={4} placeholder="CA PEM（可选）" value={clusterForm.caCert} onChange={(event) => setClusterForm({ ...clusterForm, caCert: event.target.value })} />
              </>
            )}
            <Button className="w-full" disabled={!canCreateCluster || createCluster.isPending} onClick={() => createCluster.mutate()}>
              <ShieldCheck className="h-4 w-4 mr-1" /> 验证并接入
            </Button>
          </CardContent>
        </Card>
      </div>

      {selectedCluster ? (
        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex flex-wrap items-center justify-between gap-2">
                <span>{selectedCluster.displayName || selectedCluster.name} / Namespace</span>
                {selectedCluster.permissions?.canOperate ? (
                  <Button size="sm" variant="outline" onClick={() => syncNamespaces.mutate()} disabled={syncNamespaces.isPending}>
                    <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncNamespaces.isPending ? 'animate-spin' : ''}`} /> 同步
                  </Button>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {namespacesQuery.isLoading ? <Skeleton className="h-44" /> : (
                <Table>
                  <TableHeader><TableRow><TableHead>名称</TableHead><TableHead>生命周期</TableHead><TableHead>有效可见性</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {namespaces.map((namespace) => {
                      const isPublic = namespace.visibility === V1NamespaceVisibility.NAMESPACE_VISIBILITY_PUBLIC;
                      return (
                        <TableRow key={namespace.id}>
                          <TableCell>
                            <div className="font-medium text-xs">{namespace.displayName || namespace.name}</div>
                            <div className="text-[10px] text-muted-foreground font-mono">{namespace.name}</div>
                            {namespace.visibilitySyncStatusEnum && !namespace.visibilitySyncStatusEnum.includes('SYNCED') ? (
                              <div className="text-[10px] text-amber-600 mt-1">权限同步：{namespace.visibilitySyncStatusEnum}</div>
                            ) : null}
                          </TableCell>
                          <TableCell><Badge variant={statusVariant(namespace.lifecycle)}>{namespace.lifecycle || 'UNKNOWN'}</Badge></TableCell>
                          <TableCell className="text-xs">{namespace.effectiveVisibility || namespace.visibility || '-'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {namespace.permissions?.canManage ? (
                                <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => updateVisibility.mutate({
                                  namespace,
                                  visibility: isPublic
                                    ? V1NamespaceVisibility.NAMESPACE_VISIBILITY_PRIVATE
                                    : V1NamespaceVisibility.NAMESPACE_VISIBILITY_PUBLIC,
                                })}>{isPublic ? '设为私有' : '设为公开'}</Button>
                              ) : null}
                              {namespace.permissions?.canDelete ? (
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => {
                                  if (window.confirm(`确认级联删除 Kubernetes Namespace ${namespace.name}？`)) deleteNamespace.mutate(namespace);
                                }}><Trash2 className="h-3.5 w-3.5" /></Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!namespaces.length ? <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">该集群还没有受管 Namespace</TableCell></TableRow> : null}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            {selectedCluster.permissions?.canCreateNamespace ? (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Plus className="h-4 w-4" /> 创建 Namespace</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Input placeholder="DNS-1123 名称，如 agent-runtime" value={namespaceForm.name} onChange={(event) => setNamespaceForm({ ...namespaceForm, name: event.target.value })} />
                  <Input placeholder="展示名称" value={namespaceForm.displayName} onChange={(event) => setNamespaceForm({ ...namespaceForm, displayName: event.target.value })} />
                  <Textarea rows={2} placeholder="说明" value={namespaceForm.description} onChange={(event) => setNamespaceForm({ ...namespaceForm, description: event.target.value })} />
                  <Select value={namespaceForm.visibility} onValueChange={(visibility) => setNamespaceForm({ ...namespaceForm, visibility: visibility as NamespaceVisibility })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={V1NamespaceVisibility.NAMESPACE_VISIBILITY_PRIVATE}>私有</SelectItem>
                      <SelectItem value={V1NamespaceVisibility.NAMESPACE_VISIBILITY_PUBLIC}>公开只读</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button className="w-full" disabled={!namespaceForm.name.trim() || createNamespace.isPending} onClick={() => createNamespace.mutate()}>
                    <Plus className="h-4 w-4 mr-1" /> 创建到远端集群
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            {selectedCluster.permissions?.canManage ? (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><KeyRound className="h-4 w-4" /> 轮换集群凭据</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Select value={rotateForm.credentialKind} onValueChange={(value: CredentialKind) => setRotateForm({ ...rotateForm, credentialKind: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="kubeconfig">Kubeconfig</SelectItem><SelectItem value="service-account">ServiceAccount Token</SelectItem></SelectContent>
                  </Select>
                  {rotateForm.credentialKind === 'kubeconfig' ? (
                    <Textarea className="font-mono text-xs" rows={6} placeholder="新 kubeconfig" value={rotateForm.kubeconfig} onChange={(event) => setRotateForm({ ...rotateForm, kubeconfig: event.target.value })} />
                  ) : (
                    <>
                      <Textarea className="font-mono text-xs" rows={3} placeholder="新 Token" value={rotateForm.token} onChange={(event) => setRotateForm({ ...rotateForm, token: event.target.value })} />
                      <Textarea className="font-mono text-xs" rows={3} placeholder="新 CA PEM（可选）" value={rotateForm.caCert} onChange={(event) => setRotateForm({ ...rotateForm, caCert: event.target.value })} />
                    </>
                  )}
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={rotateCredential.isPending || (rotateForm.credentialKind === 'kubeconfig' ? !rotateForm.kubeconfig.trim() : !rotateForm.token.trim())}
                    onClick={() => rotateCredential.mutate(selectedCluster)}
                  >
                    <RotateCcw className="h-4 w-4 mr-1" /> 探测并原子轮换
                  </Button>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
