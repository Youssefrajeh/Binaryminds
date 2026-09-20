import { Link } from "react-router";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="currentColor" aria-hidden="true">
          <path d="M12 3 2 8l10 5 10-5-10-5Zm-6 9.5v3.6c0 1.6 2.7 3.4 6 3.4s6-1.8 6-3.4v-3.6l-6 3-6-3Z" />
        </svg>
      </span>
      <span className="text-[17px] font-semibold tracking-tight text-ink">CampusHub</span>
    </Link>
  );
}
