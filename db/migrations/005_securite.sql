-- Essais de connexion, comptés en base (survivent aux redémarrages ; limite par identifiant et par adresse)
create table if not exists login_attempts (
  id    bigserial primary key,
  login text not null,
  ip    text not null,
  at    timestamptz not null default now()
);
create index if not exists login_attempts_login_at on login_attempts (login, at);
create index if not exists login_attempts_ip_at on login_attempts (ip, at);

-- Une seule évaluation ouverte par élève et par cours (double clic, deux onglets)
create unique index if not exists eval_attempts_one_open on eval_attempts (student_id, course_id)
  where status in ('requested', 'approved', 'in_progress');

-- Le journal est en lecture seule : une suppression ne doit pas tenter de le modifier (« set null » échouait)
alter table activity_log drop constraint if exists activity_log_course_id_fkey;
alter table activity_log add constraint activity_log_course_id_fkey foreign key (course_id) references courses(id);
alter table activity_log drop constraint if exists activity_log_actor_id_fkey;
alter table activity_log add constraint activity_log_actor_id_fkey foreign key (actor_id) references users(id);

-- Réinitialisations par cours plus rapides
create index if not exists points_ledger_student_course on points_ledger (student_id, course_id);
