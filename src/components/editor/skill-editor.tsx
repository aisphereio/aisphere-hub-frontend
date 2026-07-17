"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  ArrowLeft,
  Loader2,
  Save,
  Trash2,
  MoreHorizontal,
  GitBranch,
  FileCode2,
  Star,
  Bell,
  Download,
  Play,
  Pause,
  Send,
  CheckCircle2,
  History,
  RefreshCw,
  X,
  Tag,
  Lock,
  Globe,
  PanelRightClose,
  PanelRightOpen,
  Eye,
  Pencil,
  Share2,
  GitCommitHorizontal,
  Users,
  Columns2,
  AlertCircle,
  FilePlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  useSkillDetail,
  useSkillSocial,
  useSkillFiles,
  useSkillFileContent,
  useSkillLabels,
  useSkillDelete,
  useSkillPublish,
  useSkillSubmit,
  useSkillCommit,
  useSkillOnline,
  useSkillOffline,
  useSkillBizTags,
  useSocialStar,
  useSocialRating,
  useSocialSubscribe,
  useSaveSkillFile,
  useCreateSkillFile,
  useDeleteSkillFile,
  useRenameSkillFile,
  useEnsureDraftVersion,
} from "@/hooks/use-skills";
import { useResourceShares } from "@/hooks/use-shares";
import {
  getScopeColor,
  getStatusColor,
  versionOf,
  buildTree,
  fmtTime,
  cn,
} from "@/lib/utils";
import { skillApi } from "@/lib/api";
import { ConfirmDialog, InfoItem } from "@/components/shared";
import { FileTree, FileBreadcrumbs } from "./file-tree";
import { CodeEditor } from "./code-editor";
import { ResourceSharePanel } from "@/components/aihub";
import { useT } from "@/lib/i18n";
import type { Skill, SkillVersion, AccessMode, SkillFileContent } from "@/lib/api/types";
import { deriveAccessMode } from "@/lib/api/types";

interface SkillEditorProps {
  skillName: string;
  onBack: () => void;
}

type RightPanelTab =
  | "overview"
  | "versions"
  | "runtime"
  | "settings"
  | "shares";

type MarkdownViewMode = "edit" | "preview" | "split";

