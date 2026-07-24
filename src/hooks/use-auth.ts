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
    // gateway_oidc 模式下，OIDC 回跳后首次 /me 偶发 401（session cookie 刚种、
    // 网关 principal 注入的瞬时态）。重试 1 次避免把瞬时失败误判为未登录而
    // 跳 LoginPage。token 模式下 401 即真未登录，不重试。
    retry: () => IS_GATEWAY_OIDC,
    retryDelay: () => 500,
  });
}

export function useLogout() {
  return async () => {
    if (typeof window !== 'undefined') {
      window.location.href = GATEWAY_LOGOUT_PATH;
    }
  };
}