export type MascotMood = "idle" | "watching" | "hiding" | "peeking" | "error" | "success";

interface LoginMascotProps {
  mood: MascotMood;
  /** 0 = looking left, 1 = looking right; used while the email is typed */
  lookAt?: number;
}

/**
 * "Hub", the campus-hub logo as a character: the roof is its hat, the two dark
 * dots are its eyes and the orange dot is its nose. It follows the email as you
 * type, covers its eyes for the password, and peeks when the password is shown.
 */
export function LoginMascot({ mood, lookAt = 0.5 }: LoginMascotProps) {
  const covering = mood === "hiding" || mood === "peeking";

  // Eyes drift toward the text being typed, and look down at the form
  const eyeX = mood === "watching" ? -7 + 14 * Math.min(Math.max(lookAt, 0), 1) : 0;
  const eyeY = mood === "watching" ? 4 : mood === "error" ? 2 : 0;

  const mouth = {
    idle: "M70 103 Q80 110 90 103",
    watching: "M72 104 Q80 108 88 104",
    hiding: "M73 105 Q80 107 87 105",
    peeking: "M75 104 Q80 110 85 104 Q80 101 75 104",
    error: "M70 108 Q80 100 90 108",
    success: "M66 100 Q80 116 94 100",
  }[mood];

  return (
    <svg
      viewBox="0 0 160 130"
      className={`mascot h-32 w-40 ${mood === "error" ? "mascot-shake" : ""} ${mood === "success" ? "mascot-bounce" : ""}`}
      aria-hidden="true"
    >
      {/* Head */}
      <rect x="30" y="46" width="100" height="78" rx="22" fill="var(--surface)" stroke="var(--line)" strokeWidth="2.5" />

      {/* Cheeks */}
      <ellipse cx="46" cy="98" rx="8" ry="5" fill="var(--brand-soft)" />
      <ellipse cx="114" cy="98" rx="8" ry="5" fill="var(--brand-soft)" />

      {/* Eyes (the logo's two dark dots) */}
      <g className="mascot-move" style={{ transform: `translate(${eyeX}px, ${eyeY}px)` }}>
        <g className="mascot-blink">
          <circle cx="58" cy="78" r="8.5" fill="var(--logo-node)" />
          <circle cx="102" cy="78" r="8.5" fill="var(--logo-node)" />
          <circle cx="61" cy="75" r="2.6" fill="var(--surface)" />
          <circle cx="105" cy="75" r="2.6" fill="var(--surface)" />
        </g>
      </g>

      {/* Nose (the logo's orange dot) */}
      <circle cx="80" cy="90" r="6.5" fill="var(--logo-accent)" />

      {/* Mouth */}
      <path d={mouth} fill="none" stroke="var(--logo-node)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="mascot-mouth" />

      {/* Roof hat */}
      <path d="M20 58L80 14L140 58" fill="none" stroke="var(--logo-roof)" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />

      {/* Hands: below the head until the password field is focused */}
      <g
        className="mascot-move"
        style={{ transform: covering ? "translate(0px, 0px)" : "translate(-10px, 80px)" }}
      >
        <Hand cx={58} cy={80} />
      </g>
      <g
        className="mascot-move"
        style={{
          transform: !covering
            ? "translate(10px, 80px)"
            : mood === "peeking"
              ? "translate(5px, 17px)"
              : "translate(0px, 0px)",
        }}
      >
        <Hand cx={102} cy={80} />
      </g>
    </svg>
  );
}

function Hand({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx="19" ry="15" fill="var(--logo-roof)" />
      <path
        d={`M${cx - 8} ${cy - 13}v9M${cx} ${cy - 15}v10M${cx + 8} ${cy - 13}v9`}
        stroke="var(--surface)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.55"
      />
    </g>
  );
}
