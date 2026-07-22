"use client";

/**
 * MonacoSkillEditor — the in-browser code editor for skill files.
 *
 * This is the first next/dynamic({ ssr: false }) import in the repo.
 * Monaco pulls in web workers and touches `self` at module load, so it
 * cannot run during Next.js standalone SSR. The dynamic wrapper lives
 * in skill-editor.tsx; this file holds the actual Editor component.
 *
 * Language is inferred from the file extension. Content is fully
 * client-side (no server round-trip on each keystroke); saving goes
 * through useSaveFile, which POSTs/PUTs the base64-encoded content and
 * surfaces 409 conflicts as error.isConflict for the parent to handle.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor, { DiffEditor, loader, type OnMount } from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save, AlertTriangle, RotateCcw, Download, Pencil } from "lucide-react";
import { useSaveFile } from "@/hooks/use-skill-files";
import { fileApi } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { toast } from "sonner";

// Self-host Monaco: load the editor core + workers from /monaco/vs
// (same-origin) instead of the default jsdelivr CDN. The assets are
// copied into public/monaco/vs by .zscripts/copy-monaco.mjs (dev) and
// into .next/standalone/public/monaco/vs by copy-standalone-assets.mjs
// (prod). This runs once at module load, before any <Editor> mounts.
loader.config({ paths: { vs: "/monaco/vs" } });

export type MonacoSkillEditorProps = {
  skillName: string;
  filePath: string;
  branch?: string;
  /** Initial plaintext content (already base64-decoded by the adapter). */
  initialContent: string;
  /** Blob sha the parent last fetched; sent for optimistic concurrency. */
  sha?: string;
  /** true when the file is being newly created (POST vs PUT). */
  create?: boolean;
  readOnly?: boolean;
  /** Called after a successful save with the new sha + content. */
  onSaved?: (sha: string, content: string) => void;
  /** Called when a 409 conflict is detected so the parent can refetch. */
  onConflict?: () => void;
};

const EXT_LANG: Record<string, string> = {
  md: "markdown",
  markdown: "markdown",
  yaml: "yaml",
  yml: "yaml",
  json: "json",
  jsonc: "json",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  jsx: "javascript",
  py: "python",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  go: "go",
  rs: "rust",
  txt: "plaintext",
  toml: "ini",
  ini: "ini",
  env: "ini",
  html: "html",
  css: "css",
  scss: "scss",
  sql: "sql",
  xml: "xml",
};

function languageFor(path: string): string {
  const dot = path.lastIndexOf(".");
  if (dot < 0) return "plaintext";
  const ext = path.slice(dot + 1).toLowerCase();
  return EXT_LANG[ext] ?? "plaintext";
}

