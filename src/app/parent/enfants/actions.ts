'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { requireUser, hashPassword } from '@/lib/auth';
import { setPassword } from '@/lib/password';
import { assertParentOf } from '@/lib/access';
import { isTheme } from '@/lib/settings';
import { profileFrom } from '@/lib/child-profile';
import { assignEntryTest } from '@/lib/entry-test';

export type ChildState = { error?: string; ok?: string } | undefined;

const NewChild = z.object({
  first_name: z.string().trim().min(1).max(40),
  login: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,40}$/, 'Identifiant : 3 à 40 caractères, lettres sans accent, chiffres, point, tiret'),
  password: z.string().min(8, 'Mot de passe : 8 caractères minimum').max(200),
  level: z.string().min(1),
  theme: z.string().optional(),
  gender: z.enum(['fille', 'garcon']).optional(),
  birth_year: z.string().regex(/^\d{4}$/).optional().or(z.literal('')),
  birth_month: z.string().regex(/^(0[1-9]|1[0-2])$/).optional().or(z.literal('')),
});



export async function addChild(_: ChildState, form: FormData): Promise<ChildState> {
  const u = await requireUser('parent');
  const p = NewChild.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const [h] = await sql<{ household_id: string }[]>`select household_id from household_members where user_id = ${u.id} and role = 'parent' limit 1`;
  if (!h) return { error: 'Aucun foyer associé à votre compte.' };
  const [lvl] = await sql`select 1 from levels where code = ${p.data.level}`;
  if (!lvl) return { error: 'Niveau inconnu.' };
  const [exists] = await sql`select 1 from users where login = ${p.data.login}`;
  if (exists) return { error: 'Cet identifiant est déjà pris.' };
  const hash = await hashPassword(p.data.password);
  const studentId = await sql.begin(async tx => {
    const [su] = await tx<{ id: string }[]>`insert into users (login, password_hash, display_name, role) values (${p.data.login}, ${hash}, ${p.data.first_name}, 'student') returning id`;
    await tx`insert into household_members values (${h.household_id}, ${su.id}, 'student')`;
    const [st] = await tx<{ id: string }[]>`insert into students (household_id, user_id, first_name, level_code, settings) values (${h.household_id}, ${su.id}, ${p.data.first_name}, ${p.data.level}, ${tx.json({ ...profileFrom(form), theme: isTheme(p.data.theme) ? p.data.theme : p.data.gender === 'fille' ? 'glacier' : p.data.gender === 'garcon' ? 'graphite' : 'classique' })}) returning id`;
    return st.id;
  });
  // test de rentrée proposé d'emblée (case cochée par défaut) : on commence par ce que l'enfant sait vraiment
  let test = '';
  if (form.get('entry_test') === 'on') {
    const r = await assignEntryTest(studentId, u.id);
    test = 'ok' in r ? ` Le test de rentrée (${r.questions} questions) l’attend dans son espace.` : '';
  }
  revalidatePath('/parent', 'layout');
  return { ok: `Compte de ${p.data.first_name} créé. Identifiant : ${p.data.login}.${test}` };
}

export async function resetChildPassword(_: ChildState, form: FormData): Promise<ChildState> {
  const u = await requireUser('parent');
  const s = await assertParentOf(u.id, String(form.get('student')));
  const pw = String(form.get('password') ?? '');
  if (pw.length < 8) return { error: 'Mot de passe : 8 caractères minimum' };
  if (!s.user_id) return { error: 'Pas de compte de connexion pour cet élève.' };
  await setPassword(s.user_id, pw);   // ferme aussi ses sessions et sa demande « mot de passe oublié »
  revalidatePath('/parent/a-faire');
  return { ok: `Mot de passe de ${s.first_name} modifié.` };
}
