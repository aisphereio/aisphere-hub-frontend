'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { asItems } from '@/lib/api/client';
import {
  lightweightSkillSetApi,
  type LightweightSkillSetMember,
  type LightweightSkillSetUpdate,
} from '@/lib/api/skillsets';
import type { SkillSet, SkillSetMember } from '@/lib/api/types';

export function useSkillSets(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: ['skillsets', 'list', params],
    queryFn: async () => {
      const page = await lightweightSkillSetApi.list(params);
      return asItems<SkillSet>(page);
    },
    staleTime: 15_000,
  });
}

export function useSkillSetDetail(skillSetName: string | null) {
  return useQuery({
    queryKey: ['skillsets', 'detail', skillSetName],
    queryFn: () => lightweightSkillSetApi.detail(skillSetName!),
    enabled: Boolean(skillSetName),
    staleTime: 10_000,
  });
}

export function useSkillSetSkills(skillSetName: string | null) {
  return useSkillSetDetail(skillSetName);
}

export function useSkillSetSave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (skillSet: SkillSet) => lightweightSkillSetApi.create(skillSet),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skillsets', 'list'] });
    },
  });
}

export function useSkillSetUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ skillSetName, data }: { skillSetName: string; data: LightweightSkillSetUpdate }) =>
      lightweightSkillSetApi.update(skillSetName, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['skillsets', 'detail', vars.skillSetName] });
      queryClient.invalidateQueries({ queryKey: ['skillsets', 'list'] });
    },
  });
}

export function useSkillSetReplaceMembers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      skillSetName,
      members,
    }: {
      skillSetName: string;
      members: LightweightSkillSetMember[];
    }) => lightweightSkillSetApi.replaceMembers(skillSetName, members),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['skillsets', 'detail', vars.skillSetName] });
      queryClient.invalidateQueries({ queryKey: ['skillsets', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['skills', 'list'] });
    },
  });
}

export function useSkillSetDelete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (skillSetName: string) => lightweightSkillSetApi.remove(skillSetName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skillsets', 'list'] });
    },
  });
}

/**
 * Compatibility wrappers for older call sites. Membership is still persisted
 * as one ordered list; version, label and required fields are intentionally
 * ignored because those belong to the independently released Skill.
 */
export function useSkillSetBind() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ skillSetName, member }: { skillSetName: string; member: SkillSetMember }) => {
      const current = await lightweightSkillSetApi.detail(skillSetName);
      const members = [...(current.members || [])]
        .filter((item) => item.skillName !== member.skillName)
        .map((item, index) => ({ skillName: item.skillName, order: item.order ?? index }));
      members.push({ skillName: member.skillName, order: members.length });
      return lightweightSkillSetApi.replaceMembers(skillSetName, members);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['skillsets', 'detail', vars.skillSetName] });
      queryClient.invalidateQueries({ queryKey: ['skillsets', 'list'] });
    },
  });
}

export function useSkillSetUnbind() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ skillSetName, skillName }: { skillSetName: string; skillName: string }) => {
      const current = await lightweightSkillSetApi.detail(skillSetName);
      const members = (current.members || [])
        .filter((item) => item.skillName !== skillName)
        .map((item, index) => ({ skillName: item.skillName, order: index }));
      return lightweightSkillSetApi.replaceMembers(skillSetName, members);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['skillsets', 'detail', vars.skillSetName] });
      queryClient.invalidateQueries({ queryKey: ['skillsets', 'list'] });
    },
  });
}

export function useSkillSetUpdateMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      skillSetName,
      skillName,
      member,
    }: {
      skillSetName: string;
      skillName: string;
      member: Partial<SkillSetMember>;
    }) => {
      const current = await lightweightSkillSetApi.detail(skillSetName);
      const members = (current.members || []).map((item, index) => ({
        skillName: item.skillName,
        order: item.skillName === skillName ? (member.order ?? item.order ?? index) : (item.order ?? index),
      }));
      members.sort((a, b) => a.order - b.order || a.skillName.localeCompare(b.skillName));
      return lightweightSkillSetApi.replaceMembers(skillSetName, members);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['skillsets', 'detail', vars.skillSetName] });
      queryClient.invalidateQueries({ queryKey: ['skillsets', 'list'] });
    },
  });
}

export function useSkillSetsOfSkill(skillName: string | null) {
  return useQuery({
    queryKey: ['skillsets', 'of-skill', skillName],
    queryFn: async () => {
      const response = await lightweightSkillSetApi.ofSkill(skillName!);
      return response.skillsets || [];
    },
    enabled: Boolean(skillName),
    staleTime: 30_000,
  });
}
