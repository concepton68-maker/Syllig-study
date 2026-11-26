-- « Passer cette leçon » (demande du propriétaire, 26/11/2026) : l'élève peut passer un cours pour n'importe quelle raison,
-- sans aucune sanction (ni points en moins, ni niveau changé). Le cours passe simplement après les autres,
-- jusqu'à ce que l'élève y revienne (la date est alors effacée).
alter table course_progress add column if not exists skipped_at timestamptz;
