import fs from 'node:fs';
import path from 'node:path';
import { PageTitle } from '@/components/Shell';
import { Screen } from '@/components/Layout';

export const metadata = { title: 'Format et consigne IA' };

export default function FormatPage() {
  const consigne = fs.readFileSync(path.join(process.cwd(), 'content/format/consigne-generation.md'), 'utf8');
  return (
    <Screen top={<>
      <PageTitle kicker="Format syllig-course/1" title="Générer un cours avec Claude"
        sub={<>Le plus simple : dans le <a href="/contenu">catalogue</a>, cliquez sur « Préparer la consigne » à côté du cours voulu. Cette page garde la consigne générique et l’exemple, pour référence.</>}>
        <a className="btn" href="/api/contenu/exemple" download>Télécharger un cours d’exemple</a>
      </PageTitle>
    </>}>
      <section className="card">
        <div className="flex justify-between items-center mb-3"><h2 className="text-lg font-semibold">Consigne à copier dans Claude</h2></div>
        <textarea readOnly className="field font-mono text-xs min-h-[420px]" value={consigne} aria-label="Consigne de génération" />
      </section>
    </Screen>
  );
}
