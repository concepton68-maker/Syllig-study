'use client';
import { useActionState, useEffect, useState } from 'react';
import { expectedClass, LEVEL_OF_CLASS, pathNote, ageAt } from '@/lib/school-class';
import { addChild, resetChildPassword } from './actions';
import { THEMES } from '@/lib/settings';

function Msg({ s }: { s: { error?: string; ok?: string } | undefined }) {
  if (s?.error) return <p role="alert" className="m-0 rounded-lg bg-warm-soft text-warm-dark px-3 py-2 text-sm">{s.error}</p>;
  if (s?.ok) return <p role="status" className="m-0 rounded-lg bg-brand-soft text-brand-ink px-3 py-2 text-sm">{s.ok}</p>;
  return null;
}

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

// Profil scolaire : né(e) en (mois, année) → classe attendue proposée ; le parent garde la main (redoublement, avance).
export function BirthClassFields({ levels, birth, gender, level, extraTime, onLevel, fixedLevel }: {
  levels: { code: string; name: string }[]; birth?: string | null; gender?: string | null; level?: string; extraTime?: boolean; onLevel?: (code: string) => void;
  fixedLevel?: boolean;   // fiche de l'enfant : la classe se change dans « Dossier scolaire », ici on montre seulement l'écart
}) {
  const now = new Date();
  const [by, bm] = (birth ?? '').split('-');
  const [year, setYear] = useState(by ?? '');
  const [month, setMonth] = useState(bm ?? '');
  const [lvl, setLvl] = useState(level ?? '');
  const [touched, setTouched] = useState(!!level);
  const exp = year ? expectedClass(Number(year), now) : null;
  const suggested = exp?.name ? LEVEL_OF_CLASS[exp.name] : undefined;
  const available = suggested && levels.some(l => l.code === suggested);
  useEffect(() => { if (!touched && !fixedLevel && available) { setLvl(suggested!); onLevel?.(suggested!); } }, [suggested, available, touched, onLevel, fixedLevel]);
  const chosen = levels.find(l => l.code === lvl);
  const note = year && chosen ? pathNote(Number(year), chosen.name, now) : null;
  const years = Array.from({ length: 16 }, (_, i) => now.getFullYear() - 5 - i);
  return (
    <>
      <div className="flex flex-wrap gap-3">
        <fieldset className="flex-[1_1_180px] flex flex-col gap-1 border-0 p-0 m-0">
          <legend className="text-sm font-semibold mb-1">Fille ou garçon</legend>
          <div className="flex gap-2">
            {[['fille', 'Fille'], ['garcon', 'Garçon']].map(([v, l]) => (
              <label key={v} className="flex-1 flex items-center gap-2 field cursor-pointer"><input type="radio" name="gender" value={v} defaultChecked={gender === v} className="w-4 h-4" />{l}</label>
            ))}
          </div>
        </fieldset>
        <label className="flex-[1_1_150px] flex flex-col gap-1 text-sm font-semibold">Né(e) en
          <select className="field" name="birth_month" value={month} onChange={e => setMonth(e.target.value)}>
            <option value="">mois…</option>{MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>)}</select></label>
        <label className="flex-[1_1_120px] flex flex-col gap-1 text-sm font-semibold"><span>Année <span className="sr-only">de naissance</span></span>
          <select className="field" name="birth_year" value={year} onChange={e => setYear(e.target.value)}>
            <option value="">année…</option>{years.map(y => <option key={y} value={y}>{y}</option>)}</select></label>
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        {fixedLevel ? <span className="flex-[1_1_220px] text-sm"><span className="font-semibold block">Classe cette année</span>{chosen?.name} <span className="muted">(se change dans « Dossier scolaire »)</span></span> : <label className="flex-[1_1_220px] flex flex-col gap-1 text-sm font-semibold">Classe cette année
          <select className="field" name="level" value={lvl} required onChange={e => { setLvl(e.target.value); setTouched(true); onLevel?.(e.target.value); }}>
            <option value="" disabled>choisir…</option>{levels.map(l => <option key={l.code} value={l.code}>{l.name}{l.code === suggested ? ' · selon son âge' : ''}</option>)}</select></label>}
        <div className="flex-[2_1_280px] text-sm" data-class-hint>
          {exp && (exp.name
            ? <span>Selon son année de naissance : <strong>{exp.name}</strong> en {now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1}–{(now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1) + 1}{year && month ? ` · ${ageAt(`${year}-${month}`, now)} ans` : ''}.
                {!available && <span className="block text-warm-dark">Le programme de {exp.name} n’est pas encore sur la plateforme : choisissez la classe la plus proche.</span>}</span>
            : <span className="text-warm-dark">Âge hors de l’école primaire et secondaire.</span>)}
          {note && <span className="block muted">{note}. C’est possible : gardez la classe réelle de l’enfant.</span>}
        </div>
      </div>
      <label className="flex items-start gap-3 text-[15px]">
        <input type="checkbox" name="extra_time" defaultChecked={extraTime} className="mt-1 w-5 h-5" />
        <span><strong>Tiers-temps aux évaluations</strong><span className="block muted text-sm">Si l’enfant a un aménagement (PAP, PPS : dyslexie, TDAH…), le temps de chaque évaluation est majoré d’un tiers, comme au brevet.</span></span>
      </label>
    </>
  );
}

export function AddChildForm({ levels }: { levels: { code: string; name: string }[] }) {
  const [state, action, pending] = useActionState(addChild, undefined);
  return (
    <form action={action} method="post" className="flex flex-col gap-3" data-add-child>
      <div className="flex flex-wrap gap-3">
        <label className="flex-[1_1_180px] flex flex-col gap-1 text-sm font-semibold">Prénom<input className="field" name="first_name" required /></label>
        <label className="flex-[1_1_180px] flex flex-col gap-1 text-sm font-semibold">Thème d’affichage
          <select className="field" name="theme" defaultValue="">
            <option value="">selon fille ou garçon</option>{THEMES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      </div>
      <BirthClassFields levels={levels} />
      <div className="flex flex-wrap gap-3">
        <label className="flex-[1_1_180px] flex flex-col gap-1 text-sm font-semibold">Identifiant de connexion<input className="field" name="login" required autoComplete="off" placeholder="ex. tom" /></label>
        <label className="flex-[1_1_180px] flex flex-col gap-1 text-sm font-semibold">Mot de passe (8 caractères min.)<input className="field" name="password" type="password" required autoComplete="new-password" /></label>
      </div>
      <label className="flex items-start gap-3 text-[15px]">
        <input type="checkbox" name="entry_test" defaultChecked className="mt-1 w-5 h-5" />
        <span><strong>Commencer par le test de rentrée</strong><span className="block muted text-sm">25 à 30 minutes sur les bases des années précédentes, non noté, corrigé automatiquement (sans IA). Il donne un score par matière et la liste des questions ratées : des pistes pour savoir par où commencer.</span></span>
      </label>
      <Msg s={state} />
      <div><button className="btn btn-primary" type="submit" disabled={pending}>Créer le compte</button></div>
    </form>
  );
}

export function ResetForm({ studentId }: { studentId: string }) {
  const [state, action, pending] = useActionState(resetChildPassword, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="student" value={studentId} />
      <label className="flex flex-col gap-1 text-sm font-semibold">Nouveau mot de passe<input className="field" name="password" type="password" required autoComplete="new-password" /></label>
      <button className="btn" type="submit" disabled={pending}>Modifier</button>
      <div className="basis-full"><Msg s={state} /></div>
    </form>
  );
}
