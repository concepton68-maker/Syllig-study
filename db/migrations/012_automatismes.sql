-- File de tâches en arrière-plan (corrections et bilans automatiques, rédaction de cours par l'IA)
create table if not exists jobs (
  id          bigserial primary key,
  kind        text not null check (kind in ('correction', 'bilan', 'cours')),
  payload     jsonb not null,
  dedupe      text,
  status      text not null default 'en_attente' check (status in ('en_attente', 'en_cours', 'fait', 'echec')),
  attempts    integer not null default 0,
  run_after   timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  started_at  timestamptz,
  finished_at timestamptz,
  error       text,
  result      jsonb
);
create unique index if not exists jobs_dedupe_open on jobs (dedupe) where dedupe is not null and status in ('en_attente', 'en_cours');
create index if not exists jobs_todo on jobs (status, run_after);

-- Leçons à créer : lien vers le cours créé dans le catalogue, et étape « en rédaction »
alter table lesson_suggestions add column if not exists course_id integer references courses(id) on delete set null;
alter table lesson_suggestions drop constraint if exists lesson_suggestions_status_check;
alter table lesson_suggestions add constraint lesson_suggestions_status_check check (status in ('a_creer', 'en_redaction', 'creee', 'ecartee'));
