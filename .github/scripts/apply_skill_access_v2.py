from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8-sig")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}: {old[:120]!r}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


# API types: distinguish base visibility from derived shared access mode.
replace_once(
    "src/lib/api/types.ts",
    "export type Skill = {\n",
    "export type SkillVisibility = 'private' | 'internal' | 'public';\n\nexport type Skill = {\n",
)
replace_once(
    "src/lib/api/types.ts",
    "  visibility?: string;\n  scope?: string;\n",
    "  visibility?: SkillVisibility;\n  scope?: SkillVisibility;\n",
)
replace_once(
    "src/lib/api/types.ts",
    'export type AccessMode = "private" | "shared" | "public";',
    'export type AccessMode = "private" | "internal" | "shared" | "public";',
)
replace_once(
    "src/lib/api/types.ts",
    "  accessMode?: AccessMode;\n  canManage?: boolean;\n",
    "  accessMode?: AccessMode;\n  visibility?: SkillVisibility;\n  governingOrgId?: string;\n  canManage?: boolean;\n",
)

# API layer: accept internal and stop mapping reviewer to viewer.
replace_once(
    "src/lib/api/index.ts",
    '''    if (role === "admin") return "owner";\n    if (role === "reviewer") return "viewer";''',
    '''    if (role === "admin") return "owner";''',
)
replace_once(
    "src/lib/api/index.ts",
    '''    if (visibility !== "private" && visibility !== "public") {\n      throw new Error("Skill visibility must be private or public");\n    }''',
    '''    if (!["private", "internal", "public"].includes(visibility)) {\n      throw new Error("Skill visibility must be private, internal, or public");\n    }''',
)
replace_once(
    "src/lib/api/index.ts",
    '''    if (skill?.visibility === "public" && !items.some((x) => x.subjectType === "public")) {\n      items.unshift(publicGrant("skill", resourceId));\n    }\n    return {\n      items,\n      total: items.length,\n      accessMode: skill?.visibility === "public" ? "public" : deriveAccessMode(items),\n      canManage: true,\n    } as ShareListResponse;''',
    '''    const visibility = String(skill?.visibility || skill?.scope || "private").toLowerCase() as "private" | "internal" | "public";\n    if (visibility === "public" && !items.some((x) => x.subjectType === "public")) {\n      items.unshift(publicGrant("skill", resourceId));\n    }\n    return {\n      items,\n      total: items.length,\n      visibility,\n      governingOrgId: skill?.orgId,\n      accessMode: visibility === "public"\n        ? "public"\n        : visibility === "internal"\n          ? "internal"\n          : deriveAccessMode(items),\n    } as ShareListResponse;''',
)

# Directory and mutation hooks.
replace_once(
    "src/hooks/use-skill-sharing.ts",
    "export function useSkillShareTargets(open: boolean, query: string) {",
    "export function useSkillShareTargets(open: boolean, query: string, governingOrgId?: string) {",
)
replace_once(
    "src/hooks/use-skill-sharing.ts",
    "    queryKey: ['iam', 'share-targets'],",
    "    queryKey: ['iam', 'share-targets', governingOrgId || 'current'],",
)
replace_once(
    "src/hooks/use-skill-sharing.ts",
    '''      const orgId = me.orgId || me.tenantId || '';\n      if (!orgId) return [] as SkillShareTarget[];''',
    '''      const orgId = governingOrgId || me.orgId || me.tenantId || '';\n      if (!orgId) return [] as SkillShareTarget[];''',
)
replace_once(
    "src/hooks/use-skill-sharing.ts",
    "mutationFn: async ({ target, role }: { target: SkillShareTarget; role: Extract<ShareRole, 'viewer' | 'editor'> }) => {",
    "mutationFn: async ({ target, role }: { target: SkillShareTarget; role: Extract<ShareRole, 'viewer' | 'editor' | 'reviewer'> }) => {",
)
replace_once(
    "src/hooks/use-skill-sharing.ts",
    "mutationFn: async (visibility: 'private' | 'public') => {",
    "mutationFn: async (visibility: 'private' | 'internal' | 'public') => {",
)

