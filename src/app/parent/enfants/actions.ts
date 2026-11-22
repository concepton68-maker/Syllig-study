'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { requireUser, hashPassword } from '@/lib/auth';
import { assertParentOf } from '@/lib/access';

export type ChildState = { error?: string; ok?: string } | undefined;

const NewChild = z.object({
  first_name: z.string().trim().min(1).max(40),
  login: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,40}$/, 'Identifiant : 3 à 40 caractères, lettres sans accent, chiffres, point, tiret'),
  password: z.string().min(8, 'Mot de passe : 8 caractères minimum').max(200),
  level: z.string().min(1),
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
  await sql.begin(async tx => {
    const [su] = await tx<{ id: string }[]>`insert into users (login, password_hash, display_name, role) values (${p.data.login}, ${hash}, ${p.data.first_name}, 'student') returning id`;
    await tx`insert into household_members values (${h.household_id}, ${su.id}, 'student')`;
    await tx`insert into students (household_id, user_id, first_name, level_code) values (${h.household_id}, ${su.id}, ${p.data.first_name}, ${p.data.level})`;
  });
  revalidatePath('/parent/enfants');
  return { ok: `Compte de ${p.data.first_name} créé. Identifiant : ${p.data.login}` };
}

export async function resetChildPassword(_: ChildState, form: FormData): Promise<ChildState> {
  const u = await requireUser('parent');
  const s = await assertParentOf(u.id, String(form.get('student')));
  const pw = String(form.get('password') ?? '');
  if (pw.length < 8) return { error: 'Mot de passe : 8 caractères minimum' };
  if (!s.user_id) return { error: 'Pas de compte de connexion pour cet élève.' };
  await sql`update users set password_hash = ${await hashPassword(pw)} where id = ${s.user_id}`;
  await sql`delete from auth_sessions where user_id = ${s.user_id}`;
  return { ok: `Mot de passe de ${s.first_name} modifié.` };
}
