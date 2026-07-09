'use client';

import { useState } from 'react';
import { Globe, Loader2, Lock, Search, Share2, Trash2, User, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useGrantSkillShare,
  useRevokeSkillShare,
  useSkillShares,
  useSkillShareTargets,
  useUpdateSkillPublicVisibility,
  type SkillShareTarget,
} from '@/hooks/use-skill-sharing';
import type { ResourceGrant, ShareRole, Skill } from '@/lib/api/types';
import { toast } from 'sonner';

type GrantableRole = Extract<ShareRole, 'viewer' | 'editor'>;

interface SkillShareDialogProps {
  skill: Skill | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

function targetIcon(target: Pick<SkillShareTarget, 'subjectType'>) {
  return target.subjectType === 'group' ? <Users className="h-4 w-4" /> : <User className="h-4 w-4" />;
}

function grantLabel(grant: ResourceGrant): string {
  if (grant.subjectType === 'public') return '所有登录用户';
  return grant.subjectName || grant.metadata?.displayName || grant.subjectId;
}

function grantIcon(grant: ResourceGrant) {
  if (grant.subjectType === 'public') return <Globe className="h-4 w-4" />;
  if (grant.subjectType === 'group') return <Users className="h-4 w-4" />;
  return <User className="h-4 w-4" />;
}

export function SkillShareDialog({ skill, open, onOpenChange, onChanged }: SkillShareDialogProps) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<GrantableRole>('viewer');
  const skillName = skill?.name || null;
  const isPublic = (skill?.scope || skill?.visibility || 'private').toLowerCase() === 'public';

  const sharesQuery = useSkillShares(skillName);
  const targetsQuery = useSkillShareTargets(open, query);
  const grantMutation = useGrantSkillShare(skillName);
  const revokeMutation = useRevokeSkillShare(skillName);
  const visibilityMutation = useUpdateSkillPublicVisibility(skillName);

  const grants = sharesQuery.data?.items || [];
  const targets = targetsQuery.data || [];

  const handleGrant = async (target: SkillShareTarget) => {
    try {
      await grantMutation.mutateAsync({ target, role });
      toast.success(`已分享给 ${target.displayName}`);
      onChanged?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '分享失败');
    }
  };

  const handleRevoke = async (grant: ResourceGrant) => {
    try {
      await revokeMutation.mutateAsync(grant);
      toast.success('已移除分享');
      onChanged?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '移除失败');
    }
  };

  const handleVisibility = async (visibility: 'private' | 'public') => {
    try {
      await visibilityMutation.mutateAsync(visibility);
      toast.success(visibility === 'public' ? 'Skill 已公开' : 'Skill 已设为私有');
      onChanged?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '可见性更新失败');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4" /> 分享 Skill
          </DialogTitle>
          <DialogDescription>
            Skill 位于 Hub 根目录。用户和组来自 IAM；Hub 不管理组成员，只写 Skill 的分享关系。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">公开状态</div>
                <div className="text-xs text-muted-foreground">
                  公开表示所有登录用户可读；私有则只允许 owner、viewer、editor 读取。
                </div>
              </div>
              <Badge variant={isPublic ? 'secondary' : 'outline'} className="shrink-0">
                {isPublic ? '公开' : '私有'}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={isPublic ? 'secondary' : 'outline'}
                onClick={() => handleVisibility('public')}
                disabled={!skillName || visibilityMutation.isPending || isPublic}
              >
                {visibilityMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Globe className="h-3.5 w-3.5 mr-1" />}
                设为公开
              </Button>
              <Button
                size="sm"
                variant={!isPublic ? 'secondary' : 'outline'}
                onClick={() => handleVisibility('private')}
                disabled={!skillName || visibilityMutation.isPending || !isPublic}
              >
                <Lock className="h-3.5 w-3.5 mr-1" />
                设为私有
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Label>选择分享对象</Label>
                <div className="flex rounded-md border overflow-hidden text-xs">
                  <button
                    type="button"
                    className={`px-2 py-1 ${role === 'viewer' ? 'bg-muted font-medium' : ''}`}
                    onClick={() => setRole('viewer')}
                  >
                    Viewer
                  </button>
                  <button
                    type="button"
                    className={`px-2 py-1 border-l ${role === 'editor' ? 'bg-muted font-medium' : ''}`}
                    onClick={() => setRole('editor')}
                  >
                    Editor
                  </button>
                </div>
              </div>
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2 top-2.5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索 IAM 用户或组"
                  className="pl-7"
                />
              </div>
              <div className="rounded-md border max-h-72 overflow-y-auto divide-y">
                {targetsQuery.isLoading ? (
                  <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> 正在从 IAM 加载用户和组...
                  </div>
                ) : targets.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">没有匹配的用户或组</div>
                ) : (
                  targets.slice(0, 50).map((target) => (
                    <div key={`${target.subjectType}:${target.subjectId}`} className="p-2 flex items-center gap-2">
                      <div className="text-muted-foreground">{targetIcon(target)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm truncate">{target.displayName}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {target.subjectType}{target.subjectType === 'group' ? '#member' : ''} · {target.subjectId}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => handleGrant(target)} disabled={grantMutation.isPending}>
                        授权
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-3">
              <Label>当前分享</Label>
              <div className="rounded-md border max-h-80 overflow-y-auto divide-y">
                {sharesQuery.isLoading ? (
                  <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> 正在加载分享关系...
                  </div>
                ) : grants.length === 0 && !isPublic ? (
                  <div className="p-4 text-sm text-muted-foreground">暂无分享对象</div>
                ) : (
                  grants.map((grant) => (
                    <div key={grant.id} className="p-2 flex items-center gap-2">
                      <div className="text-muted-foreground">{grantIcon(grant)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm truncate">{grantLabel(grant)}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {grant.subjectType}{grant.subjectType === 'group' ? '#member' : ''} · {grant.role}
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => handleRevoke(grant)}
                        disabled={revokeMutation.isPending || grant.subjectType === 'public'}
                        title={grant.subjectType === 'public' ? '公开状态请通过上方按钮切换' : '移除分享'}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
