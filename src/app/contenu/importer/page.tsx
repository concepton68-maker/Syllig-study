import Link from 'next/link';
import { PageTitle } from '@/components/Shell';
import { ImportForm } from './ImportForm';
import { Screen } from '@/components/Layout';

export const metadata = { title: 'Importer un cours' };

export default function ImportPage() {
  return (
    <Screen top={<>
      <PageTitle kicker="Import" title="Importer des cours"
        sub={<>Le fichier est contrôlé puis enregistré en <strong>brouillon</strong>. Rien n’est visible par les élèves avant la publication.</>} />
    </>}>
      <ImportForm />
      <p className="muted text-sm">Format attendu et consigne à donner à Claude : <Link href="/contenu/format">Format et consigne IA</Link>.</p>
    </Screen>
  );
}
