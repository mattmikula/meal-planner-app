/**
 * Normalizes an email address by trimming whitespace and converting to lowercase.
 * Returns null if the input is null, undefined, or an empty string after trimming.
 * 
 * @example
 * normalizeEmail(" User@Example.com ") // returns "user@example.com"
 * normalizeEmail("") // returns null
 * normalizeEmail(null) // returns null
 */
export function normalizeEmail(email: string | null | undefined): string | null {
  const trimmed = (email ?? "").trim();
  return trimmed ? trimmed.toLowerCase() : null;
}
