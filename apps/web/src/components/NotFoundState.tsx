import { Link } from "react-router";

interface NotFoundStateProps {
  title?: string;
  message?: string;
  backTo?: string;
  backLabel?: string;
}

export function NotFoundState({
  title = "Page not found",
  message = "The page you're looking for doesn't exist or may have been moved.",
  backTo = "/",
  backLabel = "Back to home",
}: NotFoundStateProps) {
  return (
    <section aria-labelledby="not-found-title" className="mt-6 rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
      <p className="text-sm font-semibold text-brand">404</p>
      <h1 id="not-found-title" className="mt-2 text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      <p className="mx-auto mt-3 max-w-md text-sm text-ink-soft">{message}</p>
      <Link to={backTo} className="btn-primary mt-6">{backLabel}</Link>
    </section>
  );
}
