-- Niveaux, matières, chapitres et cours gérables par l'administrateur (maquette validée le 28/11/2026) :
-- activer / désactiver (invisible pour les élèves, rien n'est effacé) et supprimer (retiré partout, l'historique reste).
-- Rien de ce qui est désactivé, supprimé ou renommé ne revient à la mise à jour suivante : le chargement des programmes
-- retrouve chaque élément par son nom d'origine (source_name / source_title) et ne touche ni à son nom ni à son état.
alter table levels add column if not exists active boolean not null default true;
alter table levels add column if not exists removed_at timestamptz;
alter table levels add column if not exists renamed boolean not null default false;
alter table subjects add column if not exists active boolean not null default true;
alter table subjects add column if not exists removed_at timestamptz;
alter table subjects add column if not exists source_name text;
update subjects set source_name = name where source_name is null;
alter table chapters add column if not exists active boolean not null default true;
alter table chapters add column if not exists removed_at timestamptz;
alter table chapters add column if not exists source_name text;
update chapters set source_name = name where source_name is null;
alter table courses add column if not exists removed_at timestamptz;
alter table courses add column if not exists source_title text;
update courses set source_title = title where source_title is null;
-- cours visibles des élèves : rien de désactivé ni de supprimé au-dessus d'eux
create or replace view live_courses as
  select c.id from courses c join chapters ch on ch.id = c.chapter_id join subjects s on s.id = ch.subject_id join levels l on l.code = s.level_code
  where c.removed_at is null and ch.active and ch.removed_at is null and s.active and s.removed_at is null and l.active and l.removed_at is null;
