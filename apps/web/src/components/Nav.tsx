export function Nav() {
  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <span className="font-mono text-sm font-bold tracking-[0.12em] text-ink">
          CAMPUSHUB
        </span>
        <a
          href="#join"
          className="font-body text-sm text-ink-soft underline-offset-4 transition-colors hover:text-pen hover:underline"
        >
          Log in
        </a>
      </div>
    </header>
  );
}
