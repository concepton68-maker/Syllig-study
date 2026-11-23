import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireStudent } from '@/lib/access';
import { THEMES, THEME_KINDS, isTheme } from '@/lib/settings';
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
      {THEME_KINDS.map(k => (
        <section key={k.id} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold m-0">{k.label}</h2>
          <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(250px,1fr))]">
            {THEMES.filter(t => t.kind === k.id).map(t => {
              const on = student.settings.theme === t.id;
              return (
                <form key={t.id} action={choose}>
                  <input type="hidden" name="theme" value={t.id} />
                  <button type="submit" data-theme={t.id} aria-pressed={on}
                    className={`app w-full text-left rounded-3xl border-2 overflow-hidden flex cursor-pointer transition-transform hover:-translate-y-0.5 ${on ? 'border-brand shadow-lg' : 'border-line hover:border-brand-mid'}`}>
                    <span className="w-14 shrink-0 flex flex-col items-center gap-2 pt-4" style={{ background: 'var(--side-bg)' }} aria-hidden="true">
                      <span className="w-7 h-7 rounded-lg" style={{ background: 'linear-gradient(135deg, var(--side-accent), var(--side-accent-2))' }} />
                      <span className="w-8 h-2.5 rounded-full" style={{ background: 'var(--side-on-bg)' }} />
                      <span className="w-8 h-2.5 rounded-full opacity-40 bg-white" /><span className="w-8 h-2.5 rounded-full opacity-40 bg-white" />
                    </span>
                    <span className="flex-1 p-4 flex flex-col gap-2.5">
                      <span className="flex items-center justify-between gap-2">
                        <strong className="font-[family-name:var(--font-display)] text-[17px] text-brand-ink spark">{t.name}</strong>
                        {on && <span className="pill bg-brand text-white">Ton thème</span>}
                      </span>
                      <span className="text-[13px] text-ink-2 leading-snug">{t.desc}</span>
                      <span className="flex gap-1.5" aria-hidden="true">
                        <span className="w-6 h-6 rounded-full bg-brand" /><span className="w-6 h-6 rounded-full bg-brand-mid" />
                        <span className="w-6 h-6 rounded-full bg-accent" /><span className="w-6 h-6 rounded-full bg-warm-mid" />
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="btn btn-primary pointer-events-none !min-h-9 !text-sm">Bouton</span>
                        <span className="pill bg-brand-soft text-brand-dark">Acquis</span>
                      </span>
                    </span>
                  </button>
                </form>
              );
            })}
          </div>
        </section>
      ))}
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
