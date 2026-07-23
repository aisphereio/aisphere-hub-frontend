'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  skillReleaseApi,
  type CreateSkillReleaseInput,
} from '@/lib/api/adapters/skill-release';

const releaseQueryKey = (skillName: string) => ['skills', 'releases', skillName] as const;

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
