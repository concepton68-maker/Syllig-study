/** Profil scolaire commun à l'ajout et à la fiche : mois de naissance, fille/garçon, tiers-temps. */
export function profileFrom(form: FormData) {
  const y = String(form.get('birth_year') ?? ''), m = String(form.get('birth_month') ?? '');
  const g = form.get('gender');
  return {
    birth: /^\d{4}$/.test(y) ? `${y}-${/^(0[1-9]|1[0-2])$/.test(m) ? m : '01'}` : null,
    gender: g === 'fille' || g === 'garcon' ? g : null,
    extra_time: form.get('extra_time') === 'on',
  } as const;
}
