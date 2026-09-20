import { Link } from "react-router";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
}

export function Logo({ className = "", size = "md", showTagline = false }: LogoProps) {
  const iconSizeClasses = {
    sm: "h-7 w-7",
    md: "h-9 w-9",
    lg: "h-11 w-11",
  }[size];

  const textClasses = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-2xl",
  }[size];

  return (
    <Link
      to="/"
      className={`group flex items-center gap-3 transition-opacity hover:opacity-95 ${className}`}
      aria-label="CampusHub Home"
    >
      {/* Dynamic Emblem with Gradient & Glow */}
      <div
        className={`relative flex ${iconSizeClasses} flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#b3122e] via-[#c41634] to-[#8f0e24] shadow-md shadow-brand/20 transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg group-hover:shadow-brand/35`}
      >
        <svg
          viewBox="0 0 40 40"
          className="h-[72%] w-[72%] text-white transition-transform duration-300 group-hover:rotate-1"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Mortarboard Diamond Roof */}
          <path
            d="M20 7L6 14L20 21L34 14L20 7Z"
            fill="currentColor"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="0.8"
            strokeLinejoin="round"
          />

          {/* Tassel */}
          <path
            d="M30 16.5V23.5M30 23.5C29 23.5 28.5 24 28.5 25C28.5 26 29 26.5 30 26.5C31 26.5 31.5 26 31.5 25C31.5 24 31 23.5 30 23.5Z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />

          {/* Connected Collegiate Arch & CH Bridge */}
          <path
            d="M11 18.5V26.5C11 29.8 14.5 32.5 20 32.5C25.5 32.5 29 29.8 29 26.5V21"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />

          {/* Central Hub Connection Node */}
          <circle cx="20" cy="24.5" r="2.2" fill="#fff" />
          <path
            d="M15.5 24.5H24.5"
            stroke="#fff"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>

        {/* Ambient Gloss Highlight */}
        <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-t from-transparent via-white/10 to-white/20 opacity-60" />
      </div>

      {/* Wordmark */}
      <div className="flex flex-col">
        <span className={`font-bold tracking-tight text-ink ${textClasses} leading-none`}>
          Campus<span className="text-brand">Hub</span>
        </span>
        {showTagline && (
          <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted">
            Fanshawe Student Network
          </span>
        )}
      </div>
    </Link>
  );
}
