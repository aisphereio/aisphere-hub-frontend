'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  modelManagementApi,
  type ModelEndpointWriteRequest,
  type ModelProfileWriteRequest,
  type ModelWriteRequest,
} from '@/lib/api/model-management';

export function useModels(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: ['model-management', 'models', params],
    queryFn: async () => (await modelManagementApi.listModels(params)).items ?? [],
    staleTime: 15_000,
  });
}

export function useModelEndpoints(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: ['model-management', 'endpoints', params],
    queryFn: async () =>
      (await modelManagementApi.listEndpoints(params)).items ?? [],
    staleTime: 15_000,
  });
}

export function useModelProfilesV2(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: ['model-management', 'profiles', params],
    queryFn: async () =>
      (await modelManagementApi.listProfiles(params)).items ?? [],
    staleTime: 15_000,
  });
}

export function useSaveModel() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: ModelWriteRequest }) =>
      id
        ? modelManagementApi.updateModel(id, body)
        : modelManagementApi.createModel(body),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ['model-management', 'models'] }),
  });
}

export function useDeleteModel() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => modelManagementApi.deleteModel(id),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ['model-management', 'models'] }),
  });
}

export function useSaveModelEndpoint() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id?: string;
      body: ModelEndpointWriteRequest;
    }) =>
      id
        ? modelManagementApi.updateEndpoint(id, body)
        : modelManagementApi.createEndpoint(body),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ['model-management', 'endpoints'] }),
  });
}

export function useDeleteModelEndpoint() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => modelManagementApi.deleteEndpoint(id),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ['model-management', 'endpoints'] }),
  });
}

export function useSaveModelProfileV2() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id?: string;
      body: ModelProfileWriteRequest;
    }) =>
      id
        ? modelManagementApi.updateProfile(id, body)
        : modelManagementApi.createProfile(body),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ['model-management', 'profiles'] }),
  });
}

export function useDeleteModelProfileV2() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => modelManagementApi.deleteProfile(id),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ['model-management', 'profiles'] }),
  });
}

export function useResolveModelProfileV2() {
  return useMutation({
    mutationFn: ({ id, revision }: { id: string; revision?: number }) =>
      modelManagementApi.resolveProfile(id, revision),
  });
}
