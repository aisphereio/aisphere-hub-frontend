'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { agentApiV1 } from '@/lib/api/agents';
import { asItems } from '@/lib/api/client';
import type { AgentRunPlan, AgentRunRequest, AgentRuntimeSnapshotV1 } from '@/lib/api/agents';
import type { AgentListItem, AgentResponse, AgentUpsertRequest } from '@/lib/api/types';

export function useAgents(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: ['agents', 'list', params],
    queryFn: async () => asItems<AgentListItem>(await agentApiV1.list(params)),
    staleTime: 15_000,
  });
}

export function useAgentDetail(agentId: string | null) {
  return useQuery<AgentResponse>({
    queryKey: ['agents', 'detail', agentId],
    queryFn: () => agentApiV1.detail(agentId!),
    enabled: Boolean(agentId),
    staleTime: 10_000,
  });
}

export function useAgentSave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AgentUpsertRequest) => agentApiV1.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents', 'list'] }),
  });
}

export function useAgentUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, data }: { agentId: string; data: AgentUpsertRequest }) => agentApiV1.update(agentId, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['agents', 'detail', vars.agentId] });
      queryClient.invalidateQueries({ queryKey: ['agents', 'list'] });
    },
  });
}

export function useAgentDelete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (agentId: string) => agentApiV1.remove(agentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents', 'list'] }),
  });
}

export function useAgentRunPlan() {
  return useMutation<AgentRunPlan, Error, { agentId: string; request?: AgentRunRequest }>({
    mutationFn: ({ agentId, request = {} }) => agentApiV1.planRun(agentId, request),
  });
}

export function useAgentResolve() {
  return useMutation<AgentRuntimeSnapshotV1, Error, { agentId: string; request?: AgentRunRequest }>({
    mutationFn: ({ agentId, request = {} }) => agentApiV1.resolve(agentId, request),
  });
}
