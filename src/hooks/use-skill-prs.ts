"use client";

/**
 * use-skill-prs — TanStack Query hooks for skill pull requests.
 *
 * Query keys follow the ["skills", "prs", <op>, <args>] convention so
 * the list/detail queries share a prefix that mutations can invalidate
 * in one shot. Merge surfaces a 409 (target moved) as error.isConflict
 * so the UI can refetch and let the user retry, mirroring useSaveFile.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { prApi } from "@/lib/api";
import type { CreatePullRequestInput, MergePullRequestInput } from "@/lib/api/adapters/pr";
import { HubApiError } from "@/lib/api/hub-fetch";
import type { PullRequest } from "@/lib/api/types";

export const SKILL_PR_QUERY_KEYS = {
  list: (skillName: string, state?: string) =>
    ["skills", "prs", "list", skillName, state ?? "all"] as const,
  allForSkill: (skillName: string) => ["skills", "prs", skillName] as const,
};

/** List PRs on a skill, optionally filtered by state. */
export function usePullRequests(
  skillName: string | null,
  state?: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery<{ items: PullRequest[]; nextPageToken?: string }>({
    queryKey: SKILL_PR_QUERY_KEYS.list(skillName ?? "", state),
    queryFn: () => prApi.list(skillName!, { state }),
    enabled: Boolean(skillName) && (options.enabled ?? true),
    staleTime: 10_000,
  });
}

export type CreatePRError = { isConflict: boolean; cause: unknown };

/**
 * useCreatePR opens a new PR. A 409 (source branch already has an open
 * PR / missing branch) surfaces as isConflict so the UI can explain.
 */
export function useCreatePR() {
  const queryClient = useQueryClient();
  return useMutation<PullRequest, CreatePRError, { skillName: string } & CreatePullRequestInput>({
    mutationFn: async (input) => {
      try {
        return await prApi.create(input.skillName, {
          sourceRef: input.sourceRef,
          title: input.title,
          description: input.description,
        });
      } catch (err) {
        const status = err instanceof HubApiError ? err.status : 0;
        if (status === 409) throw { isConflict: true, cause: err };
        throw { isConflict: false, cause: err };
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: SKILL_PR_QUERY_KEYS.allForSkill(vars.skillName),
      });
    },
  });
}

export type MergePRError = { isConflict: boolean; cause: unknown };

/**
 * useMergePR merges a PR. The caller must pass the target sha it last
 * saw; if another PR merged first the server returns 409 and this hook
 * rejects with isConflict so the UI can refetch + retry.
 */
export function useMergePR() {
  const queryClient = useQueryClient();
  return useMutation<
    PullRequest,
    MergePRError,
    { skillName: string; id: string } & MergePullRequestInput
  >({
    mutationFn: async (input) => {
      try {
        return await prApi.merge(input.skillName, input.id, {
          expectedTargetSha: input.expectedTargetSha,
        });
      } catch (err) {
        const status = err instanceof HubApiError ? err.status : 0;
        if (status === 409) throw { isConflict: true, cause: err };
        throw { isConflict: false, cause: err };
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: SKILL_PR_QUERY_KEYS.allForSkill(vars.skillName),
      });
    },
  });
}

/** Close a PR without merging. */
export function useClosePR() {
  const queryClient = useQueryClient();
  return useMutation<PullRequest, Error, { skillName: string; id: string }>({
    mutationFn: (input) => prApi.close(input.skillName, input.id),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: SKILL_PR_QUERY_KEYS.allForSkill(vars.skillName),
      });
    },
  });
}
