-- Réglages de la plateforme (ex. l'IA de correction : fournisseur, modèle, clé chiffrée)
create table if not exists app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id) on delete set null
);
