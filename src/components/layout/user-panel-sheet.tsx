'use client';

import { useState } from 'react';
import {
  LogOut, Mail, Shield, Building2, Users, KeyRound, Copy, Check,
  UserCog, Hash, Clock,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useT } from '@/lib/i18n';
import { toast } from 'sonner';
import { getTokenExpiresAt } from '@/lib/api/client';

interface UserPanelSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  principal: Record<string, unknown> | null;
  onLogout: () => void | Promise<void>;
}

function pick(principal: Record<string, unknown> | null, ...keys: string[]): string {
  if (!principal) return '';
  for (const k of keys) {
    const v = principal[k];
    if (v !== undefined && v !== null && String(v)) return String(v);
  }
  return '';
}

export function UserPanelSheet({ open, onOpenChange, principal, onLogout }: UserPanelSheetProps) {
  const t = useT();
  const [copied, setCopied] = useState<string | null>(null);

  const subjectId = pick(principal, 'subjectId', 'subject_id', 'sub', 'id', 'name', 'username');
  const displayName = pick(principal, 'displayName', 'display_name', 'name');
  const email = pick(principal, 'email', 'mail');
  const avatar = pick(principal, 'avatar', 'picture');
  const orgId = pick(principal, 'orgId', 'org_id', 'organization');
  const projectId = pick(principal, 'projectId', 'project_id', 'project');
  const subjectType = pick(principal, 'subjectType', 'subject_type', 'type');
  const roles = ((principal?.roles as string[]) || []).filter(Boolean);
  const groups = ((principal?.groups as string[]) || []).filter(Boolean);
  const namespaces = ((principal?.namespaces as string[]) || []).filter(Boolean);
  const permissions = ((principal?.permissions as string[]) || []).filter(Boolean);

  const initials = (displayName || subjectId || 'U').slice(0, 2).toUpperCase();
  const expiresAt = getTokenExpiresAt();

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error('Copy failed');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0">
        <SheetHeader className="p-5 pb-3 border-b bg-gradient-to-br from-violet-500/5 to-fuchsia-500/5">
          <SheetTitle className="flex items-center gap-3">
            <Avatar className="h-12 w-12 ring-2 ring-violet-500/20">
              {avatar ? (
                <img src={avatar} alt={displayName} className="h-full w-full object-cover" />
              ) : null}
              <AvatarFallback className="bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate font-semibold text-sm">{displayName || subjectId || t('user.anonymous')}</div>
              <div className="text-xs text-muted-foreground truncate font-mono">{subjectId}</div>
            </div>
          </SheetTitle>
          <SheetDescription className="sr-only">
            {t('user.profileDesc')}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-180px)]">
          <div className="p-5 space-y-5">
            {/* Identity badges */}
            <div className="flex flex-wrap items-center gap-1.5">
              {subjectType && (
                <Badge variant="secondary" className="text-[10px] gap-1">
                  <UserCog className="h-2.5 w-2.5" /> {subjectType}
                </Badge>
              )}
              {roles.map((r) => (
                <Badge key={r} variant="outline" className="text-[10px] gap-1 border-violet-500/30 text-violet-700 dark:text-violet-300">
                  <Shield className="h-2.5 w-2.5" /> {r}
                </Badge>
              ))}
              {groups.map((g) => (
                <Badge key={g} variant="outline" className="text-[10px] gap-1">
                  <Users className="h-2.5 w-2.5" /> {g}
                </Badge>
              ))}
            </div>

            {/* Identity details */}
            <div className="space-y-2">
              <SectionLabel>{t('user.identity')}</SectionLabel>
              <DetailRow
                icon={<Hash className="h-3.5 w-3.5" />}
                label={t('user.subjectId')}
                value={subjectId}
                onCopy={subjectId ? () => copyText(subjectId, t('user.subjectId')) : undefined}
                copied={copied === t('user.subjectId')}
                mono
              />
              {email && (
                <DetailRow
                  icon={<Mail className="h-3.5 w-3.5" />}
                  label={t('user.email')}
                  value={email}
                />
              )}
              {orgId && (
                <DetailRow
                  icon={<Building2 className="h-3.5 w-3.5" />}
                  label={t('user.organization')}
                  value={orgId}
                />
              )}
              {projectId && (
                <DetailRow
                  icon={<Building2 className="h-3.5 w-3.5" />}
                  label={t('user.project')}
                  value={projectId}
                />
              )}
              {expiresAt > 0 && (
                <DetailRow
                  icon={<Clock className="h-3.5 w-3.5" />}
                  label={t('user.tokenExpires')}
                  value={new Date(expiresAt).toLocaleString()}
                />
              )}
            </div>

            {/* Namespaces */}
            {namespaces.length > 0 && (
              <div className="space-y-2">
                <SectionLabel>{t('user.namespaces')}</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {namespaces.map((ns) => (
                    <Badge key={ns} variant="secondary" className="text-[10px] gap-1">
                      <Hash className="h-2.5 w-2.5" /> {ns}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Permissions (collapsed preview) */}
            {permissions.length > 0 && (
              <div className="space-y-2">
                <SectionLabel>
                  {t('user.permissions')} ({permissions.length})
                </SectionLabel>
                <div className="max-h-32 overflow-y-auto scrollbar-thin rounded-md border bg-muted/30 p-2 flex flex-wrap gap-1">
                  {permissions.slice(0, 50).map((p) => (
                    <Badge key={p} variant="outline" className="text-[9px] font-mono">
                      {p}
                    </Badge>
                  ))}
                  {permissions.length > 50 && (
                    <span className="text-[9px] text-muted-foreground">
                      +{permissions.length - 50} more
                    </span>
                  )}
                </div>
              </div>
            )}

            <Separator />

            {/* Quick actions */}
            <div className="space-y-2">
              <SectionLabel>{t('user.actions')}</SectionLabel>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => {
                  onOpenChange(false);
                  // Reuse the IAM page tab by emitting a custom event the sidebar listens to.
                  window.dispatchEvent(new CustomEvent('skillhub:navigate', { detail: 'iam' }));
                }}
              >
                <KeyRound className="h-3.5 w-3.5" /> {t('user.manageTokens')}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => {
                  onOpenChange(false);
                  onLogout();
                }}
              >
                <LogOut className="h-3.5 w-3.5" /> {t('user.logout')}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
      {children}
    </div>
  );
}

interface DetailRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  onCopy?: () => void;
  copied?: boolean;
  mono?: boolean;
}

function DetailRow({ icon, label, value, onCopy, copied, mono }: DetailRowProps) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border bg-card/50">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] text-muted-foreground leading-tight">{label}</div>
        <div className={`text-xs truncate ${mono ? 'font-mono' : ''}`}>{value || '-'}</div>
      </div>
      {onCopy && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={onCopy}
          title="Copy"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
        </Button>
      )}
    </div>
  );
}
