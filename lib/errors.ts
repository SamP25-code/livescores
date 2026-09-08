/**
 * Pulls a readable message out of whatever got thrown. Supabase's client
 * throws plain objects (e.g. `{ message, code, details, hint }`), not real
 * `Error` instances, so a bare `err instanceof Error` check misses them and
 * falls back to a useless generic message right when it matters most.
 */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string" && err.message) {
    return err.message;
  }
  return "Something went wrong.";
}
