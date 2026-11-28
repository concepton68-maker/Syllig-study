-- Programme d'un niveau proposé par l'IA ou par Claude (maquette validée le 28/11/2026) : gardé ici le temps que
-- l'administrateur le vérifie et coche ce qu'il ajoute ; rien n'entre dans le catalogue avant sa validation.
create table if not exists programme_proposals (
  id          uuid primary key default gen_random_uuid(),
  level_code  text not null references levels(code) on delete cascade,
  source      text not null check (source in ('ia', 'claude')),
  data        jsonb not null,                -- { subjects: [{ name, chapters: [{ name, courses: [{ title, priority }] }] }] }
  created_at  timestamptz not null default now(),
  applied_at  timestamptz
);
create index if not exists programme_proposals_level on programme_proposals(level_code, created_at desc);
