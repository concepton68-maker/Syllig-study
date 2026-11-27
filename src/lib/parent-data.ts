import 'server-only';
import { sql } from './db';
import { duree } from './duration';

export type SessionRow = {
  id: string; started_at: Date; kind: string; course_id: number | null; title: string | null; subject: string | null;
  active_seconds: number; open_seconds: number; idle_pauses: number; planned_min: number | null;
  focus_losses: number | null; focus_lost_seconds: number | null; paste_blocked: number | null; final_score: string | null;
};

export async function recentSessions(studentId: string, limit = 50) {
  return sql<SessionRow[]>`
    select w.id, w.started_at, w.kind, w.course_id, c.title, s.name as subject, w.active_seconds, w.open_seconds, w.idle_pauses,
      case w.kind when 'lesson' then (v.document->'lesson'->>'duration_min')::int when 'exercises' then (v.document->'exercises'->>'duration_min')::int
        when 'evaluation' then (v.document->'evaluation'->>'duration_min')::int end as planned_min,
      a.focus_losses, a.focus_lost_seconds, a.paste_blocked, a.final_score
    from work_sessions w
    left join courses c on c.id = w.course_id left join chapters ch on ch.id = c.chapter_id left join subjects s on s.id = ch.subject_id
    left join course_versions v on v.course_id = w.course_id and v.status = 'published'
    left join lateral (select * from eval_attempts e where w.kind = 'evaluation' and e.student_id = w.student_id and e.course_id = w.course_id
      and e.started_at between w.started_at - interval '2 minutes' and coalesce(w.ended_at, w.last_beat_at) + interval '1 minute' order by e.started_at desc limit 1) a on true
    where w.student_id = ${studentId} and w.open_seconds > 0
    order by w.started_at desc limit ${limit}`;
}

// Une séance est « à regarder ensemble » (jamais « suspecte ») selon les règles du cadrage
export function lookTogether(s: SessionRow): string | null {
  if (s.kind === 'evaluation' && ((s.focus_losses ?? 0) > 0 || (s.paste_blocked ?? 0) > 0)) {
    const parts = [];
    if (s.focus_losses) parts.push(`page de l’évaluation masquée ${s.focus_losses} fois (${s.focus_lost_seconds} s)`);
    if (s.paste_blocked) parts.push(`${s.paste_blocked} collage${s.paste_blocked > 1 ? 's' : ''} bloqué${s.paste_blocked > 1 ? 's' : ''}`);
    return parts.join(', ');
  }
  if (s.kind === 'lesson' && s.planned_min && s.active_seconds < 0.3 * s.planned_min * 60 && s.open_seconds >= 120)
    return `leçon : ${duree(Math.floor(s.active_seconds / 60))} de travail pour ${duree(s.planned_min)} prévues`;
  return null;
}

export async function subjectProgress(studentId: string, level: string) {
  return sql<{ subject: string; total: number; published: number; acquired: number; started: number; avg: string | null }[]>`
    select s.name as subject, count(c.id)::int as total,
      count(v.id)::int as published,
      count(*) filter (where p.mastery >= 4)::int as acquired,
      count(*) filter (where p.mastery >= 1)::int as started,
      round(avg(p.best_eval_score), 2) as avg
    from subjects s join chapters ch on ch.subject_id = s.id join courses c on c.chapter_id = ch.id
    left join course_versions v on v.course_id = c.id and v.status = 'published'
    left join course_progress p on p.course_id = c.id and p.student_id = ${studentId}
    where s.level_code = ${level}
      and not (s.id::text in (select jsonb_array_elements_text(coalesce(st.settings->'excluded_subjects', '[]'::jsonb)) from students st where st.id = ${studentId}))
    group by s.id, s.name, s.position order by s.position`;
}

export const KIND: Record<string, string> = { lesson: '① Leçon', exercises: '② Exercices', evaluation: '③ Évaluation', review: 'Révision ou entraînement', other: 'Autre' };
