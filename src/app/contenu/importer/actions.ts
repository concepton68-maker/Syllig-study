'use server';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { importCourse } from '@/lib/import-course';

export type ImportState = { errors?: string[]; warnings?: string[]; file?: string } | undefined;

export async function importAction(_: ImportState, form: FormData): Promise<ImportState> {
  const user = await requireUser('admin');
  const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
  const pasted = String(form.get('json') ?? '').trim();
  const inputs: { name: string; raw: string }[] = [];
  for (const f of files) inputs.push({ name: f.name, raw: await f.text() });
  if (pasted) inputs.push({ name: 'texte collé', raw: pasted });
  if (!inputs.length) return { errors: ['Choisis un fichier .json ou colle le contenu.'] };

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
  redirect('/contenu?importes=' + inputs.length);
}
