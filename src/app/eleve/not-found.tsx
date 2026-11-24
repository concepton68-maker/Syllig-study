import Link from 'next/link';
import { BookX } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';

// Cours retiré ou adresse inconnue : une page claire, dans l'espace élève
export default function NotFound() {
  return (
    <section className="card max-w-[720px]">
      <EmptyState icon={<BookX size={20} />} title="Cette page n’est pas disponible"
        text="Le cours a peut-être été remplacé par une nouvelle version, ou l’adresse n’est plus valable. Ton travail, lui, est bien enregistré."
        action={<Link className="btn btn-primary" href="/eleve">Retour à aujourd’hui</Link>} />
    </section>
  );
}
