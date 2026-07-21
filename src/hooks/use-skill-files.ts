"use client";

/**
 * use-skill-files — TanStack Query hooks for the in-browser skill file
 * editor. Mirrors the query-key + invalidation conventions of
 * use-skills.ts:
 *   - list/detail keys are ["skills", "<op>", <args>]
 *   - mutations invalidate by prefix so a save refreshes both the tree
 *     and the open file
 *
 * Conflict handling: useSaveFile surfaces a 409 (ErrFileAlreadyExists)
 * as error.isConflict so the editor can refetch and let the user decide
 * whether to overwrite or discard — it does NOT auto-overwrite.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fileApi } from "@/lib/api";
import { HubApiError } from "@/lib/api/hub-fetch";
import type { SkillFile, SkillFileEntry } from "@/lib/api/types";

export const SKILL_FILE_QUERY_KEYS = {
  list: (skillName: string, path: string, ref?: string) =>
    ["skills", "files", "list", skillName, path, ref ?? "HEAD"] as const,
  file: (skillName: string, path: string, ref?: string) =>
    ["skills", "files", "file", skillName, path, ref ?? "HEAD"] as const,
  /** Prefix used to invalidate every file query for a skill. */
  allForSkill: (skillName: string) =>
    ["skills", "files", skillName] as const,
};

/** List entries at a path (root when path is ""). */
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

/** Fetch a single file's content + commit metadata. */
export function useFileContent(
  skillName: string | null,
  path: string | null,
  ref?: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery<SkillFile>({
    queryKey: SKILL_FILE_QUERY_KEYS.file(skillName ?? "", path ?? "", ref),
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
  /** When sha is provided, server enforces optimistic concurrency. */
  sha?: string;
  message?: string;
  branch?: string;
  /** true = create new file (POST), false = update existing (PUT). */
  create?: boolean;
};

export type SaveFileError = {
  isConflict: boolean;
  cause: unknown;
};

/**
 * useSaveFile creates or updates a file. On a 409 (someone else wrote
 * first / create-clobber) it rejects with { isConflict: true } so the
 * caller can refetch and prompt. On success it invalidates the file
 * tree + the open file so the UI re-renders with fresh SHAs.
 */
export function useSaveFile() {
  const queryClient = useQueryClient();
  return useMutation<SkillFile, SaveFileError, SaveFileInput>({
    mutationFn: async (input) => {
      try {
        if (input.create) {
          return await fileApi.create(input.skillName, input.path, input.content, {
            message: input.message,
            branch: input.branch,
          });
        }
        return await fileApi.update(input.skillName, input.path, input.content, {
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
      queryClient.invalidateQueries({
        queryKey: SKILL_FILE_QUERY_KEYS.allForSkill(vars.skillName),
      });
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
      queryClient.invalidateQueries({
        queryKey: SKILL_FILE_QUERY_KEYS.allForSkill(vars.skillName),
      });
    },
  });
}
