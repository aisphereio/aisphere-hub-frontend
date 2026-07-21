"use client";

/**
 * PullRequestsPanel — lists a skill's pull requests and offers the
 * open/merge/close actions. A "New PR" button opens a dialog that
 * collects the source branch + title + description; the actual branch
 * must already exist on the bare repo (pushed via git or created via
 * the file API with a branch param) — this panel does not create
 * branches.
 *
 * Merge passes the PR's current targetSha as expectedTargetSha so the
 * server can reject if another PR landed first (409 → conflict toast
 * + refetch). Close is a soft state change; the source branch is not
 * deleted by the Hub.
 */
import { useState } from "react";
import { GitPullRequest, GitMerge, XCircle, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { toast } from "sonner";
import {
  usePullRequests,
  useCreatePR,
  useMergePR,
  useClosePR,
} from "@/hooks/use-skill-prs";
import type { PullRequest } from "@/lib/api/types";

export type PullRequestsPanelProps = {
  skillName: string;
};

const STATE_FILTERS = ["open", "merged", "closed", ""] as const;

export function PullRequestsPanel({ skillName }: PullRequestsPanelProps) {
  const t = useT();
  const [stateFilter, setStateFilter] = useState<string>("open");
  const prs = usePullRequests(skillName, stateFilter || undefined);
  const createMut = useCreatePR();
  const mergeMut = useMergePR();
  const closeMut = useClosePR();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ sourceRef: "", title: "", description: "" });

  const submitCreate = () => {
    if (!form.sourceRef.trim() || !form.title.trim()) return;
    createMut.mutate(
      {
        skillName,
        sourceRef: form.sourceRef.trim(),
        title: form.title.trim(),
        description: form.description.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(t("editor.prCreated") ?? "Pull request opened");
          setCreateOpen(false);
          setForm({ sourceRef: "", title: "", description: "" });
        },
        onError: (err) => {
          const conflict = err as { isConflict?: boolean };
          if (conflict?.isConflict) {
            toast.warning(t("editor.prConflict") ?? "A PR already exists for that source branch");
          } else {
            toast.error(t("editor.prCreateFailed") ?? "Failed to open pull request");
          }
        },
      },
    );
  };

  const merge = (pr: PullRequest) => {
    mergeMut.mutate(
      { skillName, id: pr.id, expectedTargetSha: pr.targetSha },
      {
        onSuccess: () => toast.success(t("editor.prMerged") ?? "Pull request merged"),
        onError: (err) => {
          const conflict = err as { isConflict?: boolean };
          if (conflict?.isConflict) {
            toast.warning(t("editor.prMergeConflict") ?? "Target moved — refetching");
            prs.refetch();
          } else {
            toast.error(t("editor.prMergeFailed") ?? "Failed to merge pull request");
          }
        },
      },
    );
  };

  const close = (pr: PullRequest) => {
    closeMut.mutate(
      { skillName, id: pr.id },
      {
        onSuccess: () => toast.success(t("editor.prClosed") ?? "Pull request closed"),
        onError: () => toast.error(t("editor.prCloseFailed") ?? "Failed to close pull request"),
      },
    );
  };

  const items = prs.data?.items ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        {STATE_FILTERS.map((s) => (
          <Button
            key={s || "all"}
            size="sm"
            variant={stateFilter === s ? "default" : "outline"}
            className="h-7 px-2 text-xs"
            onClick={() => {
              setStateFilter(s);
              prs.refetch();
            }}
          >
            {s ? s.charAt(0).toUpperCase() + s.slice(1) : (t("editor.prAll") ?? "All")}
          </Button>
        ))}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="ml-auto h-7 gap-1 px-2 text-xs">
              <Plus className="h-3 w-3" />
              {t("editor.prNew") ?? "New PR"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("editor.prNewTitle") ?? "Open a pull request"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label className="text-xs">{t("editor.prSourceBranch") ?? "Source branch"}</Label>
                <Input
                  value={form.sourceRef}
                  onChange={(e) => setForm((f) => ({ ...f, sourceRef: e.target.value }))}
                  placeholder="feature/my-change"
                  className="text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  {t("editor.prSourceHint") ??
                    "The branch must already exist on the repo (push it via git first)."}
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("editor.prTitle") ?? "Title"}</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Add a new skill profile"
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("editor.prDescription") ?? "Description"}</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder={t("editor.commitMessagePlaceholder")}
                  className="text-xs min-h-[80px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreateOpen(false)}
                disabled={createMut.isPending}
              >
                {t("common.cancel")}
              </Button>
              <Button
                size="sm"
                onClick={submitCreate}
                disabled={createMut.isPending || !form.sourceRef.trim() || !form.title.trim()}
              >
                {createMut.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                {t("editor.prOpen") ?? "Open PR"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {prs.isLoading && (
        <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          {t("common.loading") ?? "Loading…"}
        </div>
      )}
      {!prs.isLoading && items.length === 0 && (
        <div className="py-6 text-center text-xs text-muted-foreground">
          {t("editor.prEmpty") ?? "No pull requests in this state."}
        </div>
      )}
      <div className="space-y-2">
        {items.map((pr) => (
          <PRRow
            key={pr.id}
            pr={pr}
            merging={mergeMut.isPending && mergeMut.variables?.id === pr.id}
            closing={closeMut.isPending && closeMut.variables?.id === pr.id}
            onMerge={() => merge(pr)}
            onClose={() => close(pr)}
          />
        ))}
      </div>
    </div>
  );
}

function PRRow({
  pr,
  merging,
  closing,
  onMerge,
  onClose,
}: {
  pr: PullRequest;
  merging: boolean;
  closing: boolean;
  onMerge: () => void;
  onClose: () => void;
}) {
  const stateColor =
    pr.state === "open"
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
      : pr.state === "merged"
        ? "bg-violet-500/15 text-violet-600 dark:text-violet-300"
        : "bg-muted text-muted-foreground";
  const t = useT();
  return (
    <div className="rounded-md border p-2.5">
      <div className="flex items-start gap-2">
        <GitPullRequest className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-xs font-medium">{pr.title || `PR #${pr.id}`}</span>
            <Badge variant="secondary" className={cn("h-4 px-1.5 text-[9px] uppercase", stateColor)}>
              {pr.state}
            </Badge>
          </div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">
            {pr.sourceRef} → {pr.targetRef}
          </div>
          {pr.description && (
            <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{pr.description}</p>
          )}
          <div className="mt-1 text-[10px] text-muted-foreground">
            #{pr.id} · {pr.authorId || "—"} · {pr.createTime || ""}
          </div>
        </div>
        {pr.state === "open" && (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              size="sm"
              className="h-6 gap-1 px-2 text-[11px]"
              onClick={onMerge}
              disabled={merging || closing}
            >
              {merging ? <Loader2 className="h-3 w-3 animate-spin" /> : <GitMerge className="h-3 w-3" />}
              Merge
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 gap-1 px-2 text-[11px]"
                  disabled={merging || closing}
                >
                  {closing ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                  Close
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Close pull request?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("editor.prCloseConfirm") ??
                      `Close "#${pr.id}" without merging? The source branch is not deleted.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onClose}>Close PR</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>
    </div>
  );
}
