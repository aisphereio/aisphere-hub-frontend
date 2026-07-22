'use client';

import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Network, Plus, RefreshCw, Server, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useMe } from '@/hooks/use-auth';
import {
  useClusterNamespaces,
  useCreateCluster,
  useCreateKubernetesNamespace,
  useDeleteCluster,
  useDeleteKubernetesNamespace,
  useKubernetesClusters,
  useProbeCluster,
  useRotateClusterCredential,
  useSyncKubernetesNamespaces,
  useUpdateKubernetesNamespaceVisibility,
} from '@/hooks/use-kubernetes-environments';
import type { V1Cluster, V1ClusterCredentialInput, V1Namespace } from '@/lib/api/generated/model';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败，请检查网络、权限和集群凭据';
}

function statusVariant(status?: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status?.includes('READY') || status?.includes('SYNCED')) return 'default';
  if (status?.includes('FAILED') || status?.includes('DEGRADED')) return 'destructive';
  if (status?.includes('CREATING') || status?.includes('PROBING') || status?.includes('PUBLISHING')) return 'secondary';
  return 'outline';
}

function buildCredential(mode: 'kubeconfig' | 'service-account', kubeconfig: string, token: string, caCert: string): V1ClusterCredentialInput {
  return mode === 'kubeconfig'
    ? { kubeconfig }
    : { serviceAccount: { token, caCert: caCert || undefined } };
}