# Skill cards and list filters must never default an unspecified Skill to public.
replace_once(
    "src/components/skills/skill-card.tsx",
    "  const latestVersion = skill.labels?.latest || skill.latestVersion;\n",
    "  const latestVersion = skill.labels?.latest || skill.latestVersion;\n  const visibility = (skill.visibility || skill.scope || 'private').toLowerCase();\n",
)
replace_once(
    "src/components/skills/skill-card.tsx",
    '''            <Badge variant="outline" className={`text-[10px] px-1.5 h-4 ${getScopeColor(skill.scope)}`}>\n              {/* Display the legacy `scope` field using access-mode labels.\n                  The backend may eventually stop returning `scope` in favor\n                  of the IAM ResourceGrant-derived `accessMode`. Until then,\n                  we map public→公开/Public, private→私有/Private. */}\n              {t(`accessMode.${(skill.scope || 'public').toLowerCase() === 'public' ? 'public' : 'private'}`)}\n            </Badge>''',
    '''            <Badge variant="outline" className={`text-[10px] px-1.5 h-4 ${getScopeColor(visibility)}`}>\n              {t(`accessMode.${visibility}`)}\n            </Badge>''',
)
replace_once(
    "src/components/pages/skills-page.tsx",
    "      if ((s.scope || 'public').toLowerCase() !== scopeFilter) return false;",
    "      if ((s.visibility || s.scope || 'private').toLowerCase() !== scopeFilter) return false;",
)
replace_once(
    "src/components/pages/skills-page.tsx",
    "            value={items.filter(s => (s.scope || 'public').toLowerCase() === 'public').length}",
    "            value={items.filter(s => (s.visibility || s.scope || 'private').toLowerCase() === 'public').length}",
)
replace_once(
    "src/components/skills/skill-filters.tsx",
    '''          <SelectItem value="public">{t('accessMode.public')}</SelectItem>\n          <SelectItem value="private">{t('accessMode.private')}</SelectItem>''',
    '''          <SelectItem value="private">{t('accessMode.private')}</SelectItem>\n          <SelectItem value="internal">{t('accessMode.internal')}</SelectItem>\n          <SelectItem value="public">{t('accessMode.public')}</SelectItem>''',
)

# Shared visibility helpers.
replace_once(
    "src/lib/utils.ts",
    '''    case 'PUBLIC':\n      return 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/50';\n    case 'PRIVATE':''',
    '''    case 'PUBLIC':\n      return 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/50';\n    case 'INTERNAL':\n      return 'text-sky-600 bg-sky-50 dark:text-sky-400 dark:bg-sky-950/50';\n    case 'PRIVATE':''',
)
replace_once(
    "src/lib/utils.ts",
    "export type AccessMode = 'private' | 'shared' | 'public';",
    "export type AccessMode = 'private' | 'internal' | 'shared' | 'public';",
)
replace_once(
    "src/lib/utils.ts",
    '''    case 'shared':\n      return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/50';''',
    '''    case 'internal':\n      return 'text-sky-600 bg-sky-50 dark:text-sky-400 dark:bg-sky-950/50';\n    case 'shared':\n      return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/50';''',
)
replace_once(
    "src/lib/utils.ts",
    '''    case 'public': return 'globe';\n    case 'shared': return 'users';''',
    '''    case 'public': return 'globe';\n    case 'internal': return 'building';\n    case 'shared': return 'users';''',
)

# Human-readable labels in both locales.
replace_once(
    "src/lib/i18n.tsx",
    '''  'accessMode.private': 'Private',\n  'accessMode.privateDesc': 'accessMode.privateDesc',\n  'accessMode.public': 'Public',\n  'accessMode.publicDesc': 'accessMode.publicDesc',''',
    '''  'accessMode.private': 'Private',\n  'accessMode.privateDesc': 'Only the owner and explicitly granted collaborators can access it',\n  'accessMode.internal': 'Organization internal',\n  'accessMode.internalDesc': 'Authenticated members of the governing organization can discover and read it',\n  'accessMode.public': 'Platform public',\n  'accessMode.publicDesc': 'Every authenticated platform user can discover and read it',''',
)
replace_once(
    "src/lib/i18n.tsx",
    '''  'accessMode.label': 'Access',\n  'accessMode.managedByShares': '由分享设置管理',\n  'accessMode.private': 'Private',\n  'accessMode.privateDesc': '仅所有者可访问',\n  'accessMode.public': 'Public',\n  'accessMode.publicDesc': '所有人可访问',\n  'accessMode.shared': 'Shared',\n  'accessMode.sharedDesc': '指定主体可访问',''',
    '''  'accessMode.label': '可见范围',\n  'accessMode.managedByShares': '由 IAM 分享关系管理',\n  'accessMode.private': '私有',\n  'accessMode.privateDesc': '仅所有者和显式授权的协作者可访问',\n  'accessMode.internal': '组织内部',\n  'accessMode.internalDesc': '治理组织内的已登录成员可发现和读取',\n  'accessMode.public': '平台公开',\n  'accessMode.publicDesc': '所有已登录的平台用户可发现和读取',\n  'accessMode.shared': '已分享',\n  'accessMode.sharedDesc': '指定用户或用户组可访问',''',
)

