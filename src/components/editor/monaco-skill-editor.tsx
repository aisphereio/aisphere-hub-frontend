"use client";

/**
 * MonacoSkillEditor is kept as the compatibility export consumed by
 * skill-editor.tsx. The default implementation is CodeMirror 6, so Monaco's
 * core, workers and language services are not loaded on the normal editing
 * path.
 */
import {
  useCallback,
  useMemo,
  useState,
  type KeyboardEvent,
} from "react";
import CodeMirror from "@uiw/react-codemirror";
import type { Extension } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { yaml } from "@codemirror/lang-yaml";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  Download,
  Loader2,
  Pencil,
  RotateCcw,
  Save,
} from "lucide-react";
import { useSaveFile } from "@/hooks/use-skill-files";
import { fileApi } from "@/lib/api";
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

function languageExtensionsFor(path: string): Extension[] {
  const dot = path.lastIndexOf(".");
  const extension = dot >= 0 ? path.slice(dot + 1).toLowerCase() : "";

  switch (extension) {
    case "md":
    case "markdown":
      return [markdown()];
    case "yaml":
    case "yml":
      return [yaml()];
    case "json":
    case "jsonc":
      return [json()];
    case "js":
    case "mjs":
    case "cjs":
      return [javascript()];
    case "ts":
      return [javascript({ typescript: true })];
    case "jsx":
      return [javascript({ jsx: true })];
    case "tsx":
      return [javascript({ typescript: true, jsx: true })];
    case "py":
      return [python()];
    default:
      return [];
  }
}

const EDITOR_CLASS_NAME =
  "h-full overflow-hidden text-sm " +
  "[&_.cm-editor]:h-full [&_.cm-editor]:bg-background " +
  "[&_.cm-scroller]:h-full [&_.cm-scroller]:overflow-auto " +
  "[&_.cm-content]:font-mono [&_.cm-content]:text-[13px] " +
  "[&_.cm-gutters]:border-r [&_.cm-gutters]:bg-muted/20";

/**
 * The file query resolves after a tab is first opened. Key the inner editor by
 * the server revision so clean buffers adopt the fetched content through a
 * normal remount instead of synchronously setting React state in an effect.
 */
export function MonacoSkillEditor(props: MonacoSkillEditorProps) {
  const revision = props.create ? "create" : (props.sha ?? "loading");
  return (
    <CodeMirrorSkillEditor
      key={`${props.filePath}:${revision}`}
      {...props}
    />
  );
}

function CodeMirrorSkillEditor({
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
  const saveMutation = useSaveFile();
  const [value, setValue] = useState(initialContent);
  const [savedValue, setSavedValue] = useState(initialContent);
  const [localSha, setLocalSha] = useState(sha);
  const [commitMessage, setCommitMessage] = useState("");
  const [conflict, setConflict] = useState<{
    serverContent: string;
    serverSha: string;
  } | null>(null);
  const [resolving, setResolving] = useState(false);

  const dirty = value !== savedValue;
  const languageExtensions = useMemo(
    () => languageExtensionsFor(filePath),
    [filePath],
  );

  const doSave = useCallback(async () => {
    if (!dirty || saveMutation.isPending || readOnly) return;

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
      setSavedValue(value);
      setLocalSha(result.sha);
      setCommitMessage("");
      onSaved?.(result.sha, value);
      toast.success(t("editor.fileSaved"));
    } catch (error) {
      const conflictError = error as { isConflict?: boolean };
      if (!conflictError?.isConflict) {
        toast.error(t("editor.fileSaveFailed"));
        return;
      }

      try {
        setResolving(true);
        const server = await fileApi.get(skillName, filePath, branch);
        setConflict({
          serverContent: server.content,
          serverSha: server.sha,
        });
      } catch {
        toast.warning(t("editor.conflict"));
        onConflict?.();
      } finally {
        setResolving(false);
      }
    }
  }, [
    branch,
    commitMessage,
    create,
    dirty,
    filePath,
    localSha,
    onConflict,
    onSaved,
    readOnly,
    saveMutation,
    skillName,
    t,
    value,
  ]);

  const handleEditorKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void doSave();
      }
    },
    [doSave],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b bg-muted/30 px-3 text-xs text-muted-foreground">
        <span className="truncate font-mono" title={filePath}>
          {filePath}
        </span>
        <span className="rounded border bg-background/60 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide">
          CodeMirror
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
            onClick={() => setValue(savedValue)}
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

      {dirty && (
        <div className="flex h-8 shrink-0 items-center gap-2 border-b bg-muted/20 px-3">
          <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
            {t("editor.commitMessage")}
          </span>
          <Input
            value={commitMessage}
            onChange={(event) => setCommitMessage(event.target.value)}
            placeholder={t("editor.commitMessagePlaceholder")}
            className="h-6 flex-1 border-none bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
            disabled={saveMutation.isPending}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void doSave();
              }
            }}
          />
        </div>
      )}

      <div className="min-h-0 flex-1" onKeyDownCapture={handleEditorKeyDown}>
        {conflict ? (
          <div className="flex h-full min-h-0 flex-col">
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
                    setValue(conflict.serverContent);
                    setSavedValue(conflict.serverContent);
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
            <div className="grid min-h-0 flex-1 grid-cols-2 divide-x">
              <div className="min-h-0 overflow-hidden">
                <div className="border-b bg-muted/20 px-3 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {t("editor.serverVersion")}
                </div>
                <CodeMirror
                  value={conflict.serverContent}
                  height="100%"
                  theme="dark"
                  extensions={languageExtensions}
                  readOnly
                  editable={false}
                  className={EDITOR_CLASS_NAME}
                />
              </div>
              <div className="min-h-0 overflow-hidden">
                <div className="border-b bg-muted/20 px-3 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {t("editor.yourVersion")}
                </div>
                <CodeMirror
                  value={value}
                  height="100%"
                  theme="dark"
                  extensions={languageExtensions}
                  readOnly
                  editable={false}
                  className={EDITOR_CLASS_NAME}
                />
              </div>
            </div>
          </div>
        ) : (
          <CodeMirror
            value={value}
            height="100%"
            theme="dark"
            extensions={languageExtensions}
            readOnly={Boolean(readOnly || saveMutation.isPending)}
            editable={!readOnly && !saveMutation.isPending}
            onChange={setValue}
            className={EDITOR_CLASS_NAME}
          />
        )}
      </div>
    </div>
  );
}
