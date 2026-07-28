'use client';

import { Box, Cpu, KeyRound, Pencil, Trash2, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useModelProfileT } from './i18n';
import type { ModelProfile } from '@/lib/api/types';

const providerAccent: Record<string, string> = {
  openai: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  vllm: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
  vertex: 'bg-sky-500/10 text-sky-600 dark:text-sky-300',
};

interface ModelProfileCardProps {
  profile: ModelProfile;
  onEdit: () => void;
  onDelete: () => void;
}

export function ModelProfileCard({
  profile,
  onEdit,
  onDelete,
}: ModelProfileCardProps) {
  const t = useModelProfileT();
  const contextWindow = profile.limits?.maxInputTokens ?? 0;
  const isActive = (profile.status || 'active') === 'active';

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">
              {profile.displayName || profile.id}
            </h3>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {profile.id}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1">
            <Badge
              variant="secondary"
              className={
                isActive
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                  : 'bg-muted text-muted-foreground'
              }
            >
              {t(`status.${profile.status || 'active'}`)}
            </Badge>
            <Badge
              variant="outline"
              className={
                providerAccent[profile.provider || ''] ||
                'bg-muted text-muted-foreground'
              }
            >
              {profile.provider || '—'}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-2 text-xs">
        {profile.description ? (
          <p className="line-clamp-2 text-muted-foreground">
            {profile.description}
          </p>
        ) : null}

        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Cpu className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {profile.upstreamModel || '—'}
            <span className="text-muted-foreground/60">
              {' '}· {profile.apiFormat || '—'}
            </span>
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
          <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
            {contextWindow > 0
              ? `${contextWindow.toLocaleString()} ctx`
              : 'ctx unset'}
          </Badge>
          {profile.limits?.maxOutputTokens ? (
            <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
              {profile.limits.maxOutputTokens.toLocaleString()} out
            </Badge>
          ) : null}
        </div>

        <div className="flex items-center gap-1 border-t pt-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={onEdit}
          >
            <Pencil className="mr-1 h-3 w-3" />
            {t('edit')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-7 text-xs text-destructive hover:text-destructive"
            onClick={onDelete}
            aria-label={t('delete')}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
