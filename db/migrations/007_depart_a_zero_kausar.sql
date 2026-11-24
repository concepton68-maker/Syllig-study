-- Départ à zéro demandé par le parent (24/11/2026) : Kausar recommence sur des bases neuves,
-- pour un suivi propre depuis le départ. Le compte, le niveau (3e générale), les réglages et le thème sont conservés.
-- Vise l'élève prénommée Kausar (ou une orthographe voisine), ou l'unique élève de la plateforme.
create temporary table depart_zero on commit drop as
  select s.id from students s
  where lower(s.first_name) similar to '(kau|kaw|kao|kou)%' or (select count(*) from students) = 1;

delete from eval_attempts        where student_id in (select id from depart_zero);
delete from exercise_submissions where student_id in (select id from depart_zero);
delete from checkpoint_answers   where student_id in (select id from depart_zero);
delete from points_ledger        where student_id in (select id from depart_zero);
delete from work_sessions        where student_id in (select id from depart_zero);
delete from course_progress      where student_id in (select id from depart_zero);

-- journal d'activité : effacé (seule voie autorisée, comme « Repartir de zéro » avec effacement du journal)
set local syllig.allow_log_purge = 'on';
delete from activity_log where student_id in (select id from depart_zero);
set local syllig.allow_log_purge = 'off';

-- le dossier scolaire repart d'aujourd'hui : une seule année, en cours, commencée maintenant
delete from student_years where student_id in (select id from depart_zero) and status = 'terminee';
update student_years set started_at = now(), note = 'Départ à zéro le 24/11/2026'
  where student_id in (select id from depart_zero) and status = 'en_cours';

-- premier événement du nouveau journal
insert into activity_log (student_id, event, actor_id, data, prev_hash, hash)
  select id, 'parcours_reinitialise', null, '{"journal_efface": true, "motif": "Départ à zéro demandé par le parent"}'::jsonb, '', ''
  from depart_zero;
