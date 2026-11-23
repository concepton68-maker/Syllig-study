'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { assertParentOf } from '@/lib/access';
import { resetCourse, resetStudent, ResetRefused } from '@/lib/reset';
import { verifyLogin } from '@/lib/auth';
import { sql } from '@/lib/db';
import { isTheme } from '@/lib/settings';

export type ResetState = { ok?: string; error?: string } | undefined;

export async function resetCourseAction(_: ResetState, form: FormData): Promise<ResetState> {
  const u = await requireUser('parent');
  const studentId = z.string().uuid().parse(form.get('student'));
  const courseId = z.coerce.number().int().parse(form.get('course'));
  const s = await assertParentOf(u.id, studentId);
  let c;
  try { c = await resetCourse(s.id, courseId, u.id, { withSessions: form.get('sessions') === 'on' }); }
  catch (e) { if (e instanceof ResetRefused) return { error: e.message }; throw e; }
  revalidatePath('/parent', 'layout');
  revalidatePath('/eleve', 'layout');
  // le cours quitte la liste « commencés » : la confirmation s'affiche en tête de la fiche
  redirect(`/parent/enfants/${s.id}?onglet=cours&reinitialise=${courseId}&t=${c.tentatives}&p=${c.points}`);
}

export async function resetStudentAction(_: ResetState, form: FormData): Promise<ResetState> {
  const u = await requireUser('parent');
  const studentId = z.string().uuid().parse(form.get('student'));
  const s = await assertParentOf(u.id, studentId);
  if (String(form.get('confirm') ?? '').trim().toLowerCase() !== s.first_name.toLowerCase())
    return { error: `Pour confirmer, tapez exactement le prénom « ${s.first_name} ».` };
  const purge = form.get('purge') === 'on';
  if (purge && !(await verifyLogin(u.login, String(form.get('password') ?? ''))))
    return { error: 'Pour effacer aussi le journal, saisissez votre mot de passe (parent).' };
  try { await resetStudent(s.id, u.id, { purgeLog: purge }); }
  catch (e) { if (e instanceof ResetRefused) return { error: e.message }; throw e; }
  revalidatePath('/parent', 'layout');
  revalidatePath('/eleve', 'layout');
  return { ok: `Le parcours de ${s.first_name} est revenu à zéro. Les comptes, réglages et thème sont conservés.` };
}

// Règles et thème : seules les clés modifiées sont fusionnées (pas d'écrasement d'un changement fait ailleurs)
export async function saveRulesAction(_: ResetState, form: FormData): Promise<ResetState> {
  const u = await requireUser('parent');
  const s = await assertParentOf(u.id, z.string().uuid().parse(form.get('student')));
  const p = z.object({
    weekly_goal_minutes: z.coerce.number().int().min(30).max(1500),
    retry_delay_days: z.coerce.number().int().min(1).max(30),
    idle_seconds: z.coerce.number().int().min(30).max(300),
  }).safeParse({ weekly_goal_minutes: Number(form.get('goal_h')) * 60, retry_delay_days: form.get('retry'), idle_seconds: form.get('idle') });
  if (!p.success) return { error: 'Valeurs invalides.' };
  const t = form.get('theme');
  const patch = { ...p.data, eval_requires_approval: form.get('approval') === 'on', ...(isTheme(t) ? { theme: t } : {}) };
  await sql`update students set settings = settings || ${sql.json(patch)} where id = ${s.id}`;
  revalidatePath('/parent', 'layout');
  revalidatePath('/eleve', 'layout');
  return { ok: 'Règles enregistrées. Elles s’appliquent tout de suite.' };
}

// Ordre du parcours : mettre un cours en avant (« maintenant ») ou en retrait (« plus tard »)
export async function setForcedAction(form: FormData) {
  const u = await requireUser('parent');
  const s = await assertParentOf(u.id, z.string().uuid().parse(form.get('student')));
  const courseId = z.coerce.number().int().parse(form.get('course'));
  const v = String(form.get('forced') ?? '');
  const forced = v === 'now' || v === 'later' ? v : null;
  await sql`insert into course_progress (student_id, course_id, forced) values (${s.id}, ${courseId}, ${forced})
    on conflict (student_id, course_id) do update set forced = excluded.forced, updated_at = now()`;
  revalidatePath(`/parent/enfants/${s.id}`);
  revalidatePath('/eleve', 'layout');
}

// ───────── Actions groupées ─────────
const idsOf = (form: FormData) => form.getAll('ids').map(Number).filter(Number.isInteger);

// Réinitialiser plusieurs cours d'un coup (chaque cours reste tracé séparément dans le journal)
export async function resetCoursesBulkAction(form: FormData) {
  const u = await requireUser('parent');
  const s = await assertParentOf(u.id, z.string().uuid().parse(form.get('student')));
  const withSessions = form.get('sessions') === 'on';
  let n = 0, t = 0, p = 0, refus = 0;
  for (const courseId of idsOf(form)) {
    try { const c = await resetCourse(s.id, courseId, u.id, { withSessions }); n++; t += c.tentatives; p += c.points; }
    catch (e) { if (e instanceof ResetRefused) refus++; else throw e; }
  }
  revalidatePath('/parent', 'layout');
  revalidatePath('/eleve', 'layout');
  redirect(`/parent/enfants/${s.id}?onglet=cours&groupe=${n}&t=${t}&p=${p}&refus=${refus}`);
}

// Changer la place de plusieurs cours dans le parcours
export async function setForcedBulkAction(form: FormData) {
  const u = await requireUser('parent');
  const s = await assertParentOf(u.id, z.string().uuid().parse(form.get('student')));
  const v = String(form.get('forced') ?? '');
  const forced = v === 'now' || v === 'later' ? v : null;
  const ids = idsOf(form);
  if (ids.length) await sql`insert into course_progress (student_id, course_id, forced)
    select ${s.id}, x, ${forced} from unnest(${ids}::int[]) as x
    on conflict (student_id, course_id) do update set forced = excluded.forced, updated_at = now()`;
  revalidatePath(`/parent/enfants/${s.id}`);
  revalidatePath('/eleve', 'layout');
}