export function SkillEditor({ skillName, onBack }: SkillEditorProps) {
  const t = useT();
  const [userVersionChoice, setUserVersionChoice] = useState<string | null>(null);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("");
  const [rightTab, setRightTab] = useState<RightPanelTab>("overview");
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  // Commit draft dialog state. `commitTargetVersion` is the draft version
  // being committed; null means the dialog is closed.
  const [commitTargetVersion, setCommitTargetVersion] = useState<string | null>(
    null,
  );
  const [commitMsg, setCommitMsg] = useState("");
  const [commitCascade, setCommitCascade] = useState<{
    submit: boolean;
    publish: boolean;
    online: boolean;
  }>({ submit: false, publish: false, online: false });

  // Dirty content per file path (uncommitted edits).
  const [dirtyMap, setDirtyMap] = useState<Record<string, string>>({});

  const {
    data: detail,
    isLoading: detailLoading,
    refetch: refetchDetail,
  } = useSkillDetail(skillName);
  const { data: social } = useSkillSocial(skillName);

  // When detail changes, prefer an editing/draft version if one exists.
  // The user's explicit choice still wins.
  const preferredDraftVersion = useMemo(() => {
    if (!detail || userVersionChoice) return null;
    return (
      (detail.versions || []).find(
        (v) => v.status === "draft" || v.status === "submitted",
      ) || null
    );
  }, [detail, userVersionChoice]);

  const activeVersion = useMemo(() => {
    if (!detail) return userVersionChoice || "";
    const versions = detail.versions || [];
    if (userVersionChoice && versions.some((v) => v.version === userVersionChoice)) {
      return userVersionChoice;
    }
    return preferredDraftVersion?.version || versionOf(detail);
  }, [userVersionChoice, preferredDraftVersion, detail]);

  const activeVersionMeta = useMemo(() => {
    if (!detail || !activeVersion) return null;
    return (detail.versions || []).find((x) => x.version === activeVersion) || null;
  }, [detail, activeVersion]);
  const activeVersionStatus = activeVersionMeta?.status || "";
  const isOnlineVersion = activeVersionMeta?.status === "online";
  const canEditInEditor = Boolean(activeVersion);

  // Files
  const { data: filesData, refetch: refetchFiles } = useSkillFiles(
    skillName,
    activeVersion || null,
  );
  const files = filesData?.files || [];
  const tree = useMemo(() => buildTree(files), [files]);

  // File content (one query per active tab)
  const { data: activeFileData, isLoading: fileLoading } = useSkillFileContent(
    skillName,
    activeVersion || null,
    activeTab || null,
  );
  const activeFileContent = activeFileData?.binary
    ? "[binary resource — download the ZIP to view]"
    : activeFileData?.content || "";
  const isBinary = Boolean(activeFileData?.binary);

  // Mutations
  const deleteMutation = useSkillDelete();
  const publishMutation = useSkillPublish();
  const submitMutation = useSkillSubmit();
  const commitMutation = useSkillCommit();
  const onlineMutation = useSkillOnline();
  const offlineMutation = useSkillOffline();
  const bizTagsMutation = useSkillBizTags();
  const labelsMutation = useSkillLabels();
  const starMutation = useSocialStar();
  const subscribeMutation = useSocialSubscribe();
  const ratingMutation = useSocialRating();

  const saveFileMutation = useSaveSkillFile();
  const createFileMutation = useCreateSkillFile();
  const deleteFileMutation = useDeleteSkillFile();
  const renameFileMutation = useRenameSkillFile();
  const ensureDraftMutation = useEnsureDraftVersion();
  const versionActionPending =
    submitMutation.isPending ||
    publishMutation.isPending ||
    commitMutation.isPending ||
    onlineMutation.isPending ||
    offlineMutation.isPending ||
    ensureDraftMutation.isPending;

  const { data: sharesData } = useResourceShares("skill", skillName, {
    enabled: showRightPanel && rightTab === "shares",
  });
  const skillAccessMode: AccessMode =
    sharesData?.accessMode ?? deriveAccessMode(sharesData?.items || []);

  const openFile = useCallback((path: string) => {
    setOpenTabs((prev) => (prev.includes(path) ? prev : [...prev, path]));
    setActiveTab(path);
  }, []);

  const closeTab = useCallback(
    (path: string) => {
      setOpenTabs((prev) => {
        const next = prev.filter((p) => p !== path);
        if (activeTab === path) {
          setActiveTab(next[next.length - 1] || "");
        }
        return next;
      });
      setDirtyMap((prev) => {
        const next = { ...prev };
        delete next[path];
        return next;
      });
    },
    [activeTab],
  );

  // Read the saved baseline for a file path directly from the React Query cache,
  // avoiding the setState-in-effect anti-pattern.
  const queryClient = useQueryClient();
  const getSavedContent = useCallback(
    (path: string): string => {
      const data = queryClient.getQueryData<SkillFileContent>([
        "skills",
        "file",
        skillName,
        activeVersion,
        path,
      ]);
      return data?.binary ? "" : data?.content || "";
    },
    [queryClient, skillName, activeVersion],
  );

  const dirtyCount = useMemo(
    () =>
      Object.entries(dirtyMap).filter(
        ([path, content]) => getSavedContent(path) !== content,
      ).length,
    [dirtyMap, getSavedContent],
  );

  const isDirty = (path: string) =>
    dirtyMap[path] !== undefined && dirtyMap[path] !== getSavedContent(path);

  const handleEditorChange = useCallback(
    (value: string) => {
      if (!activeTab) return;
      setDirtyMap((prev) => ({ ...prev, [activeTab]: value }));
    },
    [activeTab],
  );

  // Ensure a draft version exists when the user edits the online runtime
  // artifact. Non-online versions are writable directly.
  const ensureDraft = useCallback(async (): Promise<string | null> => {
    if (!detail) return null;
    if (!isOnlineVersion) return activeVersion;
    try {
      toast.info(t("editor.draftNeeded"));
      const res = await ensureDraftMutation.mutateAsync({
        skillName: detail.name,
        baseVersion: activeVersion,
      });
      setUserVersionChoice(res.version);
      toast.success(t("editor.draftCreated"));
      await refetchDetail();
      return res.version;
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : t("editor.draftCreateFailed"),
      );
      return null;
    }
  }, [detail, isOnlineVersion, activeVersion, ensureDraftMutation, refetchDetail, t]);

  // Save a single file.
  const saveFile = useCallback(
    async (path: string) => {
      if (!detail || !activeVersion) return;
      const content = dirtyMap[path];
      if (content === undefined) return;

      let version = activeVersion;
      if (isOnlineVersion) {
        const draftVersion = await ensureDraft();
        if (!draftVersion) return;
        version = draftVersion;
      }

      try {
        await saveFileMutation.mutateAsync({
          skillName: detail.name,
          version,
          path,
          content,
        });
        // Invalidate the cached file content so the next read pulls the new server value.
        queryClient.invalidateQueries({
          queryKey: ["skills", "file", detail.name, version, path],
        });
        setDirtyMap((prev) => {
          const next = { ...prev };
          delete next[path];
          return next;
        });
        toast.success(t("editor.fileSaved"));
        refetchFiles();
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : t("editor.fileSaveFailed"),
        );
      }
    },
    [detail, activeVersion, isOnlineVersion, dirtyMap, ensureDraft, saveFileMutation, queryClient, refetchFiles, t],
  );

  // Save all dirty files.
  const saveAll = useCallback(async () => {
    if (!detail || !activeVersion) return;
    let version = activeVersion;
    if (isOnlineVersion) {
      const draftVersion = await ensureDraft();
      if (!draftVersion) return;
      version = draftVersion;
    }
    const dirtyPaths = Object.entries(dirtyMap)
      .filter(([path, content]) => getSavedContent(path) !== content)
      .map(([path]) => path);
    if (dirtyPaths.length === 0) return;
    let okCount = 0;
    let failCount = 0;
    for (const path of dirtyPaths) {
      try {
        await saveFileMutation.mutateAsync({
          skillName: detail.name,
          version,
          path,
          content: dirtyMap[path],
        });
        queryClient.invalidateQueries({
          queryKey: ["skills", "file", detail.name, version, path],
        });
        setDirtyMap((prev) => {
          const next = { ...prev };
          delete next[path];
          return next;
        });
        okCount += 1;
      } catch {
        failCount += 1;
      }
    }
    if (okCount > 0 && failCount === 0) {
      toast.success(`${okCount} file(s) saved`);
    } else if (failCount > 0 && okCount > 0) {
      toast.warning(`${okCount} saved, ${failCount} failed`);
    } else if (failCount > 0) {
      toast.error(`Failed to save ${failCount} file(s)`);
    }
    refetchFiles();
  }, [detail, activeVersion, isOnlineVersion, dirtyMap, getSavedContent, ensureDraft, saveFileMutation, queryClient, refetchFiles]);

  // Create a new file or folder inside the draft version.
  const handleCreateFile = useCallback(
    async (parentDir: string, name: string, type: "file" | "dir") => {
      if (!detail || !activeVersion) return;
      let version = activeVersion;
      if (isOnlineVersion) {
        const draftVersion = await ensureDraft();
        if (!draftVersion) return;
        version = draftVersion;
      }
      const path = parentDir ? `${parentDir}/${name}` : name;
      try {
        await createFileMutation.mutateAsync({
          skillName: detail.name,
          version,
          path,
          type,
        });
        toast.success(t("editor.fileCreated"));
        await refetchFiles();
        if (type === "file") openFile(path);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to create");
      }
    },
    [detail, activeVersion, isOnlineVersion, ensureDraft, createFileMutation, refetchFiles, openFile, t],
  );

  // Delete a file or directory.
  const handleDeleteNode = useCallback(
    async (path: string) => {
      if (!detail || !activeVersion) return;
      let version = activeVersion;
      if (isOnlineVersion) {
        const draftVersion = await ensureDraft();
        if (!draftVersion) return;
        version = draftVersion;
      }
      try {
        await deleteFileMutation.mutateAsync({
          skillName: detail.name,
          version,
          path,
        });
        toast.success(t("editor.fileDeleted"));
        // Close the tab if open
        if (openTabs.includes(path)) closeTab(path);
        refetchFiles();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to delete");
      }
    },
    [detail, activeVersion, isOnlineVersion, ensureDraft, deleteFileMutation, refetchFiles, openTabs, closeTab, t],
  );

  // Rename / move a file or directory.
  const handleRenameNode = useCallback(
    async (oldPath: string, newPath: string) => {
      if (!detail || !activeVersion) return;
      let version = activeVersion;
      if (isOnlineVersion) {
        const draftVersion = await ensureDraft();
        if (!draftVersion) return;
        version = draftVersion;
      }
      try {
        await renameFileMutation.mutateAsync({
          skillName: detail.name,
          version,
          oldPath,
          newPath,
        });
        toast.success(t("editor.fileRenamed"));
        // Update open tabs
        if (openTabs.includes(oldPath)) {
          setOpenTabs((prev) => prev.map((p) => (p === oldPath ? newPath : p)));
          if (activeTab === oldPath) setActiveTab(newPath);
        }
        refetchFiles();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to rename");
      }
    },
    [detail, activeVersion, isOnlineVersion, ensureDraft, renameFileMutation, refetchFiles, openTabs, activeTab, t],
  );

  const doVersionAction = async (action: string, version: string) => {
    if (!detail) return;
    try {
      switch (action) {
        case "commit":
          // Commit needs a commit message + cascade options — open the
          // dialog instead of running inline.
          openCommitDialog(version);
          return;
        case "submit":
          await submitMutation.mutateAsync({ skillName: detail.name, version });
          toast.success(t("editor.versionSubmitted"));
          break;
        case "publish":
          await publishMutation.mutateAsync({
            skillName: detail.name,
            version,
          });
          toast.success(t("editor.versionPublished"));
          break;
        case "online":
          await onlineMutation.mutateAsync({ skillName: detail.name, version });
          toast.success(t("editor.broughtOnline"));
          try {
            const draft = await ensureDraftMutation.mutateAsync({
              skillName: detail.name,
              baseVersion: version,
            });
            setUserVersionChoice(draft.version);
          } catch {
            toast.info(t("editor.draftNeeded"));
          }
          break;
        case "offline":
          await offlineMutation.mutateAsync({
            skillName: detail.name,
            version,
          });
          toast.success(t("editor.takenOffline"));
          break;
      }
      await refetchDetail();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("skills.actionFailed"));
    }
  };

  const versionActionsFor = (v: SkillVersion) => {
    switch (v.status) {
      case "draft":
        return [
          { action: "commit", label: t("editor.commit"), icon: GitCommitHorizontal },
          { action: "submit", label: t("editor.submit"), icon: Send },
        ];
      case "submitted":
        return [{ action: "publish", label: t("editor.publish"), icon: CheckCircle2 }];
      case "published":
        return [{ action: "online", label: t("editor.bringOnline"), icon: Play }];
      case "online":
        return [{ action: "offline", label: t("editor.takeOffline"), icon: Pause }];
      default:
        return [];
    }
  };

  // Open the commit dialog for a draft version. The actual commit runs in
  // `handleCommit` once the user confirms the message + cascade options.
  const openCommitDialog = (version: string) => {
    setCommitMsg("");
    setCommitCascade({ submit: false, publish: false, online: false });
    setCommitTargetVersion(version);
  };

  const handleCommit = async () => {
    if (!detail || !commitTargetVersion) return;
    try {
      await commitMutation.mutateAsync({
        skillName: detail.name,
        version: commitTargetVersion,
        commitMsg: commitMsg.trim() || undefined,
        submit: commitCascade.submit,
        publish: commitCascade.publish,
        online: commitCascade.online,
      });
      toast.success(t("editor.committed"));
      const committedVersion = commitTargetVersion;
      setCommitTargetVersion(null);
      await refetchDetail();
      // If the commit cascaded to "online", switch the editor to a fresh
      // draft so the user can keep editing.
      if (commitCascade.online) {
        try {
          const draft = await ensureDraftMutation.mutateAsync({
            skillName: detail.name,
            baseVersion: committedVersion,
          });
          setUserVersionChoice(draft.version);
        } catch {
          toast.info(t("editor.draftNeeded"));
        }
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("skills.actionFailed"));
    }
  };

  const downloadZip = async (version: string) => {
    if (!detail || !version) return;
    try {
      const pkg = await skillApi.download(detail.name, version);
      const raw = pkg.packageBytes || "";
      const binary = atob(raw);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1)
        bytes[i] = binary.charCodeAt(i);
      const url = URL.createObjectURL(
        new Blob([bytes], { type: "application/zip" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `${detail.name}-${version}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("skills.actionFailed"));
    }
  };

  const saveBizTags = async (tagsText: string) => {
    if (!detail) return;
    try {
      const tags = tagsText
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      await bizTagsMutation.mutateAsync({ skillName: detail.name, tags });
      toast.success(t("editor.bizTagsSaved"));
      refetchDetail();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("skills.actionFailed"));
    }
  };

  const saveLabels = async (labelsTextValue: string) => {
    if (!detail) return;
    try {
      const labels = JSON.parse(labelsTextValue);
      await labelsMutation.mutateAsync({ skillName: detail.name, labels });
      toast.success(t("editor.labelsSaved"));
      refetchDetail();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("editor.invalidJson"));
    }
  };

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

  const isMarkdown = useMemo(() => {
    if (!activeTab) return false;
    return (
      /\.(md|markdown)$/i.test(activeTab) ||
      activeTab.toLowerCase() === "skill.md"
    );
  }, [activeTab]);

  // The current editor value: prefer the dirty value, fall back to the loaded content.
  const editorValue = activeTab
    ? (dirtyMap[activeTab] ?? activeFileContent)
    : "";
  const isCurrentDirty = activeTab ? isDirty(activeTab) : false;

  // Warn before navigating away with unsaved changes.
  useEffect(() => {
    if (dirtyCount === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirtyCount]);

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
              {dirtyCount > 0 && (
                <Badge variant="outline" className="text-[9px] px-1.5 h-4 border-amber-500/40 text-amber-700 dark:text-amber-300 gap-1">
                  <AlertCircle className="h-2.5 w-2.5" />
                  {t("editor.unsavedCount", { count: dirtyCount })}
                </Badge>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground truncate font-mono">
              {detail.name}
            </div>
          </div>
        </div>

        {/* Version selector */}
        <div className="flex items-center gap-1.5 shrink-0">
          <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={activeVersion} onValueChange={setUserVersionChoice}>
            <SelectTrigger className="h-7 w-32 text-xs gap-1">
              <SelectValue placeholder="version" />
            </SelectTrigger>
            <SelectContent>
              {(detail.versions || []).map((v: SkillVersion) => (
                <SelectItem
                  key={v.version}
                  value={v.version}
                  className="text-xs"
                >
                  v{v.version}{" "}
                  <span className="text-muted-foreground">({v.status})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activeVersionStatus && (
            <Badge variant="secondary" className={`text-[9px] px-1.5 h-4 ${getStatusColor(activeVersionStatus)}`}>
              {activeVersionStatus}
            </Badge>
          )}
        </div>

        <Separator orientation="vertical" className="h-5" />

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Save button */}
          <Button
            variant={dirtyCount > 0 ? "default" : "ghost"}
            size="sm"
            className="h-7 px-2 gap-1"
            disabled={dirtyCount === 0 || saveFileMutation.isPending}
            onClick={saveAll}
            title={t("editor.saveAll")}
          >
            {saveFileMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            <span className="text-xs">{t("editor.saveAll")}</span>
          </Button>

          {social && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 gap-1"
                onClick={toggleStar}
              >
                <Star
                  className={`h-3.5 w-3.5 ${social.myStarred ? "fill-amber-400 text-amber-400" : ""}`}
                />
                <span className="text-xs tabular-nums">{social.stars}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 gap-1"
                onClick={toggleSubscribe}
              >
                <Bell
                  className={`h-3.5 w-3.5 ${social.mySubscribed ? "text-violet-500 fill-violet-500/30" : ""}`}
                />
              </Button>
            </>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 gap-1">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {activeVersionStatus === "draft" && (
                <DropdownMenuItem
                  disabled={versionActionPending}
                  onClick={() => doVersionAction("submit", activeVersion)}
                >
                  <Send className="h-3.5 w-3.5 mr-2" />{" "}
                  {t("editor.submitForReview")}
                </DropdownMenuItem>
              )}
              {activeVersionStatus === "submitted" && (
                <DropdownMenuItem
                  disabled={versionActionPending}
                  onClick={() => doVersionAction("publish", activeVersion)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-2" />{" "}
                  {t("editor.publishVersion")}
                </DropdownMenuItem>
              )}
              {activeVersionStatus === "published" && (
                <DropdownMenuItem
                  disabled={versionActionPending}
                  onClick={() => doVersionAction("online", activeVersion)}
                >
                  <Play className="h-3.5 w-3.5 mr-2" /> {t("editor.bringOnline")}
                </DropdownMenuItem>
              )}
              {activeVersionStatus === "online" && (
                <DropdownMenuItem
                  disabled={versionActionPending}
                  onClick={() => doVersionAction("offline", activeVersion)}
                >
                  <Pause className="h-3.5 w-3.5 mr-2" /> {t("editor.takeOffline")}
                </DropdownMenuItem>
              )}
              {["draft", "submitted", "published", "online"].includes(activeVersionStatus) && (
                <DropdownMenuSeparator />
              )}
              <DropdownMenuItem onClick={() => downloadZip(activeVersion)}>
                <Download className="h-3.5 w-3.5 mr-2" />{" "}
                {t("editor.downloadZip")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />{" "}
                {t("editor.deleteSkill")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setShowRightPanel(!showRightPanel)}
            title={showRightPanel ? "Hide panel" : "Show panel"}
          >
            {showRightPanel ? (
              <PanelRightClose className="h-3.5 w-3.5" />
            ) : (
              <PanelRightOpen className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </header>

      {/* Online runtime versions are copied before editing. */}
      {isOnlineVersion && activeVersion && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-500/20 text-amber-800 dark:text-amber-200 text-xs">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{t("editor.cannotEditPublished")}</span>
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[11px] border-amber-500/40 text-amber-800 dark:text-amber-200 hover:bg-amber-500/10"
            disabled={ensureDraftMutation.isPending}
            onClick={ensureDraft}
          >
            {ensureDraftMutation.isPending ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <FilePlus className="h-3 w-3 mr-1" />
            )}
            {t("editor.createDraftToEdit")}
          </Button>
        </div>
      )}

      {/* ─── Editor Body ────────────────────────────────────────────── */}
      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        {/* File Tree */}
        <ResizablePanel
          defaultSize={18}
          minSize={12}
          maxSize={32}
          className="bg-card/40"
        >
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-3 h-8 border-b shrink-0">
              <div className="flex items-center gap-1.5">
                <FileCode2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("editor.explorer")}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {files.length} {t("editor.files")}
                </span>
              </div>
            </div>
            <ScrollArea className="flex-1 scrollbar-thin">
              <div className="px-1.5 pb-2">
                <FileTree
                  nodes={tree}
                  selectedPath={activeTab}
                  onOpenFile={openFile}
                  defaultExpanded={tree
                    .filter((n) => n.type === "dir")
                    .map((n) => n.path)}
                  editable={canEditInEditor}
                  onCreateFile={handleCreateFile}
                  onDeleteNode={handleDeleteNode}
                  onRenameNode={handleRenameNode}
                />
              </div>
            </ScrollArea>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Editor / Tabs area */}
        <ResizablePanel defaultSize={showRightPanel ? 58 : 82} minSize={30}>
          <div className="flex flex-col h-full">
            {/* Tabs strip */}
            <div className="flex items-stretch h-9 border-b bg-card/30 overflow-x-auto scrollbar-thin shrink-0">
              {openTabs.length === 0 && (
                <div className="flex items-center px-4 text-xs text-muted-foreground">
                  {t("editor.selectFile")}
                </div>
              )}
              {openTabs.map((tabPath) => {
                const name = tabPath.split("/").pop() || tabPath;
                const isActive = tabPath === activeTab;
                const tabDirty = isDirty(tabPath);
                return (
                  <button
                    key={tabPath}
                    onClick={() => setActiveTab(tabPath)}
                    className={cn(
                      "group relative flex items-center gap-1.5 px-3 h-full text-xs border-r shrink-0 transition-colors",
                      isActive
                        ? "bg-background text-foreground"
                        : "bg-transparent text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    )}
                  >
                    {isActive && (
                      <span className="absolute top-0 left-0 right-0 h-[2px] bg-violet-500" />
                    )}
                    <FileCode2 className="h-3 w-3 shrink-0 opacity-70" />
                    <span className="truncate max-w-[140px]">{name}</span>
                    {tabDirty && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                    )}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(tabPath);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          closeTab(tabPath);
                        }
                      }}
                      className="ml-1 p-0.5 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Breadcrumb + Save strip */}
            {activeTab && (
              <div className="flex items-center h-7 px-3 border-b bg-card/20 shrink-0 gap-2">
                <FileBreadcrumbs path={activeTab} />
                <span className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground">
                  {isBinary ? (
                    t("editor.binaryHint")
                  ) : (
                    <>
                      {isCurrentDirty && (
                        <span className="text-amber-600 dark:text-amber-400">
                          {t("editor.unsavedChanges")}
                        </span>
                      )}
                      <span>{editorValue.length} {t("editor.chars")}</span>
                      {!isBinary && (
                        <Button
                          size="sm"
                          variant={isCurrentDirty ? "default" : "ghost"}
                          className="h-5 px-2 text-[10px] gap-1"
                          disabled={!isCurrentDirty || saveFileMutation.isPending}
                          onClick={() => saveFile(activeTab)}
                        >
                          {saveFileMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Save className="h-3 w-3" />
                          )}
                          {t("editor.saveFile")}
                        </Button>
                      )}
                    </>
                  )}
                </span>
              </div>
            )}

            {/* Editor surface */}
            <div className="flex-1 min-h-0 bg-background">
              {!activeTab ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                  <FileCode2 className="h-10 w-10 opacity-30" />
                  <div className="text-center">
                    <p className="text-sm font-medium">
                      {t("editor.noFileOpen")}
                    </p>
                    <p className="text-xs">{t("editor.noFileOpenDesc")}</p>
                  </div>
                </div>
              ) : fileLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : isBinary ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                  <Download className="h-8 w-8 opacity-40" />
                  <p className="text-sm">{t("editor.binary")}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadZip(activeVersion)}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />{" "}
                    {t("editor.downloadZip")}
                  </Button>
                </div>
              ) : isMarkdown ? (
                <MarkdownEditorPane
                  key={activeTab}
                  value={editorValue}
                  onChange={handleEditorChange}
                  readOnly={!canEditInEditor}
                />
              ) : (
                <CodeEditor
                  value={editorValue}
                  onChange={handleEditorChange}
                  path={activeTab}
                  readOnly={!canEditInEditor}
                  className="h-full"
                />
              )}
            </div>
          </div>
        </ResizablePanel>

        {/* Right metadata panel */}
        {showRightPanel && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel
              defaultSize={24}
              minSize={18}
              maxSize={40}
              className="bg-card/40"
            >
              <div className="flex flex-col h-full">
                <Tabs
                  value={rightTab}
                  onValueChange={(v) => setRightTab(v as RightPanelTab)}
                  className="flex flex-col h-full"
                >
                  <div className="border-b shrink-0">
                    <TabsList className="h-9 bg-transparent p-0 gap-0 w-full justify-start px-2">
                      <TabsTrigger
                        value="overview"
                        className="text-xs h-9 data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-violet-500 rounded-none"
                      >
                        {t("editor.overview")}
                      </TabsTrigger>
                      <TabsTrigger
                        value="versions"
                        className="text-xs h-9 data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-violet-500 rounded-none"
                      >
                        <History className="h-3 w-3 mr-1" />
                        {t("editor.versions")}
                      </TabsTrigger>
                      <TabsTrigger
                        value="runtime"
                        className="text-xs h-9 data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-violet-500 rounded-none"
                      >
                        {t("editor.runtime")}
                      </TabsTrigger>
                      <TabsTrigger
                        value="settings"
                        className="text-xs h-9 data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-violet-500 rounded-none"
                      >
                        {t("editor.settings")}
                      </TabsTrigger>
                      <TabsTrigger
                        value="shares"
                        className="text-xs h-9 data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-violet-500 rounded-none"
                      >
                        <Share2 className="h-3 w-3 mr-1" />
                        {t("share.title")}
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <ScrollArea className="flex-1 scrollbar-thin">
                    {/* OVERVIEW */}
                    <TabsContent
                      value="overview"
                      className="p-3 space-y-3 mt-0"
                    >
                      {social && (
                        <div className="flex flex-wrap items-center gap-2 pb-3 border-b">
                          <div className="flex items-center gap-1 text-xs">
                            <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                            <span className="font-medium tabular-nums">
                              {social.stars}
                            </span>
                            <span className="text-muted-foreground">
                              {t("editor.stars")}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-xs">
                            <Bell className="h-3.5 w-3.5 text-violet-500" />
                            <span className="font-medium tabular-nums">
                              {social.subscribers}
                            </span>
                            <span className="text-muted-foreground">
                              {t("editor.subs")}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-xs">
                            <span className="font-medium tabular-nums">
                              {Number(social.ratingAverage || 0).toFixed(1)}
                            </span>
                            <span className="text-muted-foreground">
                              / 5 ({social.ratingCount})
                            </span>
                          </div>
                        </div>
                      )}

                      {social && (
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              onClick={() => rate(n)}
                              className="hover:scale-110 transition-transform"
                            >
                              <Star
                                className={`h-4 w-4 ${(social.myRating || 0) >= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
                              />
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          {t("editor.description")}
                        </Label>
                        <p className="text-xs leading-relaxed">
                          {detail.description || t("editor.noDescription")}
                        </p>
                      </div>

                      <Separator />

                      <div className="grid grid-cols-2 gap-2">
                        <InfoItem
                          label={t("editor.owner")}
                          value={detail.owner || "-"}
                        />
                        <InfoItem
                          label={t("editor.scope")}
                          value={detail.scope || "-"}
                        />
                        <InfoItem
                          label={t("editor.onlineCount")}
                          value={String(detail.onlineCnt || 0)}
                        />
                        <InfoItem
                          label={t("editor.downloadCount")}
                          value={String(detail.downloadCount || 0)}
                        />
                        <InfoItem
                          label={t("editor.stableLabel")}
                          value={
                            detail.labels?.stable || detail.stableVersion || "-"
                          }
                        />
                        <InfoItem
                          label={t("editor.latestLabel")}
                          value={
                            detail.labels?.latest || detail.latestVersion || "-"
                          }
                        />
                        <InfoItem
                          label={t("editor.editing")}
                          value={detail.editingVersion || "-"}
                        />
                        <InfoItem
                          label={t("editor.reviewing")}
                          value={detail.reviewingVersion || "-"}
                        />
                      </div>

                      {detail.bizTags && (
                        <>
                          <Separator />
                          <div className="space-y-1.5">
                            <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              {t("editor.bizTags")}
                            </Label>
                            <div className="flex flex-wrap gap-1">
                              {(Array.isArray(detail.bizTags)
                                ? detail.bizTags
                                : [detail.bizTags as string]
                              )
                                .filter(Boolean)
                                .map((tg) => (
                                  <Badge
                                    key={tg}
                                    variant="secondary"
                                    className="text-[10px]"
                                  >
                                    <Tag className="h-2.5 w-2.5 mr-1" />
                                    {tg}
                                  </Badge>
                                ))}
                            </div>
                          </div>
                        </>
                      )}

                      {detail.skillsets && detail.skillsets.length > 0 && (
                        <div className="space-y-1.5">
                          <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            {t("editor.inGroups")}
                          </Label>
                          <div className="flex flex-wrap gap-1">
                            {detail.skillsets.map((g) => (
                              <Badge
                                key={g}
                                variant="outline"
                                className="text-[10px]"
                              >
                                {g}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    {/* VERSIONS */}
                    <TabsContent
                      value="versions"
                      className="p-3 space-y-2 mt-0"
                    >
                      <div className="flex items-center justify-between pb-2">
                        <span className="text-xs font-medium">
                          {detail.versions?.length || 0}{" "}
                          {t("editor.versionsCount")}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => refetchDetail()}
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      </div>
                      {(detail.versions || []).map((v: SkillVersion) => {
                        const isActive = v.version === activeVersion;
                        const actions = versionActionsFor(v);
                        return (
                          <div
                            key={v.version}
                            role="button"
                            tabIndex={0}
                            onClick={() => setUserVersionChoice(v.version)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setUserVersionChoice(v.version);
                              }
                            }}
                            className={cn(
                              "w-full cursor-pointer text-left rounded-md border p-2.5 transition-all hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              isActive
                                ? "border-violet-500/40 bg-violet-500/5"
                                : "border-border/60 hover:border-border",
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-mono font-medium">
                                  v{v.version}
                                </span>
                                {v.status && (
                                  <Badge
                                    variant="secondary"
                                    className={`text-[9px] h-4 px-1 ${getStatusColor(v.status)}`}
                                  >
                                    {v.status}
                                  </Badge>
                                )}
                              </div>
                              {isActive && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] h-4 px-1 text-violet-600 border-violet-500/40"
                                >
                                  {t("editor.viewing")}
                                </Badge>
                              )}
                            </div>
                            {v.commitMsg && (
                              <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                                {v.commitMsg}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1.5 text-[9px] text-muted-foreground">
                              {v.author && <span>{v.author}</span>}
                              {v.updateTime && (
                                <span>· {fmtTime(v.updateTime)}</span>
                              )}
                              {v.downloadCount !== undefined &&
                                v.downloadCount > 0 && (
                                  <span>· {v.downloadCount} downloads</span>
                                )}
                            </div>
                            {actions.length > 0 && (
                              <div className="flex items-center gap-1 mt-2">
                                {actions.map(({ action, label, icon: Icon }) => (
                                  <Button
                                    key={action}
                                    size="sm"
                                    variant="ghost"
                                    className="h-5 px-1.5 text-[10px]"
                                    disabled={versionActionPending}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      doVersionAction(action, v.version);
                                    }}
                                  >
                                    <Icon className="h-2.5 w-2.5 mr-0.5" />
                                    {label}
                                  </Button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </TabsContent>

                    {/* RUNTIME */}
                    <TabsContent value="runtime" className="p-3 space-y-3 mt-0">
                      <div>
                        <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Client API
                        </Label>
                        <p className="text-[11px] text-muted-foreground mt-1 mb-2">
                          Used by the Agent runtime to resolve this skill at
                          request time.
                        </p>
                        <pre className="text-[10px] font-mono bg-muted/40 p-2.5 rounded-md overflow-x-auto scrollbar-thin whitespace-pre-wrap leading-relaxed">
                          {`# Catalog record
GET /v3/aihub/catalog/skills/${detail.name}

# Online manifest consumed by runtime
GET /v3/aihub/catalog/skills/${detail.name}/manifest

# Download a concrete package version
GET /v3/aihub/catalog/skills/${detail.name}/versions/${activeVersion || "1.0.0"}/download`}
                        </pre>
                      </div>
                      <Separator />
                      <div>
                        <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Well-known Discovery
                        </Label>
                        <pre className="text-[10px] font-mono bg-muted/40 p-2.5 rounded-md overflow-x-auto scrollbar-thin mt-1.5 whitespace-pre-wrap leading-relaxed">
                          {`# Deprecated in the new Hub backend. Use /v3/aihub/catalog/skills/* endpoints above.`}
                        </pre>
                      </div>
                      <Separator />
                      <div className="grid grid-cols-2 gap-2">
                        <InfoItem
                          label="Stable"
                          value={
                            detail.labels?.stable || detail.stableVersion || "-"
                          }
                        />
                        <InfoItem
                          label="Latest"
                          value={
                            detail.labels?.latest || detail.latestVersion || "-"
                          }
                        />
                      </div>
                    </TabsContent>

                    {/* SETTINGS */}
                    <TabsContent value="settings" className="p-3 mt-0">
                      <SettingsTab
                        key={detail.name + (detail.updateTime || "")}
                        detail={detail}
                        accessMode={skillAccessMode}
                        onSaveBizTags={saveBizTags}
                        onSaveLabels={saveLabels}
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
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Skill"
        description={`Are you sure you want to permanently delete "${detail.name}"? This removes all versions and metadata. This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />

      <Dialog
        open={commitTargetVersion !== null}
        onOpenChange={(open) => {
          if (!open) setCommitTargetVersion(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCommitHorizontal className="h-4 w-4" />
              {t("editor.commitDraft")}
            </DialogTitle>
            <DialogDescription>
              {t("editor.commitDraftDescription", {
                version: commitTargetVersion ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="commit-msg">{t("editor.commitMessage")}</Label>
              <Textarea
                id="commit-msg"
                value={commitMsg}
                onChange={(e) => setCommitMsg(e.target.value)}
                placeholder={t("editor.commitMessagePlaceholder")}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("editor.commitCascade")}</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={commitCascade.submit}
                    onCheckedChange={(v) =>
                      setCommitCascade((c) => ({ ...c, submit: v === true }))
                    }
                  />
                  {t("editor.cascadeSubmit")}
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={commitCascade.publish}
                    onCheckedChange={(v) =>
                      setCommitCascade((c) => ({ ...c, publish: v === true }))
                    }
                  />
                  {t("editor.cascadePublish")}
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={commitCascade.online}
                    onCheckedChange={(v) =>
                      setCommitCascade((c) => ({ ...c, online: v === true }))
                    }
                  />
                  {t("editor.cascadeOnline")}
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCommitTargetVersion(null)}
              disabled={commitMutation.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={handleCommit} disabled={commitMutation.isPending}>
              {commitMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("editor.commit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Helper: dropdown for creating new top-level files ─────────────
// ─── Child: SettingsTab ────────────────────────────────────────────
// Holds its own form state initialized from `detail` on mount.
interface SettingsTabProps {
  detail: Skill;
  accessMode: AccessMode;
  onSaveBizTags: (tagsText: string) => Promise<void>;
  onSaveLabels: (labelsText: string) => Promise<void>;
  onSaveDisplayNameDescription: (
    displayName: string,
    description: string,
  ) => Promise<void>;
  onDelete: () => void;
}

function SettingsTab({
  detail,
  accessMode,
  onSaveBizTags,
  onSaveLabels,
  onSaveDisplayNameDescription,
  onDelete,
}: SettingsTabProps) {
  const t = useT();
  const [bizTagsText, setBizTagsText] = useState(() =>
    Array.isArray(detail.bizTags)
      ? detail.bizTags.join(", ")
      : (detail.bizTags as string) || "",
  );
  const [labelsText, setLabelsText] = useState(() =>
    JSON.stringify(detail.labels || {}, null, 2),
  );
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
          {accessMode === "public" ? (
            <Globe className="h-4 w-4 text-emerald-500" />
          ) : accessMode === "shared" ? (
            <Users className="h-4 w-4 text-amber-500" />
          ) : (
            <Lock className="h-4 w-4 text-violet-500" />
          )}
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

      {/* Biz Tags */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">{t("editor.bizTags")}</Label>
        <div className="flex gap-1.5">
          <Input
            value={bizTagsText}
            onChange={(e) => setBizTagsText(e.target.value)}
            placeholder={t("editor.bizTagsPlaceholder")}
            className="text-xs h-8"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2.5"
            onClick={() => onSaveBizTags(bizTagsText)}
          >
            <Save className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <Separator />

      {/* Labels (JSON) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">
            {t("editor.labelsJson")}
          </Label>
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[10px]"
            onClick={() => onSaveLabels(labelsText)}
          >
            <Save className="h-3 w-3 mr-1" />
            {t("editor.save")}
          </Button>
        </div>
        <Textarea
          value={labelsText}
          onChange={(e) => setLabelsText(e.target.value)}
          rows={8}
          className="font-mono text-[11px] resize-none"
        />
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

// ─── Child: MarkdownEditorPane ────────────────────────────────────
// Renders the markdown editor with edit / preview / split modes.
interface MarkdownEditorPaneProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

function MarkdownEditorPane({ value, onChange, readOnly = false }: MarkdownEditorPaneProps) {
  const t = useT();
  const [mode, setMode] = useState<MarkdownViewMode>("edit");

  return (
    <div className="flex flex-col h-full">
      {/* Mode toggle */}
      <div className="flex items-center justify-between px-3 h-8 border-b bg-muted/20 shrink-0">
        <span className="text-[11px] text-muted-foreground">
          {t("editor.markdown")}
        </span>
        <div className="flex items-center bg-muted/40 rounded-md p-0.5 gap-0.5">
          <button
            onClick={() => setMode("edit")}
            className={cn(
              "flex items-center gap-1 px-2 h-6 rounded text-[11px] transition-colors",
              mode === "edit"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Pencil className="h-3 w-3" /> {t("editor.source")}
          </button>
          <button
            onClick={() => setMode("preview")}
            className={cn(
              "flex items-center gap-1 px-2 h-6 rounded text-[11px] transition-colors",
              mode === "preview"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Eye className="h-3 w-3" /> {t("editor.preview")}
          </button>
          <button
            onClick={() => setMode("split")}
            className={cn(
              "flex items-center gap-1 px-2 h-6 rounded text-[11px] transition-colors",
              mode === "split"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Columns2 className="h-3 w-3" /> {t("editor.splitView")}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex">
        {(mode === "edit" || mode === "split") && (
          <div className={cn("flex-1 min-h-0", mode === "split" && "border-r")}>
            <CodeEditor value={value} onChange={onChange} readOnly={readOnly} className="h-full" />
          </div>
        )}
        {(mode === "preview" || mode === "split") && (
          <div className="flex-1 min-h-0 overflow-hidden bg-background">
            <ScrollArea className="h-full scrollbar-thin">
              <article className="prose prose-sm dark:prose-invert prose-headings:scroll-mt-0 max-w-3xl mx-auto p-6 prose-headings:font-semibold prose-headings:tracking-tight prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-h4:text-base prose-p:leading-relaxed prose-a:text-violet-600 dark:prose-a:text-violet-400 prose-strong:text-foreground prose-code:text-violet-700 dark:prose-code:text-violet-300 prose-code:bg-violet-500/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-muted/50 prose-pre:border prose-pre:border-border prose-blockquote:border-l-violet-500 prose-blockquote:bg-violet-500/5 prose-img:rounded-lg">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    // Open external links in new tab safely
                    a: ({ ...props }) => (
                      <a
                        {...props}
                        target={props.href?.startsWith("http") ? "_blank" : undefined}
                        rel={props.href?.startsWith("http") ? "noopener noreferrer" : undefined}
                      />
                    ),
                  }}
                >
                  {value || "_No content yet. Switch to **Source** to start editing._"}
                </ReactMarkdown>
              </article>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
