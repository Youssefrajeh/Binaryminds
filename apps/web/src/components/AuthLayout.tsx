import { Link } from "react-router";

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="border-b border-rule">
        <div className="mx-auto flex max-w-5xl items-center px-6 py-4">
          <Link to="/" className="font-mono text-sm font-bold tracking-[0.12em] text-ink">
            CAMPUSHUB
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="border border-rule bg-paper px-8 py-10 shadow-sm">
            <h1 className="font-display text-3xl font-medium text-ink">{title}</h1>
            {subtitle && (
              <p className="mt-2 font-body text-sm leading-relaxed text-ink-soft">{subtitle}</p>
            )}
            <div className="mt-8">{children}</div>
          </div>
          {footer && <div className="mt-6 text-center font-body text-sm text-ink-soft">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
