'use client';
import { useEffect } from 'react';
import { isStaleBuildError, reloadOnceForNewVersion } from '@/lib/stale-build';

// Dernier filet : si quelque chose plante au niveau de l'application entière, message clair en français
// (et rechargement automatique si c'est une nouvelle version mise en ligne pendant que la page était ouverte).
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { if (isStaleBuildError(error?.message)) reloadOnceForNewVersion(); }, [error]);
  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#F6F7FB', color: '#1F2A44', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: '#fff', borderRadius: 18, padding: '28px 26px', maxWidth: 460, textAlign: 'center', boxShadow: '0 10px 30px -15px rgba(20,30,60,.35)' }}>
          <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>Un instant…</h1>
          <p style={{ margin: '0 0 20px', color: '#55607A', lineHeight: 1.5 }}>Syllig Study vient peut-être d’être mis à jour. Ton travail est bien enregistré : recharge la page pour continuer.</p>
          <button onClick={() => window.location.reload()} style={{ background: '#2F4FD8', color: '#fff', border: 0, borderRadius: 12, padding: '12px 20px', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>Recharger la page</button>
          <div style={{ marginTop: 12 }}><button onClick={() => reset()} style={{ background: 'none', border: 0, color: '#55607A', textDecoration: 'underline', cursor: 'pointer' }}>Réessayer sans recharger</button></div>
        </div>
      </body>
    </html>
  );
}
