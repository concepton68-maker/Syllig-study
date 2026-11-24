-- Dossier scolaire : une ligne par année scolaire de chaque élève (niveau, année, bilan figé à la clôture).
-- Changer de niveau = soit passer dans l'année supérieure (on clôt l'année et on en ouvre une nouvelle),
-- soit corriger le niveau de l'année en cours (erreur de saisie).

alter table levels add column if not exists cycle text;   -- ex. « Collège », « Lycée »

-- le niveau 3e générale existe avant même le chargement de son programme (nécessaire pour la correction ci-dessous)
insert into levels (code, name, position, cycle) values ('troisieme-generale', '3e générale', 4, 'Collège')
  on conflict (code) do nothing;
update levels set position = 5, cycle = 'Lycée' where code = 'seconde-generale';

create table if not exists student_years (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  level_code  text not null references levels(code),
  school_year text not null,                                  -- ex. « 2026-2027 »
  status      text not null default 'en_cours' check (status in ('en_cours', 'terminee')),
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  summary     jsonb,                                          -- bilan figé à la clôture
  note        text,                                           -- remarque du parent (ex. « Passage en 3e »)
  created_by  uuid references users(id) on delete set null
);
create unique index if not exists student_years_one_open on student_years (student_id) where status = 'en_cours';
create index if not exists student_years_student on student_years (student_id, started_at);

-- année scolaire (septembre → août) d'une date
create or replace function school_year_of(d timestamptz) returns text language sql immutable as $$
  select case when extract(month from d) >= 8
    then extract(year from d)::int || '-' || (extract(year from d)::int + 1)
    else (extract(year from d)::int - 1) || '-' || extract(year from d)::int end
$$;

-- une année en cours pour chaque élève existant
insert into student_years (student_id, level_code, school_year, started_at)
  select s.id, s.level_code, school_year_of(s.created_at), s.created_at from students s
  where not exists (select 1 from student_years y where y.student_id = s.id);

-- Correction demandée par le propriétaire : l'élève (Kausar) est en 3e générale, pas en Seconde.
-- Vise l'élève nommée Kausar, ou l'unique élève de la plateforme s'il n'y en a qu'une.
with cible as (
  select s.id from students s
  where s.level_code = 'seconde-generale'
    and (lower(s.first_name) similar to '(kausar|kawsar|kaousar|kawthar|kaoutar)%' or (select count(*) from students) = 1)
)
, maj_annee as (
  update student_years y set level_code = 'troisieme-generale', note = 'Niveau corrigé : 3e générale (et non Seconde)'
  where y.status = 'en_cours' and y.student_id in (select id from cible) returning y.student_id
)
update students set level_code = 'troisieme-generale' where id in (select id from cible);

-- tout nouvel élève reçoit automatiquement sa première année scolaire
create or replace function students_first_year() returns trigger language plpgsql as $$
begin
  insert into student_years (student_id, level_code, school_year, started_at)
    values (new.id, new.level_code, school_year_of(new.created_at), new.created_at);
  return new;
end $$;
drop trigger if exists students_first_year_trg on students;
create trigger students_first_year_trg after insert on students for each row execute function students_first_year();
