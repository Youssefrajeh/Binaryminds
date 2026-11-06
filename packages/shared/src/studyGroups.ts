/** A subject code and course number, e.g. INFO-5103, INFO5103 or info 5103 */
export const COURSE_CODE_PATTERN = /^[A-Za-z]{2,6}[ -]?\d{3,5}[A-Za-z]?$/;
export const COURSE_CODE_HINT = "Use a course code such as INFO-5103";

/** Stored and compared without spaces or hyphens, so INFO-5103 and info5103 match */
export function normalizeCourseCode(code: string): string {
  return code.trim().replace(/[ -]/g, "").toUpperCase();
}
