'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Sidebar, MobileSidebar } from './sidebar';
import { Topbar } from './topbar';
import { authApi } from '@/lib/api';
import { getToken, getAccessSpace, onAuthEvent } from '@/lib/api/client';
import { useMe, useLogout } from '@/hooks/use-auth';
import { LoginPage } from '@/components/auth/login-page';
import { SkillEditor } from '@/components/editor/skill-editor';
import { UserPanelSheet } from '@/components/layout/user-panel-sheet';
import { useT } from '@/lib/i18n';
import type { Tab } from '@/lib/api/types';

interface AppShellProps {
  children: (tab: Tab) => React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const t = useT();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('skills');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<string | null>(null);
  const [userPanelOpen, setUserPanelOpen] = useState(false);
  const accessSpaceId = getAccessSpace();

  // Defer auth check to client to avoid SSR/CSR hydration mismatch.
  useEffect(() => {
    queueMicrotask(() => setAuthed(Boolean(getToken())));
  }, []);

  // useMe is enabled only when authed so the principal is fetched lazily after login.
  const { data: principal } = useMe();
  const logout = useLogout();

  const unreadNotifications = 0;

  // Listen for forced-logout events (401, refresh failure) so the UI flips back to LoginPage.
  useEffect(() => {
    if (!authed) return;
    const off = onAuthEvent((reason) => {
      if (reason === 'expired' || reason === 'logout') {
        setAuthed(false);
        setEditingSkill(null);
      }
    });
    return off;
  }, [authed]);

  // Re-check token presence on focus / storage events so multiple tabs stay in sync.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const check = () => {
      const hasToken = Boolean(getToken());
      setAuthed((cur) => (cur !== hasToken ? hasToken : cur));
    };
    window.addEventListener('storage', check);
    window.addEventListener('focus', check);
    return () => {
      window.removeEventListener('storage', check);
      window.removeEventListener('focus', check);
    };
  }, []);

  const handleLogout = useCallback(async () => {
    setAuthed(false);
    setEditingSkill(null);
    await logout();
  }, [logout]);

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

  if (authed === null) {
    return <div className="flex items-center justify-center min-h-screen bg-background" />;
  }

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
          principal={principal || null}
          onLogout={handleLogout}
          onOpenProfile={() => setUserPanelOpen(true)}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <Topbar
            activeTab={tab}
            onMenuClick={() => setMobileSidebarOpen(true)}
            accessSpaceId={accessSpaceId}
            unreadNotifications={unreadNotifications}
            editorMode={Boolean(editingSkill)}
            onExitEditor={closeSkillEditor}
            onNavigate={handleTabChange}
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
          principal={principal || null}
          onLogout={handleLogout}
          onOpenProfile={() => { setMobileSidebarOpen(false); setUserPanelOpen(true); }}
        />

        <UserPanelSheet
          open={userPanelOpen}
          onOpenChange={setUserPanelOpen}
          principal={principal || null}
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
