interface AvatarProps {
  name: string;
  src?: string | null;
  className?: string;
}

function initials(name: string) {
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

export function Avatar({ name, src, className = "h-10 w-10 text-sm" }: AvatarProps) {
  if (src) {
    return <img src={src} alt={name} className={`${className} shrink-0 rounded-full object-cover`} />;
  }

  return (
    <span
      aria-label={name}
      role="img"
      className={`${className} inline-flex shrink-0 select-none items-center justify-center rounded-full bg-brand-soft font-semibold text-brand`}
    >
      {initials(name)}
    </span>
  );
}
