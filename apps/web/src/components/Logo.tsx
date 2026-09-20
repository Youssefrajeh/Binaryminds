import { Link } from "react-router";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showFanshawe?: boolean;
  showTagline?: boolean;
}

export function Logo({
  className = "",
  size = "md",
  showFanshawe = true,
  showTagline = false,
}: LogoProps) {
  const iconSizeClasses = {
    sm: "h-7 w-7",
    md: "h-9.5 w-9.5",
    lg: "h-12 w-12",
  }[size];

  const textClasses = {
    sm: "text-base",
    md: "text-[19px]",
    lg: "text-2xl",
  }[size];

  return (
    <Link
      to="/"
      className={`group flex items-center gap-3 transition-opacity hover:opacity-95 ${className}`}
      aria-label="CampusHub - Fanshawe College"
    >
      {/* Dynamic Fanshawe NorthStar & Collegiate Hub Emblem */}
      <div
        className={`relative flex ${iconSizeClasses} flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#c8102e] via-[#b3122e] to-[#800b1e] shadow-md shadow-[#b3122e]/25 transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg group-hover:shadow-[#b3122e]/40`}
      >
        <svg
          viewBox="0 0 48 48"
          className="h-[76%] w-[76%] text-white transition-transform duration-300 group-hover:rotate-3"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Fanshawe NorthStar 4-Point Outward Starburst Geometry */}
          {/* North Point */}
          <path d="M24 4L27.5 14H20.5L24 4Z" fill="currentColor" opacity="0.95" />
          <path d="M27.5 10H33V13H27.5V10Z" fill="currentColor" opacity="0.85" />
          
          {/* South Point */}
          <path d="M24 44L20.5 34H27.5L24 44Z" fill="currentColor" opacity="0.95" />
          <path d="M20.5 38H15V35H20.5V38Z" fill="currentColor" opacity="0.85" />

          {/* East Point */}
          <path d="M44 24L34 27.5V20.5L44 24Z" fill="currentColor" opacity="0.95" />
          <path d="M38 27.5V33H35V27.5H38Z" fill="currentColor" opacity="0.85" />

          {/* West Point */}
          <path d="M4 24L14 20.5V27.5L4 24Z" fill="currentColor" opacity="0.95" />
          <path d="M10 20.5V15H13V20.5H10Z" fill="currentColor" opacity="0.85" />

          {/* Central Mortarboard Diamond Roof */}
          <path
            d="M24 16L13 22.5L24 29L35 22.5L24 16Z"
            fill="#ffffff"
            stroke="rgba(255,255,255,0.6)"
            strokeWidth="0.8"
          />

          {/* Central Hub Connection Node */}
          <circle cx="24" cy="24" r="3" fill="#b3122e" stroke="#ffffff" strokeWidth="1.5" />
        </svg>

        {/* Ambient Gloss Highlight */}
        <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-t from-transparent via-white/10 to-white/20 opacity-70" />
      </div>

      {/* Wordmark with Fanshawe College Integration */}
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 leading-none">
          <span className={`font-bold tracking-tight text-ink ${textClasses}`}>
            Campus<span className="text-brand">Hub</span>
          </span>
          <span className="rounded-full bg-brand-soft px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-brand uppercase">
            Fanshawe
          </span>
        </div>
        {(showFanshawe || showTagline) && (
          <span className="mt-0.5 text-[10px] font-semibold tracking-wider text-muted uppercase">
            Fanshawe College Student Portal
          </span>
        )}
      </div>
    </Link>
  );
}
