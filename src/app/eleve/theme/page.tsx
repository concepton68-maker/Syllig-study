import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireStudent } from '@/lib/access';
import { THEMES, isTheme } from '@/lib/settings';
import { PageTitle } from '@/components/Shell';
import { Screen } from '@/components/Layout';

export const metadata = { title: 'Mon thème' };
export const dynamic = 'force-dynamic';

async function choose(form: FormData) {
  'use server';
  const { student } = await requireStudent();
  const t = form.get('theme');
  if (!isTheme(t)) return;
  await sql`update students set settings = settings || ${sql.json({ theme: t })} where id = ${student.id}`;
  revalidatePath('/eleve', 'layout');
  redirect('/eleve');
}

export default async function ThemePage() {
  const { student } = await requireStudent();
  return (
    <Screen top={<PageTitle spark title="Mon espace" sub="Choisis les couleurs de ton espace (tu peux changer quand tu veux), et vois ce que tes parents suivent." />}>
      <div className="flex flex-wrap gap-4">
        {THEMES.map(t => (
          <form key={t.id} action={choose} className="flex-[1_1_280px]">
            <input type="hidden" name="theme" value={t.id} />
            <button type="submit" data-theme={t.id} aria-pressed={student.settings.theme === t.id}
              className={`app w-full text-left rounded-3xl border-2 p-5 flex flex-col gap-3 cursor-pointer ${student.settings.theme === t.id ? 'border-brand' : 'border-line hover:border-brand-mid'}`}>
              <span className="app-header rounded-2xl px-4 py-3 flex items-center justify-between border border-line">
                <strong className="font-[family-name:var(--font-display)] text-lg text-ink spark">{t.name}</strong>
                {student.settings.theme === t.id && <span className="pill bg-brand text-white">Ton thème</span>}
              </span>
              <span className="text-sm text-ink-2">{t.desc}</span>
              <span className="flex gap-2" aria-hidden="true">
                <span className="w-9 h-9 rounded-full bg-brand" /><span className="w-9 h-9 rounded-full bg-brand-mid" />
                <span className="w-9 h-9 rounded-full bg-accent" /><span className="w-9 h-9 rounded-full bg-warm-mid" />
              </span>
              <span className="flex gap-2">
                <span className="btn btn-primary pointer-events-none">Bouton</span>
                <span className="pill bg-brand-soft text-brand-dark self-center">Acquis</span>
              </span>
            </button>
          </form>
        ))}
      </div>
      <section className="card flex flex-col gap-2 max-w-[760px]">
        <h2 className="text-lg font-semibold">Ce que tes parents voient</h2>
        <ul className="m-0 pl-5 text-sm text-ink-2 flex flex-col gap-1.5 list-disc">
          <li>Ton temps de travail actif et tes séances</li><li>Tes notes et tes niveaux par cours</li><li>Les sorties de fenêtre pendant une évaluation</li>
        </ul>
        <span className="lbl mt-1.5">Ce qu’ils ne voient pas</span>
        <ul className="m-0 pl-5 text-sm text-ink-2 flex flex-col gap-1.5 list-disc"><li>Ton écran, ta caméra ou ton micro</li><li>Les autres sites que tu visites</li></ul>
      </section>
    </Screen>
  );
}