# Replace the share dialog with an owner-managed, organization-aware UX.
Path("src/components/skills/skill-share-dialog.tsx").write_text(r'''\
'use client';

import { useState } from 'react';
import { AlertTriangle, Building2, Globe, Loader2, Lock, Search, Share2, Trash2, User, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMe } from '@/hooks/use-auth';
import {
  useGrantSkillShare,
  useRevokeSkillShare,
  useSkillShares,
  useSkillShareTargets,
  useUpdateSkillPublicVisibility,
  type SkillShareTarget,
} from '@/hooks/use-skill-sharing';
import type { ResourceGrant, ShareRole, Skill, SkillVisibility } from '@/lib/api/types';
import { toast } from 'sonner';

type GrantableRole = Extract<ShareRole, 'viewer' | 'editor' | 'reviewer'>;

interface SkillShareDialogProps {
  skill: Skill | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

const roleMeta: Record<GrantableRole, { label: string; description: string }> = {
  viewer: { label: '查看者', description: '查看、下载，并允许 Agent/Runtime 使用已授权内容。' },
  editor: { label: '编辑者', description: '编辑草稿和提交版本，但不能扩大分享范围。' },
  reviewer: { label: '审核发布者', description: '审核、发布、上线和下线版本。' },
};

const visibilityMeta: Record<SkillVisibility, { label: string; description: string }> = {
  private: { label: '私有', description: '只有所有者和显式授权的用户、用户组可以访问。' },
  internal: { label: '组织内部', description: '治理组织内的已登录成员可以发现和读取。' },
  public: { label: '平台公开', description: '所有已登录的平台用户可以发现和读取。' },
};

function targetIcon(target: Pick<SkillShareTarget, 'subjectType'>) {
  return target.subjectType === 'group' ? <Users className="h-4 w-4" /> : <User className="h-4 w-4" />;
}

function grantLabel(grant: ResourceGrant): string {
  if (grant.subjectType === 'public') return '所有已登录的平台用户';
  return grant.subjectName || grant.metadata?.displayName || grant.subjectId;
}

function grantIcon(grant: ResourceGrant) {
  if (grant.subjectType === 'public') return <Globe className="h-4 w-4" />;
  if (grant.subjectType === 'group') return <Users className="h-4 w-4" />;
  return <User className="h-4 w-4" />;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function SkillShareDialog({ skill, open, onOpenChange, onChanged }: SkillShareDialogProps) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<GrantableRole>('viewer');
  const { data: principal } = useMe();
  const skillName = skill?.name || null;

  const sharesQuery = useSkillShares(skillName);
  const governingOrgId = skill?.orgId || sharesQuery.data?.governingOrgId || '';
  const visibility = String(sharesQuery.data?.visibility || skill?.visibility || skill?.scope || 'private').toLowerCase() as SkillVisibility;
  const targetsQuery = useSkillShareTargets(open, query, governingOrgId);
  const grantMutation = useGrantSkillShare(skillName);
  const revokeMutation = useRevokeSkillShare(skillName);
  const visibilityMutation = useUpdateSkillPublicVisibility(skillName);

  const grants = sharesQuery.data?.items || [];
  const targets = targetsQuery.data || [];
  const principalId = String(principal?.subjectId || principal?.sub || '');
  const ownerId = skill?.ownerId || skill?.owner || '';
  const ownerGrant = grants.some((grant) => grant.role === 'owner' && grant.subjectType === 'user' && grant.subjectId === principalId);
  const canManage = Boolean(principalId && (principalId === ownerId || ownerGrant)) && !sharesQuery.isError;
  const managementBusy = grantMutation.isPending || revokeMutation.isPending || visibilityMutation.isPending;

  const handleGrant = async (target: SkillShareTarget) => {
    if (!canManage) return;
    try {
      await grantMutation.mutateAsync({ target, role });
      toast.success(`已将“${roleMeta[role].label}”授予 ${target.displayName}`);
      onChanged?.();
    } catch (e: unknown) {
      toast.error(errorMessage(e, '分享失败'));
    }
  };

  const handleRevoke = async (grant: ResourceGrant) => {
    if (!canManage || grant.role === 'owner') return;
    try {
      await revokeMutation.mutateAsync(grant);
      toast.success('已移除分享');
      onChanged?.();
    } catch (e: unknown) {
      toast.error(errorMessage(e, '移除失败'));
    }
  };

  const handleVisibility = async (next: SkillVisibility) => {
    if (!canManage) return;
    try {
      await visibilityMutation.mutateAsync(next);
      toast.success(`Skill 已设为“${visibilityMeta[next].label}”`);
      onChanged?.();
    } catch (e: unknown) {
      toast.error(errorMessage(e, '可见范围更新失败'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4" /> Skill 访问权限
          </DialogTitle>
          <DialogDescription>
            Skill 位于 Hub 全局根目录；组织仅作为治理和 Internal 权限边界。用户、用户组与成员关系来自 IAM/Casdoor。
          </DialogDescription>
        </DialogHeader>

        {(sharesQuery.isError || targetsQuery.isError) && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              <div className="font-medium">无法完整加载访问权限</div>
              {sharesQuery.isError && <div>{errorMessage(sharesQuery.error, '读取 Skill 授权关系失败')}</div>}
              {targetsQuery.isError && <div>{errorMessage(targetsQuery.error, '读取 IAM 用户或用户组失败')}</div>}
            </div>
          </div>
        )}

        {!canManage && !sharesQuery.isLoading && (
          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            当前账号可以查看已授予的权限，但只有 Skill 所有者可以改变可见范围或管理协作者。
          </div>
        )}

        <div className="space-y-5">
          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium">可见范围</div>
                <div className="mt-1 text-xs text-muted-foreground">{visibilityMeta[visibility]?.description}</div>
                {governingOrgId && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5" /> 治理组织：{governingOrgId}
                  </div>
                )}
              </div>
              <Badge variant="outline">{visibilityMeta[visibility]?.label || visibility}</Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {(['private', 'internal', 'public'] as SkillVisibility[]).map((item) => {
                const Icon = item === 'private' ? Lock : item === 'internal' ? Building2 : Globe;
                return (
                  <button
                    type="button"
                    key={item}
                    disabled={!canManage || managementBusy || visibility === item || (item === 'internal' && !governingOrgId)}
                    onClick={() => handleVisibility(item)}
                    className={`rounded-lg border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${visibility === item ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                  >
                    <div className="flex items-center gap-2 text-sm font-medium"><Icon className="h-4 w-4" />{visibilityMeta[item].label}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{visibilityMeta[item].description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>授予角色</Label>
                <div className="grid grid-cols-3 overflow-hidden rounded-md border text-xs">
                  {(Object.keys(roleMeta) as GrantableRole[]).map((item) => (
                    <button
                      key={item}
                      type="button"
                      disabled={!canManage}
                      className={`border-r px-2 py-2 last:border-r-0 disabled:cursor-not-allowed disabled:opacity-50 ${role === item ? 'bg-muted font-medium' : ''}`}
                      onClick={() => setRole(item)}
                    >
                      {roleMeta[item].label}
                    </button>
                  ))}
                </div>
                <div className="text-[11px] text-muted-foreground">{roleMeta[role].description}</div>
              </div>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={governingOrgId ? `搜索 ${governingOrgId} 组织中的用户或组` : '搜索 IAM 用户或组'}
                  className="pl-7"
                  disabled={!canManage || targetsQuery.isError}
                />
              </div>
              <div className="max-h-72 overflow-y-auto divide-y rounded-md border">
                {targetsQuery.isLoading ? (
                  <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> 正在从 IAM 加载目录…</div>
                ) : targetsQuery.isError ? (
                  <div className="p-4 text-sm text-muted-foreground">IAM 目录暂不可用</div>
                ) : targets.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">没有匹配的用户或组</div>
                ) : targets.slice(0, 50).map((target) => (
                  <div key={`${target.subjectType}:${target.subjectId}`} className="flex items-center gap-2 p-2">
                    <div className="text-muted-foreground">{targetIcon(target)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{target.displayName}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{target.subjectType}{target.subjectType === 'group' ? '#member' : ''} · {target.subjectId}</div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleGrant(target)} disabled={!canManage || managementBusy}>授权</Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label>当前直接授权</Label>
              <div className="max-h-96 overflow-y-auto divide-y rounded-md border">
                {sharesQuery.isLoading ? (
                  <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> 正在加载授权关系…</div>
                ) : sharesQuery.isError ? (
                  <div className="p-4 text-sm text-muted-foreground">无法读取当前授权关系</div>
                ) : grants.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">暂无显式协作者</div>
                ) : grants.map((grant) => (
                  <div key={grant.id} className="flex items-center gap-2 p-2">
                    <div className="text-muted-foreground">{grantIcon(grant)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{grantLabel(grant)}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {grant.subjectType}{grant.subjectType === 'group' ? '#member' : ''} · {roleMeta[grant.role as GrantableRole]?.label || (grant.role === 'owner' ? '所有者' : grant.role)}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => handleRevoke(grant)}
                      disabled={!canManage || managementBusy || grant.subjectType === 'public' || grant.role === 'owner'}
                      title={grant.role === 'owner' ? '所有权不能从分享面板移除' : grant.subjectType === 'public' ? '通过可见范围切换' : '移除授权'}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
'''.lstrip('\\'), encoding="utf-8")
