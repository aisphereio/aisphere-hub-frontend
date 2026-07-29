'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  modelManagementApi,
  type ModelEndpointWriteRequest,
  type ModelEndpoint,
  type ModelProfileV2,
  type ModelProfileWriteRequest,
  type ModelResource,
  type ModelWriteRequest,
} from '@/lib/api/model-management';

export interface ModelConnection {
  key: string;
  model: ModelResource;
  endpoint?: ModelEndpoint;
  profile?: ModelProfileV2;
}

export interface SaveModelConnectionInput {
  current?: ModelConnection | null;
  model: ModelWriteRequest;
  endpoint: Omit<ModelEndpointWriteRequest, 'modelId'>;
  profile: Omit<ModelProfileWriteRequest, 'endpointId'>;
}

export function useModels(params: Record<string, unknown> = {}) {
  return useQuery<ModelResource[]>({
    queryKey: ['model-management', 'models', params],
    queryFn: async () => (await modelManagementApi.listModels(params)).items ?? [],
    staleTime: 15_000,
  });
}

export function useModelEndpoints(params: Record<string, unknown> = {}) {
  return useQuery<ModelEndpoint[]>({
    queryKey: ['model-management', 'endpoints', params],
    queryFn: async () =>
      (await modelManagementApi.listEndpoints(params)).items ?? [],
    staleTime: 15_000,
  });
}

export function useModelProfilesV2(params: Record<string, unknown> = {}) {
  return useQuery<ModelProfileV2[]>({
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

export function useTestModelEndpoint() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => modelManagementApi.testEndpoint(id),
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

export function useSaveModelConnection() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ current, model: modelBody, endpoint: endpointBody, profile: profileBody }: SaveModelConnectionInput) => {
      let createdModelId = '';
      let createdEndpointId = '';
      let createdProfileId = '';
      const targetDisabled = profileBody.status === 'disabled';

      try {
        const stagedModelBody: ModelWriteRequest = targetDisabled
          ? { ...modelBody, status: 'active' }
          : modelBody;
        let modelResponse = current?.model
          ? await modelManagementApi.updateModel(current.model.id, stagedModelBody)
          : await modelManagementApi.createModel(stagedModelBody);
        let model = modelResponse.model;
        if (!current?.model) createdModelId = model.id;

        const stagedEndpointRequest: ModelEndpointWriteRequest = {
          ...endpointBody,
          status: targetDisabled ? 'active' : endpointBody.status,
          modelId: model.id,
        };
        let endpointResponse = current?.endpoint
          ? await modelManagementApi.updateEndpoint(current.endpoint.id, stagedEndpointRequest)
          : await modelManagementApi.createEndpoint(stagedEndpointRequest);
        let endpoint = endpointResponse.endpoint;
        if (!current?.endpoint) createdEndpointId = endpoint.id;

        const profileRequest: ModelProfileWriteRequest = {
          ...profileBody,
          endpointId: endpoint.id,
        };
        const profileResponse = current?.profile
          ? await modelManagementApi.updateProfile(current.profile.id, profileRequest)
          : await modelManagementApi.createProfile(profileRequest);
        if (!current?.profile) createdProfileId = profileResponse.profile.id;

        if (targetDisabled) {
          endpointResponse = await modelManagementApi.updateEndpoint(endpoint.id, {
            ...endpointBody,
            status: 'disabled',
            modelId: model.id,
          });
          endpoint = endpointResponse.endpoint;
          modelResponse = await modelManagementApi.updateModel(model.id, {
            ...modelBody,
            status: 'disabled',
          });
          model = modelResponse.model;
        }

        return {
          key: profileResponse.profile.id,
          model,
          endpoint,
          profile: profileResponse.profile,
        } satisfies ModelConnection;
      } catch (error) {
        if (createdProfileId) {
          await modelManagementApi.deleteProfile(createdProfileId).catch(() => undefined);
        }
        if (createdEndpointId) {
          await modelManagementApi.deleteEndpoint(createdEndpointId).catch(() => undefined);
        }
        if (createdModelId) {
          await modelManagementApi.deleteModel(createdModelId).catch(() => undefined);
        }
        throw error;
      }
    },
    onSettled: () =>
      client.invalidateQueries({ queryKey: ['model-management'] }),
  });
}

export function useDeleteModelConnection() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (connection: ModelConnection) => {
      if (connection.profile) {
        await modelManagementApi.deleteProfile(connection.profile.id);
        if (connection.endpoint) {
          await modelManagementApi.deleteEndpoint(connection.endpoint.id).catch(() => undefined);
        }
        await modelManagementApi.deleteModel(connection.model.id).catch(() => undefined);
        return;
      }
      if (connection.endpoint) {
        await modelManagementApi.deleteEndpoint(connection.endpoint.id);
        await modelManagementApi.deleteModel(connection.model.id).catch(() => undefined);
        return;
      }
      await modelManagementApi.deleteModel(connection.model.id);
    },
    onSettled: () =>
      client.invalidateQueries({ queryKey: ['model-management'] }),
  });
}
