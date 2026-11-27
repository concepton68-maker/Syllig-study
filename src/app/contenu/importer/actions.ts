'use server';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { importCourse } from '@/lib/import-course';
import { importBatch, isBatch } from '@/lib/course-batch';

export type ImportState = { errors?: string[]; warnings?: string[]; file?: string; summary?: string[] } | undefined;

export async function importAction(_: ImportState, form: FormData): Promise<ImportState> {
  const user = await requireUser('admin');
  const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
  const pasted = String(form.get('json') ?? '').trim();
  const publish = form.get('publier') === '1';
  const inputs: { name: string; raw: string }[] = [];
  for (const f of files) inputs.push({ name: f.name, raw: await f.text() });
  if (pasted) inputs.push({ name: 'texte collé', raw: pasted });
  if (!inputs.length) return { errors: ['Choisis un fichier .json ou colle le contenu.'] };

  // lot de cours renvoyé par Claude (un seul fichier, tout ou rien)
  if (inputs.some(i => isBatch(i.raw))) {
    if (inputs.length > 1) return { errors: ['Un lot de cours s’importe seul : un fichier à la fois.'] };
    const r = await importBatch(inputs[0].raw, inputs[0].name, user.id, publish);
    if (!r.ok) return { errors: r.errors, warnings: r.warnings };
    const n = r.imported.length;
    return { warnings: r.warnings, summary: [
      n ? `${n} cours ${publish ? 'corrigé' + (n > 1 ? 's et publiés' : ' et publié') + ' (l’ancienne version reste dans l’historique)' : 'enregistré' + (n > 1 ? 's' : '') + ' en brouillon « À relire »'} : ${r.imported.map(x => `${x.code} (v${x.version})`).join(', ')}.` : 'Aucun cours à corriger : rien n’a changé.',
      ...(r.unchanged.length ? [`${r.unchanged.length} cours renvoyé${r.unchanged.length > 1 ? 's' : ''} sans changement, ignoré${r.unchanged.length > 1 ? 's' : ''} : ${r.unchanged.join(', ')}.`] : []),
    ] };
  }

  let last: { courseId: number; versionId: string } | null = null;
  const errors: string[] = [], warnings: string[] = [];
  for (const i of inputs) {
    const r = await importCourse(i.raw, i.name, user.id);
    if (r.ok) last = { courseId: r.courseId, versionId: r.versionId };
    else errors.push(...r.errors.map(e => `${i.name} — ${e}`));
    warnings.push(...r.warnings.map(w => `${i.name} — ${w}`));
  }
  if (errors.length || !last) return { errors, warnings };
  if (inputs.length === 1) redirect(`/contenu/cours/${last.courseId}?v=${last.versionId}&importe=1`);
  redirect('/contenu/a-relire?importes=' + inputs.length);
}
