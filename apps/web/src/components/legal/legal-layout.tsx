import Link from 'next/link';

export function LegalLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <header className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="font-display text-foreground text-lg font-semibold">
            Nexa CRM
          </Link>
          <span className="text-muted-foreground text-xs">
            Actualizado: {new Date(lastUpdated).toLocaleDateString('es-AR')}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-foreground mb-10 text-2xl font-bold">{title}</h1>
        {children}
      </main>

      <footer className="border-border mt-auto border-t">
        <div className="text-muted-foreground mx-auto flex max-w-3xl flex-wrap gap-x-6 gap-y-2 px-4 py-6 text-xs">
          <Link href="/" className="hover:text-foreground transition-colors">
            Inicio
          </Link>
          <Link href="/terminos-y-condiciones" className="hover:text-foreground transition-colors">
            Terminos y Condiciones
          </Link>
          <Link href="/politica-de-privacidad" className="hover:text-foreground transition-colors">
            Politica de Privacidad
          </Link>
          <a href="mailto:nexacrm0@gmail.com" className="hover:text-foreground transition-colors">
            Contacto
          </a>
        </div>
      </footer>
    </div>
  );
}
