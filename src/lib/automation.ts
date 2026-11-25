import 'server-only';
import { sql } from './db';
import { enqueue, progressReporter } from './jobs';
import { aiConfigFor, askText, loadAiSettings, logAiRequest, correctWithAi } from './ai';
import { generateReport, placementQuestion, type ReportData } from './report';
import { logEvent } from './activity';
import { settingsOf } from './settings';
import { promptContext } from './prompt-context';
import { buildPrompt, suggestOptions } from './prompt-builder';
import { importCourse } from './import-course';
import type { Attempt } from './evaluation';

// Automatismes (réglés par le parent pour chaque enfant, ou par l'administrateur pour les cours) :
// correction dès la remise, bilan régulier, test de positionnement proposé, rédaction des leçons de rattrapage.

// ── Test de positionnement d'un bilan proposé à l'élève (bouton du parent, ou automatisme)
export async function assignPlacementFromReport(reportId: string, actorId: string | null): Promise<{ ok: true; questions: number } | { error: string }> {
  const [r] = await sql<{ student_id: string; data: ReportData }[]>`select student_id, data from student_reports where id = ${reportId}`;
  if (!r) return { error: 'Bilan introuvable.' };
  const [open] = await sql`select 1 from placement_tests where student_id = ${r.student_id} and status <> 'termine'`;
  if (open) return { error: 'Un test de positionnement est déjà proposé : attendez qu’il soit fait (ou retirez-le).' };
  const questions = r.data.test_positionnement.questions.map(placementQuestion).filter(q => q !== null);
  if (questions.length < 5) return { error: 'Le test proposé par l’IA n’est pas utilisable : demandez un nouveau bilan.' };
  const duration = Math.min(40, Math.max(10, Math.round(questions.length * 1.5)));
  await sql`insert into placement_tests (student_id, report_id, created_by, questions, duration_min, total)
    values (${r.student_id}, ${reportId}, ${actorId}, ${sql.json({ consigne: r.data.test_positionnement.consigne_eleve, items: questions })}, ${duration}, ${questions.length})`;
  await logEvent(r.student_id, 'positionnement_propose', { actorId, data: { questions: questions.length, automatique: !actorId } });
  return { ok: true, questions: questions.length };
}

// ── Correction dès la remise (appelée par submitAttempt)
export async function maybeAutoCorrect(a: Pick<Attempt, 'id' | 'student_id'>) {
  const [s] = await sql<{ settings: unknown }[]>`select settings from students where id = ${a.student_id}`;
  const st = settingsOf(s?.settings);
  if (!st.auto_correction || !st.ai_correction) return;
  if (!(await loadAiSettings()).enabled) return;
  await enqueue('correction', { attemptId: a.id }, `correction:${a.id}`);
}

export async function runCorrectionJob(attemptId: string) {
  const attempts = await sql<(Attempt & { title: string; subject: string; level: string })[]>`
    select a.*, c.title, s.name as subject, l.name as level from eval_attempts a
    join courses c on c.id = a.course_id join chapters ch on ch.id = c.chapter_id join subjects s on s.id = ch.subject_id join levels l on l.code = s.level_code
    where a.id = ${attemptId} and a.status = 'submitted' and a.proposal is null`;
  if (!attempts.length) return { skipped: 'copie déjà corrigée ou notée' };
  const r = await correctWithAi(attempts, [attempts[0].student_id], null);
  if (!r.ok) throw new Error(r.errors.join(' · ') || 'correction impossible');
  await logEvent(attempts[0].student_id, 'corrections_importees', { data: { copies: r.ok, par: 'ia', automatique: true } });
  return { corrected: r.ok, notes: r.errors };
}

// ── Bilan automatique (+ test de positionnement proposé si l'automatisme est actif)
export async function runBilanJob(studentId: string) {
  const r = await generateReport(studentId, null);
  if (r.error || !r.id) throw new Error(r.error ?? 'bilan impossible');
  await logEvent(studentId, 'bilan_ia', { data: { rapport: r.id, automatique: true } });
  const [s] = await sql<{ settings: unknown }[]>`select settings from students where id = ${studentId}`;
  let test: string | null = null;
  if (settingsOf(s?.settings).auto_test) {
    const t = await assignPlacementFromReport(r.id, null);
    test = 'ok' in t ? `${t.questions} questions proposées` : t.error;
  }
  return { report: r.id, test };
}

