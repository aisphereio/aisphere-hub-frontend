'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Share2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
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
import {
  namespaceServiceCreateNamespaceShare,
  namespaceServiceDeleteNamespaceShare,
  namespaceServiceListNamespaces,
  namespaceServiceListNamespaceShares,
} from '@/lib/api/generated/namespace-service/namespace-service';
import { V1NamespaceShareRelation } from '@/lib/api/generated/model';
import type { V1NamespaceShareRelation as NamespaceShareRelation } from '@/lib/api/generated/model';

type ShareForm = {
  subjectType: string;
  subjectId: string;
  relation: NamespaceShareRelation;
};

const defaultShareForm: ShareForm = {
  subjectType: 'user',
  subjectId: '',
  relation: V1NamespaceShareRelation.NAMESPACE_SHARE_RELATION_VIEWER,
};

export function NamespaceSharesDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [namespaceId, setNamespaceId] = useState('');
  const [form, setForm] = useState<ShareForm>(defaultShareForm);

  const namespacesQuery = useQuery({
    queryKey: ['kubernetes', 'namespaces', 'shareable'],
    queryFn: () => namespaceServiceListNamespaces({ pageSize: 200 }),
    enabled: open,
  });
  const namespaces = namespacesQuery.data?.namespaces ?? [];
  const effectiveNamespaceId = namespaces.some((namespace) => namespace.id === namespaceId)
    ? namespaceId
    : namespaces.find((namespace) => namespace.permissions?.canShare)?.id ?? '';

  const sharesQueryKey = ['kubernetes', 'namespace-shares', effectiveNamespaceId] as const;
  const sharesQuery = useQuery({
    queryKey: sharesQueryKey,
    queryFn: () => namespaceServiceListNamespaceShares(effectiveNamespaceId),
    enabled: open && Boolean(effectiveNamespaceId),
  });
  const shares = sharesQuery.data?.shares ?? [];

  const createShare = useMutation({
    mutationFn: () => namespaceServiceCreateNamespaceShare(effectiveNamespaceId, {
      relation: form.relation,
      subjectType: form.subjectType.trim(),
      subjectId: form.subjectId.trim(),
    }),
    onSuccess: async () => {
      toast.success('Namespace 分享权限已添加');
      setForm(defaultShareForm);
      await queryClient.invalidateQueries({ queryKey: sharesQueryKey });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : '添加分享权限失败'),
  });

  const deleteShare = useMutation({
    mutationFn: (share: { relation?: NamespaceShareRelation; subjectType?: string; subjectId?: string }) =>
      namespaceServiceDeleteNamespaceShare(
        effectiveNamespaceId,
        share.relation ?? V1NamespaceShareRelation.NAMESPACE_SHARE_RELATION_VIEWER,
        share.subjectType ?? '',
        share.subjectId ?? '',
      ),
    onSuccess: async () => {
      toast.success('Namespace 分享权限已移除');
      await queryClient.invalidateQueries({ queryKey: sharesQueryKey });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : '移除分享权限失败'),
  });

  const shareableNamespaces = namespaces.filter((namespace) => namespace.permissions?.canShare);
  const canSubmit = Boolean(effectiveNamespaceId && form.subjectType.trim() && form.subjectId.trim());

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" title="Namespace 分享权限">
          <Share2 className="h-3.5 w-3.5 lg:mr-1" />
          <span className="hidden lg:inline">Namespace 分享</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Namespace 分享权限</DialogTitle>
          <DialogDescription>把 Kubernetes Namespace 以 viewer、user 或 editor 关系分享给指定主体。</DialogDescription>
        </DialogHeader>

        {namespacesQuery.isLoading ? <Skeleton className="h-44" /> : shareableNamespaces.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            当前账号没有可分享的 Kubernetes Namespace。
          </div>
        ) : (
          <div className="space-y-4">
            <Select value={effectiveNamespaceId} onValueChange={setNamespaceId}>
              <SelectTrigger><SelectValue placeholder="选择 Namespace" /></SelectTrigger>
              <SelectContent>
                {shareableNamespaces.map((namespace) => (
                  <SelectItem key={namespace.id} value={namespace.id ?? ''}>
                    {namespace.displayName || namespace.name} · {namespace.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="grid grid-cols-1 md:grid-cols-[140px_1fr_150px_auto] gap-2">
              <Select value={form.subjectType} onValueChange={(subjectType) => setForm({ ...form, subjectType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">用户</SelectItem>
                  <SelectItem value="group">用户组</SelectItem>
                  <SelectItem value="service_account">服务账号</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="主体 ID" value={form.subjectId} onChange={(event) => setForm({ ...form, subjectId: event.target.value })} />
              <Select value={form.relation} onValueChange={(relation) => setForm({ ...form, relation: relation as NamespaceShareRelation })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={V1NamespaceShareRelation.NAMESPACE_SHARE_RELATION_VIEWER}>viewer</SelectItem>
                  <SelectItem value={V1NamespaceShareRelation.NAMESPACE_SHARE_RELATION_USER}>user</SelectItem>
                  <SelectItem value={V1NamespaceShareRelation.NAMESPACE_SHARE_RELATION_EDITOR}>editor</SelectItem>
                </SelectContent>
              </Select>
              <Button disabled={!canSubmit || createShare.isPending} onClick={() => createShare.mutate()}>添加</Button>
            </div>

            <div className="rounded-md border divide-y max-h-64 overflow-auto">
              {sharesQuery.isLoading ? <Skeleton className="h-32" /> : shares.map((share) => (
                <div key={share.id || `${share.subjectType}:${share.subjectId}:${share.relation}`} className="flex items-center gap-3 px-3 py-2">
                  <Badge variant="outline" className="font-mono text-[10px]">{share.relation}</Badge>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium truncate">{share.subjectId}</div>
                    <div className="text-[10px] text-muted-foreground">{share.subjectType} · {share.syncStatus || 'SYNCED'}</div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    disabled={deleteShare.isPending}
                    onClick={() => deleteShare.mutate(share)}
                    title="移除分享"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              {!sharesQuery.isLoading && shares.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">当前 Namespace 没有定向分享关系。</div>
              ) : null}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
