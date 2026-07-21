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
import Editor, { type OnMount } from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Loader2, Save, AlertTriangle, RotateCcw } from "lucide-react";
import { useSaveFile } from "@/hooks/use-skill-files";
import { useT } from "@/lib/i18n";
import { toast } from "sonner";

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
  const saveMutation = useSaveFile();
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
        branch,
        create,
      });
      setLocalSha(result.sha);
      // The server may normalise line endings; adopt its view so the
      // dirty flag clears cleanly.
      setValue(value);
      onSaved?.(result.sha, value);
      toast.success(t("editor.fileSaved"));
    } catch (err) {
      const conflict = err as { isConflict?: boolean };
      if (conflict?.isConflict) {
        toast.warning(t("editor.conflict"));
        onConflict?.();
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
      <div className="min-h-0 flex-1">
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
      </div>
    </div>
  );
}
