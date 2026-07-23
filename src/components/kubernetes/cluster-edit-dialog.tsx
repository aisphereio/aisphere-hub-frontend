'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Save } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  clusterServiceListClusters,
  clusterServiceUpdateCluster,
} from '@/lib/api/generated/cluster-service/cluster-service';
import type { V1Cluster } from '@/lib/api/generated/model';

const clusterQueryKey = ['kubernetes', 'clusters'] as const;

type EditableClusterField = 'displayName' | 'description' | 'distribution';

type ClusterEditFormState = Record<EditableClusterField, string>;

function initialForm(cluster: V1Cluster): ClusterEditFormState {
  return {
    displayName: cluster.displayName ?? '',
    description: cluster.description ?? '',
    distribution: cluster.distribution ?? '',
  };
}

function changedFields(cluster: V1Cluster, form: ClusterEditFormState): EditableClusterField[] {
  return (['displayName', 'description', 'distribution'] as const).filter(
    (field) => form[field].trim() !== (cluster[field] ?? '').trim(),
  );
}

function updateErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('REVISION_CONFLICT')) {
    return '集群信息已被其他操作更新，请刷新后重试';
  }
  return message || '集群信息更新失败';
}

function ClusterEditForm({ cluster, onSaved }: { cluster: V1Cluster; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ClusterEditFormState>(() => initialForm(cluster));
  const fields = changedFields(cluster, form);

  const updateCluster = useMutation({
    mutationFn: () => clusterServiceUpdateCluster(cluster.id ?? '', {
      expectedRevision: cluster.revision ?? '0',
      // FieldMask uses protobuf JSON lowerCamelCase; the gateway converts it
      // back to the backend's snake_case proto paths.
      updateMask: fields.join(','),
      cluster: {
        displayName: form.displayName.trim(),
        description: form.description.trim(),
        distribution: form.distribution.trim(),
      },
    }),
    onSuccess: async () => {
      toast.success(`集群 ${form.displayName.trim() || cluster.name || ''} 已更新`);
      await queryClient.invalidateQueries({ queryKey: clusterQueryKey });
      onSaved();
    },
    onError: (error) => toast.error(updateErrorMessage(error)),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="cluster-edit-name" className="text-xs font-medium">集群标识</label>
          <Input id="cluster-edit-name" value={cluster.name ?? ''} disabled />
          <p className="text-[10px] text-muted-foreground">创建后不可修改</p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="cluster-edit-org" className="text-xs font-medium">组织 / Zone ID</label>
          <Input id="cluster-edit-org" value={cluster.orgId ?? ''} disabled />
          <p className="text-[10px] text-muted-foreground">集群归属不可迁移</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="cluster-edit-display-name" className="text-xs font-medium">展示名称</label>
        <Input
          id="cluster-edit-display-name"
          placeholder="展示名称"
          value={form.displayName}
          onChange={(event) => setForm({ ...form, displayName: event.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="cluster-edit-distribution" className="text-xs font-medium">发行版</label>
        <Input
          id="cluster-edit-distribution"
          placeholder="例如 k3s / rke2 / eks"
          value={form.distribution}
          onChange={(event) => setForm({ ...form, distribution: event.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="cluster-edit-description" className="text-xs font-medium">说明</label>
        <Textarea
          id="cluster-edit-description"
          rows={3}
          placeholder="集群用途、环境或维护说明"
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="cluster-edit-server-url" className="text-xs font-medium">API Server</label>
        <Input id="cluster-edit-server-url" value={cluster.serverUrl ?? ''} disabled className="font-mono text-xs" />
        <p className="text-[10px] text-muted-foreground">
          API Server 属于集群身份信息；连接凭据请使用页面中的“轮换集群凭据”。
        </p>
      </div>

      <Button
        className="w-full"
        disabled={fields.length === 0 || updateCluster.isPending}
        onClick={() => updateCluster.mutate()}
      >
        <Save className="mr-1 h-4 w-4" />
        {updateCluster.isPending ? '保存中…' : fields.length === 0 ? '没有待保存修改' : '保存修改'}
      </Button>
    </div>
  );
}

export function ClusterEditDialog() {
  const [open, setOpen] = useState(false);
  const [selectedClusterId, setSelectedClusterId] = useState('');

  const clustersQuery = useQuery({
    queryKey: clusterQueryKey,
    queryFn: () => clusterServiceListClusters({ pageSize: 100 }),
    enabled: open,
  });
  const editableClusters = (clustersQuery.data?.clusters ?? []).filter(
    (cluster) => cluster.id && cluster.permissions?.canOperate,
  );
  const effectiveClusterId = editableClusters.some((cluster) => cluster.id === selectedClusterId)
    ? selectedClusterId
    : editableClusters[0]?.id ?? '';
  const selectedCluster = editableClusters.find((cluster) => cluster.id === effectiveClusterId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" title="编辑已有集群">
          <Pencil className="h-3.5 w-3.5 lg:mr-1" />
          <span className="hidden lg:inline">编辑集群</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>编辑已有集群</DialogTitle>
          <DialogDescription>
            修改集群展示信息。集群身份、API Server 与组织归属保持不可变，凭据通过轮换流程更新。
          </DialogDescription>
        </DialogHeader>

        {clustersQuery.isLoading ? (
          <Skeleton className="h-80" />
        ) : editableClusters.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            当前账号没有可编辑的 Kubernetes 集群。
          </div>
        ) : (
          <div className="space-y-4">
            <Select value={effectiveClusterId} onValueChange={setSelectedClusterId}>
              <SelectTrigger>
                <SelectValue placeholder="选择要编辑的集群" />
              </SelectTrigger>
              <SelectContent>
                {editableClusters.map((cluster) => (
                  <SelectItem key={cluster.id} value={cluster.id ?? ''}>
                    {cluster.displayName || cluster.name} · {cluster.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedCluster ? (
              <ClusterEditForm
                key={`${selectedCluster.id}:${selectedCluster.revision}`}
                cluster={selectedCluster}
                onSaved={() => setOpen(false)}
              />
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
