import { useLayoutEffect, useRef, type CSSProperties } from "react";
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
  /** Letters drop in on a loop (the hyphen bounces in last) and wave on hover */
  animated?: boolean;
}

const wordmark = [
  ..."campus".split("").map((ch) => ({ ch, className: "" })),
  { ch: "-", className: "logo-dash text-[var(--logo-accent)]" },
  ..."hub".split("").map((ch) => ({ ch, className: "text-[var(--logo-hub)]" })),
];
const DASH = 6;

/** Length of one full performance; the settled logo holds for the rest of the cycle */
const CYCLE_MS = 11_000;

/** Each letter falls and squashes on landing */
function drop(el: HTMLElement, delay: number): Animation {
  return el.animate(
    [
      { transform: "translateY(-1.6em) scale(.88,1.18)", opacity: 0, easing: "cubic-bezier(.55,0,1,.45)" },
      { offset: 0.5, transform: "translateY(0) scale(1.28,.68)", opacity: 1, easing: "cubic-bezier(.2,.7,.4,1)" },
      { offset: 0.7, transform: "translateY(-.2em) scale(.93,1.09)", easing: "cubic-bezier(.55,0,1,.45)" },
      { offset: 0.84, transform: "translateY(0) scale(1.09,.92)", easing: "ease-out" },
      { offset: 0.93, transform: "translateY(0) scale(.98,1.02)" },
      { transform: "none", opacity: 1 },
    ],
    // "backwards" keeps letters hidden while they wait; no fill afterwards so the hover wave still works
    { duration: 1000, delay, fill: "backwards" },
  );
}

/** The hyphen rolls in from the right, bouncing, then hops into place */
function rollIn(el: HTMLElement, delay: number): Animation {
  // [offset, x(em), y(em), rotate(deg), scaleX, scaleY]
  const pts = [
    [0, 4.5, -1.3, 900, 0.9, 1.15],
    [0.16, 3.1, 0, 540, 1.35, 0.62],
    [0.29, 2.2, -0.75, 360, 0.9, 1.12],
    [0.41, 1.45, 0, 180, 1.3, 0.7],
    [0.52, 0.8, -0.42, 90, 0.95, 1.08],
    [0.61, 0.22, 0, 0, 1.25, 0.74],
    [0.67, -0.14, -0.11, -8, 0.97, 1.04],
    [0.73, 0, 0, 0, 1.12, 0.88],
    [0.8, 0, -0.55, 0, 0.9, 1.16],
    [0.89, 0, 0, 0, 1.22, 0.76],
    [0.95, 0, 0, 0, 0.96, 1.04],
    [1, 0, 0, 0, 1, 1],
  ];
  return el.animate(
    pts.map(([offset, x, y, r, sx, sy], i) => ({
      offset,
      transform: `translate(${x}em,${y}em) rotate(${r}deg) scale(${sx},${sy})`,
      opacity: i === 0 ? 0 : 1,
      easing: y < 0 ? "cubic-bezier(.45,0,.9,.5)" : "cubic-bezier(.15,.6,.45,1)",
    })),
    { duration: 2700, delay, fill: "backwards" },
  );
}

/** Neighbours flinch when the hyphen lands next to them */
function startle(el: HTMLElement, delay: number, dir: number): Animation {
  return el.animate(
    [
      { transform: "none" },
      { offset: 0.25, transform: `translate(${dir * 0.04}em,-.12em) rotate(${dir * 6}deg) scale(.95,1.07)` },
      { offset: 0.55, transform: "scale(1.06,.94)" },
      { transform: "none" },
    ],
    { duration: 520, delay, easing: "ease-out" },
  );
}

/** The hyphen glances left and right, then glows */
function lookAround(el: HTMLElement, delay: number): Animation[] {
  const look = el.animate(
    [
      { transform: "none" },
      { offset: 0.2, transform: "rotate(-14deg) scale(.96,1.08)" },
      { offset: 0.42, transform: "rotate(-14deg) scale(.96,1.08)" },
      { offset: 0.6, transform: "rotate(12deg) scale(.96,1.08)" },
      { offset: 0.78, transform: "rotate(12deg) scale(.96,1.08)" },
      { offset: 0.9, transform: "scale(1.1,.9)" },
      { transform: "none" },
    ],
    { duration: 1500, delay, easing: "ease-in-out" },
  );
  const glow = el.animate(
    [
      { filter: "drop-shadow(0 0 0 transparent)" },
      { offset: 0.5, filter: "drop-shadow(0 0 .18em color-mix(in srgb, var(--logo-accent) 85%, transparent))" },
      { filter: "drop-shadow(0 0 0 transparent)" },
    ],
    { duration: 1400, delay: delay + 1500, easing: "ease-in-out" },
  );
  return [look, glow];
}

function AnimatedWordmark() {
  const letters = useRef<(HTMLSpanElement | null)[]>([]);

  // Layout effect so letters are hidden before the first paint, not after a flash
  useLayoutEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const els = letters.current.filter((el): el is HTMLSpanElement => el !== null);
    // jsdom (tests) and very old browsers have no Web Animations API
    if (els.length !== wordmark.length || typeof els[0].animate !== "function") return;
    const campus = els.slice(0, DASH);
    const hub = els.slice(DASH + 1);
    const dash = els[DASH];
    const land = 2600 + Math.round(0.89 * 2700);

    let anims: Animation[] = [];
    let timer: ReturnType<typeof setTimeout>;

    function play() {
      anims.forEach((a) => a.cancel());
      anims = [
        ...campus.map((el, i) => drop(el, 300 + i * 115)),
        ...hub.map((el, i) => drop(el, 1300 + i * 130)),
        rollIn(dash, 2600),
        startle(campus[campus.length - 1], land - 60, -1),
        startle(hub[0], land - 60, 1),
        startle(campus[campus.length - 2], land + 60, -1),
        startle(hub[1], land + 60, 1),
        ...lookAround(dash, land + 700),
      ];
      timer = setTimeout(play, CYCLE_MS);
    }

    play();
    return () => {
      clearTimeout(timer);
      anims.forEach((a) => a.cancel());
    };
  }, []);

  return (
    <span>
      {wordmark.map(({ ch, className }, i) => (
        <span
          key={i}
          ref={(el) => {
            letters.current[i] = el;
          }}
          className={`logo-letter ${className}`}
          style={{ "--i": i } as CSSProperties}
        >
          {ch}
        </span>
      ))}
    </span>
  );
}

const sizes = {
  sm: { mark: "h-6 w-8", text: "text-lg" },
  md: { mark: "h-7 w-9.5", text: "text-[22px]" },
  lg: { mark: "h-10 w-13", text: "text-3xl" },
};

export function Logo({ className = "", size = "md", showTagline = false, animated = false }: LogoProps) {
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
          {animated ? (
            <AnimatedWordmark />
          ) : (
            <>
              campus<span className="text-[var(--logo-accent)]">-</span>
              <span className="text-[var(--logo-hub)]">hub</span>
            </>
          )}
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
