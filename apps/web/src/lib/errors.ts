/** The API's `{ error }` message from a failed request, or the fallback */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { error?: unknown } } } | null)?.response?.data?.error;
  return typeof message === "string" && message ? message : fallback;
}
