'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/lib/api';
import {
  getToken,
  getRefreshToken,
  getIdToken,
  setTokens,
  clearTokens,
  registerRefreshFn,
  onAuthEvent,
} from '@/lib/api/client';
import { useEffect } from 'react';

// Register the refresh implementation once on module load.
if (typeof window !== 'undefined') {
  registerRefreshFn(async () => {
    const rt = getRefreshToken();
    if (!rt) throw new Error('no refresh token');
    const res = await authApi.refresh(rt);
    return {
      accessToken: res.accessToken,
      refreshToken: res.refreshToken || rt,
      idToken: res.idToken,
      expiresIn: res.expiresIn,
    };
  });
}

export function useMe() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const raw = await authApi.me();
      // The backend may return either a flat principal or { principal: {...} }.
      const principal =
        (raw && (raw as Record<string, unknown>).principal as Record<string, unknown>) ||
        (raw as Record<string, unknown>) ||
        null;
      return principal;
    },
    enabled: Boolean(getToken()),
    staleTime: 60_000,
    retry: 0,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return async (options?: { postLogoutRedirectUri?: string }) => {
    const idToken = getIdToken();
    const redirect =
      options?.postLogoutRedirectUri ||
      (typeof window !== 'undefined' ? window.location.origin : '');

    // Ask Hub for the logout URL before clearing tokens so the request carries
    // Authorization and Hub can revoke the current access token in Redis.
    let logoutUrl = '';
    try {
      logoutUrl = await authApi.logoutUrl(redirect, idToken);
    } catch {
      logoutUrl = authApi.logout(redirect, idToken);
    }

    clearTokens('logout');
    queryClient.clear();

    if (typeof window !== 'undefined') {
      try {
        window.location.href = logoutUrl || authApi.logout(redirect, idToken);
      } catch {
        window.location.href = '/';
      }
    }
  };
}

/** Subscribe to forced-logout events (401, refresh failure). */
export function useAuthEvents(handlers: {
  onExpired?: () => void;
  onLogout?: () => void;
}) {
  useEffect(() => {
    const off = onAuthEvent((reason) => {
      if (reason === 'expired') handlers.onExpired?.();
      if (reason === 'logout' || reason === 'manual') handlers.onLogout?.();
    });
    return off;
  }, [handlers.onExpired, handlers.onLogout]);
}

/** Persist tokens after OAuth callback. */
export function useAuthCallback() {
  const queryClient = useQueryClient();
  return async (code: string, redirectUri: string, state = '') => {
    const res = await authApi.exchange(code, redirectUri, state);
    setTokens(res.accessToken, res.refreshToken, {
      idToken: res.idToken,
      expiresIn: res.expiresIn,
    });
    queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    return res;
  };
}
