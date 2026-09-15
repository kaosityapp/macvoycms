/**
 * Only allow same-site relative paths in `?next=` so an auth link can never
 * bounce someone to another domain.
 */
export function safeNextPath(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  // Must be a relative path; "//host" and "/\host" are protocol-relative in browsers.
  if (!/^\/(?![\/\\])/.test(value)) return fallback;
  return value;
}
