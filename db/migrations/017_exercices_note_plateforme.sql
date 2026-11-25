-- Note d'exercices retenue : uniquement les questions corrigées par la plateforme (règle du 25/11/2026, version 0.43).
-- Les notes enregistrées avant incluaient l'auto-évaluation de l'élève : recalcul à partir des séries remises.
-- Une série sans question corrigée automatiquement ne donne pas de note (null).
update course_progress p set exercises_score = s.best from (
  select student_id, course_id,
    max(round(10.0 * (select count(*) from jsonb_each(auto_results) where value = 'true'::jsonb)
              / nullif((select count(*) from jsonb_object_keys(auto_results)), 0)))::int as best
  from exercise_submissions where checked_at is not null and auto_results is not null group by 1, 2) s
where p.student_id = s.student_id and p.course_id = s.course_id;
