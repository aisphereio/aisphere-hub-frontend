'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  skillReleaseApi,
  type CreateSkillReleaseInput,
} from '@/lib/api/adapters/skill-release';

const releaseQueryKey = (skillName: string) => ['skills', 'releases', skillName] as const;
const releaseRefQueryKey = (skillName: string, ref: string) =>
  ['skills', 'release-ref', skillName, ref] as const;

export function useSkillReleaseRef(skillName: string | null, ref: string | null) {
  return useQuery({
    queryKey: releaseRefQueryKey(skillName ?? '', ref ?? ''),
    queryFn: () => skillReleaseApi.resolveRef(skillName!, { ref: ref || undefined }),
    enabled: Boolean(skillName) && Boolean(ref),
    staleTime: 5_000,
  });
}

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
