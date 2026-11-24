-- « Mot de passe oublié » : la demande part vers le parent (compte élève) ou vers l'administrateur (compte adulte).
create table if not exists password_requests (
  id         bigserial primary key,
  user_id    uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  done_at    timestamptz
);
create unique index if not exists password_requests_open on password_requests (user_id) where done_at is null;

-- Liens à usage unique pour choisir un nouveau mot de passe (seul le hash du jeton est gardé)
create table if not exists password_reset_tokens (
  token_hash text primary key,
  user_id    uuid not null references users(id) on delete cascade,
  created_by uuid references users(id) on delete set null,
  expires_at timestamptz not null,
  used_at    timestamptz
);
