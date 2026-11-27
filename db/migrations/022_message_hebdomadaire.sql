-- Message hebdomadaire au parent (maquette validée par le propriétaire le 27/11/2026) : chaque lundi, les faits de la semaine
-- précédente, un point à regarder ensemble et une idée ; sur l'Accueil et par e-mail (service d'envoi européen configuré par l'administrateur).
-- Format inspiré des essais contrôlés : Kraft & Rogers (2015), Bergman & Chan (2021).
-- consentement explicite : rien n'est envoyé tant que le parent n'a pas coché la case ET confirmé son adresse (lien reçu par e-mail)
alter table users add column if not exists email text;                    -- adresse confirmée
alter table users add column if not exists email_pending text;            -- adresse saisie, en attente de confirmation
alter table users add column if not exists weekly_email boolean not null default false;
create table if not exists weekly_messages (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  week_start  date not null,                     -- lundi de la semaine décrite (heure de Paris)
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  unique (student_id, week_start)
);
create table if not exists weekly_sends (
  message_id  uuid not null references weekly_messages(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  email       text not null,
  attempts    int not null default 0,
  sent_at     timestamptz,
  error       text,
  claimed_at  timestamptz,                       -- envoi en cours (évite deux envois si deux passages se chevauchent)
  next_try_at timestamptz,                       -- nouvel essai après une panne (30 min, puis 1 h, 2 h…)
  primary key (message_id, user_id)
);
