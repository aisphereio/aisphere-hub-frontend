import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { modelProfileApi } from '@/lib/api';
import { asItems } from '@/lib/api/client';
import type { ModelProfile } from '@/lib/api/types';
import type { ModelProfileServiceListModelProfilesParams } from '@/lib/api/generated/model';

export function useModelProfiles(
  params?: Partial<ModelProfileServiceListModelProfilesParams>,
) {
  return useQuery({
    queryKey: ['model-profiles', params],
    queryFn: async () =>
      asItems<ModelProfile>(await modelProfileApi.list(params)),
  });
}

export function useCreateModelProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (profile: ModelProfile) => modelProfileApi.save(profile),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['model-profiles'] }),
  });
}

export function useUpdateModelProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      profile,
    }: {
      id: string;
      profile: ModelProfile;
    }) => modelProfileApi.update(id, profile),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['model-profiles'] }),
  });
}

export function useDeleteModelProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => modelProfileApi.remove(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['model-profiles'] }),
  });
}

/**
 * Compatibility wrapper for callers that still use the original create-only
 * hook. New management UI code should call create/update explicitly.
 */
export function useSaveModelProfile() {
  return useCreateModelProfile();
}
