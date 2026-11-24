-- Relecture d'un cours existant par l'IA (liste de problèmes), puis correction en nouvelle version (brouillon à relire)
alter table jobs drop constraint if exists jobs_kind_check;
alter table jobs add constraint jobs_kind_check check (kind in ('correction', 'bilan', 'cours', 'relecture', 'cours_corrige'));

create table if not exists course_reviews (
  id         uuid primary key default gen_random_uuid(),
  course_id  integer not null references courses(id) on delete cascade,
  version_id uuid not null references course_versions(id) on delete cascade,
  created_at timestamptz not null default now(),
  provider   text not null,
  model      text not null,
  data       jsonb not null,
  fixed_version_id uuid references course_versions(id) on delete set null
);
create index if not exists course_reviews_course on course_reviews (course_id, created_at desc);
