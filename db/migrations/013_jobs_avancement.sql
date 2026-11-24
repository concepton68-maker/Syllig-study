-- Avancement lisible d'une tâche longue (ex. « essai 1/2 · 38 % »)
alter table jobs add column if not exists progress text;
