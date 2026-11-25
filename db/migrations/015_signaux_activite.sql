-- Signaux d'activité (toutes les 15 s pendant le travail) : frise de la journée et suivi en direct pour le parent.
-- Purgés après 90 jours (les totaux par séance restent dans work_sessions).
create table if not exists activity_beats (
  id         bigserial primary key,
  session_id uuid not null references work_sessions(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  at         timestamptz not null default now(),
  active     boolean not null,
  seconds    smallint not null
);
create index if not exists activity_beats_student_at on activity_beats (student_id, at);
