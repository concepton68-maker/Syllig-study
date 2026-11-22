// DÉMONSTRATION UNIQUEMENT : ajoute une semaine d'activité fictive à l'élève « lea » pour illustrer les tableaux de bord.
// Ne jamais lancer en production.
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
const [s] = await sql`select s.id from students s join users u on u.id = s.user_id where u.login = 'lea'`;
const [c] = await sql`select id from courses where code = 'C001'`;
// [jour de la semaine (0 = lundi), heure, minutes actives, minutes ouvertes, type]
const plan = [[0, '18:10', 34, 39, 'lesson'], [1, '17:35', 48, 61, 'exercises'], [3, '20:40', 6, 31, 'lesson'], [3, '21:20', 22, 23, 'evaluation'], [4, '18:05', 30, 34, 'exercises'], [5, '15:02', 58, 66, 'review']];
for (const [d, h, a, o, kind] of plan) {
  await sql`insert into work_sessions (student_id, course_id, kind, started_at, last_beat_at, ended_at, open_seconds, active_seconds, idle_pauses, was_active)
    values (${s.id}, ${c.id}, ${kind},
      (date_trunc('week', now() at time zone 'Europe/Paris') + make_interval(days => ${d}) + ${h}::time) at time zone 'Europe/Paris',
      (date_trunc('week', now() at time zone 'Europe/Paris') + make_interval(days => ${d}) + ${h}::time + make_interval(mins => ${o})) at time zone 'Europe/Paris',
      (date_trunc('week', now() at time zone 'Europe/Paris') + make_interval(days => ${d}) + ${h}::time + make_interval(mins => ${o})) at time zone 'Europe/Paris', ${o * 60}, ${a * 60}, ${o > a + 5 ? 2 : 0}, true)`;
}
console.log('Activité de démonstration ajoutée.');
await sql.end();
