'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { iamApi, iamDirectoryApi, iamProjectApi, iamResourceService, iamGrantService } from '@/lib/api';
import type { LocalUser } from '@/lib/api/types';

// ─── Legacy Local User Hooks ───────────────────────────────────────────

export function useIamUsers() {
  return useQuery({
    queryKey: ['iam', 'users'],
    queryFn: () => iamApi.listUsers(),
    staleTime: 30_000,
  });
}

export function useIamSaveUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (u: LocalUser & { password?: string }) => iamApi.saveUser(u),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iam', 'users'] });
    },
  });
}

export function useIamDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (username: string) => iamApi.deleteUser(username),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iam', 'users'] });
    },
  });
}

// ─── IAM Directory Hooks ───────────────────────────────────────────────

export function useIamDirectoryUsers(orgId: string) {
  return useQuery({
    queryKey: ['iam-directory', 'users', orgId],
    queryFn: () => iamDirectoryApi.listUsers(orgId),
    enabled: !!orgId,
    staleTime: 30_000,
  });
}

export function useIamDirectoryOrganization(orgId: string) {
  return useQuery({
    queryKey: ['iam-directory', 'org', orgId],
    queryFn: () => iamDirectoryApi.getOrganization(orgId),
    enabled: !!orgId,
    staleTime: 60_000,
  });
}

export function useIamDirectoryGroups(orgId: string) {
  return useQuery({
    queryKey: ['iam-directory', 'groups', orgId],
    queryFn: () => iamDirectoryApi.listGroups(orgId),
    enabled: !!orgId,
    staleTime: 30_000,
  });
}

// ─── Control Plane: Organizations ──────────────────────────────────────

export function useIamOrganizations() {
  return useQuery({
    queryKey: ['iam-cp', 'organizations'],
    queryFn: () => iamProjectApi.listOrganizations(),
    staleTime: 30_000,
  });
}

export function useIamOrganization(orgId: string) {
  return useQuery({
    queryKey: ['iam-cp', 'organization', orgId],
    queryFn: () => iamProjectApi.getOrganization(orgId),
    enabled: !!orgId,
    staleTime: 30_000,
  });
}

export function useIamCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (org: { slug: string; displayName?: string; casdoorOrg?: string }) =>
      iamProjectApi.createOrganization(org),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iam-cp', 'organizations'] });
    },
  });
}

// ─── Control Plane: Projects ───────────────────────────────────────────

export function useIamProjects() {
  return useQuery({
    queryKey: ['iam-cp', 'projects'],
    queryFn: () => iamProjectApi.listProjects(),
    staleTime: 30_000,
  });
}

export function useIamProject(projectId: string) {
  return useQuery({
    queryKey: ['iam-cp', 'project', projectId],
    queryFn: () => iamProjectApi.getProject(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

export function useIamCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, ...project }: { orgId: string; slug: string; displayName?: string; description?: string }) =>
      iamProjectApi.createProject(orgId, project),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iam-cp', 'projects'] });
    },
  });
}

// ─── Control Plane: Capabilities ───────────────────────────────────────

export function useIamCapabilities() {
  return useQuery({
    queryKey: ['iam-cp', 'capabilities'],
    queryFn: () => iamProjectApi.listCapabilities(),
    staleTime: 60_000,
  });
}

export function useIamProjectCapabilities(projectId: string) {
  return useQuery({
    queryKey: ['iam-cp', 'project-capabilities', projectId],
    queryFn: () => iamProjectApi.listProjectCapabilities(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

// ─── Control Plane: Resource Types & Resources ─────────────────────────

export function useIamResourceTypes() {
  return useQuery({
    queryKey: ['iam-cp', 'resource-types'],
    queryFn: () => iamResourceService.listResourceTypes(),
    staleTime: 60_000,
  });
}

export function useIamResources(params: { resourceType?: string; projectId?: string } = {}) {
  return useQuery({
    queryKey: ['iam-cp', 'resources', params],
    queryFn: () => iamResourceService.listResources(params),
    staleTime: 30_000,
  });
}

export function useIamResourceBindings(params: { sourceType?: string; sourceId?: string } = {}) {
  return useQuery({
    queryKey: ['iam-cp', 'resource-bindings', params],
    queryFn: () => iamResourceService.listResourceBindings(params),
    staleTime: 30_000,
  });
}

// ─── Control Plane: Grants & Role Templates ────────────────────────────

export function useIamRoleTemplates() {
  return useQuery({
    queryKey: ['iam-cp', 'role-templates'],
    queryFn: () => iamGrantService.listRoleTemplates(),
    staleTime: 60_000,
  });
}

export function useIamGrants(params: { resourceType?: string; resourceId?: string } = {}) {
  return useQuery({
    queryKey: ['iam-cp', 'grants', params],
    queryFn: () => iamGrantService.listGrants(params),
    staleTime: 30_000,
  });
}

export function useIamGrantAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (grant: {
      resource: { type: string; id: string };
      roleKey?: string;
      relation?: string;
      subject: { type: string; id: string; relation?: string };
      reason?: string;
    }) => iamGrantService.grantAccess(grant),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iam-cp', 'grants'] });
    },
  });
}

export function useIamRevokeAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (grantId: string) => iamGrantService.revokeAccess(grantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iam-cp', 'grants'] });
    },
  });
}