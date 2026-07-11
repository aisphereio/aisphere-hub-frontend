'use client';

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { iamAuthApi, iamDirectoryApi, sharesApi, skillApi } from '@/lib/api';
import type { IamGroup, IamUser, ResourceGrant, ShareRole, ShareSubjectType } from '@/lib/api/types';

export type SkillShareTarget = {
  subjectType: Extract<ShareSubjectType, 'user' | 'group'>;
  subjectId: string;
  subjectRelation?: string;
  displayName: string;
  description?: string;
};

function userToTarget(user: IamUser): SkillShareTarget {
  return {
    subjectType: 'user',
    subjectId: user.id,
    displayName: user.displayName || user.username || user.id,
    description: user.email || user.username || user.externalId,
  };
}

function groupToTarget(group: IamGroup): SkillShareTarget {
  return {
    subjectType: 'group',
    subjectId: group.id,
    subjectRelation: 'member',
    displayName: group.displayName || group.name || group.path || group.id,
    description: group.path || group.type || group.externalId,
  };
}

function matchTarget(target: SkillShareTarget, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [target.displayName, target.description, target.subjectId, target.subjectType]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(q));
}

export function useSkillShares(skillName: string | null) {
  return useQuery({
    queryKey: ['skills', 'shares', skillName],
    queryFn: () => sharesApi.listSkillShares(skillName!),
    enabled: Boolean(skillName),
    staleTime: 10_000,
  });
}

export function useSkillShareTargets(open: boolean, query: string, governingOrgId?: string) {
  const targetsQuery = useQuery({
    queryKey: ['iam', 'share-targets', governingOrgId || 'current'],
    enabled: open,
    staleTime: 30_000,
    queryFn: async () => {
      const me = await iamAuthApi.getMe();
      const orgId = governingOrgId || me.orgId || me.tenantId || '';
      if (!orgId) return [] as SkillShareTarget[];

      const [usersResult, groupsResult] = await Promise.allSettled([
        iamDirectoryApi.listUsers(orgId),
        iamDirectoryApi.listGroups(orgId),
      ]);

      const users = usersResult.status === 'fulfilled' ? usersResult.value.users || [] : [];
      const groups = groupsResult.status === 'fulfilled' ? groupsResult.value.groups || [] : [];

      return [
        ...users.filter((user) => user.enabled !== false).map(userToTarget),
        ...groups.map(groupToTarget),
      ];
    },
  });

  const filtered = useMemo(
    () => (targetsQuery.data || []).filter((target) => matchTarget(target, query)),
    [targetsQuery.data, query],
  );

  return { ...targetsQuery, data: filtered };
}

export function useGrantSkillShare(skillName: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ target, role }: { target: SkillShareTarget; role: Extract<ShareRole, 'viewer' | 'editor' | 'reviewer'> }) => {
      if (!skillName) throw new Error('skillName is required');
      return sharesApi.createSkillShare(skillName, {
        subjectType: target.subjectType,
        subjectId: target.subjectId,
        subjectRelation: target.subjectType === 'group' ? 'member' : undefined,
        role,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills', 'shares', skillName] });
      queryClient.invalidateQueries({ queryKey: ['skills', 'detail', skillName] });
      queryClient.invalidateQueries({ queryKey: ['skills', 'list'] });
    },
  });
}

export function useRevokeSkillShare(skillName: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (grant: ResourceGrant) => {
      if (!skillName) throw new Error('skillName is required');
      return sharesApi.deleteSkillShare(skillName, grant.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills', 'shares', skillName] });
      queryClient.invalidateQueries({ queryKey: ['skills', 'detail', skillName] });
      queryClient.invalidateQueries({ queryKey: ['skills', 'list'] });
    },
  });
}

export function useUpdateSkillPublicVisibility(skillName: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (visibility: 'private' | 'internal' | 'public') => {
      if (!skillName) throw new Error('skillName is required');
      return skillApi.scope(skillName, visibility);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills', 'shares', skillName] });
      queryClient.invalidateQueries({ queryKey: ['skills', 'detail', skillName] });
      queryClient.invalidateQueries({ queryKey: ['skills', 'list'] });
    },
  });
}