// ── Vérification périodique des automatismes (toutes les 30 minutes, ou à la demande depuis Contenu › IA)
export async function scheduleAuto() {
  await sql`delete from activity_beats where at < now() - interval '90 days'`;   // signaux d'activité : 90 jours
  const ai = await loadAiSettings();
  if (!ai.enabled) return { bilans: 0, cours: 0 };
  let bilans = 0, cours = 0;
  const students = await sql<{ id: string; settings: unknown; last: Date | null; graded_since: number; active_since: number }[]>`
    select s.id, s.settings,
      (select max(created_at) from student_reports r where r.student_id = s.id) as last,
      (select count(*)::int from eval_attempts a where a.student_id = s.id and a.status = 'graded'
         and a.graded_at > coalesce((select max(created_at) from student_reports r where r.student_id = s.id), '-infinity')) as graded_since,
      (select count(*)::int from work_sessions w where w.student_id = s.id
         and w.started_at > coalesce((select max(created_at) from student_reports r where r.student_id = s.id), '-infinity')) as active_since
    from students s`;
  for (const s of students) {
    const st = settingsOf(s.settings);
    if (!st.ai_bilan || st.auto_bilan === 'off') continue;
    const due = st.auto_bilan === '3_evals' ? s.graded_since >= 3
      : (!s.last || Date.now() - s.last.getTime() > 7 * 864e5) && (s.active_since > 0 || s.graded_since > 0);
    if (due && await enqueue('bilan', { studentId: s.id }, `bilan:${s.id}`)) bilans++;
  }
  if (ai.auto_cours) {
    const groups = await sql<{ ids: string[] }[]>`select array_agg(id::text) as ids from lesson_suggestions where status = 'a_creer'
      group by lower(trim(title)), lower(trim(level)), lower(trim(subject)) order by min(priority) limit 5`;
    for (const g of groups) { const r = await draftRemedialCourses(g.ids, null); cours += r.queued; }
  }
  return { bilans, cours };
}

// ── Rédaction d'un cours par l'IA : même circuit que l'import manuel (validation, brouillon à relire)
const SYSTEM_COURS = `Tu es auteur de cours pour Syllig Study. Tu réponds UNIQUEMENT par le document JSON complet du cours (format syllig-course/1), sans aucun texte avant ou après, sans balises de code. Le JSON doit être valide et suivre exactement la structure de l'exemple fourni.`;

async function adminId(userId: string | null) {
  if (userId) return userId;
  const [a] = await sql<{ user_id: string }[]>`select user_id from user_roles where role = 'admin' order by user_id limit 1`;
  return a?.user_id ?? null;
}

export async function runCourseJob(courseId: number, userId: string | null, jobId: string | null = null) {
  const report = progressReporter(jobId);
  const conf = await aiConfigFor('cours');
  if ('error' in conf) throw new Error(conf.error);
  const cfg = conf.cfg;
  const ctx = await promptContext(courseId);
  if (!ctx) throw new Error('cours introuvable dans le catalogue');
  const who = await adminId(userId);
  if (!who) throw new Error('aucun compte administrateur');
  const opts = suggestOptions(ctx).options;   // mêmes réglages automatiques que la page « Préparer la consigne »
  let prompt = buildPrompt(ctx, opts);
  let lastErrors: string[] = [];
  for (let essai = 1; essai <= 2; essai++) {
    let text: string;
    report(`essai ${essai}/2 · l’IA commence à écrire…`);
    try { text = await askText(cfg, SYSTEM_COURS, prompt, 32000, n => report(`essai ${essai}/2 · environ ${Math.min(99, Math.round(n / 450))} % rédigé`), n => report(`essai ${essai}/2 · l’IA réfléchit avant d’écrire (${Math.round(n / 1000)} k caractères)…`)); }
    catch (e) { await logAiRequest(null, 'cours', cfg, `Cours ${ctx.code} · ${ctx.title}`, (e as Error).message.slice(0, 300)); throw e; }
    await logAiRequest(null, 'cours', cfg, `Cours ${ctx.code} · ${ctx.title} (essai ${essai})`);
    report(`essai ${essai}/2 · vérification par le validateur`);
    const raw = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    if (!raw) { lastErrors = [`la réponse ne contient pas de JSON (début : « ${text.trim().slice(0, 160)} »)`]; continue; }
    const r = await importCourse(raw, `Rédigé par l’IA (${cfg.provider} · ${cfg.model})`, who);
    if (r.ok) {
      await sql`update lesson_suggestions set status = 'creee', updated_at = now() where course_id = ${courseId} and status = 'en_redaction'`;
      return { courseId: r.courseId, version: r.version, warnings: r.warnings };
    }
    lastErrors = r.errors;
    // second essai : on signale à l'IA ce que le validateur a refusé
    prompt = `${buildPrompt(ctx, opts)}\n\n## Important\nUne première version a été refusée par le validateur pour ces raisons ; corrige-les :\n${r.errors.slice(0, 15).map(e => `- ${e}`).join('\n')}`;
  }
  throw new Error(`cours refusé par le validateur : ${lastErrors.slice(0, 5).join(' ; ')}`);
}

