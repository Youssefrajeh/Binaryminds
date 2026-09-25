/* ------------------------------------------------------------------ */
/*  Password policy — shown in the web UI and enforced by the API     */
/*  (apps/api/src/lib/password.ts mirrors these rules at runtime)      */
/* ------------------------------------------------------------------ */

export interface PasswordRule {
  id: string;
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { id: "length", label: "At least 8 characters", test: (p) => p.length >= 8 },
  { id: "uppercase", label: "One uppercase letter (A–Z)", test: (p) => /[A-Z]/.test(p) },
  { id: "number", label: "One number (0–9)", test: (p) => /[0-9]/.test(p) },
  { id: "symbol", label: "One symbol (e.g. # $ % @)", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export function isStrongPassword(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}
