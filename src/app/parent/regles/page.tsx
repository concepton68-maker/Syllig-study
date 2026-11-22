import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { requireParent, assertParentOf } from '@/lib/access';
import { requireUser } from '@/lib/auth';
import { PageTitle } from '@/components/Shell';
import { THEMES, isTheme } from '@/lib/settings';
import { ChildPicker } from '@/components/ChildPicker';
import { Screen } from '@/components/Layout';

export const metadata = { title: 'Règles' };
export const dynamic = 'force-dynamic';

async function save(form: FormData) {
  'use server';
  const u = await requireUser('parent');
  const s = await assertParentOf(u.id, String(form.get('student')));
  const v = z.object({
    weekly_goal_minutes: z.coerce.number().int().min(30).max(1500),
    retry_delay_days: z.coerce.number().int().min(0).max(30),
    idle_seconds: z.coerce.number().int().min(30).max(300),
  }).parse({ weekly_goal_minutes: Number(form.get('goal_h')) * 60, retry_delay_days: form.get('retry'), idle_seconds: form.get('idle') });
  const t = form.get('theme');
  const settings = { ...s.settings, ...v, eval_requires_approval: form.get('approval') === 'on', theme: isTheme(t) ? t : s.settings.theme };
  await sql`update students set settings = ${sql.json(settings)} where id = ${s.id}`;
  revalidatePath('/parent/regles');
}

export default async function Rules({ searchParams }: { searchParams: Promise<{ eleve?: string }> }) {
  const { eleve } = await searchParams;
  const { students, student } = await requireParent(eleve);
  if (!student) return null;
  const s = student.settings;
  return (
    <Screen top={<>
      <ChildPicker students={students} current={student} path="/parent/regles" />
      <PageTitle kicker="Règles" title={`Un cadre clair, connu de ${student.first_name}`} sub="Ces règles sont annoncées à l’élève avant chaque évaluation. Un cadre connu à l’avance motive davantage qu’une surveillance découverte après coup." />
    </>}>
      <form action={save} className="card flex flex-col gap-5 max-w-[760px]">
        <input type="hidden" name="student" value={student.id} />
        <label className="flex flex-col gap-1.5 text-sm font-semibold">Temps actif visé par semaine (heures)
          <select className="field" name="goal_h" defaultValue={String(s.weekly_goal_minutes / 60)}>{[2, 3, 4, 5, 6, 7, 8, 10].map(h => <option key={h} value={h}>{h} h</option>)}</select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">Délai avant une nouvelle tentative d’évaluation
          <select className="field" name="retry" defaultValue={String(s.retry_delay_days)}>{[0, 1, 2, 3, 5, 7].map(d => <option key={d} value={d}>{d === 0 ? 'Aucun' : `${d} jour${d > 1 ? 's' : ''}`}</option>)}</select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">Pause du chrono après une inactivité de
          <select className="field" name="idle" defaultValue={String(s.idle_seconds)}>{[45, 60, 90, 120].map(d => <option key={d} value={d}>{d} secondes</option>)}</select>
        </label>
        <fieldset className="flex flex-col gap-2 border-0 p-0 m-0">
          <legend className="text-sm font-semibold mb-1.5">Thème d’affichage de l’espace élève <span className="muted font-normal">(l’élève peut aussi le changer)</span></legend>
          <div className="flex flex-wrap gap-2">
            {THEMES.map(t => (
              <label key={t.id} data-theme={t.id} className="flex-[1_1_200px] flex items-start gap-2.5 p-3 rounded-xl border border-line-strong cursor-pointer bg-brand-soft">
                <input type="radio" name="theme" value={t.id} defaultChecked={s.theme === t.id} className="mt-1 w-4 h-4" />
                <span><strong className="text-brand-ink">{t.name}</strong><span className="block text-sm text-ink-2">{t.desc}</span>
                  <span className="flex gap-1 mt-1.5" aria-hidden="true"><span className="w-5 h-5 rounded-full bg-brand" /><span className="w-5 h-5 rounded-full bg-brand-mid" /><span className="w-5 h-5 rounded-full bg-accent" /></span></span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-start gap-3 text-[15px]">
          <input type="checkbox" name="approval" defaultChecked={s.eval_requires_approval} className="mt-1 w-5 h-5" />
          <span><strong>Évaluation avec mon accord</strong><span className="block muted text-sm">L’élève vous envoie une demande avant de commencer une évaluation. Sinon, elle s’ouvre dès que les exercices sont faits.</span></span>
        </label>
        <div><button className="btn btn-primary" type="submit">Enregistrer</button></div>
      </form>
      <section className="card max-w-[760px] bg-surface-2 flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Ce que Syllig Study ne fait jamais</h2>
        <ul className="m-0 pl-5 list-disc text-sm text-ink-2 flex flex-col gap-1"><li>Filmer, enregistrer le micro ou l’écran</li><li>Lire ce que l’élève fait hors de Syllig Study</li><li>Comparer l’élève à d’autres ou afficher un classement</li></ul>
      </section>
    </Screen>
  );
}