export async function draftCourse(courseId: number, userId: string | null) {
  return enqueue('cours', { courseId, userId }, `cours:${courseId}`);
}

// Leçons de rattrapage (proposées par les bilans) : rangées dans le catalogue au niveau de l'élève,
// chapitre « Remise à niveau », puis rédigées par l'IA. Les ids d'un groupe = la même leçon proposée plusieurs fois.
export async function draftRemedialCourses(suggestionIds: string[], userId: string | null, opts: { draft?: boolean } = {}): Promise<{ queued: number; added: number; errors: string[] }> {
  const withAi = opts.draft !== false;
  const rows = await sql<{ id: string; title: string; subject: string; level: string; objective: string; course_id: number | null; level_code: string | null }[]>`
    select g.id::text, g.title, g.subject, g.level, g.objective, g.course_id, st.level_code
    from lesson_suggestions g left join student_reports r on r.id = g.report_id left join students st on st.id = r.student_id
    where g.id in ${sql(suggestionIds.length ? suggestionIds : ['0'])} and g.status in ('a_creer', 'en_redaction')`;
  if (!rows.length) return { queued: 0, added: 0, errors: [] };
  const first = rows[0];
  const errors: string[] = [];
  let courseId = rows.find(r => r.course_id)?.course_id ?? null;
  if (!courseId) {
    const level = rows.find(r => r.level_code)?.level_code;
    if (!level) return { queued: 0, added: 0, errors: [`« ${first.title} » : niveau de l’élève inconnu (bilan supprimé)`] };
    const [subj] = await sql<{ id: number }[]>`select id from subjects where level_code = ${level} and lower(name) = lower(${first.subject}) limit 1`;
    if (!subj) return { queued: 0, added: 0, errors: [`« ${first.title} » : matière « ${first.subject} » absente du programme`] };
    let [ch] = await sql<{ id: number }[]>`select id from chapters where subject_id = ${subj.id} and name = 'Remise à niveau'`;
    if (!ch) [ch] = await sql<{ id: number }[]>`insert into chapters (subject_id, name, position) values (${subj.id}, 'Remise à niveau', 0) returning id`;
    let [c] = await sql<{ id: number }[]>`select id from courses where chapter_id = ${ch.id} and lower(title) = lower(${first.title})`;
    if (!c) {
      const [{ n }] = await sql<{ n: number }[]>`select coalesce(max(substring(code from '^RN(\\d+)$')::int), 0) + 1 as n from courses where code ~ '^RN\\d+$'`;
      [c] = await sql<{ id: number }[]>`insert into courses (chapter_id, code, title, priority, position, official_note)
        values (${ch.id}, ${'RN' + String(n).padStart(3, '0')}, ${first.title}, 'mis_de_cote', (select coalesce(max(position), 0) + 1 from courses),
          ${`Remise à niveau : notion de ${first.level}, à reprendre simplement et progressivement. Objectif : ${first.objective}`}) returning id`;
    }
    courseId = c.id;
  }
  if (!withAi) {
    // simple ajout au catalogue : la consigne se prépare ensuite pour Claude (export / import)
    await sql`update lesson_suggestions set course_id = ${courseId}, updated_at = now() where id in ${sql(rows.map(r => r.id))}`;
    return { queued: 0, added: 1, errors };
  }
  await sql`update lesson_suggestions set status = 'en_redaction', course_id = ${courseId}, updated_at = now() where id in ${sql(rows.map(r => r.id))}`;
  const q = await draftCourse(courseId, userId);
  return { queued: q ? 1 : 0, added: 1, errors };
}

// À la publication d'un cours de rattrapage : il passe en tête du parcours des élèves pour qui il a été proposé
export async function assignRemedial(courseId: number) {
  await sql`update lesson_suggestions set status = 'creee', updated_at = now() where course_id = ${courseId} and status in ('a_creer', 'en_redaction')`;
  const students = await sql<{ student_id: string }[]>`
    select distinct r.student_id from lesson_suggestions g join student_reports r on r.id = g.report_id where g.course_id = ${courseId}`;
  for (const s of students) {
    await sql`insert into course_progress (student_id, course_id, forced) values (${s.student_id}, ${courseId}, 'now')
      on conflict (student_id, course_id) do update set forced = 'now'`;
    await logEvent(s.student_id, 'remise_a_niveau_ajoutee', { courseId });
  }
  return students.length;
}
