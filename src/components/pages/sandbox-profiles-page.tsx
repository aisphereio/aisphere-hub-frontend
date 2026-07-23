'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Boxes, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/shared';
import { useMe } from '@/hooks/use-auth';
import {
  useCreateSandboxTemplate,
  useDeleteSandboxTemplate,
  useSandboxTemplates,
} from '@/hooks/use-sandboxes';
import { clusterServiceListClusters } from '@/lib/api/generated/cluster-service/cluster-service';
import { V1SandboxTemplateStatus } from '@/lib/api/generated/model';
import type { V1SandboxTemplate } from '@/lib/api/generated/model';

/**
 * SandboxTemplate management page (formerly "Sandbox Profiles").
 *
 * Templates are cluster-scoped reusable Pod templates that map to the K8s
 * SandboxTemplate CRD. The console lists them per cluster and offers a
 * create form (name / display name / image / container command). The
 * container command is entered as a JSON array string, e.g.
 *   ["/bin/sh", "-c", "sleep infinity"]
 * and stored verbatim in the template's containerCommand field.
 */
export function SandboxProfilesPage() {
  const { data: principal } = useMe();
  const principalId =
    (principal?.id as string | undefined) ||
    (principal?.subjectId as string | undefined) ||
    (principal?.sub as string | undefined) ||
    '';

  // ── Cluster selector ────────────────────────────────────────────────────
  const clustersQuery = useQuery({
    queryKey: ['kubernetes', 'clusters'],
    queryFn: () => clusterServiceListClusters({ pageSize: 100 }),
  });
  const clusters = clustersQuery.data?.clusters ?? [];

  const [selectedClusterId, setSelectedClusterId] = useState('');
  const activeClusterId = clusters.some((c) => c.id === selectedClusterId)
    ? selectedClusterId
    : clusters[0]?.id ?? '';

  // ── Templates (cluster-scoped) ──────────────────────────────────────────
  const templatesQuery = useSandboxTemplates(activeClusterId);
  const templates = templatesQuery.data?.templates ?? [];

  // ── Create form ─────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    name: '',
    displayName: '',
    image: '',
    containerCommand: '["/bin/sh","-c","sleep infinity"]',
  });

  const createTemplate = useCreateSandboxTemplate();
  const deleteTemplate = useDeleteSandboxTemplate();

  const canCreate = Boolean(
    activeClusterId && form.name.trim() && form.image.trim(),
  );

  const handleCreate = () => {
    if (!canCreate) return;
    createTemplate.mutate(
      {
        clusterId: activeClusterId,
        name: form.name.trim(),
        displayName: form.displayName.trim() || undefined,
        image: form.image.trim(),
        containerCommand: form.containerCommand.trim() || undefined,
        ownerId: principalId || undefined,
        ownerType: principalId ? 'user' : undefined,
      },
      {
        onSuccess: (tpl) => {
          toast.success(`模板 ${tpl.displayName || tpl.name || ''} 已创建`);
          setForm({
            name: '',
            displayName: '',
            image: '',
            containerCommand: '["/bin/sh","-c","sleep infinity"]',
          });
        },
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : '创建模板失败'),
      },
    );
  };

  const handleDelete = (tpl: V1SandboxTemplate) => {
    if (!activeClusterId || !tpl.id) return;
    deleteTemplate.mutate(
      {
        clusterId: activeClusterId,
        id: tpl.id,
        expectedRevision: tpl.revision,
      },
      {
        onSuccess: () => {
          toast.success(`模板 ${tpl.displayName || tpl.name || ''} 已删除`);
        },
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : '删除模板失败'),
      },
    );
  };

  /** Shorten a template status enum for display. */
  const statusLabel = (status?: string) =>
    status ? status.replace(/^SANDBOX_TEMPLATE_STATUS_/, '') : 'UNKNOWN';

  /** Badge variant for a template status. */
  const statusVariant = (
    status?: string,
  ): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (status === V1SandboxTemplateStatus.SANDBOX_TEMPLATE_STATUS_READY)
      return 'default';
    if (
      status === V1SandboxTemplateStatus.SANDBOX_TEMPLATE_STATUS_FAILED ||
      status === V1SandboxTemplateStatus.SANDBOX_TEMPLATE_STATUS_DELETED
    )
      return 'destructive';
    if (status === V1SandboxTemplateStatus.SANDBOX_TEMPLATE_STATUS_CREATING)
      return 'secondary';
    return 'outline';
  };

  return (
    <div className="h-full overflow-auto p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Boxes className="h-5 w-5" /> 沙箱模板
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            管理集群级沙箱模板（Pod 模板 CRD），供沙箱实例与预热池引用。
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            activeClusterId &&
            templatesQuery.refetch()
          }
          disabled={!activeClusterId || templatesQuery.isFetching}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 mr-1 ${
              templatesQuery.isFetching ? 'animate-spin' : ''
            }`}
          />
          刷新
        </Button>
      </div>

      {/* ── Cluster selector ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">集群</CardTitle></CardHeader>
        <CardContent>
          {clustersQuery.isLoading ? (
            <Skeleton className="h-9" />
          ) : (
            <Select value={activeClusterId} onValueChange={setSelectedClusterId}>
              <SelectTrigger><SelectValue placeholder="选择集群" /></SelectTrigger>
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

      <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-4">
        {/* ── Create template form ────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Plus className="h-4 w-4" /> 创建模板
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="模板标识，如 python-runtime"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <Input
                placeholder="展示名称"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              />
            </div>
            <Input
              placeholder="容器镜像，如 aisphere/python-runtime:latest"
              value={form.image}
              onChange={(e) => setForm({ ...form, image: e.target.value })}
            />
            <Textarea
              className="font-mono text-xs"
              rows={3}
              placeholder='容器命令（JSON 数组），如 ["/bin/sh","-c","sleep infinity"]'
              value={form.containerCommand}
              onChange={(e) =>
                setForm({ ...form, containerCommand: e.target.value })
              }
            />
            <Button
              className="w-full"
              onClick={handleCreate}
              disabled={!canCreate || createTemplate.isPending}
            >
              <Plus className="h-4 w-4 mr-1" /> 创建模板
            </Button>
          </CardContent>
        </Card>

        {/* ── Template list ───────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>模板列表</span>
              <Badge variant="secondary">{templates.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {templatesQuery.isLoading ? (
              <Skeleton className="h-44" />
            ) : templates.length === 0 ? (
              <EmptyState
                icon={<Boxes className="h-10 w-10" />}
                title="暂无模板"
                description="在左侧表单创建一个沙箱模板。"
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {templates.map((tpl) => (
                  <Card key={tpl.id} className="border-border/50">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">
                            {tpl.displayName || tpl.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono truncate">
                            {tpl.name}
                          </div>
                        </div>
                        <Badge variant={statusVariant(tpl.status)}>
                          {statusLabel(tpl.status)}
                        </Badge>
                      </div>
                      <div className="text-xs font-mono break-all text-muted-foreground">
                        {tpl.image || '-'}
                      </div>
                      {tpl.containerCommand ? (
                        <div className="text-[11px] font-mono break-all text-muted-foreground line-clamp-2">
                          {tpl.containerCommand}
                        </div>
                      ) : null}
                      {tpl.healthMessage ? (
                        <div className="text-[10px] text-destructive">
                          {tpl.healthMessage}
                        </div>
                      ) : null}
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          if (
                            window.confirm(
                              `确认删除模板 ${tpl.displayName || tpl.name}？`,
                            )
                          )
                            handleDelete(tpl);
                        }}
                        disabled={deleteTemplate.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> 删除
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
