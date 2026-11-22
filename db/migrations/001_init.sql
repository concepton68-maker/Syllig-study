-- Syllig Study · schéma initial
-- Multi-foyers / multi-élèves dès le départ : toutes les données de suivi sont rattachées à un élève,
-- lui-même rattaché à un foyer (household). Un parent ne voit que les élèves de ses foyers.

create extension if not exists pgcrypto;

-- ───────────── Comptes ─────────────
create table users (
  id            uuid primary key default gen_random_uuid(),
  login         text not null unique,              -- e-mail ou identifiant simple (élève sans e-mail)
  password_hash text not null,
  display_name  text not null,
  role          text not null check (role in ('parent','student','admin')),
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

create table auth_sessions (
  token_hash text primary key,                     -- sha256 du jeton du cookie (jamais le jeton en clair)
  user_id    uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index on auth_sessions(user_id);

create table households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id      uuid not null references users(id) on delete cascade,
  role         text not null check (role in ('parent','student')),
  primary key (household_id, user_id)
);

-- ───────────── Catalogue (programme) ─────────────
create table levels (
  code     text primary key,                       -- ex. 'seconde-generale'
  name     text not null,
  position int not null default 0
);

create table subjects (
  id         serial primary key,
  level_code text not null references levels(code),
  name       text not null,
  position   int not null,
  unique (level_code, name)
);

create table chapters (
  id         serial primary key,
  subject_id int not null references subjects(id) on delete cascade,
  name       text not null,
  position   int not null,
  unique (subject_id, name)
);

create table courses (
  id         serial primary key,
  chapter_id int not null references chapters(id) on delete cascade,
  code       text unique,                          -- ex. 'C001' quand le contenu est rédigé
  title      text not null,
  priority   text not null default 'ensuite' check (priority in ('prioritaire','ensuite','mis_de_cote')),
  position   int not null,                         -- ordre global dans le niveau
  official_note text,
  unique (chapter_id, title)
);

-- Versions importées d'un cours (format syllig-course/1). Un import crée un brouillon ;
-- la publication rend la version visible. Les copies d'élèves pointent vers la version utilisée.
create table course_versions (
  id           uuid primary key default gen_random_uuid(),
  course_id    int  not null references courses(id) on delete cascade,
  version      int  not null,
  status       text not null check (status in ('draft','published','archived')),
  document     jsonb not null,                     -- fichier complet validé, corrigés compris
  source_name  text,
  imported_by  uuid references users(id) on delete set null,
  imported_at  timestamptz not null default now(),
  published_at timestamptz,
  unique (course_id, version)
);
create unique index course_versions_one_published on course_versions(course_id) where status = 'published';

-- ───────────── Élèves ─────────────
create table students (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id      uuid unique references users(id) on delete set null,
  first_name   text not null,
  level_code   text not null references levels(code),
  settings     jsonb not null default '{}'::jsonb, -- règles parentales (objectif, délais, autorisations…)
  created_at   timestamptz not null default now()
);
create index on students(household_id);

-- État de chaque cours pour chaque élève
create table course_progress (
  student_id         uuid not null references students(id) on delete cascade,
  course_id          int  not null references courses(id) on delete cascade,
  lesson_done_at     timestamptz,
  exercises_done_at  timestamptz,
  exercises_score    int,                          -- réussis sur 10 (auto-correction guidée)
  points_awarded     jsonb not null default '{}'::jsonb, -- jalons de points déjà accordés pour ce cours
  best_eval_score    numeric(4,2),
  mastery            smallint not null default 0 check (mastery between 0 and 5),
  forced             text check (forced in ('now','later')),
  next_review_at     timestamptz,
  updated_at         timestamptz not null default now(),
  primary key (student_id, course_id)
);

-- Points de contrôle des leçons (une ligne par réponse)
create table checkpoint_answers (
  id          bigserial primary key,
  student_id  uuid not null references students(id) on delete cascade,
  course_id   int  not null references courses(id) on delete cascade,
  version_id  uuid not null references course_versions(id),
  part_index  int  not null,
  variant     int  not null,
  choice      int  not null,
  correct     boolean not null,
  answered_at timestamptz not null default now()
);
create index on checkpoint_answers(student_id, course_id);

-- Réponses aux exercices
create table exercise_submissions (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references students(id) on delete cascade,
  course_id    int  not null references courses(id) on delete cascade,
  version_id   uuid not null references course_versions(id),
  auto_results jsonb,                              -- { exN: true/false } pour les questions corrigées automatiquement
  answers      jsonb not null default '{}'::jsonb,
  self_check   jsonb,                              -- { ex1: true, ex2: false, … }
  submitted_at timestamptz,
  checked_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index on exercise_submissions(student_id, course_id);

-- Tentatives d'évaluation (chrono côté serveur)
create table eval_attempts (
  id                 uuid primary key default gen_random_uuid(),
  student_id         uuid not null references students(id) on delete cascade,
  course_id          int  not null references courses(id) on delete cascade,
  version_id         uuid not null references course_versions(id),
  attempt_no         int  not null,
  variant            int  not null default 0,
  status             text not null check (status in ('requested','approved','in_progress','submitted','graded','cancelled')),
  requested_at       timestamptz,
  approved_at        timestamptz,
  started_at         timestamptz,
  deadline_at        timestamptz,
  submitted_at       timestamptz,
  answers            jsonb not null default '{}'::jsonb,
  focus_losses       int not null default 0,
  focus_lost_seconds int not null default 0,
  paste_blocked      int not null default 0,
  late               boolean not null default false,
  auto_scores        jsonb,                        -- points des questions corrigées automatiquement
  proposal           jsonb,                        -- propositions importées (Claude) : { q7: {points, comment} }
  scores             jsonb,                        -- points définitifs validés { q1: 1, q2: 0.5, … }
  feedback           jsonb,                        -- { q1: "…", general: "…" }
  final_score        numeric(4,2),
  graded_by          uuid references users(id),
  graded_at          timestamptz,
  unique (student_id, course_id, attempt_no)
);
create index on eval_attempts(student_id, status);

-- Séances de travail : temps ouvert vs temps actif, mesurés par le serveur
create table work_sessions (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references students(id) on delete cascade,
  course_id      int references courses(id) on delete set null,
  kind           text not null check (kind in ('lesson','exercises','evaluation','review','other')),
  started_at     timestamptz not null default now(),
  last_beat_at   timestamptz not null default now(),
  ended_at       timestamptz,
  open_seconds   int not null default 0,
  active_seconds int not null default 0,
  idle_pauses    int not null default 0,
  was_active     boolean not null default true
);
create index on work_sessions(student_id, started_at);

-- Points de progrès
create table points_ledger (
  id         bigserial primary key,
  student_id uuid not null references students(id) on delete cascade,
  amount     int not null,
  reason     text not null,
  course_id  int references courses(id) on delete set null,
  at         timestamptz not null default now()
);
create index on points_ledger(student_id, at);

-- ───────────── Journal horodaté et chaîné ─────────────
-- Chaque ligne contient l'empreinte de la précédente (par élève) : modifier ou supprimer une ligne
-- casse la chaîne, ce que verify_activity_chain() détecte.
create table activity_log (
  id         bigserial primary key,
  student_id uuid not null references students(id) on delete cascade,
  at         timestamptz not null default clock_timestamp(),
  event      text not null,
  course_id  int references courses(id) on delete set null,
  actor_id   uuid references users(id) on delete set null,
  data       jsonb not null default '{}'::jsonb,
  prev_hash  text not null,
  hash       text not null
);
create index on activity_log(student_id, id);

create or replace function activity_log_hash(p_prev text, p_student uuid, p_at timestamptz, p_event text,
                                             p_course int, p_actor uuid, p_data jsonb)
returns text language sql immutable as $$
  select encode(sha256(convert_to(
    p_prev || '|' || p_student::text || '|' || to_char(p_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') || '|' ||
    p_event || '|' || coalesce(p_course::text,'') || '|' || coalesce(p_actor::text,'') || '|' || p_data::text, 'UTF8')), 'hex')
$$;

create or replace function activity_log_chain() returns trigger language plpgsql as $$
declare v_prev text;
begin
  perform pg_advisory_xact_lock(hashtext('activity_log:' || new.student_id::text));
  select hash into v_prev from activity_log where student_id = new.student_id order by id desc limit 1;
  new.prev_hash := coalesce(v_prev, 'ORIGINE');
  new.at := clock_timestamp();
  new.hash := activity_log_hash(new.prev_hash, new.student_id, new.at, new.event, new.course_id, new.actor_id, new.data);
  return new;
end $$;

create trigger activity_log_chain_trg before insert on activity_log
for each row execute function activity_log_chain();

-- Interdit toute modification ou suppression applicative du journal
create or replace function activity_log_readonly() returns trigger language plpgsql as $$
begin
  -- Seule exception : effacement complet des données d'un élève (droit à l'effacement RGPD),
  -- explicitement autorisé dans la transaction via set local syllig.allow_log_purge = 'on'.
  if tg_op = 'DELETE' and current_setting('syllig.allow_log_purge', true) = 'on' then
    return old;
  end if;
  raise exception 'Le journal d''activité est en lecture seule';
end $$;
create trigger activity_log_no_update before update or delete on activity_log
for each row execute function activity_log_readonly();

create or replace function verify_activity_chain(p_student uuid)
returns table(broken_ids bigint[], total bigint) language plpgsql as $$
declare r record; v_prev text := 'ORIGINE'; v_broken bigint[] := '{}'; v_total bigint := 0;
begin
  for r in select * from activity_log where student_id = p_student order by id loop
    v_total := v_total + 1;
    if r.prev_hash <> v_prev or r.hash <> activity_log_hash(r.prev_hash, r.student_id, r.at, r.event, r.course_id, r.actor_id, r.data) then
      v_broken := v_broken || r.id;
    end if;
    v_prev := r.hash;
  end loop;
  return query select v_broken, v_total;
end $$;
