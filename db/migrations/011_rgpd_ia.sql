-- RGPD : journal de ce qui est envoyé à une IA (consultable par le parent, purgé après la durée de conservation)
create table if not exists ai_requests (
  id         bigserial primary key,
  student_id uuid references students(id) on delete cascade,
  task       text not null,
  provider   text not null,
  model      text not null,
  eu         boolean not null,
  payload    text not null,      -- exactement ce qui a été transmis (données de l'élève, sans nom)
  error      text,
  created_at timestamptz not null default now()
);
create index if not exists ai_requests_student on ai_requests (student_id, created_at desc);
create index if not exists ai_requests_created on ai_requests (created_at);
