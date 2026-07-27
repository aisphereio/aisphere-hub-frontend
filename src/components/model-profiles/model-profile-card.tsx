'use client';

import { Box, Cpu, KeyRound, Loader2, Pencil, Play, Trash2, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useT } from '@/lib/i18n';
import type { ModelProfile } from '@/lib/api/types';
import type { V1TestModelProfileResponse } from '@/lib/api/generated/model';

const providerAccent: Record<string, string> = {
  openai: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  vllm: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
  vertex: 'bg-sky-500/10 text-sky-600 dark:text-sky-300',
};

interface ModelProfileCardProps {
  profile: ModelProfile;
  testing?: boolean;
  testResult?: V1TestModelProfileResponse;
  onTest: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ModelProfileCard({
  profile,
  testing,
  testResult,
  onTest,
  onEdit,
  onDelete,
}: ModelProfileCardProps) {
  const t = useT();
  const tr = (key: string, fallback: string) => {
    const v = t(key);
    return v === key ? fallback : v;
  };
  const contextWindow = profile.limits?.maxInputTokens ?? 0;
  const isActive = (profile.status || 'active') === 'active';

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">
              {profile.displayName || profile.id}
            </h3>
            <p className="text-xs text-muted-foreground font-mono truncate">
              {profile.id}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1 shrink-0">
            <Badge
              variant="secondary"
              className={
                isActive
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                  : 'bg-muted text-muted-foreground'
              }
            >
              {t(`model-profiles.status.${profile.status || 'active'}`)}
            </Badge>
            <Badge
              variant="outline"
              className={providerAccent[profile.provider || ''] || 'bg-muted text-muted-foreground'}
            >
              {profile.provider}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-2 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Cpu className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {profile.upstreamModel || '—'}
            <span className="text-muted-foreground/60"> · {profile.apiFormat}</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Box className="h-3 w-3 shrink-0" />
          <span className="truncate">{profile.endpoint || '—'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <KeyRound className="h-3 w-3 shrink-0" />
          <span className="truncate font-mono">{profile.secretRef || '—'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="h-3 w-3 shrink-0 text-muted-foreground" />
          <Badge variant="outline" className="text-[10px] h-4 px-1.5">
            {contextWindow > 0 ? `${contextWindow.toLocaleString()} ctx` : 'ctx unset'}
          </Badge>
          {profile.limits?.maxOutputTokens ? (
            <Badge variant="outline" className="text-[10px] h-4 px-1.5">
              {profile.limits.maxOutputTokens.toLocaleString()} out
            </Badge>
          ) : null}
        </div>

        {testResult ? (
          <TestResultBadge result={testResult} t={t} />
        ) : null}

        <div className="flex items-center gap-1 pt-2 border-t">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            disabled={testing}
            onClick={onTest}
          >
            {testing ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Play className="mr-1 h-3 w-3" />
            )}
            {testing ? t('model-profiles.testing') : t('model-profiles.test')}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onEdit}>
            <Pencil className="mr-1 h-3 w-3" />
            {tr('model-profiles.edit', 'Edit')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-destructive hover:text-destructive ml-auto"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TestResultBadge({
  result,
  t,
}: {
  result: V1TestModelProfileResponse;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  if (result.ok) {
    return (
      <div className="rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-600 dark:text-emerald-300">
        {t('model-profiles.testOk', { latency: result.latencyMillis ?? 0 })}
      </div>
    );
  }
  const status = result.httpStatus ?? 0;
  if (status === 401 || status === 403) {
    return (
      <div className="rounded-md bg-amber-500/10 px-2 py-1 text-[11px] text-amber-600 dark:text-amber-300">
        {t('model-profiles.testReachable', { status })}
      </div>
    );
  }
  return (
    <div className="rounded-md bg-destructive/10 px-2 py-1 text-[11px] text-destructive truncate" title={result.error || ''}>
      {t('model-profiles.testFail')}{result.error ? `: ${result.error}` : ''}
    </div>
  );
}
