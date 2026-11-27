-- « M'entraîner » sur un cours déjà fait (maquette validée par le propriétaire le 27/11/2026) : 5 questions du cours
-- (exercices et points de contrôle, jamais l'évaluation), les moins récemment vues, corrigées aussitôt. Ne change ni la note
-- ni le calendrier des révisions espacées ; le temps compte comme du travail.
alter table review_sessions add column if not exists kind text not null default 'revision';
alter table review_sessions add column if not exists course_id int references courses(id) on delete cascade;
alter table review_sessions drop constraint if exists review_sessions_kind_check;
alter table review_sessions add constraint review_sessions_kind_check check (kind in ('revision', 'entrainement') and (kind = 'revision' or course_id is not null));
create index if not exists review_sessions_training on review_sessions(student_id, course_id) where kind = 'entrainement';
-- révisions programmées avant que les exercices soient remis (la révision en montre les corrigés) : retirées si jamais faites ;
-- elles seront reprogrammées le lendemain de la remise des exercices
delete from review_schedule r where not exists (select 1 from course_progress p where p.student_id = r.student_id and p.course_id = r.course_id and p.exercises_done_at is not null)
  and not exists (select 1 from review_results x where x.student_id = r.student_id and x.course_id = r.course_id);
