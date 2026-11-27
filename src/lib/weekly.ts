import 'server-only';
import { duree } from './duration';
import { sql } from './db';
import { settingsOf } from './settings';
import { weekReport, mondayOf } from './week';
import { copyReview, exerciseReview } from './review';
import { sendMail, mailSettings, unsubscribeToken, appUrl } from './mailer';
import type { Student } from './access';

// Message hebdomadaire au parent (maquette validée le 27/11/2026). Uniquement des faits mesurés de la semaine écoulée,
// un seul point à regarder ensemble (le plus récent : questions à 0 point ou sans réponse) et une idée liée à ce point.
// Forme inspirée de deux essais contrôlés auprès de parents (sans promesse d'effet) : messages courts et réguliers de
// l'enseignant, ceux qui signalaient un point à améliorer ayant eu plus d'effet que les messages positifs (Kraft & Rogers 2015,
// programme d'été aux États-Unis) ; alertes automatiques sur les notes, le travail non rendu et les absences (Bergman & Chan 2021).
// « Une idée » n'est tirée d'aucune de ces études. Le message est figé à sa création : la date est affichée.

export type WeeklyData = {
  first_name: string; week_start: string; week_end: string; label: string;
  active_min: number; goal_min: number; days_worked: number; lessons_done: number;
  evals: { title: string; note: string }[]; pending: number; revisions: { ok: number; total: number } | null; generated_at?: string;
  point: { title: string; kind: 'copie' | 'exercices'; blank: number; wrong: number; href: string } | null;
  idea: string | null;
};

