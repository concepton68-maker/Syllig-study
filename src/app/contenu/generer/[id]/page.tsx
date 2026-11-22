import { notFound } from 'next/navigation';
import Link from 'next/link';
import { promptContext } from '@/lib/prompt-context';
import { PageTitle } from '@/components/Shell';
import { Generator } from './Generator';

export const metadata = { title: 'Générer une consigne' };
export const dynamic = 'force-dynamic';

export default async function GeneratePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const courseId = Number(id);
  if (!Number.isInteger(courseId)) notFound();
  const ctx = await promptContext(courseId);
  if (!ctx) notFound();
  return (
    <>
      <PageTitle kicker={`${ctx.subject} · ${ctx.chapter} · ${ctx.code}`} title={`Consigne Claude : ${ctx.title}`}
        sub={ctx.isNewVersion ? 'Ce cours est déjà publié : la consigne demandera une nouvelle version complète, à relire avant publication.' : 'La fiche du cours, le programme officiel, les cours voisins et les compétences existantes sont déjà intégrés.'}>
        <Link className="btn" href="/contenu">‹ Catalogue</Link>
      </PageTitle>
      <Generator ctx={ctx} />
    </>
  );
}
