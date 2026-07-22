'use client';

import { Search, RefreshCw, Plus, LayoutGrid, Layers3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';

export type SkillViewMode = 'grid' | 'skillset';

interface SkillFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  skillSetName: string;
  onGroupNameChange: (v: string) => void;
  scopeFilter: string;
  onScopeFilterChange: (v: string) => void;
  onRefresh: () => void;
  onCreateClick: () => void;
  viewMode: SkillViewMode;
  onViewModeChange: (v: SkillViewMode) => void;
}

export function SkillFilters({
  search,
  onSearchChange,
  skillSetName,
  onGroupNameChange,
  scopeFilter,
  onScopeFilterChange,
  onRefresh,
  onCreateClick,
  viewMode,
  onViewModeChange,
}: SkillFiltersProps) {
  const t = useT();
  const hasActiveFilters = scopeFilter !== 'all' || skillSetName || search;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative flex-1 min-w-[220px] max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder={t('skills.search')}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9 bg-card"
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground hover:text-foreground"
          >
            {t('skills.clear')}
          </button>
        )}
      </div>

      {/* Access mode filter (was "Scope") */}
      <Select value={scopeFilter} onValueChange={onScopeFilterChange}>
        <SelectTrigger className={cn('w-28 h-9 bg-card text-xs', scopeFilter !== 'all' && 'border-violet-500/40')}>
          <SelectValue placeholder={t('accessMode.label')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('common.all')}</SelectItem>
          <SelectItem value="private">{t('accessMode.private')}</SelectItem>
          <SelectItem value="internal">{t('accessMode.internal')}</SelectItem>
          <SelectItem value="public">{t('accessMode.public')}</SelectItem>
        </SelectContent>
      </Select>

      {/* Group filter */}
      <Input
        placeholder={t('skills.skillsetFilter')}
        value={skillSetName}
        onChange={(e) => onGroupNameChange(e.target.value)}
        className={cn('w-28 h-9 bg-card text-xs', skillSetName && 'border-violet-500/40')}
      />

      {/* Reset all filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 text-xs text-muted-foreground"
          onClick={() => {
            onSearchChange('');
            onGroupNameChange('');
            onScopeFilterChange('all');
          }}
        >
          {t('skills.reset')}
        </Button>
      )}

      <div className="flex-1" />

      {/* View mode toggle */}
      <div className="flex items-center bg-muted/40 rounded-md p-0.5 gap-0.5">
        <button
          onClick={() => onViewModeChange('grid')}
          className={cn(
            'flex items-center gap-1 px-2 h-7 rounded text-[11px] transition-colors',
            viewMode === 'grid'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
          title={t('skills.viewGrid')}
        >
          <LayoutGrid className="h-3 w-3" />
          <span className="hidden sm:inline">{t('skills.viewGrid')}</span>
        </button>
        <button
          onClick={() => onViewModeChange('skillset')}
          className={cn(
            'flex items-center gap-1 px-2 h-7 rounded text-[11px] transition-colors',
            viewMode === 'skillset'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
          title={t('skills.viewSkillSet')}
        >
          <Layers3 className="h-3 w-3" />
          <span className="hidden sm:inline">{t('skills.viewSkillSet')}</span>
        </button>
      </div>

      {/* Actions */}
      <Button variant="outline" size="sm" className="h-9 px-2" onClick={onRefresh} title={t('skills.refresh')}>
        <RefreshCw className="h-3.5 w-3.5" />
      </Button>
      <Button size="sm" variant="outline" className="h-9" onClick={onCreateClick}>
        <Plus className="h-3.5 w-3.5 mr-1.5" /> {t('skills.createDraft')}
      </Button>
    </div>
  );
}
