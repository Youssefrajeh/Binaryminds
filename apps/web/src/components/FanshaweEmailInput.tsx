import { useEffect, useId, useRef, useState, type FocusEventHandler } from "react";
import {
  FANSHAWE_EMAIL_DOMAIN,
  FANSHAWE_EMAIL_ERROR,
  FANSHAWE_ID_ERROR,
  FANSHAWE_ID_PATTERN,
  fanshaweEmailFor,
  normalizeFanshaweId,
} from "@campushub/shared";

const SUFFIX = `@${FANSHAWE_EMAIL_DOMAIN}`;
const suffixAtEnd = new RegExp(`${SUFFIX.replace(/\./g, "\\.")}$`, "i");

/**
 * Reads what is in the box, whether typed, pasted or autofilled. A full
 * Fanshawe address keeps only the ID; any other domain is left as entered so
 * the student can see what went wrong.
 */
function readId(raw: string): { text: string; error: string } {
  const trimmed = raw.trim();
  if (suffixAtEnd.test(trimmed)) {
    const text = normalizeFanshaweId(trimmed.replace(suffixAtEnd, ""));
    return { text, error: text && !FANSHAWE_ID_PATTERN.test(text) ? FANSHAWE_ID_ERROR : "" };
  }
  if (trimmed.includes("@")) return { text: raw, error: FANSHAWE_EMAIL_ERROR };
  const text = normalizeFanshaweId(trimmed);
  return { text, error: text && !FANSHAWE_ID_PATTERN.test(text) ? FANSHAWE_ID_ERROR : "" };
}

function idFrom(email: string) {
  return suffixAtEnd.test(email) ? email.replace(suffixAtEnd, "") : "";
}

interface FanshaweEmailInputProps {
  id: string;
  /** The full email, or "" while the ID is empty or invalid */
  value: string;
  onChange: (email: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  onFocus?: FocusEventHandler<HTMLInputElement>;
  onBlur?: FocusEventHandler<HTMLInputElement>;
}

/** A Fanshawe ID box with the @fanshaweonline.ca ending fixed in place */
export function FanshaweEmailInput({ id, value, onChange, label = "Fanshawe email", required, disabled, onFocus, onBlur }: FanshaweEmailInputProps) {
  const [text, setText] = useState(() => idFrom(value));
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const suffixId = useId();
  const errorId = useId();

  // Follow the form when it sets or clears the email itself; our own updates
  // come back as the value we last sent, so they leave the box alone
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setText(idFrom(value));
    setError("");
  }

  // Blocks the browser's own form submission while the ID is invalid
  useEffect(() => {
    inputRef.current?.setCustomValidity(error);
  }, [error]);

  function update(raw: string) {
    const next = readId(raw);
    setText(next.text);
    setError(next.error);
    const email = next.text && !next.error ? fanshaweEmailFor(next.text) : "";
    setLastValue(email);
    onChange(email);
  }

  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div
        className={`flex w-full overflow-hidden rounded-lg border bg-surface text-sm shadow-xs transition focus-within:ring-4 ${
          error ? "border-danger focus-within:ring-danger/10" : "border-line focus-within:border-brand focus-within:ring-brand/10"
        } ${disabled ? "opacity-60" : ""}`}
      >
        <input
          ref={inputRef}
          id={id}
          name="username"
          type="text"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required={required}
          disabled={disabled}
          placeholder="your ID, e.g. y_rajeh"
          value={text}
          onChange={(e) => update(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${suffixId} ${errorId}` : suffixId}
          className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 text-ink outline-none placeholder:text-muted"
        />
        <span id={suffixId} className="flex shrink-0 select-none items-center border-l border-line bg-canvas px-3 text-ink-soft">
          {SUFFIX}
        </span>
      </div>
      {error && (
        <p id={errorId} className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
