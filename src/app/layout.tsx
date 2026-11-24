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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="h-full">
      <body className="h-full"><DeployGuard /><FieldHints />{children}<DialogHost /></body>
    </html>
  );
}
