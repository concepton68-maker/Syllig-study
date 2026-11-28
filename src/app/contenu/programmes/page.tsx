import Link from 'next/link';
import { AiButton } from '@/app/parent/a-faire/AiButton';
import { sql } from '@/lib/db';
import { PaneScreen, Panes, Pane } from '@/components/Layout';
import { BulkBar, BulkCheck } from '@/components/Bulk';
import { LEVEL_CATALOG, subjectsFor } from '@/lib/levels-catalog';
import { PickList, PickPopover } from '@/components/PickList';
import { aiOverview } from '@/lib/ai';
import { activateAction, proposeAiAction, proposeImportAction, deactivateAction, removeAction, addLevelAction, addSubjectAction, addChapterAction, addCourseAction, renameAction, importProgrammeAction } from './actions';

export const metadata = { title: 'Programmes' };
export const dynamic = 'force-dynamic';

type Lvl = { code: string; name: string; cycle: string | null; active: boolean; subjects: number; courses: number; published: number; students: number };
type Sub = { id: number; name: string; active: boolean; courses: number; published: number };
type Chap = { id: number; subject_id: number; name: string; active: boolean };
type Co = { id: number; chapter_id: number; title: string; code: string | null; published: boolean; draft: boolean };

const BULK = (_kind: string, _niveau: string, feminine = false) => [
  { label: 'Activer', action: activateAction },
  { label: 'Désactiver', action: deactivateAction, confirm: `Désactiver {n} ? ${feminine ? 'Elles' : 'Ils'} ne seront plus visibles pour les élèves ; rien n’est effacé.` },
  { label: 'Supprimer', action: removeAction, tone: 'danger' as const, confirm: `Supprimer {n} ? Ce qui a déjà servi (cours rédigés, élèves inscrits ou qui ont commencé) sera seulement désactivé : les notes et le dossier scolaire restent.` },
];

