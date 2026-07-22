'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Sidebar, MobileSidebar } from './sidebar';
import { Topbar } from './topbar';
import { getAccessSpace, setAccessSpace, IS_GATEWAY_OIDC } from '@/lib/api/client';
import { useMe, useLogout } from '@/hooks/use-auth';
import { LoginPage } from '@/components/auth/login-page';
import { buildGatewayLoginUrl } from '@/lib/api/client';
import { SkillEditor } from '@/components/editor/skill-editor';
import { UserPanelSheet } from '@/components/layout/user-panel-sheet';
import { useT } from '@/lib/i18n';
import type { Tab } from '@/lib/api/types';

interface AppShellProps {
  children: (tab: Tab) => React.ReactNode;
}

// All valid tab values — kept in sync with the Tab union in types.ts
const VALID_TABS: Tab[] = [
  'skills', 'skillsets', 'agents', 'tools', 'model-profiles',
  'sandbox-profiles', 'sandboxes', 'namespaces', 'governance', 'ops',
  'proposals', 'iam', 'access', 'authz', 'docs',
];

// Read the initial tab from ?tab=xxx so refresh / deep links preserve state
function getInitialTab(): Tab {
  if (typeof window === 'undefined') return 'skills';
  const t = new URLSearchParams(window.location.search).get('tab') as Tab | null;
  return t && VALID_TABS.includes(t) ? t : 'skills';
}

export function AppShell({ children }: AppShellProps) {
  const t = useT();
  const [tab, setTab] = useState<Tab>(getInitialTab);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<string | null>(null);
  const [userPanelOpen, setUserPanelOpen] = useState(false);
  const accessSpaceId = getAccessSpace();

  const { data: principal, isLoading, error } = useMe();
  const logout = useLogout();

  // Sync the access space (org/zone ID) from the authenticated principal so
  // that getAccessSpace() returns the correct org everywhere (cluster creation
  // form, namespace queries, etc.). Without this, getAccessSpace() falls back
  // to "default" while the principal's OrgID is the Casdoor org (e.g.
  // "aisphere"), causing a mismatch: clusters created under "default" are
  // invisible to ListClusters which queries by principal.OrgID.
  useEffect(() => {
    const orgId = (principal?.orgId as string | undefined) || (principal?.org_id as string | undefined);
    if (orgId && orgId !== getAccessSpace()) {
      setAccessSpace(orgId);
    }
  }, [principal]);

  const unreadNotifications = 0;

  const handleLogout = useCallback(async () => {
    setEditingSkill(null);
    await logout();
  }, [logout]);

  const openSkillEditor = useCallback((skillName: string) => {
    setEditingSkill(skillName);
  }, []);

  const closeSkillEditor = useCallback(() => {
    setEditingSkill(null);
  }, []);

  const handleTabChange = useCallback((nextTab: Tab) => {
    setEditingSkill(null);
    setTab(nextTab);
    // Serialize tab into the URL and push a history entry so the browser
    // back button navigates between tabs instead of leaving the app.
    const url = new URL(window.location.href);
    url.searchParams.set('tab', nextTab);
    window.history.pushState({}, '', url.toString());
  }, []);

  // Keep React state in sync when the user navigates with browser back/forward.
  useEffect(() => {
    const onPopState = () => {
      const t = new URLSearchParams(window.location.search).get('tab') as Tab | null;
      setTab(t && VALID_TABS.includes(t) ? t : 'skills');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // On first mount, if the URL has no ?tab=, backfill it with the current tab
  // so the very first history entry is not a bare "/" (which would let back
  // exit the app immediately).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (!params.get('tab')) {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState({}, '', url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Loading state
  if (isLoading && !principal && !error) {
    return <div className="flex items-center justify-center min-h-screen bg-background" />;
  }

  // Not authenticated — show login page
  if (!principal || error) {
    return (
      <LoginPage
        onLogin={() => { window.location.assign(buildGatewayLoginUrl()); }}
      />
    );
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