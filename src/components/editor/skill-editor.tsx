"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, Loader2, Trash2, Star, Bell, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { toast } from "sonner";
import {
  useSkillDetail,
  useSkillSocial,
  useSkillDelete,
  useSocialStar,
  useSocialRating,
  useSocialSubscribe,
} from "@/hooks/use-skills";
import {
  useFileTree,
  useFileContent,
  useSaveFile,
  useDeleteFile,
} from "@/hooks/use-skill-files";
import { useResourceShares } from "@/hooks/use-shares";
import { getScopeColor, getStatusColor, fmtTime } from "@/lib/utils";
import { ConfirmDialog, InfoItem } from "@/components/shared";
import { ResourceSharePanel } from "@/components/aihub";
import { useT } from "@/lib/i18n";
import type { Skill, AccessMode } from "@/lib/api/types";
import { SkillFileTree } from "./skill-file-tree";
import { PullRequestsPanel } from "./pull-requests-panel";
import { SkillReleasesPanel } from "./skill-releases-panel";

// Monaco is the first next/dynamic({ ssr: false }) import in the repo.
// It pulls in web workers and touches `self` at module load, so it must
// never execute during server-side rendering.
const MonacoSkillEditor = dynamic(
  () => import("./monaco-skill-editor").then((m) => m.MonacoSkillEditor),
  { ssr: false, loading: () => <Loader2 className="h-4 w-4 animate-spin" /> },
);

// defaultBranchOf extracts the skill's default branch for the file API.
// The proto field is optional; fall back to "main" (SkillDefaultBranch).
function defaultBranchOf(detail: Skill): string {
  const v = (detail as Skill & { defaultBranch?: string }).defaultBranch;
  return v && v.length > 0 ? v : "main";
}
import { deriveAccessMode } from "@/lib/api/types";

interface SkillEditorProps {
  skillName: string;
  onBack: () => void;
}

type RightPanelTab = "overview" | "settings" | "shares" | "prs" | "releases";

/**
 * SkillEditor — settings-focused editor for the Git-native Hub.
 *
 * The Git-native refactor (Hub PR #18) removed the version/draft/file REST
 * surface. Skill content is authored through git (clone/push/LFS), not in the
 * UI, so this editor no longer hosts a file tree, code editor, version
 * timeline, or commit/publish/submit/online/offline actions. It focuses on
 * metadata projected from SKILL.md, sharing, and delete. Content metadata is
 * changed through Git so the repository remains the single source of truth.
 */
