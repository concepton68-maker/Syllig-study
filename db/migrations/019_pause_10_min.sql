-- Temps de travail (décision du propriétaire, 26/11/2026) : l'élève peut écrire au brouillon ou réfléchir sans toucher l'écran.
-- Le temps compte tant que la page de travail est au premier plan ; il s'arrête si la page est cachée ou après 10 min sans geste.
update students set settings = settings || '{"idle_seconds": 600}'::jsonb
  where coalesce((settings->>'idle_seconds')::int, 0) < 300;
