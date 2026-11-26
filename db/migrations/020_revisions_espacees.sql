-- Révisions espacées (maquette validée par le propriétaire le 26/11/2026) : se tester (effet de test) à intervalles
-- qui s'allongent après une réussite (convention de Leitner) et reviennent à 1 jour après un échec. Questions des exercices et
-- points de contrôle (jamais de l'évaluation), corrigées par la plateforme.
create table if not exists review_schedule (
  student_id uuid not null references students(id) on delete cascade,
  course_id  int  not null references courses(id) on delete cascade,
  step       int  not null default 0,               -- rang dans les intervalles 1, 3, 7, 14, 30, 60 jours
  due_at     timestamptz not null,
  primary key (student_id, course_id)
);
create table if not exists review_sessions (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  questions   jsonb not null,                       -- [{ course_id, version_id, key }]
  created_at  timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists review_sessions_student on review_sessions(student_id, created_at desc);
create table if not exists review_items (
  session_id  uuid not null references review_sessions(id) on delete cascade,
  idx         int  not null,
  student_id  uuid not null references students(id) on delete cascade,
  course_id   int  not null references courses(id) on delete cascade,
  key         text not null,                        -- question du cours (exercice, évaluation ou point de contrôle)
  answer      text not null default '',
  correct     boolean not null,
  answered_at timestamptz not null default now(),
  primary key (session_id, idx)
);
create index if not exists review_items_student_course on review_items(student_id, course_id, answered_at desc);
create table if not exists review_results (
  id          bigserial primary key,
  student_id  uuid not null references students(id) on delete cascade,
  course_id   int  not null references courses(id) on delete cascade,
  session_id  uuid not null references review_sessions(id) on delete cascade,
  at          timestamptz not null default now(),
  ok          int not null,
  total       int not null,
  gap_days    int not null,                         -- jours (heure de Paris) depuis la révision précédente, ou depuis la fin de la leçon
  passed      boolean not null,
  next_days   int not null
);
create index if not exists review_results_student on review_results(student_id, at desc);

-- l'ancienne révision unique (exercices refaits 3 à 30 jours après l'évaluation) est remplacée
update course_progress set next_review_at = null where next_review_at is not null;
