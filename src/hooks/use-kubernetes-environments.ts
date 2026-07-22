'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  clusterServiceCreateCluster,
  clusterServiceDeleteCluster,
  clusterServiceListClusters,
  clusterServiceProbeCluster,
  clusterServiceRotateCredential,
} from '@/lib/api/generated/cluster-service/cluster-service';
import {
  namespaceServiceCreateNamespace,
  namespaceServiceDeleteNamespace,
  namespaceServiceListClusterNamespaces,
  namespaceServiceSyncNamespaces,
  namespaceServiceUpdateNamespaceVisibility,
} from '@/lib/api/generated/namespace-service/namespace-service';
import type {
  NamespaceServiceCreateNamespaceBody,
  NamespaceServiceUpdateNamespaceVisibilityBody,
  V1Cluster,
  V1ClusterCredentialInput,
  V1CreateClusterRequest,
  V1Namespace,
} from '@/lib/api/generated/model';

const clusterKeys = {
  all: ['kubernetes', 'clusters'] as const,
  namespaces: (clusterId: string) => ['kubernetes', 'clusters', clusterId, 'namespaces'] as const,
};

export type CreateClusterInput = Omit<V1CreateClusterRequest, 'credential'> & {
  credential: V1ClusterCredentialInput;
};

export function useKubernetesClusters() {
  return useQuery<V1Cluster[]>({
    queryKey: clusterKeys.all,
    queryFn: async () => (await clusterServiceListClusters({ pageSize: 100 })).clusters ?? [],
    staleTime: 10_000,
  });
}

export function useClusterNamespaces(clusterId: string | null) {
  return useQuery<V1Namespace[]>({
    queryKey: clusterKeys.namespaces(clusterId ?? ''),
    queryFn: async () =>
      (await namespaceServiceListClusterNamespaces(clusterId!, { pageSize: 200 })).namespaces ?? [],
    enabled: Boolean(clusterId),
    staleTime: 10_000,
  });
}

export function useCreateCluster() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateClusterInput) => clusterServiceCreateCluster(input),
    onSuccess: () => client.invalidateQueries({ queryKey: clusterKeys.all }),
  });
}

export function useProbeCluster() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (clusterId: string) => clusterServiceProbeCluster(clusterId),
    onSuccess: () => client.invalidateQueries({ queryKey: clusterKeys.all }),
  });
}

export function useRotateClusterCredential() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ clusterId, expectedRevision, credential }: { clusterId: string; expectedRevision: string; credential: V1ClusterCredentialInput }) =>
      clusterServiceRotateCredential(clusterId, { expectedRevision, credential }),
    onSuccess: () => client.invalidateQueries({ queryKey: clusterKeys.all }),
  });
}

export function useDeleteCluster() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ clusterId, expectedRevision }: { clusterId: string; expectedRevision: string }) =>
      clusterServiceDeleteCluster(clusterId, { expectedRevision, deletePolicy: 'DELETE_POLICY_DETACH_ONLY' }),
    onSuccess: () => client.invalidateQueries({ queryKey: clusterKeys.all }),
  });
}

export function useCreateKubernetesNamespace() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ clusterId, body }: { clusterId: string; body: NamespaceServiceCreateNamespaceBody }) =>
      namespaceServiceCreateNamespace(clusterId, body),
    onSuccess: (_, vars) =>
      client.invalidateQueries({ queryKey: clusterKeys.namespaces(vars.clusterId) }),
  });
}

export function useSyncKubernetesNamespaces() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (clusterId: string) => namespaceServiceSyncNamespaces(clusterId),
    onSuccess: (_, clusterId) =>
      client.invalidateQueries({ queryKey: clusterKeys.namespaces(clusterId) }),
  });
}

export function useUpdateKubernetesNamespaceVisibility() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, clusterId, body }: { id: string; clusterId: string; body: NamespaceServiceUpdateNamespaceVisibilityBody }) =>
      namespaceServiceUpdateNamespaceVisibility(id, body),
    onSuccess: (_, vars) =>
      client.invalidateQueries({ queryKey: clusterKeys.namespaces(vars.clusterId) }),
  });
}

export function useDeleteKubernetesNamespace() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, clusterId, expectedRevision }: { id: string; clusterId: string; expectedRevision: string }) =>
      namespaceServiceDeleteNamespace(id, { expectedRevision, deletePolicy: 'DELETE_POLICY_DETACH_ONLY' }),
    onSuccess: (_, vars) =>
      client.invalidateQueries({ queryKey: clusterKeys.namespaces(vars.clusterId) }),
  });
}
