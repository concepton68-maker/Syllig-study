import { cookies } from 'next/headers';
import 'server-only';
import { redirect, notFound } from 'next/navigation';
import { sql } from './db';
import { requireUser, type User } from './auth';
import { settingsOf, type StudentSettings } from './settings';

export type Student = {
  id: string; household_id: string; user_id: string | null; first_name: string; level_code: string;
  settings: StudentSettings; level_name: string;
};

const studentCols = sql`s.id, s.household_id, s.user_id, s.first_name, s.level_code, s.settings, l.name as level_name`;
const fix = (s: Student) => ({ ...s, settings: settingsOf(s.settings) });

// Élève connecté
export async function requireStudent(): Promise<{ user: User; student: Student }> {
  const user = await requireUser('student');
  const [s] = await sql<Student[]>`select ${studentCols} from students s join levels l on l.code = s.level_code where s.user_id = ${user.id}`;
  if (!s) redirect('/connexion');
  return { user, student: fix(s) };
}

// Élèves visibles par un parent : ceux de ses foyers, et seulement ceux-là.
export async function studentsOfParent(userId: string): Promise<Student[]> {
  const rows = await sql<Student[]>`
    select ${studentCols} from students s join levels l on l.code = s.level_code
    where s.household_id in (select household_id from household_members where user_id = ${userId} and role = 'parent')
    order by s.created_at`;
  return rows.map(fix);
}

// Parent connecté + élève choisi (paramètre ?eleve=…, sinon le dernier choisi (cookie), sinon le premier)
export async function requireParent(eleve?: string): Promise<{ user: User; students: Student[]; student: Student | null }> {
  const user = await requireUser('parent');
  const students = await studentsOfParent(user.id);
  if (eleve && !students.some(s => s.id === eleve)) notFound();
  const remembered = (await cookies()).get('ss_eleve')?.value;
  const student = students.find(s => s.id === eleve) ?? students.find(s => s.id === remembered) ?? students[0] ?? null;
  return { user, students, student };
}

export async function assertParentOf(userId: string, studentId: string): Promise<Student> {
  const s = (await studentsOfParent(userId)).find(x => x.id === studentId);
  if (!s) notFound();
  return s;
}
