'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Tant qu'une tâche IA tourne en arrière-plan, la page se met à jour toute seule (plus besoin de F5)
export function AutoRefresh({ active, every = 5000 }: { active: boolean; every?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, every);
    return () => clearInterval(t);
  }, [active, every, router]);
  return null;
}
