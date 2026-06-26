'use client';

import { useEffect, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { setTokens } from '@/lib/api/client';
import { authApi } from '@/lib/api';
import { useT } from '@/lib/i18n';

function readTokenParam(params: URLSearchParams, key: string): string {
  return params.get(key) || params.get(key.replace('_', '')) || '';
}

export default function AuthCallbackPage() {
  const t = useT();
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function completeLogin() {
      try {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const queryParams = new URLSearchParams(window.location.search.replace(/^\?/, ''));
        const accessToken = readTokenParam(hashParams, 'access_token') || readTokenParam(queryParams, 'access_token');
        const refreshToken = readTokenParam(hashParams, 'refresh_token') || readTokenParam(queryParams, 'refresh_token');
        const idToken = readTokenParam(hashParams, 'id_token') || readTokenParam(queryParams, 'id_token');
        const expiresInRaw = readTokenParam(hashParams, 'expires_in') || readTokenParam(queryParams, 'expires_in');
        const code = queryParams.get('code') || '';
        const state = queryParams.get('state') || '';
        const next = queryParams.get('next') || process.env.NEXT_PUBLIC_AUTH_REDIRECT_AFTER_LOGIN || '/';

        if (!accessToken && !code) {
          setError(t('login.noToken'));
          return;
        }

        setMessage(t('login.storing'));

        if (accessToken) {
          setTokens(accessToken, refreshToken || undefined, {
            idToken: idToken || undefined,
            expiresIn: expiresInRaw ? Number(expiresInRaw) : undefined,
          });
        } else if (code) {
          const callbackPath = process.env.NEXT_PUBLIC_AUTH_CALLBACK_PATH || '/auth/callback';
          const redirectUri = callbackPath.startsWith('http')
            ? callbackPath
            : `${window.location.origin}${callbackPath}`;
          const tokens = await authApi.exchange(code, redirectUri, state);
          if (!tokens.accessToken) {
            setError(t('login.noToken'));
            return;
          }
          setTokens(tokens.accessToken, tokens.refreshToken || undefined, {
            idToken: tokens.idToken || undefined,
            expiresIn: tokens.expiresIn,
          });
        }

        window.history.replaceState({}, document.title, window.location.pathname);
        window.location.replace(next.startsWith('/') ? next : '/');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Login failed');
      }
    }
    completeLogin();
  }, [t]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex items-center gap-3 text-muted-foreground">
        {error ? (
          <>
            <AlertCircle className="h-5 w-5 text-destructive" />
            <span className="text-destructive">{error}</span>
          </>
        ) : (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>{message || t('login.completing')}</span>
          </>
        )}
      </div>
    </div>
  );
}
