import { Link } from "react-router";

interface LogoMarkProps {
  className?: string;
}

/**
 * The campus-hub mark: a roof over three connected people.
 * Colours come from the --logo-* theme tokens, so it adapts to dark mode.
 */
export function LogoMark({ className = "h-8 w-11" }: LogoMarkProps) {
  return (
    <svg viewBox="0 0 48 36" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M6 18.5L24 4L42 18.5"
        stroke="var(--logo-roof)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M15 30L24 27L33 30" stroke="var(--logo-node)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="15" cy="30" r="3.8" fill="var(--logo-node)" />
      <circle cx="33" cy="30" r="3.8" fill="var(--logo-node)" />
      <circle cx="24" cy="27" r="4.3" fill="var(--logo-accent)" />
    </svg>
  );
}

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
}

const sizes = {
  sm: { mark: "h-6 w-8", text: "text-lg" },
  md: { mark: "h-7 w-9.5", text: "text-[22px]" },
  lg: { mark: "h-10 w-13", text: "text-3xl" },
};

export function Logo({ className = "", size = "md", showTagline = false }: LogoProps) {
  const { mark, text } = sizes[size];

  return (
    <Link
      to="/"
      className={`group inline-flex items-center gap-2 transition-opacity hover:opacity-90 ${className}`}
      aria-label="campus-hub home"
    >
      <LogoMark className={`${mark} shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5`} />
      <span className="flex flex-col">
        <span className={`font-extrabold leading-none tracking-[-0.05em] text-ink ${text}`}>
          campus<span className="text-[var(--logo-accent)]">-</span>
          <span className="text-[var(--logo-hub)]">hub</span>
        </span>
        {showTagline && (
          <span className="mt-1 font-mono text-[10px] font-medium tracking-[0.18em] text-muted uppercase">
            Connect · Announcements · Lost &amp; Found
          </span>
        )}
      </span>
    </Link>
  );
}
