'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { agentRuntimeApi, type RuntimeSession } from '@/lib/api/runtime';

export function useAgentSessions(agentId: string | null, userId: string) {
  return useQuery<RuntimeSession[]>({
    queryKey: ['agent-runtime', 'sessions', agentId, userId],
    queryFn: () => agentRuntimeApi.listSessions(agentId!, userId),
    enabled: Boolean(agentId && userId),
    staleTime: 5_000,
    refetchOnWindowFocus: false,
  });
}

export function useRefreshAgentSessions() {
  const queryClient = useQueryClient();
  return (agentId: string, userId: string) =>
    queryClient.invalidateQueries({ queryKey: ['agent-runtime', 'sessions', agentId, userId] });
}