export function KubernetesEnvironmentPanel() {
  const { data: principal } = useMe();
  const principalOrgId = String(principal?.orgId || principal?.tenantId || '');
  const clustersQuery = useKubernetesClusters();
  const clusters = clustersQuery.data ?? [];
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const selectedCluster = useMemo(
    () => clusters.find((cluster) => cluster.id === selectedClusterId) ?? null,
    [clusters, selectedClusterId],
  );
  const namespacesQuery = useClusterNamespaces(selectedClusterId);
  const namespaces = namespacesQuery.data ?? [];

  const createCluster = useCreateCluster();
  const probeCluster = useProbeCluster();
  const rotateCredential = useRotateClusterCredential();
  const deleteCluster = useDeleteCluster();
  const createNamespace = useCreateKubernetesNamespace();
  const syncNamespaces = useSyncKubernetesNamespaces();
  const updateVisibility = useUpdateKubernetesNamespaceVisibility();
  const deleteNamespace = useDeleteKubernetesNamespace();

  const [createClusterOpen, setCreateClusterOpen] = useState(false);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [credentialMode, setCredentialMode] = useState<'kubeconfig' | 'service-account'>('kubeconfig');
  const [clusterForm, setClusterForm] = useState({
    name: '',
    displayName: '',
    description: '',
    orgId: principalOrgId,
    serverUrl: '',
    distribution: '',
    kubeconfig: '',
    token: '',
    caCert: '',
  });
  const [rotateForm, setRotateForm] = useState({ kubeconfig: '', token: '', caCert: '' });
  const [namespaceForm, setNamespaceForm] = useState({
    name: '',
    displayName: '',
    description: '',
    visibility: 'NAMESPACE_VISIBILITY_PRIVATE',
  });

  useEffect(() => {
    if (!selectedClusterId && clusters[0]?.id) setSelectedClusterId(clusters[0].id);
    if (selectedClusterId && !clusters.some((cluster) => cluster.id === selectedClusterId)) {
      setSelectedClusterId(clusters[0]?.id ?? null);
    }
  }, [clusters, selectedClusterId]);

  useEffect(() => {
    if (principalOrgId && !clusterForm.orgId) {
      setClusterForm((current) => ({ ...current, orgId: principalOrgId }));
    }
  }, [principalOrgId, clusterForm.orgId]);

  const submitCluster = async () => {
    const credential = buildCredential(
      credentialMode,
      clusterForm.kubeconfig.trim(),
      clusterForm.token.trim(),
      clusterForm.caCert.trim(),
    );
    if (!clusterForm.name.trim() || !clusterForm.orgId.trim() || !clusterForm.serverUrl.trim()) {
      toast.error('集群名称、组织 ID 和 API Server 地址不能为空');
      return;
    }
    if (credentialMode === 'kubeconfig' && !clusterForm.kubeconfig.trim()) {
      toast.error('请粘贴 kubeconfig');
      return;
    }
    if (credentialMode === 'service-account' && !clusterForm.token.trim()) {
      toast.error('请填写 ServiceAccount Token');
      return;
    }
    try {
      const created = await createCluster.mutateAsync({
        name: clusterForm.name.trim(),
        displayName: clusterForm.displayName.trim() || undefined,
        description: clusterForm.description.trim() || undefined,
        orgId: clusterForm.orgId.trim(),
        serverUrl: clusterForm.serverUrl.trim(),
        distribution: clusterForm.distribution.trim() || undefined,
        credential,
      });
      toast.success(`集群 ${created.displayName || created.name || clusterForm.name} 已接入`);
      setCreateClusterOpen(false);
      setSelectedClusterId(created.id || null);
      setClusterForm({
        name: '', displayName: '', description: '', orgId: principalOrgId,
        serverUrl: '', distribution: '', kubeconfig: '', token: '', caCert: '',
      });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const submitRotate = async () => {
    if (!selectedCluster?.id || !selectedCluster.revision) return;
    try {
      await rotateCredential.mutateAsync({
        clusterId: selectedCluster.id,
        expectedRevision: selectedCluster.revision,
        credential: buildCredential(
          credentialMode,
          rotateForm.kubeconfig.trim(),
          rotateForm.token.trim(),
          rotateForm.caCert.trim(),
        ),
      });
      toast.success('凭据轮换成功，旧凭据已进入延迟清理队列');
      setRotateOpen(false);
      setRotateForm({ kubeconfig: '', token: '', caCert: '' });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const submitNamespace = async () => {
    if (!selectedCluster?.id || !namespaceForm.name.trim()) return;
    try {
      await createNamespace.mutateAsync({
        clusterId: selectedCluster.id,
        body: {
          name: namespaceForm.name.trim(),
          displayName: namespaceForm.displayName.trim() || undefined,
          description: namespaceForm.description.trim() || undefined,
          visibility: namespaceForm.visibility as 'NAMESPACE_VISIBILITY_PRIVATE' | 'NAMESPACE_VISIBILITY_PUBLIC',
        },
      });
      toast.success(`Namespace ${namespaceForm.name} 已创建`);
      setNamespaceForm({ name: '', displayName: '', description: '', visibility: 'NAMESPACE_VISIBILITY_PRIVATE' });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const handleProbe = async (cluster: V1Cluster) => {
    if (!cluster.id) return;
    try {
      await probeCluster.mutateAsync(cluster.id);
      toast.success('集群探测完成');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const handleDeleteCluster = async (cluster: V1Cluster) => {
    if (!cluster.id || !window.confirm(`确定从 AISphere 移除集群「${cluster.displayName || cluster.name}」？远端 Namespace 不会被删除。`)) return;
    try {
      await deleteCluster.mutateAsync(cluster.id);
      toast.success('集群已从 AISphere 移除');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const toggleVisibility = async (namespace: V1Namespace) => {
    if (!namespace.id || !selectedCluster?.id) return;
    const next = namespace.visibility === 'NAMESPACE_VISIBILITY_PUBLIC'
      ? 'NAMESPACE_VISIBILITY_PRIVATE'
      : 'NAMESPACE_VISIBILITY_PUBLIC';
    try {
      await updateVisibility.mutateAsync({
        id: namespace.id,
        clusterId: selectedCluster.id,
        body: { visibility: next },
      });
      toast.success(next.endsWith('PUBLIC') ? 'Namespace 已公开' : 'Namespace 已设为私有');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const removeNamespace = async (namespace: V1Namespace) => {
    if (!namespace.id || !selectedCluster?.id || !window.confirm(`确定解绑 Namespace「${namespace.name}」？远端资源默认保留。`)) return;
    try {
      await deleteNamespace.mutateAsync({ id: namespace.id, clusterId: selectedCluster.id });
      toast.success('Namespace 已解绑');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm"><Server className="h-4 w-4" /> Kubernetes 集群环境</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">接入外部集群、探测连通性、轮换凭据，并管理 AISphere Namespace。</p>
            </div>
            <Button size="sm" onClick={() => setCreateClusterOpen(true)}><Plus className="mr-1 h-3.5 w-3.5" />接入集群</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {clustersQuery.isLoading ? <div className="p-4"><Skeleton className="h-32 w-full" /></div> : (
            <Table>
              <TableHeader><TableRow><TableHead>集群</TableHead><TableHead>状态</TableHead><TableHead>版本</TableHead><TableHead>API Server</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
              <TableBody>
                {clusters.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">还没有接入 Kubernetes 集群</TableCell></TableRow>
                ) : clusters.map((cluster) => (
                  <TableRow key={cluster.id} className={selectedClusterId === cluster.id ? 'bg-muted/40' : undefined} onClick={() => setSelectedClusterId(cluster.id || null)}>
                    <TableCell><div className="font-medium">{cluster.displayName || cluster.name}</div><div className="text-xs text-muted-foreground">{cluster.name} · {cluster.distribution || 'Kubernetes'}</div></TableCell>
                    <TableCell><Badge variant={statusVariant(cluster.status)}>{cluster.status || 'UNKNOWN'}</Badge>{cluster.healthMessage && <div className="mt-1 max-w-48 truncate text-xs text-muted-foreground" title={cluster.healthMessage}>{cluster.healthMessage}</div>}</TableCell>
                    <TableCell className="text-xs">{cluster.kubernetesVersion || '-'}</TableCell>
                    <TableCell className="max-w-64 truncate font-mono text-xs" title={cluster.serverUrl}>{cluster.serverUrl}</TableCell>
                    <TableCell><div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={(event) => { event.stopPropagation(); void handleProbe(cluster); }} title="重新探测"><RefreshCw className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" onClick={(event) => { event.stopPropagation(); setSelectedClusterId(cluster.id || null); setRotateOpen(true); }} title="轮换凭据"><KeyRound className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={(event) => { event.stopPropagation(); void handleDeleteCluster(cluster); }} title="移除集群"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedCluster && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader className="pb-3"><div className="flex items-center justify-between gap-2"><CardTitle className="flex items-center gap-2 text-sm"><Network className="h-4 w-4" />{selectedCluster.displayName || selectedCluster.name} / Namespaces</CardTitle><Button variant="outline" size="sm" onClick={() => selectedCluster.id && syncNamespaces.mutate(selectedCluster.id, { onSuccess: () => toast.success('Namespace 同步完成'), onError: (error) => toast.error(errorMessage(error)) })}><RefreshCw className="mr-1 h-3.5 w-3.5" />同步远端</Button></div></CardHeader>
            <CardContent className="p-0">
              {namespacesQuery.isLoading ? <div className="p-4"><Skeleton className="h-32 w-full" /></div> : (
                <Table>
                  <TableHeader><TableRow><TableHead>名称</TableHead><TableHead>生命周期</TableHead><TableHead>可见性</TableHead><TableHead>同步状态</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {namespaces.length === 0 ? <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">暂无受管 Namespace</TableCell></TableRow> : namespaces.map((namespace) => (
                      <TableRow key={namespace.id}>
                        <TableCell><div className="font-medium">{namespace.displayName || namespace.name}</div><div className="text-xs text-muted-foreground">{namespace.name}</div></TableCell>
                        <TableCell><Badge variant={statusVariant(namespace.lifecycle)}>{namespace.lifecycle || 'UNKNOWN'}</Badge></TableCell>
                        <TableCell><Badge variant="outline">{namespace.effectiveVisibility || namespace.visibility}</Badge></TableCell>
                        <TableCell><Badge variant={statusVariant(namespace.visibilitySyncStatusEnum || namespace.visibilitySyncStatus)}>{namespace.visibilitySyncStatusEnum || namespace.visibilitySyncStatus || '-'}</Badge></TableCell>
                        <TableCell><div className="flex justify-end gap-1"><Button variant="outline" size="sm" onClick={() => void toggleVisibility(namespace)}>{namespace.visibility === 'NAMESPACE_VISIBILITY_PUBLIC' ? '设为私有' : '公开'}</Button><Button variant="ghost" size="sm" className="text-destructive" onClick={() => void removeNamespace(namespace)}><Trash2 className="h-3.5 w-3.5" /></Button></div></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">创建 Namespace</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5"><Label>名称</Label><Input value={namespaceForm.name} onChange={(event) => setNamespaceForm({ ...namespaceForm, name: event.target.value })} placeholder="agent-runtime" /></div>
              <div className="space-y-1.5"><Label>显示名称</Label><Input value={namespaceForm.displayName} onChange={(event) => setNamespaceForm({ ...namespaceForm, displayName: event.target.value })} /></div>
              <div className="space-y-1.5"><Label>描述</Label><Textarea value={namespaceForm.description} onChange={(event) => setNamespaceForm({ ...namespaceForm, description: event.target.value })} rows={2} /></div>
              <div className="space-y-1.5"><Label>可见性</Label><Select value={namespaceForm.visibility} onValueChange={(visibility) => setNamespaceForm({ ...namespaceForm, visibility })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NAMESPACE_VISIBILITY_PRIVATE">私有</SelectItem><SelectItem value="NAMESPACE_VISIBILITY_PUBLIC">平台公开</SelectItem></SelectContent></Select></div>
              <Button className="w-full" disabled={!namespaceForm.name.trim() || createNamespace.isPending} onClick={() => void submitNamespace()}><Plus className="mr-1 h-3.5 w-3.5" />创建</Button>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={createClusterOpen} onOpenChange={setCreateClusterOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>接入 Kubernetes 集群</DialogTitle><DialogDescription>凭据仅在本次请求中传输，Hub 使用 AEAD 加密后保存，后续接口不会返回明文。</DialogDescription></DialogHeader>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5"><Label>资源名称 *</Label><Input value={clusterForm.name} onChange={(event) => setClusterForm({ ...clusterForm, name: event.target.value })} placeholder="prod-cluster" /></div>
            <div className="space-y-1.5"><Label>显示名称</Label><Input value={clusterForm.displayName} onChange={(event) => setClusterForm({ ...clusterForm, displayName: event.target.value })} /></div>
            <div className="space-y-1.5"><Label>组织 ID *</Label><Input value={clusterForm.orgId} onChange={(event) => setClusterForm({ ...clusterForm, orgId: event.target.value })} /></div>
            <div className="space-y-1.5"><Label>发行版</Label><Input value={clusterForm.distribution} onChange={(event) => setClusterForm({ ...clusterForm, distribution: event.target.value })} placeholder="kubernetes / rke2 / openshift" /></div>
            <div className="space-y-1.5 md:col-span-2"><Label>API Server *</Label><Input value={clusterForm.serverUrl} onChange={(event) => setClusterForm({ ...clusterForm, serverUrl: event.target.value })} placeholder="https://kube-api.example.com:6443" /></div>
            <div className="space-y-1.5 md:col-span-2"><Label>描述</Label><Textarea value={clusterForm.description} onChange={(event) => setClusterForm({ ...clusterForm, description: event.target.value })} rows={2} /></div>
            <CredentialFields mode={credentialMode} onModeChange={setCredentialMode} kubeconfig={clusterForm.kubeconfig} token={clusterForm.token} caCert={clusterForm.caCert} onChange={(patch) => setClusterForm({ ...clusterForm, ...patch })} />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCreateClusterOpen(false)}>取消</Button><Button onClick={() => void submitCluster()} disabled={createCluster.isPending}>{createCluster.isPending ? '接入中…' : '接入并探测'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rotateOpen} onOpenChange={setRotateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>轮换集群凭据</DialogTitle><DialogDescription>新凭据会先进行探测和 Cluster UID 校验，成功后才通过 CAS 切换。</DialogDescription></DialogHeader>
          <CredentialFields mode={credentialMode} onModeChange={setCredentialMode} kubeconfig={rotateForm.kubeconfig} token={rotateForm.token} caCert={rotateForm.caCert} onChange={(patch) => setRotateForm({ ...rotateForm, ...patch })} />
          <DialogFooter><Button variant="outline" onClick={() => setRotateOpen(false)}>取消</Button><Button onClick={() => void submitRotate()} disabled={rotateCredential.isPending}>{rotateCredential.isPending ? '验证中…' : '验证并轮换'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CredentialFields({
  mode,
  onModeChange,
  kubeconfig,
  token,
  caCert,
  onChange,
}: {
  mode: 'kubeconfig' | 'service-account';
  onModeChange: (mode: 'kubeconfig' | 'service-account') => void;
  kubeconfig: string;
  token: string;
  caCert: string;
  onChange: (patch: { kubeconfig?: string; token?: string; caCert?: string }) => void;
}) {
  return (
    <div className="space-y-3 md:col-span-2">
      <div className="space-y-1.5"><Label>凭据类型</Label><Select value={mode} onValueChange={(value) => onModeChange(value as 'kubeconfig' | 'service-account')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="kubeconfig">Kubeconfig</SelectItem><SelectItem value="service-account">ServiceAccount Token</SelectItem></SelectContent></Select></div>
      {mode === 'kubeconfig' ? (
        <div className="space-y-1.5"><Label>Kubeconfig *</Label><Textarea className="min-h-52 font-mono text-xs" value={kubeconfig} onChange={(event) => onChange({ kubeconfig: event.target.value })} placeholder="apiVersion: v1…" /></div>
      ) : (
        <><div className="space-y-1.5"><Label>Bearer Token *</Label><Textarea className="min-h-28 font-mono text-xs" value={token} onChange={(event) => onChange({ token: event.target.value })} /></div><div className="space-y-1.5"><Label>CA Certificate（可选）</Label><Textarea className="min-h-32 font-mono text-xs" value={caCert} onChange={(event) => onChange({ caCert: event.target.value })} placeholder="-----BEGIN CERTIFICATE-----" /></div></>
      )}
    </div>
  );
}
