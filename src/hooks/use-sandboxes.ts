'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sandboxApi } from '@/lib/api/adapters/sandbox';
import type {
  CallSandboxToolInput,
  CreateSandboxClaimInput,
  CreateSandboxInput,
  CreateSandboxTemplateInput,
  CreateWarmPoolInput,
  DeleteSandboxInput,
  DeleteSandboxTemplateInput,
} from '@/lib/api/adapters/sandbox';

/**
 * TanStack Query hooks over the generated SandboxService SDK (via the
 * sandboxApi adapter). Query keys are namespaced under ['sandboxes', ...]
 * / ['sandbox-templates', ...] / ['warm-pools', ...] / ['sandbox-claims', ...]
 * so mutations can invalidate the right slices.
 *
 * The new API is protojson: sandboxes are namespace-scoped and templates are
 * cluster-scoped. There is no "ensure"/"restart" RPC anymore — creation is
 * `POST /v1/namespaces/{id}/sandboxes` and the only lifecycle mutators are
 * create / delete / sync.
 */

const sandboxListKey = (namespaceId: string) =>
  ['sandboxes', 'list', namespaceId] as const;
const sandboxDetailKey = (id: string) => ['sandboxes', 'detail', id] as const;
const sandboxToolsKey = (id: string) => ['sandboxes', 'tools', id] as const;
const templatesKey = (clusterId: string) =>
  ['sandbox-templates', 'list', clusterId] as const;
const warmPoolsKey = (namespaceId: string) =>
  ['warm-pools', 'list', namespaceId] as const;
const claimsKey = (namespaceId: string) =>
  ['sandbox-claims', 'list', namespaceId] as const;

/** List sandboxes in a namespace. Enabled only when namespaceId is set. */
export function useSandboxes(namespaceId: string) {
  return useQuery({
    queryKey: sandboxListKey(namespaceId),
    queryFn: () => sandboxApi.listSandboxes({ namespaceId }),
    enabled: Boolean(namespaceId),
    staleTime: 5_000,
  });
}

/** Get a single sandbox by id. Enabled only when id is set. */
export function useSandboxDetail(id: string | null) {
  return useQuery({
    queryKey: id ? sandboxDetailKey(id) : ['sandboxes', 'detail'],
    queryFn: () => sandboxApi.getSandbox(id!),
    enabled: Boolean(id),
    staleTime: 3_000,
  });
}

/** Create a sandbox (replaces the legacy useSandboxEnsure). */
export function useCreateSandbox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSandboxInput) => sandboxApi.createSandbox(input),
    onSuccess: async (sandbox) => {
      await queryClient.invalidateQueries({
        queryKey: ['sandboxes', 'list'],
      });
      if (sandbox.id) {
        await queryClient.invalidateQueries({
          queryKey: sandboxDetailKey(sandbox.id),
        });
      }
    },
  });
}

/** Delete a sandbox by id (requires expectedRevision). */
export function useSandboxDelete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DeleteSandboxInput) => sandboxApi.deleteSandbox(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sandboxes', 'list'] });
    },
  });
}

/** Sync sandboxes from the remote cluster into the Hub. */
export function useSyncSandboxes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (namespaceId: string) => sandboxApi.syncSandboxes(namespaceId),
    onSuccess: async (_data, namespaceId) => {
      await queryClient.invalidateQueries({
        queryKey: sandboxListKey(namespaceId),
      });
    },
  });
}

/** List tools exposed by a sandbox. Enabled only when id is set. */
export function useSandboxTools(id: string | null) {
  return useQuery({
    queryKey: id ? sandboxToolsKey(id) : ['sandboxes', 'tools'],
    queryFn: () => sandboxApi.listSandboxTools(id!),
    enabled: Boolean(id),
    staleTime: 5_000,
  });
}

/** Call a tool on a sandbox. */
export function useSandboxToolCall() {
  return useMutation({
    mutationFn: (input: CallSandboxToolInput) => sandboxApi.callSandboxTool(input),
  });
}

/** List sandbox templates under a cluster. Enabled only when clusterId is set. */
export function useSandboxTemplates(clusterId: string) {
  return useQuery({
    queryKey: templatesKey(clusterId),
    queryFn: () => sandboxApi.listSandboxTemplates({ clusterId }),
    enabled: Boolean(clusterId),
    staleTime: 10_000,
  });
}

/** Create a sandbox template (cluster-scoped). */
export function useCreateSandboxTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSandboxTemplateInput) =>
      sandboxApi.createSandboxTemplate(input),
    onSuccess: async (_template, input) => {
      await queryClient.invalidateQueries({
        queryKey: templatesKey(input.clusterId),
      });
    },
  });
}

/** Delete a sandbox template by id (requires expectedRevision). */
export function useDeleteSandboxTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DeleteSandboxTemplateInput) =>
      sandboxApi.deleteSandboxTemplate(input),
    onSuccess: async () => {
      // Templates are cluster-scoped; invalidate every cluster's template list
      // since the page may not track which cluster a template belongs to.
      await queryClient.invalidateQueries({ queryKey: ['sandbox-templates'] });
    },
  });
}

/** List warm pools in a namespace. Enabled only when namespaceId is set. */
export function useWarmPools(namespaceId: string) {
  return useQuery({
    queryKey: warmPoolsKey(namespaceId),
    queryFn: () => sandboxApi.listWarmPools({ namespaceId }),
    enabled: Boolean(namespaceId),
    staleTime: 10_000,
  });
}

/** Create a warm pool (pre-warm N pods from a template). */
export function useCreateWarmPool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWarmPoolInput) => sandboxApi.createWarmPool(input),
    onSuccess: async (_warmPool, input) => {
      await queryClient.invalidateQueries({
        queryKey: warmPoolsKey(input.namespaceId),
      });
    },
  });
}

/** List sandbox claims in a namespace. Enabled only when namespaceId is set. */
export function useSandboxClaims(namespaceId: string) {
  return useQuery({
    queryKey: claimsKey(namespaceId),
    queryFn: () => sandboxApi.listSandboxClaims({ namespaceId }),
    enabled: Boolean(namespaceId),
    staleTime: 5_000,
  });
}

/** Create a sandbox claim (claim a pre-warmed pod from a warm pool). */
export function useCreateSandboxClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSandboxClaimInput) =>
      sandboxApi.createSandboxClaim(input),
    onSuccess: async (_claim, input) => {
      await queryClient.invalidateQueries({
        queryKey: claimsKey(input.namespaceId),
      });
      // A successful claim consumes a warm-pool pod; refresh pools + sandboxes.
      await queryClient.invalidateQueries({
        queryKey: warmPoolsKey(input.namespaceId),
      });
      await queryClient.invalidateQueries({
        queryKey: sandboxListKey(input.namespaceId),
      });
    },
  });
}
