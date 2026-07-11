'use client';

import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/lib/api';
import { IS_GATEWAY_OIDC, GATEWAY_LOGOUT_PATH, getToken } from '@/lib/api/client';

export function useMe() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const raw = await authApi.me();
      const principal =
        (raw && (raw as Record<string, unknown>).principal as Record<string, unknown>) ||
        (raw as Record<string, unknown>) ||
        null;
      return principal;
    },
    enabled: IS_GATEWAY_OIDC || Boolean(getToken()),
    staleTime: 60_000,
    retry: 0,
  });
}

export function useLogout() {
  return async () => {
    if (typeof window !== 'undefined') {
      window.location.href = GATEWAY_LOGOUT_PATH;
    }
  };
}