export function SkillEditor({ skillName, onBack }: SkillEditorProps) {
  const t = useT();
  const [rightTab, setRightTab] = useState<RightPanelTab>("overview");
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [metaExpanded, setMetaExpanded] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const {
    data: detail,
    isLoading: detailLoading,
  } = useSkillDetail(skillName);
  const { data: social } = useSkillSocial(skillName);

  const deleteMutation = useSkillDelete();
  const starMutation = useSocialStar();
  const subscribeMutation = useSocialSubscribe();
  const ratingMutation = useSocialRating();

  // The shares query backs both the Shares tab and the Settings tab's
  // access-mode display, so enable it whenever either tab is visible.
  const { data: sharesData } = useResourceShares("skill", skillName, {
    enabled: showRightPanel && (rightTab === "shares" || rightTab === "settings"),
  });
  // deriveAccessMode([]) returns "private", which is wrong for a skill whose
  // visibility is public/internal before the shares query resolves. Only
  // derive from shares once the query has actually resolved; otherwise fall
  // back to the skill's own scope (visibility) so the first render is correct.
  const skillAccessMode: AccessMode = sharesData
    ? (sharesData.accessMode ?? deriveAccessMode(sharesData.items || []))
    : ((detail?.scope as AccessMode | undefined) ?? "private");

  const handleDelete = async () => {
    if (!detail) return;
    try {
      await deleteMutation.mutateAsync(detail.name);
      toast.success(t("editor.skillDeleted"));
      onBack();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("editor.deleteFailed"));
    }
    setDeleteConfirmOpen(false);
  };

  const toggleStar = async () => {
    if (!detail || !social) return;
    try {
      await starMutation.mutateAsync({
        skillName: detail.name,
        starred: !social.myStarred,
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("skills.actionFailed"));
    }
  };

  const toggleSubscribe = async () => {
    if (!detail || !social) return;
    try {
      await subscribeMutation.mutateAsync({
        skillName: detail.name,
        subscribed: !social.mySubscribed,
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("skills.actionFailed"));
    }
  };

  const rate = async (n: number) => {
    if (!detail) return;
    try {
      await ratingMutation.mutateAsync({ skillName: detail.name, rating: n });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("skills.actionFailed"));
    }
  };

  if (detailLoading && !detail) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
        <p className="text-sm text-muted-foreground">{t("editor.loading")}</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 bg-background">
        <p className="text-sm text-muted-foreground">{t("editor.notFound")}</p>
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1" /> {t("editor.goBack")}
        </Button>
      </div>
    );
  }

  const status =
    detail.status || (detail.enable === false ? "disable" : "enable");
  const statusLabel =
    detail.status || (detail.enable === false ? "disabled" : "active");

  return (
    <div className="flex flex-col h-full bg-background">
      {/* ─── Editor Header ──────────────────────────────────────────────── */}
      <header className="flex items-center gap-2 h-12 px-3 border-b bg-card/80 backdrop-blur-sm shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">{t("topbar.back")}</span>
        </Button>
        <Separator orientation="vertical" className="h-5" />

        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-violet-500/15 to-fuchsia-500/15 flex items-center justify-center text-[10px] font-bold text-violet-600 dark:text-violet-300 shrink-0">
            {(detail.displayName || detail.name).slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium truncate">
                {detail.displayName || detail.name}
              </span>
              <Badge
                variant="outline"
                className={`text-[9px] px-1.5 h-4 ${getScopeColor(detail.scope)}`}
              >
                {detail.scope || "PUBLIC"}
              </Badge>
              <Badge
                variant="secondary"
                className={`text-[9px] px-1.5 h-4 ${getStatusColor(status)}`}
              >
                {statusLabel}
              </Badge>
            </div>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => setShowRightPanel((v) => !v)}
        >
          {showRightPanel ? "Hide panel" : "Show panel"}
        </Button>
      </header>

      <div className="flex-1 min-h-0 flex">
        {/* ─── Left: Overview + in-browser content editor ───────────────── */}
        <div className="flex-1 min-w-0 flex flex-col border-r overflow-hidden">
          {/* Skill meta bar: a single collapsed row (h-9) with a
              Details toggle. The skill name + status already live in
              the header above, so this row stays minimal. Expanding
              reveals description / social / info grid / git hint in a
              height-capped ScrollArea — the editor below keeps the
              bulk of the panel either way. */}
          <div className="shrink-0 border-b bg-muted/20">
            <div className="flex h-9 items-center gap-2 px-3">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                onClick={() => setMetaExpanded((v) => !v)}
              >
                <ChevronRight
                  className={`h-3.5 w-3.5 transition-transform ${metaExpanded ? "rotate-90" : ""}`}
                />
                {t("editor.details") ?? "Details"}
              </Button>
              {detail.description && (
                <span className="truncate text-xs text-muted-foreground">
                  {detail.description}
                </span>
              )}
            </div>
            {metaExpanded && (
              <ScrollArea className="max-h-[40vh]">
                <div className="p-4 space-y-4">
                  {/* Social strip (gated by env flag via the hook) */}
                  {social && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={toggleStar}
                        className={
                          social.myStarred ? "text-amber-500 border-amber-200" : ""
                        }
                      >
                        <Star
                          className={`h-3.5 w-3.5 mr-1 ${social.myStarred ? "fill-amber-500" : ""}`}
                        />
                        {social.stars}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={toggleSubscribe}
                        className={
                          social.mySubscribed
                            ? "text-violet-500 border-violet-200"
                            : ""
                        }
                      >
                        <Bell className="h-3.5 w-3.5 mr-1" />
                        {social.subscribers}
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Rating: {Number(social.ratingAverage || 0).toFixed(1)} (
                        {social.ratingCount} votes)
                      </span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            onClick={() => rate(n)}
                            className="hover:scale-110 transition-transform"
                          >
                            <Star
                              className={`h-3.5 w-3.5 ${(social.myRating || 0) >= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-mono text-muted-foreground">
                      {detail.name}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      {detail.description || t("skillCard.noDesc")}
                    </p>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <InfoItem label="Owner" value={detail.owner || "-"} />
                    <InfoItem label="Scope" value={detail.scope || "-"} />
                    <InfoItem
                      label="Default Branch"
                      value={(detail as any).defaultBranch || "main"}
                    />
                    <InfoItem
                      label="Created"
                      value={detail.createTime ? fmtTime(detail.createTime) : "-"}
                    />
                    <InfoItem
                      label="Updated"
                      value={detail.updateTime ? fmtTime(detail.updateTime) : "-"}
                    />
                    <InfoItem label="Org" value={detail.orgId || "-"} />
                  </div>

                  <Separator />

                  <details className="rounded-lg border bg-muted/30 p-3 text-xs">
                    <summary className="cursor-pointer font-medium text-muted-foreground">
                      {t("editor.gitHintTitle") ?? "Author via git (advanced)"}
                    </summary>
                    <pre className="mt-2 text-[11px] font-mono bg-background/60 p-2 rounded overflow-x-auto whitespace-pre-wrap">
{`# Clone the skill repo (private; authenticate with an OIDC access token)
git clone ${typeof window !== "undefined" ? window.location.origin : "https://hub.example"}/git/${detail.name}.git

# Edit SKILL.md, then commit and push
git add SKILL.md && git commit -m "update skill" && git push`}
                    </pre>
                  </details>
                </div>
              </ScrollArea>
            )}
          </div>

          {/* ─── In-browser content editor (Monaco + file tree) ─────────── */}
          <SkillFileEditorPane
            skillName={detail.name}
            defaultBranch={defaultBranchOf(detail)}
          />
        </div>

        {/* ─── Right: Settings / Shares ───────────────────────────────── */}
        {showRightPanel && (
          <div className="w-80 min-w-0 min-h-0 shrink-0 flex flex-col overflow-hidden bg-card/40">
            <Tabs
              value={rightTab}
              onValueChange={(v) => setRightTab(v as RightPanelTab)}
              className="flex min-h-0 min-w-0 flex-1 flex-col"
            >
              <div className="min-w-0 overflow-x-auto border-b px-3">
                <TabsList className="h-9 min-w-max bg-transparent p-0 gap-1 justify-start">
                  <TabsTrigger
                    value="overview"
                    className="h-8 shrink-0 whitespace-nowrap px-3 text-xs data-[state=active]:bg-violet-600/10 data-[state=active]:text-violet-600"
                  >
                    Overview
                  </TabsTrigger>
                  <TabsTrigger
                    value="settings"
                    className="h-8 shrink-0 whitespace-nowrap px-3 text-xs data-[state=active]:bg-violet-600/10 data-[state=active]:text-violet-600"
                  >
                    Settings
                  </TabsTrigger>
                  <TabsTrigger
                    value="shares"
                    className="h-8 shrink-0 whitespace-nowrap px-3 text-xs data-[state=active]:bg-violet-600/10 data-[state=active]:text-violet-600"
                  >
                    Shares
                  </TabsTrigger>
                  <TabsTrigger
                    value="prs"
                    className="h-8 shrink-0 whitespace-nowrap px-3 text-xs data-[state=active]:bg-violet-600/10 data-[state=active]:text-violet-600"
                  >
                    Pull Requests
                  </TabsTrigger>
                  <TabsTrigger
                    value="releases"
                    className="h-8 shrink-0 whitespace-nowrap px-3 text-xs data-[state=active]:bg-violet-600/10 data-[state=active]:text-violet-600"
                  >
                    Releases
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
                {/* OVERVIEW */}
                <TabsContent value="overview" className="p-3 space-y-3 mt-0">
                  <div className="grid grid-cols-2 gap-2">
                    <InfoItem label="Owner" value={detail.owner || "-"} />
                    <InfoItem label="Scope" value={detail.scope || "-"} />
                    <InfoItem
                      label="Status"
                      value={statusLabel || "-"}
                    />
                    <InfoItem
                      label="Org"
                      value={detail.orgId || "-"}
                    />
                  </div>
                </TabsContent>

                {/* SETTINGS */}
                <TabsContent value="settings" className="p-3 mt-0">
                  <SettingsTab
                    key={detail.name + (detail.updateTime || "")}
                    detail={detail}
                    accessMode={skillAccessMode}
                    onDelete={() => setDeleteConfirmOpen(true)}
                  />
                </TabsContent>

                {/* SHARES */}
                <TabsContent value="shares" className="p-3 mt-0">
                  <ResourceSharePanel
                    resourceType="skill"
                    resourceId={detail.name}
                    owner={detail.owner}
                  />
                </TabsContent>

                {/* PULL REQUESTS */}
                <TabsContent value="prs" className="p-3 mt-0">
                  <PullRequestsPanel skillName={detail.name} />
                </TabsContent>

      {/* RELEASES */}
      <TabsContent value="releases" className="p-3 mt-0">
        <SkillReleasesPanel skillName={detail.name} />
      </TabsContent>
              </div>
            </Tabs>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Skill"
        description={`Are you sure you want to permanently delete "${detail.name}"? This removes the skill and its git repository. This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}

// ─── Child: SettingsTab ────────────────────────────────────────────
interface SettingsTabProps {
  detail: Skill;
  accessMode: AccessMode;
  onDelete: () => void;
}

function SettingsTab({
  detail,
  accessMode,
  onDelete,
}: SettingsTabProps) {
  const t = useT();

  return (
    <div className="space-y-3">
      {/* Access mode (read-only — managed by the Sharing tab) */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">{t("accessMode.label")}</Label>
        <div className="rounded-md border bg-card/50 px-3 py-2.5 flex items-center gap-2">
          <div className="flex-1">
            <div className="text-xs font-medium">
              {t(`accessMode.${accessMode}`)}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {t(`accessMode.${accessMode}Desc`)}
            </div>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {t("accessMode.managedByShares")}
          </span>
        </div>
      </div>

      <Separator />

      {/* Content metadata is Git-owned; this is a projection preview only. */}
      <div className="space-y-2 rounded-md border bg-muted/20 p-3">
        <div className="text-xs font-medium">{t("editor.displayName")}</div>
        <div className="text-sm">{detail.displayName || detail.name}</div>
        <div className="text-xs font-medium pt-1">{t("editor.descriptionLabel")}</div>
        <div className="text-xs text-muted-foreground whitespace-pre-wrap">
          {detail.description || t("skillCard.noDesc")}
        </div>
        <p className="text-[11px] text-muted-foreground pt-1">
          {t("editor.metadataManagedByGit")}
        </p>
      </div>

      <Separator />

      {/* Danger zone */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-destructive">
          {t("editor.dangerZone")}
        </Label>
        <Button
          size="sm"
          variant="outline"
          className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          {t("editor.deleteSkill")}
        </Button>
      </div>
    </div>
  );
}

// SkillFileEditorPane is the in-browser content editor: a left file tree
// and a right Monaco editor, split by a draggable handle. It owns the
// current path + branch state and wires the file-content hooks. The
// pane sits below the metadata header in the left panel and takes the
// remaining vertical space.
type SkillFileEditorPaneProps = {
  skillName: string;
  defaultBranch: string;
};

function SkillFileEditorPane({ skillName, defaultBranch }: SkillFileEditorPaneProps) {
  const t = useT();
  const [currentPath, setCurrentPath] = useState("");
  // Open tabs: one entry per file the user has opened. We keep both
  // real files and in-progress new-file drafts here so each tab owns
  // its own editor instance + dirty/sha state. `create` flips to false
  // after the first successful save (POST → subsequent PUTs). `dirty`
  // is a mirror of the editor's `value !== savedValue` flag, reported
  // via onDirtyChange; it lets the tab strip show a marker and intercept
  // close without lifting the editor's text state.
  const [tabs, setTabs] = useState<{ path: string; create: boolean; dirty: boolean }[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  // Path of a dirty tab the user asked to close; the ConfirmDialog gates
  // the actual removal. null means no close is pending.
  const [pendingClosePath, setPendingClosePath] = useState<string | null>(null);

  // Actually remove a tab and fix up focus. Used by the confirm dialog
  // (after the user accepts discarding) and by unconditional close paths
  // (file delete). Never prompts.
  const forceCloseTab = useCallback((path: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((tab) => tab.path === path);
      if (idx < 0) return prev;
      const next = prev.filter((tab) => tab.path !== path);
      // If we closed the active tab, move focus to the neighbour.
      setActivePath((cur) => {
        if (cur !== path) return cur;
        if (next.length === 0) return null;
        const clamp = Math.min(idx, next.length - 1);
        return next[clamp].path;
      });
      return next;
    });
  }, []);

  // Open a real file tab (or focus it if already open). New tabs start
  // clean; dirty flips to true only when the user actually types.
  const openTab = useCallback((path: string, create: boolean) => {
    setTabs((prev) => {
      if (prev.some((tab) => tab.path === path)) return prev;
      return [...prev, { path, create, dirty: false }];
    });
    setActivePath(path);
  }, []);

  const tree = useFileTree(skillName, currentPath, defaultBranch);
  const deleteMutation = useDeleteFile();

  // Auto-open SKILL.md on first load so the editor shows content instead of
  // the empty state. Runs once when the root tree resolves and no tab is open yet.
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (autoOpenedRef.current || tabs.length > 0) return;
    const entries = tree.data;
    if (!entries) return;
    const skillMd = entries.find(
      (e) => e.type === "file" && e.name === "SKILL.md",
    );
    if (skillMd) {
      autoOpenedRef.current = true;
      const handle = window.setTimeout(() => openTab(skillMd.path, false), 0);
      return () => window.clearTimeout(handle);
    }
  }, [tree.data, tabs.length, openTab]);

  // Delete a file from the skill repo. We pass the optimistic-concurrency
  // sha so the server rejects the delete if someone else moved the file
  // out from under us. After the delete lands, the tree invalidates
  // (see useDeleteFile.onSuccess) and we close any open tab for it.
  const handleDeleteFile = (path: string, sha: string) => {
    deleteMutation.mutate(
      { skillName, path, sha, branch: defaultBranch },
      {
        onSuccess: () => {
          // The delete itself was already confirmed and the file is gone
          // server-side, so close the tab without a second dirty prompt.
          forceCloseTab(path);
          toast.success(t("editor.fileDeleted"));
        },
        onError: (err) => {
          const conflict = err as { isConflict?: boolean };
          if (conflict?.isConflict) {
            toast.warning(t("editor.conflict"));
            tree.refetch();
          } else {
            toast.error(t("editor.deleteFailed"));
          }
        },
      },
    );
  };

  // New-file flow: a dialog collects the file name (which may contain a
  // sub-path like docs/guide.md). The backend creates intermediate
  // directories automatically, so folders appear as soon as a file is
  // saved into them. The actual POST fires on the editor's first save.
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const startCreate = () => {
    setCreateName("");
    setCreateError(null);
    setCreateOpen(true);
  };

  const confirmCreate = () => {
    const trimmed = createName.trim();
    // Reject empty, path traversal, and leading/trailing slashes. A name
    // like "docs/guide.md" is allowed and creates the docs folder.
    if (!trimmed || /(^|\/)\.\.(\/|$)/.test(trimmed) || /^\/|\/$/.test(trimmed)) {
      setCreateError(t("editor.invalidFileName") ?? "Invalid file name");
      return;
    }
    const path = currentPath ? `${currentPath}/${trimmed}` : trimmed;
    setCreateOpen(false);
    openTab(path, true);
    toast.success(t("editor.fileCreated"));
  };

  // Mirror a single tab's dirty flag, reported upward by the editor.
  const markTabDirty = useCallback((path: string, dirty: boolean) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.path === path && tab.dirty !== dirty ? { ...tab, dirty } : tab,
      ),
    );
  }, []);

  // User-initiated close (the tab X). Clean tabs close immediately;
  // dirty tabs route through the ConfirmDialog via pendingClosePath.
  const requestCloseTab = useCallback(
    (path: string) => {
      const tab = tabs.find((item) => item.path === path);
      if (!tab?.dirty) {
        forceCloseTab(path);
        return;
      }
      setPendingClosePath(path);
    },
    [tabs, forceCloseTab],
  );

  // After a new-file tab saves successfully, flip it to edit mode so the
  // next save is a PUT (not another POST). A fresh save also means the
  // buffer is clean.
  const markSaved = (path: string) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.path === path
          ? { ...tab, create: false, dirty: false }
          : tab,
      ),
    );
  };

  // Browser refresh / tab close / external navigation protection. Lifted
  // to the pane so the whole page registers exactly one listener, gated
  // on whether *any* open tab is dirty (the editors no longer self-register).
  const hasDirtyTabs = tabs.some((tab) => tab.dirty);
  useEffect(() => {
    if (!hasDirtyTabs) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasDirtyTabs]);

  return (
    <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
      <ResizablePanel defaultSize={22} minSize={15} maxSize={45}>
        <SkillFileTree
          skillName={skillName}
          path={currentPath}
          entries={tree.data}
          isLoading={tree.isLoading}
          selectedPath={activePath ?? undefined}
          deletingPath={deleteMutation.isPending ? deleteMutation.variables?.path ?? null : null}
          onNavigate={(p) => {
            setCurrentPath(p);
          }}
          onSelectFile={(p) => openTab(p, false)}
          onCreateFile={startCreate}
          onDeleteFile={handleDeleteFile}
        />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={78} minSize={40}>
        {tabs.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
            <div className="space-y-1">
              <p>{t("editor.empty") ?? "Select or create a file to start editing."}</p>
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            {/* Tab strip. Each tab shows the file basename + a close
                button. The active tab is highlighted; inactive tabs are
                still rendered below (hidden) so their Monaco state
                survives tab switches. */}
            <div className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b bg-muted/30">
              {tabs.map((tab) => {
                const active = tab.path === activePath;
                const name = tab.path.split("/").pop() ?? tab.path;
                return (
                  <div
                    key={tab.path}
                    role="button"
                    tabIndex={0}
                    className={
                      "group flex shrink-0 items-center gap-1.5 border-r px-3 text-xs " +
                      (active
                        ? "bg-background font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/50")
                    }
                    onClick={() => setActivePath(tab.path)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActivePath(tab.path);
                      }
                    }}
                  >
                    <span className="truncate max-w-[160px]">{name}</span>
                    {tab.create && (
                      <span className="rounded bg-sky-500/15 px-1 text-[9px] uppercase text-sky-600 dark:text-sky-300">
                        new
                      </span>
                    )}
                    {tab.dirty && (
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                        title={t("editor.unsavedChanges")}
                      />
                    )}
                    <button
                      type="button"
                      className="rounded p-0.5 opacity-50 hover:bg-muted hover:opacity-100"
                      title={t("editor.closeTab")}
                      onClick={(e) => {
                        e.stopPropagation();
                        requestCloseTab(tab.path);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
            {/* Editor area: render every open tab, hide non-active ones.
                This keeps each Monaco model alive (cursor, undo stack,
                unsaved buffer) across tab switches. */}
            <div className="min-h-0 flex-1">
              {tabs.map((tab) => (
                <div
                  key={tab.path}
                  className={tab.path === activePath ? "h-full" : "hidden"}
                >
                  <EditorTab
                    skillName={skillName}
                    filePath={tab.path}
                    branch={defaultBranch}
                    create={tab.create}
                    active={tab.path === activePath}
                    onSaved={() => markSaved(tab.path)}
                    onDirtyChange={(dirty) => markTabDirty(tab.path, dirty)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </ResizablePanel>
      <CreateFileDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        value={createName}
        onValueChange={setCreateName}
        error={createError}
        currentPath={currentPath}
        onConfirm={confirmCreate}
      />
      <ConfirmDialog
        open={pendingClosePath !== null}
        onOpenChange={(open) => {
          if (!open) setPendingClosePath(null);
        }}
        title={t("editor.unsavedCloseTitle")}
        description={
          pendingClosePath
            ? t("editor.unsavedCloseMessage", { path: pendingClosePath })
            : ""
        }
        confirmLabel={t("editor.discardAndClose")}
        variant="destructive"
        onConfirm={() => {
          if (!pendingClosePath) return;
          forceCloseTab(pendingClosePath);
          setPendingClosePath(null);
        }}
      />
    </ResizablePanelGroup>
  );
}

// CreateFileDialog collects the name for a new file. The name may carry
// a sub-path (docs/guide.md); the backend creates intermediate folders
// automatically on the first save, so there is no separate "new folder"
// action. Enter confirms, Escape cancels.
type CreateFileDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onValueChange: (v: string) => void;
  error: string | null;
  currentPath: string;
  onConfirm: () => void;
};

function CreateFileDialog({
  open,
  onOpenChange,
  value,
  onValueChange,
  error,
  currentPath,
  onConfirm,
}: CreateFileDialogProps) {
  const t = useT();
  const hint = currentPath ? `${currentPath}/` : "";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("editor.createFileTitle") ?? "Create new file"}</DialogTitle>
          <DialogDescription>
            {t("editor.createFileDescription") ??
              "Enter a file name. Use a path like docs/guide.md to create it inside a folder."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="new-file-name">{t("editor.fileName") ?? "File name"}</Label>
          <div className="flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm">
            {hint && <span className="shrink-0 text-muted-foreground">{hint}</span>}
            <Input
              id="new-file-name"
              autoFocus
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onConfirm();
                }
              }}
              placeholder={t("editor.fileNamePlaceholder") ?? "filename.md or path/to/file.md"}
              className="h-auto flex-1 border-0 px-0 shadow-none focus-visible:ring-0"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel") ?? "Cancel"}
          </Button>
          <Button onClick={onConfirm}>{t("editor.create") ?? "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// EditorTab wraps MonacoSkillEditor per open file. Each tab owns its
// own useFileContent/useSaveFile so concurrent tabs don't share query
// or mutation state. `active` is currently informational (Monaco loads
// lazily); the parent hides non-active tabs via CSS. `onDirtyChange`
// forwards the editor's dirty flag so the pane can mark the tab and
// intercept close.
type EditorTabProps = {
  skillName: string;
  filePath: string;
  branch: string;
  create: boolean;
  active: boolean;
  onSaved: () => void;
  onDirtyChange: (dirty: boolean) => void;
};

function EditorTab({
  skillName,
  filePath,
  branch,
  create,
  onSaved,
  onDirtyChange,
}: EditorTabProps) {
  // Only fetch content for real files (create tabs start empty).
  const fileQuery = useFileContent(skillName, filePath, branch, {
    enabled: !create,
  });
  const saveMutation = useSaveFile();

  const editorInitial = create ? "" : (fileQuery.data?.content ?? "");
  const editorSha = create ? undefined : fileQuery.data?.sha;

  const handleConflict = () => {
    if (!create) fileQuery.refetch();
  };

  return (
    <MonacoSkillEditor
      key={filePath + (create ? ":create" : ":edit")}
      skillName={skillName}
      filePath={filePath}
      branch={branch}
      initialContent={editorInitial}
      sha={editorSha}
      create={create}
      readOnly={saveMutation.isPending}
      onSaved={(_sha, _content) => onSaved()}
      onConflict={handleConflict}
      onDirtyChange={onDirtyChange}
    />
  );
}