const hm = duree;
const clip = (s: string, n: number) => { const t = s.replace(/\*\*|__|`|\$/g, '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const fmtDay = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC', ...o });

async function studentById(id: string): Promise<Student | null> {
  const [s] = await sql<Student[]>`select s.id, s.household_id, s.user_id, s.first_name, s.level_code, s.settings, l.name as level_name
    from students s join levels l on l.code = s.level_code where s.id = ${id}`;
  return s ? { ...s, settings: settingsOf(s.settings) } : null;
}

/** Les faits de la semaine (lundi → dimanche, heure de Paris) commençant le lundi `monday`. */
export async function weeklyData(student: Student, monday: string): Promise<WeeklyData> {
  const w = await weekReport(student, monday);
  const [b] = await sql<{ start: Date; end: Date }[]>`select (${monday}::date::timestamp at time zone 'Europe/Paris') as start, ((${monday}::date + 7)::timestamp at time zone 'Europe/Paris') as end`;
  const [l] = await sql<{ n: number }[]>`select count(*)::int as n from course_progress where student_id = ${student.id} and lesson_done_at >= ${b.start} and lesson_done_at < ${b.end}`;
  // copies rendues dans la semaine : notées (avec la note) ou encore en correction au moment du message
  const all = await sql<{ id: string; title: string; note: string | null; status: string; at: Date }[]>`
    select a.id, c.title, a.final_score as note, a.status, a.submitted_at as at from eval_attempts a join courses c on c.id = a.course_id
    where a.student_id = ${student.id} and a.status in ('submitted', 'graded') and a.submitted_at >= ${b.start} and a.submitted_at < ${b.end} order by a.submitted_at`;
  const evals = all.filter(a => a.status === 'graded' && a.note !== null);
  const [rv] = await sql<{ ok: number; total: number }[]>`select coalesce(sum(ok), 0)::int as ok, coalesce(sum(total), 0)::int as total from review_results
    where student_id = ${student.id} and at >= ${b.start} and at < ${b.end}`;
  const exs = await sql<{ id: string; at: Date }[]>`select id, submitted_at as at from exercise_submissions
    where student_id = ${student.id} and submitted_at >= ${b.start} and submitted_at < ${b.end} order by submitted_at`;

  // le point à regarder : la copie notée la plus récente avec des questions à 0 point ou sans réponse ; sinon la dernière série d'exercices avec des erreurs
  let point: WeeklyData['point'] = null, idea: string | null = null;
  for (const e of [...evals].reverse()) {
    const r = await copyReview(e.id);
    const miss = r?.questions.filter(q => q.status === 'ko' || q.status === 'vide') ?? [];
    if (r && miss.length) {
      point = { title: e.title, kind: 'copie', blank: miss.filter(q => q.status === 'vide').length, wrong: miss.filter(q => q.status === 'ko').length, href: `/parent/revoir/copie/${e.id}` };
      const q = miss.find(x => x.status === 'ko') ?? miss[0];
      idea = `Demandez-lui de vous expliquer comment répondre à : « ${clip(q.prompt, 120)} »`;
      break;
    }
  }
  if (!point) for (const e of [...exs].reverse()) {
    const r = await exerciseReview(e.id);
    const miss = r?.questions.filter(q => q.status === 'ko') ?? [];
    if (r && miss.length) {
      point = { title: r.courseTitle, kind: 'exercices', blank: 0, wrong: miss.length, href: `/parent/revoir/exercices/${e.id}` };
      idea = `Demandez-lui de vous expliquer comment répondre à : « ${clip(miss[0].prompt, 120)} »`;
      break;
    }
  }
  return {
    first_name: student.first_name, week_start: monday, week_end: w.end, label: w.label,
    active_min: w.active_min, goal_min: w.goal_min, days_worked: w.days_worked, lessons_done: l.n,
    evals: evals.map(e => ({ title: e.title, note: Number(e.note).toLocaleString('fr-FR') })), pending: all.length - evals.length,
    revisions: rv.total ? { ok: rv.ok, total: rv.total } : null, point, idea, generated_at: new Date().toISOString(),
  };
}

/** Le lundi de la semaine qui vient de se terminer (heure de Paris). */
export async function lastMonday() {
  const { current } = await mondayOf();
  const d = new Date(`${current}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
}

/** Crée (une seule fois) le message de la semaine écoulée pour un élève. */
export async function ensureMessage(studentId: string, monday: string) {
  const [m] = await sql<{ id: string; data: WeeklyData }[]>`select id, data from weekly_messages where student_id = ${studentId} and week_start = ${monday}`;
  if (m) return m;
  const s = await studentById(studentId);
  if (!s) return null;
  const data = await weeklyData(s, monday);
  const [n] = await sql<{ id: string; data: WeeklyData }[]>`insert into weekly_messages (student_id, week_start, data) values (${studentId}, ${monday}, ${sql.json(data as never)})
    on conflict (student_id, week_start) do update set week_start = excluded.week_start returning id, data`;
  return n;
}

export const subject = (d: WeeklyData) => `La semaine de ${d.first_name} : ${hm(d.active_min)} de travail, ${d.days_worked} jour${d.days_worked > 1 ? 's' : ''} sur 7`;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function rows(d: WeeklyData): [string, string][] {
  const r: [string, string][] = [
    ['Temps de travail', `${hm(d.active_min)} / objectif ${hm(d.goal_min)}`],
    ['Jours travaillés (10 min ou plus)', `${d.days_worked} sur 7`],
    ['Leçons finies', String(d.lessons_done)],
  ];
  if (d.evals.length || d.pending) r.push([d.evals.length + (d.pending ?? 0) > 1 ? 'Évaluations rendues' : 'Évaluation rendue',
    [...d.evals.map(e => `${e.note}/20 · ${e.title}`), ...(d.pending ? [`${d.pending} en correction`] : [])].join(' ; ')]);
  if (d.revisions) r.push(['Révisions', `${d.revisions.ok} justes sur ${d.revisions.total}`]);
  return r;
}
export const frozenAt = (d: WeeklyData) => d.generated_at ? new Date(d.generated_at).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : null;
export const pointText = (p: NonNullable<WeeklyData['point']>) =>
  `« ${p.title} » : ${[p.blank ? `${p.blank} question${p.blank > 1 ? 's' : ''} sans réponse` : '', p.wrong ? `${p.wrong} fausse${p.wrong > 1 ? 's' : ''}` : ''].filter(Boolean).join(' et ')}${p.kind === 'exercices' ? ' dans les exercices' : ''}.`;

export function renderEmail(d: WeeklyData, userId: string) {
  const base = appUrl(), elle = 'avec ' + d.first_name;
  const unsub = `${base}/desabonnement?u=${userId}&t=${unsubscribeToken(userId)}`;
  const tr = rows(d).map(([k, v]) => `<tr><td style="padding:9px 0;border-top:1px solid #E4E7EC">${esc(k)}</td><td style="padding:9px 0;border-top:1px solid #E4E7EC;text-align:right"><strong>${esc(v)}</strong></td></tr>`).join('');
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#EEF0F3;font-family:Arial,Helvetica,sans-serif;color:#101828">
<div style="max-width:600px;margin:0 auto;padding:24px"><div style="background:#fff;border-radius:12px;padding:28px 32px">
<div style="font-weight:700;font-size:18px;color:#2F4FD8">Syllig</div>
<h1 style="margin:14px 0 4px;font-size:22px">La semaine de ${esc(d.first_name)}</h1>
<div style="font-size:14px;color:#475467;margin-bottom:16px">${esc(d.label)}</div>
<table role="presentation" style="width:100%;border-collapse:collapse;font-size:15px;border-bottom:1px solid #E4E7EC">${tr}</table>
${d.point ? `<div style="background:#FEF0E6;border-radius:10px;padding:14px 16px;margin-top:18px"><strong style="font-size:14px;color:#7A2E0B">À regarder ${esc(elle)}</strong><br><span style="font-size:15px">${esc(pointText(d.point))}</span><br><a href="${base}${d.point.href}" style="font-size:14px;font-weight:600;color:#1E36A8">${d.point.kind === 'copie' ? 'Revoir la copie' : 'Revoir les exercices'} ›</a></div>` : ''}
${d.idea ? `<div style="background:#F2F4F7;border-radius:10px;padding:14px 16px;margin-top:12px"><strong style="font-size:14px">Une idée</strong><br><span style="font-size:15px">${esc(d.idea)}</span></div>` : ''}
<p style="margin:20px 0"><a href="${base}/parent/journal?semaine=${d.week_start}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#2F4FD8;color:#fff;font-weight:600;text-decoration:none">Voir sa semaine</a></p>
<p style="font-size:12px;color:#667085;border-top:1px solid #E4E7EC;padding-top:14px;margin:0">Message envoyé chaque lundi à partir de 7 h. Chiffres mesurés par la plateforme${frozenAt(d) ? `, arrêtés le ${esc(frozenAt(d)!)}` : ''} ; l’idée est une simple suggestion. <a href="${unsub}" style="color:#1E36A8">Ne plus recevoir ce message</a></p>
</div></div></body></html>`;
  const text = [`La semaine de ${d.first_name} (${d.label})`, '', ...rows(d).map(([k, v]) => `${k} : ${v}`),
    ...(d.point ? ['', `À regarder ${elle} : ${pointText(d.point)}`, `${base}${d.point.href}`] : []),
    ...(d.idea ? ['', `Une idée : ${d.idea}`] : []), '', `Voir sa semaine : ${base}/parent/journal?semaine=${d.week_start}`, '', `Chiffres mesurés par la plateforme${frozenAt(d) ? `, arrêtés le ${frozenAt(d)}` : ''}.`, `Ne plus recevoir ce message : ${unsub}`].join('\n');
  return { html, text, unsub };
}

/** Parents à prévenir : ceux du foyer de l'élève, abonnés, avec une adresse confirmée (sauf l'essai demandé par un parent). */
async function recipients(studentId: string, onlyUser?: string) {
  return sql<{ id: string; email: string }[]>`select u.id, u.email from users u join household_members m on m.user_id = u.id and m.role = 'parent'
    join students s on s.household_id = m.household_id where s.id = ${studentId} and coalesce(u.email, '') <> ''
      and ${onlyUser ? sql`u.id = ${onlyUser}` : sql`u.weekly_email`}`;
}

export async function sendMessage(messageId: string, data: WeeklyData, studentId: string, onlyUser?: string) {
  if (!(await mailSettings())) return { sent: 0, errors: [] as string[] };
  let sent = 0; const errors: string[] = [];
  for (const r of await recipients(studentId, onlyUser)) {
    await sql`insert into weekly_sends (message_id, user_id, email) values (${messageId}, ${r.id}, ${r.email}) on conflict (message_id, user_id) do nothing`;
    // réservation de l'envoi : un seul passage à la fois envoie (pas de doublon), essais espacés après une panne (6 au plus)
    const [claim] = await sql<{ attempts: number }[]>`update weekly_sends set claimed_at = now(), email = ${r.email}
      where message_id = ${messageId} and user_id = ${r.id}
        and ${onlyUser ? sql`true` : sql`sent_at is null and attempts < 6 and coalesce(next_try_at, now()) <= now()`}
        and (claimed_at is null or claimed_at < now() - interval '5 minutes') returning attempts`;
    if (!claim) continue;
    const { html, text, unsub } = renderEmail(data, r.id);
    try {
      await sendMail(r.email, subject(data), html, text, { 'List-Unsubscribe': `<${unsub.replace('/desabonnement?', '/api/desabonnement?')}>, <${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' });
      await sql`update weekly_sends set sent_at = coalesce(sent_at, now()), attempts = attempts + 1, error = null, claimed_at = null where message_id = ${messageId} and user_id = ${r.id}`;
      sent++;
    } catch (e) {
      const msg = (e as Error).message?.slice(0, 300) ?? 'erreur';
      await sql`update weekly_sends set attempts = attempts + 1, error = ${msg}, claimed_at = null,
        next_try_at = now() + make_interval(mins => ${30 * 2 ** claim.attempts}) where message_id = ${messageId} and user_id = ${r.id}`;
      errors.push(msg);
    }
  }
  return { sent, errors };
}

