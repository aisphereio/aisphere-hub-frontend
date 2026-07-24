'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  skillReleaseApi,
  type CompareSkillRefsInput,
  type CreateSkillReleaseInput,
  type RestoreSkillRefInput,
} from '@/lib/api/adapters/skill-release';

const releaseQueryKey = (skillName: string) => ['skills', 'releases', skillName] as const;
const refsQueryKey = (skillName: string) => ['skills', 'refs', skillName] as const;
const commitsQueryKey = (skillName: string, ref: string) =>
  ['skills', 'commits', skillName, ref] as const;

export function useSkillReleases(skillName: string | null) {
  return useQuery({
    queryKey: releaseQueryKey(skillName ?? ''),
    queryFn: () => skillReleaseApi.list(skillName!),
    enabled: Boolean(skillName),
    staleTime: 10_000,
  });
}

export function useCreateSkillRelease(skillName: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateSkillReleaseInput) =>
      skillReleaseApi.create(skillName, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: releaseQueryKey(skillName) }),
  });
}

export function useResolveSkillRelease(skillName: string) {
  return useMutation({
    mutationFn: (version: string) =>
      skillReleaseApi.resolve(skillName, version),
  });
}

export function useSkillRefs(skillName: string | null) {
  return useQuery({
    queryKey: refsQueryKey(skillName ?? ''),
    queryFn: () => skillReleaseApi.listRefs(skillName!),
    enabled: Boolean(skillName),
    staleTime: 10_000,
  });
}

export function useSkillCommits(skillName: string | null, ref: string) {
  return useQuery({
    queryKey: commitsQueryKey(skillName ?? '', ref),
    queryFn: () =>
      skillReleaseApi.listCommits(skillName!, {
        ref: ref || undefined,
        pageSize: 50,
      }),
    enabled: Boolean(skillName && ref),
    staleTime: 10_000,
  });
}

export function useCompareSkillRefs(skillName: string) {
  return useMutation({
    mutationFn: (input: CompareSkillRefsInput) =>
      skillReleaseApi.compare(skillName, input),
  });
}

export function useRestoreSkillRef(skillName: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RestoreSkillRefInput) =>
      skillReleaseApi.restore(skillName, input),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: refsQueryKey(skillName) }),
        queryClient.invalidateQueries({ queryKey: ['skills', 'commits', skillName] }),
      ]),
  });
}
