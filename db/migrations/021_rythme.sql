-- Rythme de travail (décision du propriétaire, 26/11/2026) : le temps de travail ne change pas ; on mesure en plus, sans le juger,
-- la part du temps de travail avec un geste (clic, défilement, saisie) dans la minute. Les anciennes séances n'ont pas cette mesure.
alter table activity_beats add column if not exists gesture boolean;
alter table work_sessions add column if not exists gesture_seconds int;
