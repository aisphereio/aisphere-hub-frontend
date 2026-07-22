'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sandboxApi } from '@/lib/api/adapters/sandbox';
import type { V1SandboxTemplate } from '@/lib/api/generated/model';

/**
 * Legacy sandbox-profile hooks, now backed by the generated SandboxService
 * SandboxTemplate RPCs (the old v3 sandbox-profiles backend was replaced by
 * cluster-scoped SandboxTemplates). Kept for backward compatibility; new code
 * should prefer the dedicated hooks in use-sandboxes.ts
 * (useSandboxTemplates / useCreateSandboxTemplate / useDeleteSandboxTemplate).
 *
 * Templates are cluster-scoped, so list() requires a clusterId. The legacy
 * list() signature took no args; callers must now pass a clusterId.
 */

export function useSandboxProfiles(clusterId: string) {
  return useQuery({
    queryKey: ['sandbox-templates', 'list', clusterId],
    queryFn: () => sandboxApi.listSandboxTemplates({ clusterId }),
    enabled: Boolean(clusterId),
  });
}

export function useSaveSandboxProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof sandboxApi.createSandboxTemplate>[0]) =>
      sandboxApi.createSandboxTemplate(input),
    onSuccess: async (_tpl: V1SandboxTemplate, input) => {
      await qc.invalidateQueries({
        queryKey: ['sandbox-templates', 'list', input.clusterId],
      });
    },
  });
}

export function useDeleteSandboxProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof sandboxApi.deleteSandboxTemplate>[0]) =>
      sandboxApi.deleteSandboxTemplate(input),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['sandbox-templates'] });
    },
  });
}
