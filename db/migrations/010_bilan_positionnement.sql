-- Bilan pédagogique par l'IA (profilage), leçons de rattrapage à créer, tests de positionnement
create table if not exists student_reports (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  created_at  timestamptz not null default now(),
  created_by  uuid references users(id) on delete set null,
  provider    text not null,
  model       text not null,
  indicators  jsonb not null,   -- faits mesurés par la plateforme au moment du bilan
  data        jsonb not null    -- bilan rédigé par l'IA
);
create index if not exists student_reports_student on student_reports (student_id, created_at desc);

create table if not exists lesson_suggestions (
  id         bigserial primary key,
  report_id  uuid references student_reports(id) on delete set null,
  title      text not null,
  subject    text not null,
  level      text not null,
  objective  text not null,
  priority   smallint not null default 2,
  status     text not null default 'a_creer' check (status in ('a_creer', 'creee', 'ecartee')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists placement_tests (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references students(id) on delete cascade,
  report_id    uuid references student_reports(id) on delete set null,
  created_at   timestamptz not null default now(),
  created_by   uuid references users(id) on delete set null,
  status       text not null default 'propose' check (status in ('propose', 'en_cours', 'termine')),
  duration_min integer not null default 20,
  questions    jsonb not null,
  answers      jsonb not null default '{}'::jsonb,
  results      jsonb,
  score        integer,
  total        integer,
  started_at   timestamptz,
  submitted_at timestamptz
);
create index if not exists placement_tests_student on placement_tests (student_id, created_at desc);
