'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { iamApi, iamDirectoryApi, iamProjectApi, iamResourceService, iamGrantService, iamGroupAdminApi, iamAuthzAdminApi } from '@/lib/api';
import type { LocalUser, IamGroup, IamCheckPermissionRequest, IamRelationship } from '@/lib/api/types';

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

// ─── Group Admin Hooks ───────────────────────────────────────────────────

export function useIamCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, group }: { orgId: string; group: { name: string; displayName?: string; type?: string; parentId?: string } }) =>
      iamGroupAdminApi.createGroup(orgId, group),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iam-directory', 'groups'] });
    },
  });
}

export function useIamUpdateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, groupId, group }: { orgId: string; groupId: string; group: Partial<IamGroup> }) =>
      iamGroupAdminApi.updateGroup(orgId, groupId, group),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iam-directory', 'groups'] });
    },
  });
}

export function useIamDeleteGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, groupId, recursive }: { orgId: string; groupId: string; recursive?: boolean }) =>
      iamGroupAdminApi.deleteGroup(orgId, groupId, recursive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iam-directory', 'groups'] });
    },
  });
}

export function useIamAssignUserToGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, groupId, userId }: { orgId: string; groupId: string; userId: string }) =>
      iamGroupAdminApi.assignUserToGroup(orgId, groupId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iam-directory', 'groups'] });
    },
  });
}

export function useIamRemoveUserFromGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, groupId, userId }: { orgId: string; groupId: string; userId: string }) =>
      iamGroupAdminApi.removeUserFromGroup(orgId, groupId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iam-directory', 'groups'] });
    },
  });
}

// ─── Authz Admin Hooks ───────────────────────────────────────────────────

export function useIamAuthzSchema() {
  return useQuery({
    queryKey: ['iam-authz', 'schema'],
    queryFn: () => iamAuthzAdminApi.getSchema(),
    staleTime: 60_000,
  });
}

export function useIamAuthzValidateSchema() {
  return useMutation({
    mutationFn: (text: string) => iamAuthzAdminApi.validateSchema(text),
  });
}

export function useIamAuthzPublishSchema() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => iamAuthzAdminApi.publishSchema(text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iam-authz', 'schema'] });
    },
  });
}

export function useIamAuthzRelationships(filter?: {
  resourceType?: string;
  resourceId?: string;
  relation?: string;
  subjectType?: string;
  subjectId?: string;
}) {
  return useQuery({
    queryKey: ['iam-authz', 'relationships', filter],
    queryFn: () => iamAuthzAdminApi.listRelationships(filter),
    staleTime: 30_000,
  });
}

export function useIamAuthzWriteRelationships() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (relationships: IamRelationship[]) =>
      iamAuthzAdminApi.writeRelationships(relationships),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iam-authz', 'relationships'] });
    },
  });
}

export function useIamAuthzDeleteRelationships() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (filter: {
      resourceType?: string;
      resourceId?: string;
      relation?: string;
      subjectType?: string;
      subjectId?: string;
    }) => iamAuthzAdminApi.deleteRelationships(filter),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iam-authz', 'relationships'] });
    },
  });
}

export function useIamAuthzCheckPermission() {
  return useMutation({
    mutationFn: (req: IamCheckPermissionRequest) =>
      iamAuthzAdminApi.checkPermission(req),
  });
}

export function useIamAuthzExplainPermission() {
  return useMutation({
    mutationFn: (req: IamCheckPermissionRequest) =>
      iamAuthzAdminApi.explainPermission(req),
  });
}

export function useIamAuthzEffectivePermissions(params: {
  subjectType: string;
  subjectId: string;
  resourceType: string;
  resourceId: string;
  permissions?: string[];
}) {
  return useQuery({
    queryKey: ['iam-authz', 'effective-permissions', params],
    queryFn: () => iamAuthzAdminApi.getEffectivePermissions(params),
    enabled: !!params.subjectId && !!params.resourceId,
    staleTime: 30_000,
  });
}