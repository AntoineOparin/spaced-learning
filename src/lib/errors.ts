/** A readable message for anything thrown (Errors, strings, rejected values). */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
