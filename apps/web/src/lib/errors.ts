/** The API's `{ error }` message from a failed request, or the fallback */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { error?: unknown } } } | null)?.response?.data?.error;
  return typeof message === "string" && message ? message : fallback;
}

/** True when the API answered 404, e.g. for an ID that doesn't exist */
export function isNotFound(err: unknown): boolean {
  return (err as { response?: { status?: number } } | null)?.response?.status === 404;
}
