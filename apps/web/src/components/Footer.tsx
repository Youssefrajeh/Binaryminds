import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <Logo showTagline={true} />
          <p className="mt-2 text-xs text-muted">
            Crafted with passion by <span className="font-semibold text-ink">Binary Minds</span>
          </p>
        </div>
        <p className="max-w-md text-xs leading-relaxed text-muted">
          CampusHub is an independent student project built by and for Fanshawe College
          students. It is not operated by, endorsed by, or affiliated with Fanshawe College.
        </p>
      </div>
    </footer>
  );
}
