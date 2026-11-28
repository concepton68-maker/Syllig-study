'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { setActive, remove, addLevel, addSubject, addChapter, addCourse, rename, importProgramme, kindLabel, type Kind } from '@/lib/programmes';

const KINDS: Kind[] = ['level', 'subject', 'chapter', 'course'];
const kindOf = (f: FormData): Kind => { const k = String(f.get('kind')); if (!KINDS.includes(k as Kind)) throw new Error('type inconnu'); return k as Kind; };
const ids = (f: FormData) => f.getAll('ids').map(String).filter(x => /^[a-z0-9-]{1,60}$/i.test(x));
const back = (f: FormData, msg: string, err = false) => {
  revalidatePath('/contenu', 'layout'); revalidatePath('/eleve', 'layout'); revalidatePath('/parent', 'layout');
  const lvl = String(f.get('niveau') ?? '');
  redirect(`/contenu/programmes?${new URLSearchParams({ ...(lvl ? { niveau: lvl } : {}), [err ? 'erreur' : 'fait']: msg })}`);
};
const name = (f: FormData, field = 'name') => String(f.get(field) ?? '').trim().replace(/\s+/g, ' ').slice(0, 160);

export async function activateAction(f: FormData) {
  await requireUser('admin'); const k = kindOf(f);
  const n = await setActive(k, ids(f), true);
  back(f, `${n} ${kindLabel(k, n)} activé${k === 'subject' ? 'e' : ''}${n > 1 ? 's' : ''}.`);
}
export async function deactivateAction(f: FormData) {
  await requireUser('admin'); const k = kindOf(f);
  const n = await setActive(k, ids(f), false);
  back(f, `${n} ${kindLabel(k, n)} désactivé${k === 'subject' ? 'e' : ''}${n > 1 ? 's' : ''} : plus visible${n > 1 ? 's' : ''} pour les élèves.`);
}
export async function removeAction(f: FormData) {
  await requireUser('admin'); const k = kindOf(f);
  const r = await remove(k, ids(f));
  back(f, r.map(x => `${x.name} : ${x.done}${k === 'subject' && x.done !== 'retiré' ? 'e' : ''}${x.why ? ` (${x.why})` : ''}`).join(' · ') || 'Rien à supprimer.');
}
async function guarded(f: FormData, fn: () => Promise<string>) {
  await requireUser('admin');
  let msg: string;
  try { msg = await fn(); } catch (e) { return back(f, (e as Error).message, true); }
  back(f, msg);
}
export async function addLevelAction(f: FormData) {
  await guarded(f, async () => { const d = await addLevel(String(f.get('code') ?? '')); f.set('niveau', d.code); return `Niveau « ${d.name} » ajouté.`; });
}
export async function addSubjectAction(f: FormData) {
  await guarded(f, async () => { const n = name(f); if (!n) throw new Error('Donne un nom à la matière.'); await addSubject(String(f.get('niveau')), n); return `Matière « ${n} » ajoutée.`; });
}
export async function addChapterAction(f: FormData) {
  await guarded(f, async () => { const n = name(f); if (!n) throw new Error('Donne un nom au chapitre.'); await addChapter(Number(f.get('subject')), n); return `Chapitre « ${n} » ajouté.`; });
}
export async function addCourseAction(f: FormData) {
  await guarded(f, async () => { const n = name(f); if (!n) throw new Error('Donne un titre au cours.'); await addCourse(Number(f.get('chapter')), n); return `Cours « ${n} » ajouté : il apparaît dans le catalogue, à rédiger.`; });
}
export async function renameAction(f: FormData) {
  await guarded(f, async () => { const k = kindOf(f); const n = name(f); if (!n) throw new Error('Le nom ne peut pas être vide.'); const id = String(f.get('id'));
    if (!(await rename(k, id, n))) throw new Error('Élément introuvable.'); if (k === 'level') f.set('niveau', id); return `Renommé en « ${n} ».`; });
}
export async function importProgrammeAction(f: FormData) {
  await guarded(f, async () => {
    const file = f.get('file');
    if (!(file instanceof File) || !file.size) throw new Error('Choisis un fichier programme (.json).');
    const r = await importProgramme(await file.text());
    f.set('niveau', r.code);
    return `Programme « ${r.name} » importé : ${r.subjects} matière(s), ${r.chapters} chapitre(s) et ${r.courses} cours ajoutés. Ce qui existait déjà n’a pas changé.`;
  });
}
