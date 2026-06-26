'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { skillSetApi } from '@/lib/api';
import { asItems } from '@/lib/api/client';
import type { SkillSet, SkillSetUpdate } from '@/lib/api/types';

export function useSkillSets(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: ['skillsets', 'list', params],
    queryFn: async () => {
      const page = await skillSetApi.list(params);
      return asItems<SkillSet>(page);
    },
    staleTime: 15_000,
  });
}

export function useSkillSetDetail(skillSetName: string | null) {
  return useQuery({
    queryKey: ['skillsets', 'detail', skillSetName],
    queryFn: () => skillSetApi.detail(skillSetName!),
    enabled: Boolean(skillSetName),
    staleTime: 10_000,
  });
}

export function useSkillSetSkills(skillSetName: string | null) {
  return useQuery({
    queryKey: ['skillsets', 'skills', skillSetName],
    queryFn: () => skillSetApi.skillSetSkills(skillSetName!),
    enabled: Boolean(skillSetName),
    staleTime: 10_000,
  });
}

export function useSkillSetSave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (group: SkillSet) => skillSetApi.save(group),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skillsets', 'list'] });
    },
  });
}

export function useSkillSetUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ skillSetName, data }: { skillSetName: string; data: SkillSetUpdate }) =>
      skillSetApi.update(skillSetName, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['skillsets', 'detail', vars.skillSetName] });
      queryClient.invalidateQueries({ queryKey: ['skillsets', 'list'] });
    },
  });
}

export function useSkillSetDelete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (skillSetName: string) => skillSetApi.remove(skillSetName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skillsets', 'list'] });
    },
  });
}

export function useSkillSetBind() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ skillSetName, member }: { skillSetName: string; member: Record<string, unknown> }) =>
      skillSetApi.bind(skillSetName, member),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['skillsets', 'detail', vars.skillSetName] });
      queryClient.invalidateQueries({ queryKey: ['skillsets', 'list'] });
    },
  });
}

export function useSkillSetUnbind() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ skillSetName, skillName }: { skillSetName: string; skillName: string }) =>
      skillSetApi.unbind(skillSetName, skillName),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['skillsets', 'detail', vars.skillSetName] });
      queryClient.invalidateQueries({ queryKey: ['skillsets', 'list'] });
    },
  });
}
