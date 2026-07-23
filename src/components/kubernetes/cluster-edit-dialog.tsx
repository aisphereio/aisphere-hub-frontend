'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { clusterServiceUpdateCluster } from '@/lib/api/generated/cluster-service/cluster-service';
import type {
  ClusterServiceUpdateClusterBody,
  V1Cluster,
  V1ClusterLabels,
} from '@/lib/api/generated/model';

type ClusterEditDialogProps = {
  cluster: V1Cluster;
};

export type ClusterEditForm = {
  displayName: string;
  description: string;
  distribution: string;
  labels: string;
};

const clusterQueryKey = ['kubernetes', 'clusters'] as const;

function stableLabels(labels?: V1ClusterLabels): V1ClusterLabels {
  return Object.fromEntries(
    Object.entries(labels ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key.trim(), value.trim()]),
  );
}

export function formatClusterLabels(labels?: V1ClusterLabels): string {
  return Object.entries(stableLabels(labels))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
}

export function parseClusterLabels(value: string): V1ClusterLabels {
  const labels: V1ClusterLabels = {};

  value.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;

    const separator = line.indexOf('=');
    if (separator <= 0) {
      throw new Error(`第 ${index + 1} 行标签格式错误，应为 key=value`);
    }

    const key = line.slice(0, separator).trim();
    const labelValue = line.slice(separator + 1).trim();
    if (!key) {
      throw new Error(`第 ${index + 1} 行标签键不能为空`);
    }
    if (Object.prototype.hasOwnProperty.call(labels, key)) {
      throw new Error(`标签 ${key} 重复`);
    }
    labels[key] = labelValue;
  });

  return stableLabels(labels);
}

function formFromCluster(cluster: V1Cluster): ClusterEditForm {
  return {
    displayName: cluster.displayName ?? '',
    description: cluster.description ?? '',
    distribution: cluster.distribution ?? '',
    labels: formatClusterLabels(cluster.labels),
  };
}

export function buildClusterUpdateBody(
  cluster: V1Cluster,
  form: ClusterEditForm,
): ClusterServiceUpdateClusterBody | null {
  const labels = parseClusterLabels(form.labels);
  const updateMask: string[] = [];
  const patch: V1Cluster = {};

  const displayName = form.displayName.trim();
  if (displayName !== (cluster.displayName ?? '')) {
    updateMask.push('displayName');
    patch.displayName = displayName;
  }

  const description = form.description.trim();
  if (description !== (cluster.description ?? '')) {
    updateMask.push('description');
    patch.description = description;
  }

  const distribution = form.distribution.trim();
  if (distribution !== (cluster.distribution ?? '')) {
    updateMask.push('distribution');
    patch.distribution = distribution;
  }

  if (JSON.stringify(labels) !== JSON.stringify(stableLabels(cluster.labels))) {
    updateMask.push('labels');
    patch.labels = labels;
  }

  if (updateMask.length === 0) return null;

  return {
    expectedRevision: cluster.revision ?? '0',
    updateMask: updateMask.join(','),
    cluster: patch,
  };
}

export function ClusterEditDialog({ cluster }: ClusterEditDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ClusterEditForm>(() => formFromCluster(cluster));

  const updateState = useMemo(() => {
    try {
      return {
        body: buildClusterUpdateBody(cluster, form),
        error: '',
      };
    } catch (error) {
      return {
        body: null,
        error: error instanceof Error ? error.message : '标签格式错误',
      };
    }
  }, [cluster, form]);

  const updateCluster = useMutation({
    mutationFn: () => {
      if (!cluster.id || !updateState.body) throw new Error('没有需要保存的修改');
      return clusterServiceUpdateCluster(cluster.id, updateState.body);
    },
    onSuccess: async () => {
      toast.success(`集群 ${form.displayName || cluster.name || ''} 已更新`);
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: clusterQueryKey });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '集群更新失败';
      toast.error(message.includes('REVISION_CONFLICT')
        ? '集群信息已被其他操作更新，请刷新后重试'
        : message);
    },
  });

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) setForm(formFromCluster(cluster));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          title="编辑集群"
          onClick={(event) => event.stopPropagation()}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl" onClick={(event) => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>编辑集群</DialogTitle>
          <DialogDescription>
            修改 AISphere 中的集群元数据。集群标识、组织、API Server 和凭据需要通过专用流程变更。
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <div className="text-xs font-medium">集群标识</div>
            <Input value={cluster.name ?? ''} disabled />
          </div>
          <div className="space-y-1.5">
            <div className="text-xs font-medium">组织 / Zone</div>
            <Input value={cluster.orgId ?? ''} disabled />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="text-xs font-medium">API Server</div>
          <Input value={cluster.serverUrl ?? ''} disabled className="font-mono text-xs" />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <div className="text-xs font-medium">展示名称</div>
            <Input
              value={form.displayName}
              placeholder="展示名称"
              onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <div className="text-xs font-medium">发行版</div>
            <Input
              value={form.distribution}
              placeholder="例如 k3s / rke2 / eks"
              onChange={(event) => setForm((current) => ({ ...current, distribution: event.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="text-xs font-medium">说明</div>
          <Textarea
            rows={3}
            value={form.description}
            placeholder="集群用途、环境或维护说明"
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          />
        </div>

        <div className="space-y-1.5">
          <div className="text-xs font-medium">标签</div>
          <Textarea
            rows={5}
            className="font-mono text-xs"
            value={form.labels}
            placeholder={'environment=production\nregion=cn-north-1'}
            onChange={(event) => setForm((current) => ({ ...current, labels: event.target.value }))}
          />
          <div className={updateState.error ? 'text-xs text-destructive' : 'text-[11px] text-muted-foreground'}>
            {updateState.error || '每行一个标签，格式为 key=value；留空可清除全部标签。'}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={updateCluster.isPending}>
            取消
          </Button>
          <Button
            disabled={!updateState.body || Boolean(updateState.error) || updateCluster.isPending}
            onClick={() => updateCluster.mutate()}
          >
            {updateCluster.isPending ? '保存中…' : '保存修改'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
