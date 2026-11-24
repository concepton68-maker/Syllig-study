'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { isStaleBuildError, reloadOnceForNewVersion } from '@/lib/stale-build';
import { RefreshCw } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';

// Erreur inattendue : rien n'est perdu, on propose de réessayer
export default function ParentError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { if (isStaleBuildError(error?.message)) reloadOnceForNewVersion(); }, [error]);
  return (
    <section className="card max-w-[720px]">
      <EmptyState icon={<RefreshCw size={20} />} title="Oups, un petit souci technique"
        text="Rien n’a été perdu. Réessayez dans un instant."
        action={<span className="flex gap-2"><button className="btn btn-primary" type="button" onClick={reset}>Réessayer</button><Link className="btn" href="/parent">Retour à l’accueil</Link></span>} />
    </section>
  );
}