export function MonacoSkillEditor({
  skillName,
  filePath,
  branch,
  initialContent,
  sha,
  create,
  readOnly,
  onSaved,
  onConflict,
}: MonacoSkillEditorProps) {
  const t = useT();
  const [value, setValue] = useState(initialContent);
  const [localSha, setLocalSha] = useState(sha);
  // Optional commit message the user can type before saving. Empty string
  // is sent as undefined so the server uses its default message.
  const [commitMessage, setCommitMessage] = useState("");
  const saveMutation = useSaveFile();
  // Conflict-resolution state. When a save hits a 409 we fetch the
  // server's current view of the file and switch the editor into a diff
  // view (server on the left, local edits on the right). The user then
  // picks a side: "take server" discards their edits; "keep mine" lets
  // them save again (which will overwrite, since we adopt the new sha).
  const [conflict, setConflict] = useState<{
    serverContent: string;
    serverSha: string;
  } | null>(null);
  const [resolving, setResolving] = useState(false);
  // Internal state reset on file/content change is handled by the parent
  // via the `key` prop (editorPath + sha + mode) — remounting this component
  // reinitializes useState below, so no in-effect setState is needed here.

  const dirty = value !== initialContent;
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  const handleMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;
  }, []);

  // Ctrl/Cmd+S triggers a save without leaving the editor.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void doSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [value, dirty, localSha, create, filePath, skillName, branch]);

  const language = useMemo(() => languageFor(filePath), [filePath]);

  async function doSave() {
    if (!dirty || saveMutation.isPending) return;
    try {
      const result = await saveMutation.mutateAsync({
        skillName,
        path: filePath,
        content: value,
        sha: create ? undefined : localSha,
        message: commitMessage.trim() || undefined,
        branch,
        create,
      });
      setLocalSha(result.sha);
      // The server may normalise line endings; adopt its view so the
      // dirty flag clears cleanly.
      setValue(value);
      // Clear the commit message once the change has landed; the next
      // save starts a fresh commit.
      setCommitMessage("");
      onSaved?.(result.sha, value);
      toast.success(t("editor.fileSaved"));
    } catch (err) {
      const conflictErr = err as { isConflict?: boolean };
      if (conflictErr?.isConflict) {
        // Fetch the server's current view so the user can see what
        // changed and decide whether to overwrite or discard. We bypass
        // the query cache here because this is a one-off read on the
        // conflict path and we don't want to invalidate the parent's
        // tree/list queries just to show a diff.
        try {
          setResolving(true);
          const server = await fileApi.get(skillName, filePath, branch);
          setConflict({ serverContent: server.content, serverSha: server.sha });
        } catch {
          // If we can't even fetch the server view, fall back to the
          // old behaviour: notify and let the parent refetch.
          toast.warning(t("editor.conflict"));
          onConflict?.();
        } finally {
          setResolving(false);
        }
      } else {
        toast.error(t("editor.fileSaveFailed"));
      }
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b bg-muted/30 px-3 text-xs text-muted-foreground">
        <span className="truncate font-mono" title={filePath}>
          {filePath}
        </span>
        {dirty && (
          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            {t("editor.unsavedChanges")}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => {
              setValue(initialContent);
            }}
            disabled={!dirty || saveMutation.isPending}
            title={t("editor.discard") ?? "Discard"}
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            className="h-7 gap-1 px-3 text-xs"
            onClick={() => void doSave()}
            disabled={!dirty || saveMutation.isPending || readOnly}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3" />
            )}
            {t("editor.saveFile")}
          </Button>
        </div>
      </div>
      {/* Commit message row: collapsed to a single line. Visible only
          when the buffer is dirty so the user has a reason to type one. */}
      {dirty && (
        <div className="flex h-8 shrink-0 items-center gap-2 border-b bg-muted/20 px-3">
          <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
            {t("editor.commitMessage")}
          </span>
          <Input
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder={t("editor.commitMessagePlaceholder")}
            className="h-6 flex-1 border-none bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
            disabled={saveMutation.isPending}
            onKeyDown={(e) => {
              // Enter saves; Shift+Enter inserts a newline.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void doSave();
              }
            }}
          />
        </div>
      )}
      <div className="min-h-0 flex-1">
        {conflict ? (
          <div className="flex h-full flex-col">
            {/* Conflict toolbar: explains the view + offers the two
                resolution actions. "Take server" discards local edits;
                "Keep mine" adopts the server sha (so the next save is a
                clean overwrite) but preserves the user's text. */}
            <div className="flex h-9 shrink-0 items-center gap-2 border-b bg-amber-500/10 px-3 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="font-medium">{t("editor.conflictTitle")}</span>
              <span className="opacity-70">
                {t("editor.serverVersion")} ↔ {t("editor.yourVersion")}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => {
                    // Discard local edits, adopt server view + sha.
                    setValue(conflict.serverContent);
                    setLocalSha(conflict.serverSha);
                    setConflict(null);
                  }}
                  disabled={resolving}
                >
                  <Download className="h-3 w-3" />
                  {t("editor.takeServer")}
                </Button>
                <Button
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => {
                    // Keep the user's text but adopt the server sha so
                    // the next save is accepted (PUT with current sha).
                    setLocalSha(conflict.serverSha);
                    setConflict(null);
                  }}
                  disabled={resolving}
                >
                  <Pencil className="h-3 w-3" />
                  {t("editor.keepMine")}
                </Button>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <DiffEditor
                height="100%"
                language={language}
                original={conflict.serverContent}
                modified={value}
                theme="vs-dark"
                options={{
                  readOnly: true,
                  renderSideBySide: true,
                  minimap: { enabled: false },
                  fontSize: 13,
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  wordWrap: "on",
                }}
              />
            </div>
          </div>
        ) : (
          <Editor
            height="100%"
            path={filePath}
            language={language}
            value={value}
            onChange={(v) => setValue(v ?? "")}
            onMount={handleMount}
            theme="vs-dark"
            options={{
              readOnly: readOnly || saveMutation.isPending,
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbersMinChars: 3,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: "on",
            }}
          />
        )}
      </div>
    </div>
  );
}
