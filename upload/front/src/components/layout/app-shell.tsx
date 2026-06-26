'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Sidebar, MobileSidebar } from './sidebar';
import { Topbar } from './topbar';
import { authApi } from '@/lib/api';
import { setTokens, clearTokens, getToken, getAccessSpace, asItems } from '@/lib/api/client';
import { useNotifications } from '@/hooks/use-ops';
import { LoginPage } from '@/components/auth/login-page';
import { SkillEditor } from '@/components/editor/skill-editor';
import { useT } from '@/lib/i18n';
import type { Tab, Notification } from '@/lib/api/types';

interface AppShellProps {
  children: (tab: Tab) => React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const t = useT();
  const [authed, setAuthed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(getToken());
  });
  const [tab, setTab] = useState<Tab>('skills');
  const [principal, setPrincipal] = useState<Record<string, unknown> | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<string | null>(null);
  const accessSpaceId = getAccessSpace();

  const { data: notificationsData } = useNotifications({ pageNo: 1, pageSize: 30 });

  const unreadNotifications = (notificationsData || []).filter((n: Notification) => !n.read).length;

  useEffect(() => {
    if (!authed) return;
    authApi.me().then((m) => setPrincipal((m as Record<string, unknown>)?.principal as Record<string, unknown> || m as Record<string, unknown> || null)).catch(() => {
      clearTokens();
      setAuthed(false);
      setPrincipal(null);
    });
  }, [authed]);

  const handleLogout = useCallback(() => {
    clearTokens();
    setAuthed(false);
    setPrincipal(null);
  }, []);

  // Open the skill editor
  const openSkillEditor = useCallback((skillName: string) => {
    setEditingSkill(skillName);
  }, []);

  // Close the skill editor
  const closeSkillEditor = useCallback(() => {
    setEditingSkill(null);
  }, []);

  // Tab change should close the editor
  const handleTabChange = useCallback((nextTab: Tab) => {
    setEditingSkill(null);
    setTab(nextTab);
  }, []);

  if (!authed) {
    return <LoginPage />;
  }

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar
          activeTab={tab}
          onTabChange={handleTabChange}
          collapsed={!sidebarOpen}
          onToggleCollapse={() => setSidebarOpen(!sidebarOpen)}
          principal={principal}
          onLogout={handleLogout}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <Topbar
            activeTab={tab}
            onMenuClick={() => setMobileSidebarOpen(true)}
            accessSpaceId={accessSpaceId}
            unreadNotifications={unreadNotifications}
            editorMode={Boolean(editingSkill)}
            onExitEditor={closeSkillEditor}
          />

          <main className="flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              {editingSkill ? (
                <motion.div
                  key={`editor:${editingSkill}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="h-full"
                >
                  <SkillEditor skillName={editingSkill} onBack={closeSkillEditor} />
                </motion.div>
              ) : (
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="h-full"
                >
                  {/* Pass openSkillEditor to children via context */}
                  <SkillEditorContext.Provider value={openSkillEditor}>
                    {children(tab)}
                  </SkillEditorContext.Provider>
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </div>

        <MobileSidebar
          open={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
          activeTab={tab}
          onTabChange={handleTabChange}
          principal={principal}
          onLogout={handleLogout}
        />
      </div>
    </TooltipProvider>
  );
}

// Context to allow any child page to open the skill editor
export const SkillEditorContext = React.createContext<(skillName: string) => void>(() => {});

export function useOpenSkillEditor() {
  return React.useContext(SkillEditorContext);
}
