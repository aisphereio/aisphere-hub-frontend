"use client";

/**
 * TanStack Query hooks for the in-browser Skill file editor.
 *
 * Query keys are grouped by Skill first so prefix invalidation works:
 *   ["skills", "files", <skill>, "list", ...]
 *   ["skills", "files", <skill>, "file", ...]
 *
 * Conflict handling: useSaveFile surfaces a 409 as error.isConflict. The
 * editor decides whether to keep the local buffer or adopt the server copy.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fileApi } from "@/lib/api";
import { HubApiError } from "@/lib/api/hub-fetch";
import type { SkillFile, SkillFileEntry } from "@/lib/api/types";

const skillFileRoot = (skillName: string) =>
  ["skills", "files", skillName] as const;

export const SKILL_FILE_QUERY_KEYS = {
  allForSkill: (skillName: string) => skillFileRoot(skillName),
  listsForSkill: (skillName: string) =>
    [...skillFileRoot(skillName), "list"] as const,
  filesForSkill: (skillName: string) =>
    [...skillFileRoot(skillName), "file"] as const,
  list: (skillName: string, path: string, ref?: string) =>
    [...skillFileRoot(skillName), "list", path, ref ?? "HEAD"] as const,
  file: (skillName: string, path: string, ref?: string) =>
    [...skillFileRoot(skillName), "file", path, ref ?? "HEAD"] as const,
};

/** List entries at a path (root when path is empty). */
export function useFileTree(
  skillName: string | null,
  path: string = "",
  ref?: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery<SkillFileEntry[]>({
    queryKey: SKILL_FILE_QUERY_KEYS.list(skillName ?? "", path, ref),
    queryFn: () => fileApi.list(skillName!, { path, ref }),
    enabled: Boolean(skillName) && (options.enabled ?? true),
    staleTime: 10_000,
  });
}

/** Fetch a single file's content and commit metadata. */
export function useFileContent(
  skillName: string | null,
  path: string | null,
  ref?: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery<SkillFile>({
    queryKey: SKILL_FILE_QUERY_KEYS.file(
      skillName ?? "",
      path ?? "",
      ref,
    ),
    queryFn: () => fileApi.get(skillName!, path!, ref),
    enabled:
      Boolean(skillName) && Boolean(path) && (options.enabled ?? true),
    staleTime: 10_000,
  });
}

export type SaveFileInput = {
  skillName: string;
  path: string;
  content: string;
  /** When sha is provided, the server enforces optimistic concurrency. */
  sha?: string;
  message?: string;
  branch?: string;
  /** true creates a new file; false updates an existing file. */
  create?: boolean;
};

export type SaveFileError = {
  isConflict: boolean;
  cause: unknown;
};

/** Create or update a file and update the exact content cache immediately. */
export function useSaveFile() {
  const queryClient = useQueryClient();

  return useMutation<SkillFile, SaveFileError, SaveFileInput>({
    mutationFn: async (input) => {
      try {
        if (input.create) {
          return await fileApi.create(
            input.skillName,
            input.path,
            input.content,
            {
              message: input.message,
              branch: input.branch,
            },
          );
        }

        return await fileApi.update(
          input.skillName,
          input.path,
          input.content,
          {
            message: input.message,
            sha: input.sha,
            branch: input.branch,
          },
        );
      } catch (err) {
        const status = err instanceof HubApiError ? err.status : 0;
        const code = err instanceof HubApiError ? err.code : "";
        if (status === 409 || code === "SKILL_FILE_ALREADY_EXISTS") {
          throw { isConflict: true, cause: err };
        }
        throw { isConflict: false, cause: err };
      }
    },
    onSuccess: (file, vars) => {
      // Make a newly created or updated file available immediately. This also
      // prevents the editor from briefly remounting with an empty buffer while
      // the newly enabled file query is waiting for the network.
      queryClient.setQueryData(
        SKILL_FILE_QUERY_KEYS.file(vars.skillName, vars.path, vars.branch),
        file,
      );

      // A save can create a new tree entry, so every open directory listing for
      // the Skill must be considered stale.
      void queryClient.invalidateQueries({
        queryKey: SKILL_FILE_QUERY_KEYS.listsForSkill(vars.skillName),
      });

      if (vars.path === "SKILL.md") {
        void queryClient.invalidateQueries({
          queryKey: ["skills", "detail", vars.skillName],
        });
        void queryClient.invalidateQueries({ queryKey: ["skills", "list"] });
      }
    },
  });
}

export type DeleteFileInput = {
  skillName: string;
  path: string;
  sha?: string;
  message?: string;
  branch?: string;
};

export function useDeleteFile() {
  const queryClient = useQueryClient();

  return useMutation<
    { commitSha: string; commitMessage: string },
    SaveFileError,
    DeleteFileInput
  >({
    mutationFn: async (input) => {
      try {
        return await fileApi.remove(input.skillName, input.path, {
          message: input.message,
          sha: input.sha,
          branch: input.branch,
        });
      } catch (err) {
        const status = err instanceof HubApiError ? err.status : 0;
        const code = err instanceof HubApiError ? err.code : "";
        if (status === 409 || code === "SKILL_FILE_ALREADY_EXISTS") {
          throw { isConflict: true, cause: err };
        }
        throw { isConflict: false, cause: err };
      }
    },
    onSuccess: (_, vars) => {
      queryClient.removeQueries({
        queryKey: SKILL_FILE_QUERY_KEYS.file(
          vars.skillName,
          vars.path,
          vars.branch,
        ),
        exact: true,
      });

      void queryClient.invalidateQueries({
        queryKey: SKILL_FILE_QUERY_KEYS.listsForSkill(vars.skillName),
      });
    },
  });
}
