'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/lib/api';
import { getToken, clearTokens } from '@/lib/api/client';

export function useMe() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authApi.me(),
    enabled: Boolean(getToken()),
    staleTime: 60_000,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return () => {
    clearTokens();
    queryClient.clear();
  };
}