// Niveaux, matières, chapitres et cours (maquette validée le 28/11/2026) : ajouter, renommer, activer, désactiver, supprimer, importer
export default async function Programmes({ searchParams }: { searchParams: Promise<{ niveau?: string; fait?: string; erreur?: string }> }) {
  const sp = await searchParams;
  const levels = await sql<Lvl[]>`
    select l.code, l.name, l.cycle, l.active,
      (select count(*)::int from subjects s where s.level_code = l.code and s.removed_at is null) as subjects,
      (select count(*)::int from courses c join chapters ch on ch.id = c.chapter_id join subjects s on s.id = ch.subject_id
         where s.level_code = l.code and c.removed_at is null and ch.removed_at is null and s.removed_at is null) as courses,
      (select count(distinct c.id)::int from courses c join chapters ch on ch.id = c.chapter_id join subjects s on s.id = ch.subject_id
         join course_versions v on v.course_id = c.id and v.status = 'published' where s.level_code = l.code and c.removed_at is null and ch.removed_at is null and s.removed_at is null) as published,
      (select count(*)::int from students st where st.level_code = l.code) as students
    from levels l where l.removed_at is null order by l.position, l.name`;
  const cur = levels.find(l => l.code === sp.niveau) ?? levels[0];
  const subs = cur ? await sql<Sub[]>`
    select s.id, s.name, s.active,
      (select count(*)::int from courses c join chapters ch on ch.id = c.chapter_id where ch.subject_id = s.id and c.removed_at is null and ch.removed_at is null) as courses,
      (select count(distinct c.id)::int from courses c join chapters ch on ch.id = c.chapter_id join course_versions v on v.course_id = c.id and v.status = 'published'
         where ch.subject_id = s.id and c.removed_at is null and ch.removed_at is null) as published
    from subjects s where s.level_code = ${cur.code} and s.removed_at is null order by s.position, s.name` : [];
  const chaps = subs.length ? await sql<Chap[]>`select id, subject_id, name, active from chapters where subject_id in ${sql(subs.map(s => s.id))} and removed_at is null order by position, name` : [];
  const cos = chaps.length ? await sql<Co[]>`select c.id, c.chapter_id, c.title, c.code,
      exists (select 1 from course_versions v where v.course_id = c.id and v.status = 'published') as published,
      exists (select 1 from course_versions v where v.course_id = c.id and v.status = 'draft') as draft
    from courses c where c.chapter_id in ${sql(chaps.map(c => c.id))} and c.removed_at is null order by c.position` : [];
  const niv = cur?.code ?? '';
  // niveaux de la liste officielle pas encore présents (un niveau supprimé peut être rétabli)
  const present = new Set(levels.map(l => l.code));
  const missing = LEVEL_CATALOG.filter(l => !present.has(l.code));
  // matières de la liste du niveau, pas encore présentes
  const freeSubjects = subjectsFor(niv).filter(n => !subs.some(s => s.name === n));
  const aiProg = (await aiOverview()).ready.programme;
  const off = (a: boolean) => a ? '' : 'opacity-60';
  const pill = (a: boolean) => <span className={`text-xs font-bold ${a ? 'text-brand-dark' : 'muted'}`}>{a ? 'Actif' : 'Désactivé'}</span>;
  const Rename = ({ kind, id, value, choices }: { kind: string; id: string | number; value: string; choices?: string[] }) => (
    <details className="relative"><summary className="text-[13px] font-semibold text-brand-dark cursor-pointer list-none">Renommer</summary>
      <form action={renameAction} className="absolute right-0 z-20 mt-1 flex gap-1.5 bg-white border border-line rounded-xl p-2 shadow-lg">
        <input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={id} /><input type="hidden" name="niveau" value={niv} />
        {choices ? <select className="field !min-h-9 !py-1 text-sm w-60" name="name" defaultValue={value} aria-label="Nouveau nom">
          {[value, ...choices].map(n => <option key={n}>{n}</option>)}</select>
          : <input className="field !min-h-9 !py-1 text-sm w-60" name="name" defaultValue={value} aria-label="Nouveau nom" required />}
        <button className="btn btn-sm btn-primary" type="submit">OK</button></form></details>);
  return (
    <PaneScreen top={<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <h1 className="m-0 text-[22px] font-bold">Programmes</h1>
      <span className="text-[13px] muted">Ce qui est désactivé disparaît pour les élèves, sans rien effacer.</span>
      <span className="flex-1" />
      <details className="relative"><summary className="btn btn-sm cursor-pointer list-none">Importer un programme (fichier)</summary>
        <form action={importProgrammeAction} className="absolute right-0 z-20 mt-1 w-[340px] flex flex-col gap-2 bg-white border border-line rounded-xl p-3 shadow-lg text-sm" data-import-programme>
          <input type="hidden" name="niveau" value={niv} />
          <span>Fichier au format <code>programme.json</code> (niveau, matières, chapitres, cours). Ce qui existe déjà ne change pas.</span>
          <input type="file" name="file" accept=".json,application/json" className="text-xs" />
          <button className="btn btn-primary btn-sm self-start" type="submit">Importer</button></form></details>
      {sp.fait && <p role="status" className="basis-full m-0 rounded-xl bg-brand-soft text-brand-ink px-4 py-2 text-sm" data-done>{sp.fait}</p>}
      {sp.erreur && <p role="alert" className="basis-full m-0 rounded-xl bg-warm-soft text-warm-dark px-4 py-2 text-sm">{sp.erreur}</p>}
    </div>}>
      <Panes>
        <Pane className="flex-[1_1_280px] lg:max-w-[320px]">
          <section className="card !p-0 flex flex-col" aria-label="Niveaux" data-levels>
            <details className="px-3 py-2.5 border-b border-line" data-add-levels-box>
              <summary className="flex items-center justify-between gap-2 cursor-pointer list-none"><strong>Niveaux</strong><span className="btn btn-sm">+ Ajouter</span></summary>
              <div className="mt-2 -mx-3 border-y border-line bg-white" data-add-levels>
                {missing.length ? <PickList id="add-levels" title="Niveaux à ajouter" nounPlural="niveaux" action={addLevelAction} hidden={{ niveau: niv }}
                  items={missing.map(l => ({ value: l.code, label: l.name, group: l.cycle }))} />
                  : <span className="block px-4 py-3 text-sm muted">Tous les niveaux sont déjà là.</span>}
              </div>
            </details>
            {levels.map(l => (
              <div key={l.code} className={`grid grid-cols-[22px_minmax(0,1fr)_auto] gap-2 items-center px-3 py-2.5 border-t border-soft first:border-t-0 ${l.code === niv ? 'bg-brand-soft' : ''}`} data-level={l.code}>
                <BulkCheck formId="bulk-levels" value={l.code} label={l.name} />
                <Link href={`/contenu/programmes?niveau=${l.code}`} className={`no-underline text-ink min-w-0 ${off(l.active)}`}><strong className="block truncate">{l.name}</strong>
                  <span className="block text-xs muted">{l.subjects} matière{l.subjects > 1 ? 's' : ''} · {l.published} / {l.courses} cours · {l.students} élève{l.students > 1 ? 's' : ''}</span></Link>
                <span className="flex flex-col items-end gap-0.5">{pill(l.active)}<Rename kind="level" id={l.code} value={l.name} /></span>
              </div>
            ))}
            <div className="p-2 border-t border-line"><BulkBar formId="bulk-levels" noun="niveau" hidden={{ kind: 'level', niveau: niv }} actions={BULK('level', niv)} /></div>
          </section>
        </Pane>
        <Pane className="flex-[999_1_560px]">
          {cur && cur.courses === 0 && subjectsFor(niv).length > 0 && <section className="card flex flex-col gap-4 !p-6" data-empty-programme={niv}>
            <div className="flex flex-col gap-1.5">
              <h2 className="m-0 text-[22px] font-bold">{cur.name} n’a pas encore de programme</h2>
              <span className="text-[15px]">Le programme, c’est la liste des matières, de leurs chapitres et des cours à faire. Une fois ajouté, chaque cours apparaît dans le catalogue, prêt à être rédigé.</span>
            </div>
            <div className="grid gap-3.5 md:grid-cols-2">
              <form action={proposeAiAction} className="flex flex-col gap-2 p-4 rounded-2xl border-2 border-brand bg-brand-soft" data-propose-ai>
                <input type="hidden" name="niveau" value={niv} />
                <strong className="text-[17px]">Le faire proposer par l’IA</strong>
                <span className="text-sm">L’IA propose le programme officiel de {cur.name} : matières, chapitres et cours. Tu vérifies, tu retires ce qui ne va pas, puis tu l’ajoutes.</span>
                {aiProg ? <><span className="self-start mt-1"><AiButton n={0} label="Proposer le programme" busy="Proposition en cours… (environ 1 minute)" /></span>
                  <span className="text-xs muted">Aucune donnée d’élève n’est envoyée. Environ 1 minute.</span></>
                  : <span className="text-sm muted">Aucune IA prête pour la rédaction des cours : <Link href="/contenu/ia">configurer l’IA</Link>, ou passer par Claude ci-contre.</span>}
              </form>
              <div className="flex flex-col gap-2 p-4 rounded-2xl border border-line-strong" data-propose-claude>
                <strong className="text-[17px]">Le faire préparer par Claude (sans clé)</strong>
                <span className="text-sm">Un fichier avec la consigne se télécharge ; tu le donnes à Claude, il renvoie le programme ; tu l’importes ici.</span>
                <span className="flex flex-wrap gap-2 mt-1">
                  <a className="btn" href={`/api/contenu/programme-consigne?niveau=${niv}`} download data-consigne>Télécharger la consigne</a>
                  <details className="relative"><summary className="btn cursor-pointer list-none">Importer sa réponse</summary>
                    <form action={proposeImportAction} className="absolute left-0 z-20 mt-1 w-[340px] flex flex-col gap-2 bg-white border border-line rounded-xl p-3 shadow-lg text-sm" data-import-reply>
                      <input type="hidden" name="niveau" value={niv} />
                      <span>Dépose le fichier renvoyé par Claude, ou colle sa réponse.</span>
                      <input type="file" name="file" accept=".json,.txt,application/json,text/plain" className="text-xs" />
                      <textarea name="text" className="field text-xs min-h-24" placeholder="{ &quot;subjects&quot;: [ … ] }" aria-label="Réponse de Claude" />
                      <button className="btn btn-primary btn-sm self-start" type="submit">Vérifier la proposition</button></form></details>
                </span>
              </div>
            </div>
            <span className="text-[13px] muted">Ou à la main : « + Ajouter des matières », puis dans chaque matière ses chapitres et ses cours.</span>
          </section>}
          {cur && <section className="card !p-0 flex flex-col" aria-label={`Matières de ${cur.name}`} data-subjects>
            <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-b border-line">
              <strong>{cur.name} · matières</strong><span className="flex-1" />
              {freeSubjects.length ? <PickPopover id="add-subjects" label="+ Ajouter des matières" title={`Matières à ajouter en ${cur.name}`} nounPlural="matières"
                action={addSubjectAction} hidden={{ niveau: niv }} items={freeSubjects.map(n => ({ value: n, label: n }))} />
                : <span className="text-sm muted">{subjectsFor(niv).length ? 'Toutes les matières de la liste sont là.' : ''}</span>}
            </div>
            {subs.length === 0 && <span className="muted text-sm p-4">Aucune matière pour l’instant.</span>}
            {subs.map(s => {
              const sc = chaps.filter(c => c.subject_id === s.id);
              return (
                <div key={s.id} className="border-t border-soft first:border-t-0" data-subject={s.name}>
                  <div className="grid grid-cols-[22px_minmax(0,1fr)_auto_auto_auto] gap-3 items-center px-3 py-2 text-sm">
                    <BulkCheck formId="bulk-subjects" value={s.id} label={s.name} />
                    <strong className={`truncate ${off(s.active)}`}>{s.name}</strong>
                    <span className="muted text-[13px] whitespace-nowrap">{s.published} / {s.courses} cours publiés</span>
                    {pill(s.active)}<Rename kind="subject" id={s.id} value={s.name} choices={freeSubjects} />
                  </div>
                  <details className="px-3 pb-2 group" data-subject-details>
                    <summary className="text-[13px] font-semibold text-brand-dark cursor-pointer pl-[34px]">{sc.length} chapitre{sc.length > 1 ? 's' : ''} : voir, ajouter, retirer</summary>
                    <div className="pl-[34px] pt-2 flex flex-col gap-2 text-[13px]">
                      {sc.map(ch => {
                        const cc = cos.filter(c => c.chapter_id === ch.id);
                        return (
                          <div key={ch.id} className="rounded-xl border border-line p-2.5 flex flex-col gap-1.5" data-chapter={ch.name}>
                            <div className="flex flex-wrap items-center gap-2"><BulkCheck formId={`bulk-ch-${s.id}`} value={ch.id} label={ch.name} />
                              <strong className={`flex-1 min-w-0 ${off(ch.active)}`}>{ch.name}</strong>{pill(ch.active)}<Rename kind="chapter" id={ch.id} value={ch.name} /></div>
                            <ul className="list-none m-0 p-0 pl-7 flex flex-col gap-1">
                              {cc.map(c => <li key={c.id} className="flex items-center gap-2" data-course={c.title}><BulkCheck formId={`bulk-co-${s.id}`} value={c.id} label={c.title} />
                                <span className="muted w-14">{c.code ?? '—'}</span><span className="flex-1 min-w-0 truncate">{c.title}</span>
                                <span className="muted">{c.published ? 'publié' : c.draft ? 'à relire' : 'à rédiger'}</span></li>)}
                            </ul>
                            <form action={addCourseAction} className="flex gap-1.5 pl-7"><input type="hidden" name="niveau" value={niv} /><input type="hidden" name="chapter" value={ch.id} />
                              <input className="field !min-h-8 !py-0.5 text-[13px] flex-1" name="name" placeholder="Ajouter un cours (titre)" aria-label={`Nouveau cours dans ${ch.name}`} required />
                              <button className="btn btn-sm" type="submit">Ajouter</button></form>
                          </div>
                        );
                      })}
                      <form action={addChapterAction} className="flex gap-1.5"><input type="hidden" name="niveau" value={niv} /><input type="hidden" name="subject" value={s.id} />
                        <input className="field !min-h-8 !py-0.5 text-[13px] flex-1" name="name" placeholder="Ajouter un chapitre" aria-label={`Nouveau chapitre en ${s.name}`} required />
                        <button className="btn btn-sm" type="submit">Ajouter</button></form>
                      {sc.length > 0 && <BulkBar formId={`bulk-ch-${s.id}`} noun="chapitre" hidden={{ kind: 'chapter', niveau: niv }} actions={BULK('chapter', niv)} />}
                      {cos.some(c => sc.some(ch => ch.id === c.chapter_id)) && <BulkBar formId={`bulk-co-${s.id}`} noun="cours" hidden={{ kind: 'course', niveau: niv }}
                        actions={[{ label: 'Retirer', action: removeAction, tone: 'danger' as const, confirm: 'Retirer {n} du programme ? Ils ne seront plus proposés aux élèves ; l’historique de ceux qui les ont faits est gardé.' }]} />}
                    </div>
                  </details>
                </div>
              );
            })}
            {subs.length > 0 && <div className="p-2 border-t border-line"><BulkBar formId="bulk-subjects" noun="matière" feminine hidden={{ kind: 'subject', niveau: niv }} actions={BULK('subject', niv, true)} /></div>}
          </section>}
        </Pane>
      </Panes>
    </PaneScreen>
  );
}
