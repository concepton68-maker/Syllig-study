import Link from 'next/link';

// Page introuvable (adresse inconnue en dehors des espaces)
export default function NotFound() {
  return (
    <main className="h-full flex items-center justify-center p-6 bg-[#F6F7FB]">
      <div className="card max-w-[480px] flex flex-col gap-3 text-center items-center">
        <h1 className="text-2xl font-bold m-0">Page introuvable</h1>
        <p className="muted m-0">Cette adresse n’existe pas ou plus. Ton travail, lui, est bien enregistré.</p>
        <Link className="btn btn-primary" href="/">Retour à l’accueil</Link>
      </div>
    </main>
  );
}
