export const FANSHAWE_EMAIL_DOMAIN = "fanshaweonline.ca";
export const FANSHAWE_EMAIL_ERROR = `Use your @${FANSHAWE_EMAIL_DOMAIN} email`;

/** The part of a student email before the @, e.g. y_rajeh */
export const FANSHAWE_ID_PATTERN = /^[a-z0-9._-]+$/;
export const FANSHAWE_ID_ERROR = "Use only letters, numbers, dots, underscores and hyphens";

/** Trims and lowercases what the student typed, before it is checked */
export function normalizeFanshaweId(value: string): string {
  return value.trim().toLowerCase();
}

export function fanshaweEmailFor(id: string): string {
  return `${normalizeFanshaweId(id)}@${FANSHAWE_EMAIL_DOMAIN}`;
}
