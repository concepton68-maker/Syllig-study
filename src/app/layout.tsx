import type { Metadata, Viewport } from 'next';
// Polices intégrées au projet : aucun appel à Google, ni au build ni dans le navigateur des élèves
import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/source-serif-4';
import '@fontsource-variable/quicksand';
import './globals.css';
import { DeployGuard } from '@/components/DeployGuard';
import { DialogHost, FieldHints } from '@/components/Dialog';

export const metadata: Metadata = {
  title: { default: 'Syllig Study', template: '%s · Syllig Study' },
  description: 'Le parcours qui fait progresser.',
  robots: { index: false, follow: false },
  icons: { icon: '/favicon.svg' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

// site d'essai : un bandeau toujours visible, pour ne jamais confondre avec le site des élèves
function EssaiBanner() {
  return <div role="note" data-site-essai className="fixed top-0 inset-x-0 z-[100] bg-[#f47230] text-white text-center text-xs font-semibold py-0.5 pointer-events-none">SITE D’ESSAI · copie des données, rien n’est visible par les élèves · IA désactivée</div>;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="h-full">
      <body className="h-full">{process.env.SITE_ESSAI === '1' && <EssaiBanner />}<DeployGuard /><FieldHints />{children}<DialogHost /></body>
    </html>
  );
}
