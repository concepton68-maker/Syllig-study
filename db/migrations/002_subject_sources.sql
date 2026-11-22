-- Références officielles du programme par matière (servent au générateur de consignes)
alter table subjects add column if not exists official_sources jsonb not null default '[]'::jsonb;
alter table levels add column if not exists general_sources jsonb not null default '[]'::jsonb;
