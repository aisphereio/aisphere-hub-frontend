"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, Loader2, Save, Trash2, Star, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
} from "@/hooks/use-skill-files";
import { useResourceShares } from "@/hooks/use-shares";
import { getScopeColor, getStatusColor, fmtTime } from "@/lib/utils";
import { skillApi } from "@/lib/api";
import { ConfirmDialog, InfoItem } from "@/components/shared";
import { ResourceSharePanel } from "@/components/aihub";
import { useT } from "@/lib/i18n";
import type { Skill, AccessMode } from "@/lib/api/types";
import { SkillFileTree } from "./skill-file-tree";

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

type RightPanelTab = "overview" | "runtime" | "settings" | "shares";

/**
 * SkillEditor — settings-focused editor for the Git-native Hub.
 *
 * The Git-native refactor (Hub PR #18) removed the version/draft/file REST
 * surface. Skill content is authored through git (clone/push/LFS), not in the
 * UI, so this editor no longer hosts a file tree, code editor, version
 * timeline, or commit/publish/submit/online/offline actions. It focuses on
 * metadata the Hub still persists via UpdateSkill (displayName/description),
 * sharing, the runtime catalog reference, and delete. A git-aware content
 * editor is a follow-up.
 */
export function SkillEditor({ skillName, onBack }: SkillEditorProps) {
  const t = useT();
  const [rightTab, setRightTab] = useState<RightPanelTab>("overview");
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const {
    data: detail,
    isLoading: detailLoading,
    refetch: refetchDetail,
  } = useSkillDetail(skillName);
  const { data: social } = useSkillSocial(skillName);

  const deleteMutation = useSkillDelete();
  const starMutation = useSocialStar();
  const subscribeMutation = useSocialSubscribe();
  const ratingMutation = useSocialRating();

  const { data: sharesData } = useResourceShares("skill", skillName, {
    enabled: showRightPanel && rightTab === "shares",
  });
  const skillAccessMode: AccessMode =
    sharesData?.accessMode ?? deriveAccessMode(sharesData?.items || []);

  const saveDisplayNameDescription = async (
    displayName: string,
    description: string,
  ) => {
    if (!detail) return;
    try {
      await skillApi.update(detail.name, { displayName, description });
      toast.success(t("editor.saved"));
      refetchDetail();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("skills.actionFailed"));
    }
  };

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
          {/* Metadata header (social/title/info). Height-capped so the
              Monaco editor below gets the bulk of the panel. */}
          <ScrollArea className="shrink-0 max-h-[45vh] border-b">
            <div className="p-6 max-w-3xl mx-auto space-y-6">
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
                <h2 className="text-lg font-semibold">
                  {detail.displayName || detail.name}
                </h2>
                <p className="text-xs font-mono text-muted-foreground mt-0.5">
                  {detail.name}
                </p>
                <p className="text-sm text-muted-foreground mt-3">
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

          {/* ─── In-browser content editor (Monaco + file tree) ─────────── */}
          <SkillFileEditorPane
            skillName={detail.name}
            defaultBranch={defaultBranchOf(detail)}
          />
        </div>

        {/* ─── Right: Settings / Runtime / Shares ──────────────────────── */}
        {showRightPanel && (
          <div className="w-80 shrink-0 flex flex-col bg-card/40">
            <Tabs
              value={rightTab}
              onValueChange={(v) => setRightTab(v as RightPanelTab)}
              className="flex flex-col flex-1"
            >
              <div className="px-3 border-b">
                <TabsList className="h-9 bg-transparent p-0 gap-1 w-full justify-start">
                  <TabsTrigger
                    value="overview"
                    className="text-xs h-8 px-3 data-[state=active]:bg-violet-600/10 data-[state=active]:text-violet-600"
                  >
                    Overview
                  </TabsTrigger>
                  <TabsTrigger
                    value="runtime"
                    className="text-xs h-8 px-3 data-[state=active]:bg-violet-600/10 data-[state=active]:text-violet-600"
                  >
                    Runtime
                  </TabsTrigger>
                  <TabsTrigger
                    value="settings"
                    className="text-xs h-8 px-3 data-[state=active]:bg-violet-600/10 data-[state=active]:text-violet-600"
                  >
                    Settings
                  </TabsTrigger>
                  <TabsTrigger
                    value="shares"
                    className="text-xs h-8 px-3 data-[state=active]:bg-violet-600/10 data-[state=active]:text-violet-600"
                  >
                    Shares
                  </TabsTrigger>
                </TabsList>
              </div>

              <ScrollArea className="flex-1">
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

                {/* RUNTIME */}
                <TabsContent value="runtime" className="p-3 space-y-3 mt-0">
                  <div>
                    <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Client API
                    </Label>
                    <p className="text-[11px] text-muted-foreground mt-1 mb-2">
                      Used by the Agent runtime to resolve this skill at request
                      time.
                    </p>
                    <pre className="text-[10px] font-mono bg-muted/40 p-2.5 rounded-md overflow-x-auto scrollbar-thin whitespace-pre-wrap leading-relaxed">
{`# Catalog record
GET /v3/aihub/catalog/skills/${detail.name}

# Online manifest consumed by runtime
GET /v3/aihub/catalog/skills/${detail.name}/manifest`}
                    </pre>
                  </div>
                </TabsContent>

                {/* SETTINGS */}
                <TabsContent value="settings" className="p-3 mt-0">
                  <SettingsTab
                    key={detail.name + (detail.updateTime || "")}
                    detail={detail}
                    accessMode={skillAccessMode}
                    onSaveDisplayNameDescription={
                      saveDisplayNameDescription
                    }
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
              </ScrollArea>
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
// Holds its own form state initialized from `detail` on mount. Only the
// displayName/description fields are persisted by the new Hub UpdateSkill
// API; bizTags/labels/metadata were removed (no backend support).
interface SettingsTabProps {
  detail: Skill;
  accessMode: AccessMode;
  onSaveDisplayNameDescription: (
    displayName: string,
    description: string,
  ) => Promise<void>;
  onDelete: () => void;
}

function SettingsTab({
  detail,
  accessMode,
  onSaveDisplayNameDescription,
  onDelete,
}: SettingsTabProps) {
  const t = useT();
  const [editDisplayName, setEditDisplayName] = useState(
    () => detail.displayName || "",
  );
  const [editDescription, setEditDescription] = useState(
    () => detail.description || "",
  );
  const [savingNameDesc, setSavingNameDesc] = useState(false);

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

      {/* Display name + Description (editable together) */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">{t("editor.displayName")}</Label>
        <Input
          value={editDisplayName}
          onChange={(e) => setEditDisplayName(e.target.value)}
          className="text-xs h-8"
          placeholder={t("editor.displayNamePlaceholder")}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">
          {t("editor.descriptionLabel")}
        </Label>
        <Textarea
          value={editDescription}
          onChange={(e) => setEditDescription(e.target.value)}
          rows={3}
          className="text-xs resize-none"
          placeholder={t("editor.descriptionPlaceholder")}
        />
      </div>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        disabled={savingNameDesc}
        onClick={async () => {
          setSavingNameDesc(true);
          try {
            await onSaveDisplayNameDescription(
              editDisplayName,
              editDescription,
            );
          } finally {
            setSavingNameDesc(false);
          }
        }}
      >
        <Save className="h-3 w-3 mr-1" /> {t("editor.saveNameDesc")}
      </Button>

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
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [creatingFile, setCreatingFile] = useState<string | null>(null);

  const tree = useFileTree(skillName, currentPath, defaultBranch);
  // Fetch the file the user selected, OR the in-progress new-file path
  // (with create=true so the editor knows to POST instead of PUT).
  const fileQuery = useFileContent(
    skillName,
    selectedFile ?? creatingFile,
    defaultBranch,
    { enabled: Boolean(selectedFile) },
  );
  const saveMutation = useSaveFile();

  // New-file flow: when the user asks to create a file we open the
  // editor with an empty buffer and create=true. The actual POST fires
  // on first save (see MonacoSkillEditor.doSave).
  const startCreate = () => {
    setSelectedFile(null);
    setCreatingFile(currentPath ? `${currentPath}/new-file.md` : "new-file.md");
  };

  // When the user picks a real file, drop out of create mode.
  const selectFile = (p: string) => {
    setCreatingFile(null);
    setSelectedFile(p);
  };

  // Editor content source: existing file content from the server, or
  // empty for a brand-new file.
  const editorInitial = creatingFile ? "" : (fileQuery.data?.content ?? "");
  const editorSha = creatingFile ? undefined : fileQuery.data?.sha;
  const editorPath = selectedFile ?? creatingFile;
  const editorCreate = Boolean(creatingFile);

  // Refetch on conflict so the editor adopts the server's current sha
  // and content; the user then decides to overwrite (edit + save) or
  // discard (revert). We do NOT auto-overwrite.
  const handleConflict = () => {
    if (selectedFile) fileQuery.refetch();
  };

  return (
    <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
      <ResizablePanel defaultSize={22} minSize={15} maxSize={45}>
        <SkillFileTree
          skillName={skillName}
          path={currentPath}
          entries={tree.data}
          isLoading={tree.isLoading}
          selectedPath={selectedFile ?? undefined}
          onNavigate={(p) => {
            setCurrentPath(p);
            // Navigating into a directory clears the open file so the
            // editor doesn't keep showing a file from another folder.
            setSelectedFile(null);
            setCreatingFile(null);
          }}
          onSelectFile={selectFile}
          onCreateFile={startCreate}
        />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={78} minSize={40}>
        {editorPath ? (
          <MonacoSkillEditor
            key={editorPath + (editorCreate ? ":create" : ":edit") + (editorSha || "")}
            skillName={skillName}
            filePath={editorPath}
            branch={defaultBranch}
            initialContent={editorInitial}
            sha={editorSha}
            create={editorCreate}
            readOnly={saveMutation.isPending}
            onSaved={(_sha, _content) => {
              // After a successful create, switch into edit mode so the
              // next save is a PUT (not another POST).
              if (creatingFile) {
                setSelectedFile(creatingFile);
                setCreatingFile(null);
              }
            }}
            onConflict={handleConflict}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
            <div className="space-y-1">
              <p>{t("editor.empty") ?? "Select or create a file to start editing."}</p>
            </div>
          </div>
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
