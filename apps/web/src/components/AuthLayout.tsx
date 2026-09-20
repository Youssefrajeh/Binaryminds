import { Link } from "react-router";
import { Logo } from "./Logo";

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Logo />
        <Link to="/" className="text-sm font-medium text-ink-soft hover:text-ink">
          Back to home
        </Link>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 pt-8 pb-16 sm:items-center sm:pt-0">
        <div className="w-full max-w-105">
          <div className="rounded-2xl border border-line bg-surface p-8 shadow-sm">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
            {subtitle && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{subtitle}</p>}
            <div className="mt-7">{children}</div>
          </div>
          {footer && <div className="mt-6 text-center text-sm text-ink-soft">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
