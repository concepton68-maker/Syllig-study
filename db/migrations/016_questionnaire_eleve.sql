-- Questionnaire « Comment je travaille » rempli par l'élève (2 minutes, toutes les 6 semaines environ) :
-- son ressenti (envie, confiance, stress, organisation, conditions), en complément des mesures de la plateforme.
create table if not exists student_checkins (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  created_at timestamptz not null default now(),
  answers    jsonb not null,          -- { item: 0..3 }
  scores     jsonb not null,          -- { dimension: 0..100 }
  free       jsonb not null default '{}'::jsonb   -- { aide: "...", bloque: "..." } (jamais envoyé à l'IA)
);
create index if not exists student_checkins_student on student_checkins (student_id, created_at desc);
