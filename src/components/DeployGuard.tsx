'use client';
import { useEffect } from 'react';
import { isStaleBuildError, reloadOnceForNewVersion } from '@/lib/stale-build';

// Surveille les erreurs dues à une nouvelle version mise en ligne pendant que la page était ouverte.
export function DeployGuard() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => { if (isStaleBuildError(e.message) || isStaleBuildError(e.error?.message)) reloadOnceForNewVersion(); };
    const onRejection = (e: PromiseRejectionEvent) => { const r = e.reason as { message?: string } | undefined; if (isStaleBuildError(r?.message ?? r)) reloadOnceForNewVersion(); };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection); };
  }, []);
  return null;
}