/** Le message de la semaine écoulée existe à partir du lundi 7 h (heure de Paris). */
export async function weekOpen() {
  const [t] = await sql<{ ok: boolean }[]>`select extract(isodow from now() at time zone 'Europe/Paris') > 1 or extract(hour from now() at time zone 'Europe/Paris') >= 7 as ok`;
  return t.ok;
}

/** Appelé par la file de tâches (au plus toutes les WEEKLY_EVERY_MS, 5 min par défaut ; jamais deux passages à la fois). */
let running = false, lastRun = 0;
const EVERY = Number(process.env.WEEKLY_EVERY_MS ?? 5 * 60_000);
export async function weeklyTick() {
  if (running || Date.now() - lastRun < EVERY) return;
  running = true; lastRun = Date.now();
  try {
    if (!(await weekOpen())) return;
    const monday = await lastMonday();
    // seulement les élèves inscrits avant la fin de la semaine décrite ; un élève en erreur ne bloque pas les autres
    const todo = await sql<{ id: string }[]>`select s.id from students s where s.created_at < (${monday}::date + 7)::timestamp at time zone 'Europe/Paris'`;
    const configured = !!(await mailSettings());
    for (const s of todo) {
      try {
        const m = await ensureMessage(s.id, monday);
        if (m && configured) await sendMessage(m.id, m.data, s.id);
      } catch (e) { console.error('message hebdomadaire', s.id, (e as Error).message); }
    }
  } finally { running = false; }
}
