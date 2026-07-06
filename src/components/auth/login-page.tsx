'use client';

import { ShieldCheck, Sparkles, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useT } from '@/lib/i18n';
import { LanguageToggle } from '@/components/layout/language-toggle';
import { authApi } from '@/lib/api';

export function LoginPage() {
  const t = useT();

  const loginWithCasdoor = () => {
    const callbackPath = process.env.NEXT_PUBLIC_AUTH_CALLBACK_PATH || '/auth/callback';
    const callbackUrl = callbackPath.startsWith('http')
      ? callbackPath
      : `${window.location.origin}${callbackPath}`;
    // Preserve the page the user was trying to reach so we can bounce back after login.
    const next = window.location.pathname + window.location.search;
    const state = next && next !== '/' ? encodeURIComponent(next) : '';
    window.location.href = authApi.login(callbackUrl, state);
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-gradient-to-br from-background via-background to-violet-50 dark:to-violet-950/30 p-4 overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-violet-500/10 dark:bg-violet-500/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full bg-fuchsia-500/10 dark:bg-fuchsia-500/5 blur-3xl pointer-events-none" />

      {/* Top-right language toggle */}
      <div className="absolute top-4 right-4 z-10">
        <LanguageToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative w-full max-w-md"
      >
        <Card className="shadow-2xl shadow-violet-500/10 border-violet-500/10 backdrop-blur-sm">
          <CardContent className="pt-8 pb-8 px-8">
            {/* Brand */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white flex items-center justify-center shadow-lg shadow-violet-500/30 mb-3">
                <Sparkles className="h-7 w-7" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">{t('login.title')}</h1>
              <p className="text-sm text-muted-foreground mt-1">{t('login.subtitle')}</p>
            </div>

            {/* SSO options */}
            <div className="space-y-2.5">
              <Button
                type="button"
                className="w-full h-11 bg-gradient-to-r from-violet-600 to-fuchsia-500 hover:from-violet-700 hover:to-fuchsia-600 shadow-md shadow-violet-500/20"
                onClick={loginWithCasdoor}
              >
                <ShieldCheck className="h-4 w-4 mr-2" />
                {t('login.casdoor')}
                <ArrowRight className="h-3.5 w-3.5 ml-2 opacity-80" />
              </Button>
            </div>

            <p className="text-[11px] text-center text-muted-foreground mt-5 leading-relaxed whitespace-pre-line">
              {t('login.note')}
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-[10px] text-muted-foreground/70 mt-4">
          {t('login.footer')}
        </p>
      </motion.div>
    </div>
  );
}
