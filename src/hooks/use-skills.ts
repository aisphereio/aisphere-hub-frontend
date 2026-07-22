"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { skillApi, socialApi } from "@/lib/api";
import { asItems } from "@/lib/api/client";
import type { Skill, SkillArchiveImportDraft, SkillDraft } from "@/lib/api/types";

const ENABLE_SKILL_SOCIAL =
  process.env.NEXT_PUBLIC_ENABLE_SKILL_SOCIAL === "1" ||
  process.env.NEXT_PUBLIC_ENABLE_SKILL_SOCIAL === "true";

export function useSkills(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: ["skills", "list", params],
    queryFn: async () => {
      const page = await skillApi.list(params);
      return asItems<Skill>(page);
    },
    staleTime: 15_000,
  });
}

export function useSkillDetail(skillName: string | null) {
  return useQuery({
    queryKey: ["skills", "detail", skillName],
    queryFn: () => skillApi.detail(skillName!),
    enabled: Boolean(skillName),
    staleTime: 10_000,
  });
}

export function useSkillSocial(skillName: string | null) {
  return useQuery({
    queryKey: ["skills", "social", skillName],
    queryFn: () => socialApi.stats(skillName!),
    enabled: Boolean(skillName && ENABLE_SKILL_SOCIAL),
    staleTime: 30_000,
  });
}

export function useSkillDelete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (skillName: string) => skillApi.remove(skillName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills", "list"] });
      queryClient.invalidateQueries({ queryKey: ["skills", "detail"] });
    },
  });
}

export function useSkillDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SkillDraft) => {
      // orgId is required. projectId is optional — when provided it is
      // stored as a classification field; the authz check now uses
      // create_skill on zone:{org_id} instead of project:{org_id}/{project_id}.
      return skillApi.draft(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills", "list"] });
    },
  });
}

export function useSkillArchiveImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SkillArchiveImportDraft) => skillApi.importArchive(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills", "list"] });
    },
  });
}

export function useSkillScope() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ skillName, scope }: { skillName: string; scope: string }) =>
      skillApi.scope(skillName, scope),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["skills", "detail", vars.skillName],
      });
    },
  });
}

export function useSocialStar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      skillName,
      starred,
    }: {
      skillName: string;
      starred: boolean;
    }) => socialApi.star(skillName, starred),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["skills", "social", vars.skillName],
      });
    },
  });
}

export function useSocialRating() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      skillName,
      rating,
      comment,
    }: {
      skillName: string;
      rating: number;
      comment?: string;
    }) => socialApi.rating(skillName, rating, comment),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["skills", "social", vars.skillName],
      });
    },
  });
}

export function useSocialSubscribe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      skillName,
      subscribed,
    }: {
      skillName: string;
      subscribed: boolean;
    }) => socialApi.subscribe(skillName, subscribed),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["skills", "social", vars.skillName],
      });
    },
  });
}
