'use client';

import { useState } from 'react';
import { Bell, Menu, ChevronRight, CloudCog, FileCode2, Search, Command } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useT } from '@/lib/i18n';
import { LanguageToggle } from './language-toggle';
import { CommandPalette, useCommandPalette } from './command-palette';
import { NotificationsSheet } from './notifications-sheet';
import type { Tab } from '@/lib/api/types';

interface TopbarProps {
  activeTab: Tab;
  onMenuClick: () => void;
  accessSpaceId: string;
  unreadNotifications: number;
  editorMode?: boolean;
  onExitEditor?: () => void;
  onNavigate?: (tab: Tab) => void;
}

export function Topbar({
  activeTab,
  onMenuClick,
  accessSpaceId,
  unreadNotifications,
  editorMode,
  onExitEditor,
  onNavigate,
}: TopbarProps) {
  const t = useT();
  const { open: cmdOpen, setOpen: setCmdOpen } = useCommandPalette();
  const [notifOpen, setNotifOpen] = useState(false);

  const titleKey = `${activeTab}.title`;
  const hintKey = `${activeTab}.hint`;
  const tabLabel = activeTab === 'namespaces' ? 'Kubernetes 运行环境' : t(titleKey);
  const tabHint = activeTab === 'namespaces' ? '集群接入、凭据轮换与 Namespace 管理' : t(hintKey);

  return (
    <>
      <header className="flex items-center justify-between h-12 px-3 md:px-4 border-b bg-card/80 backdrop-blur-sm shrink-0 gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 shrink-0" onClick={onMenuClick}>
            <Menu className="h-4 w-4" />
          </Button>

          <nav className="flex items-center gap-1.5 min-w-0">
            {editorMode ? (
              <>
                <button
                  onClick={onExitEditor}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  {tabLabel}
                </button>
                <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                <div className="flex items-center gap-1.5 min-w-0">
                  <FileCode2 className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                  <span className="text-xs font-medium truncate">{t('topbar.editor')}</span>
                </div>
              </>
            ) : (
              <div className="min-w-0">
                <h1 className="font-semibold text-sm leading-tight truncate">{tabLabel}</h1>
                <p className="text-[10px] text-muted-foreground leading-tight truncate">{tabHint}</p>
              </div>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            className="hidden md:flex items-center gap-2 h-7 px-2.5 rounded-md border bg-muted/30 hover:bg-muted/50 transition-colors text-xs text-muted-foreground"
            onClick={() => setCmdOpen(true)}
            title={`${t('topbar.search')} (⌘K)`}
          >
            <Search className="h-3 w-3" />
            <span>{t('topbar.search')}…</span>
            <kbd className="ml-1 flex items-center gap-0.5 text-[10px] bg-background px-1 py-0.5 rounded border">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </button>

          <Button
            variant={activeTab === 'namespaces' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onNavigate?.('namespaces')}
            title="Kubernetes 运行环境"
          >
            <CloudCog className="h-3.5 w-3.5 lg:mr-1" />
            <span className="hidden lg:inline">运行环境</span>
          </Button>

          <LanguageToggle />

          <Badge variant="outline" className="text-[10px] gap-1 hidden sm:inline-flex">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-soft" />
            {accessSpaceId}
          </Badge>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 relative"
            onClick={() => setNotifOpen(true)}
            title={t('ops.notifications') || 'Notifications'}
          >
            <Bell className={`h-3.5 w-3.5 ${unreadNotifications > 0 ? 'text-violet-500' : 'text-muted-foreground'}`} />
            {unreadNotifications > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-violet-600 text-[8px] text-white flex items-center justify-center font-bold">
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            )}
          </Button>
        </div>
      </header>

      <CommandPalette
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        onNavigate={(tab) => onNavigate?.(tab)}
      />

      <NotificationsSheet open={notifOpen} onOpenChange={setNotifOpen} />
    </>
  );
}
