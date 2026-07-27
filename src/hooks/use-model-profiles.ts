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
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: ModelProfile) => modelProfileApi.save(p),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['model-profiles'] }),
  });
}

export function useUpdateModelProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, profile }: { id: string; profile: ModelProfile }) =>
      modelProfileApi.update(id, profile),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['model-profiles'] }),
  });
}

export function useDeleteModelProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => modelProfileApi.remove(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['model-profiles'] }),
  });
}

export function useTestModelProfile() {
  return useMutation({
    mutationFn: ({ id, prompt }: { id: string; prompt?: string }) =>
      modelProfileApi.test(id, { prompt }),
  });
}

// Kept for backward compatibility with the original JSON-textarea page; new
// UI uses useCreateModelProfile / useUpdateModelProfile explicitly.
export function useSaveModelProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: ModelProfile) => modelProfileApi.save(p),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['model-profiles'] }),
  });
}
