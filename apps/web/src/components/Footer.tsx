import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 md:flex-row md:items-start md:justify-between">
        <Logo />
        <p className="max-w-md text-sm leading-relaxed text-muted">
          CampusHub is an independent student project built by and for Fanshawe College
          students. It is not operated by, endorsed by, or affiliated with Fanshawe College.
        </p>
      </div>
    </footer>
  );
}
