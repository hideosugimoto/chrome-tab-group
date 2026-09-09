/**
 * Normalizing what a user types into the "leave this site alone" box.
 *
 * People paste whole URLs, type "www.example.com/", or add a stray
 * space. All of those mean the same host, and a mismatch here is
 * invisible and confusing — the domain silently fails to exclude
 * anything. So normalize generously, reject only what cannot be a
 * hostname.
 *
 * Pure functions only. No Chrome API, no I/O.
 */

/** A hostname label set: letters, digits, hyphen, dot separators. */
const HOSTNAME = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;

export type DomainInputError = 'empty' | 'invalid' | 'duplicate';

export type DomainInputResult =
  | { ok: true; domain: string }
  | { ok: false; error: DomainInputError };

/**
 * Extract a bare hostname from whatever the user typed.
 * Returns null when the input cannot be read as a host.
 */
export function normalizeDomainInput(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length === 0) return null;

  // A pasted URL, with or without a scheme.
  const withoutScheme = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  const host = withoutScheme.split('/')[0]?.split('?')[0]?.split('#')[0] ?? '';
  // Strip credentials and port: user:pass@host:8080
  const afterCredentials = host.includes('@') ? (host.split('@').pop() ?? '') : host;
  const withoutPort = afterCredentials.split(':')[0] ?? '';
  const withoutTrailingDot = withoutPort.replace(/\.+$/, '');

  if (withoutTrailingDot.length === 0) return null;
  if (!HOSTNAME.test(withoutTrailingDot)) return null;
  return withoutTrailingDot;
}

/** Validate a new entry against the list already saved. */
export function validateNewDomain(
  raw: string,
  existing: readonly string[]
): DomainInputResult {
  if (raw.trim().length === 0) return { ok: false, error: 'empty' };
  const domain = normalizeDomainInput(raw);
  if (domain === null) return { ok: false, error: 'invalid' };
  if (existing.some((d) => d.trim().toLowerCase() === domain)) {
    return { ok: false, error: 'duplicate' };
  }
  return { ok: true, domain };
}

/** Immutably append, keeping the list sorted and free of duplicates. */
export function withDomain(existing: readonly string[], domain: string): string[] {
  return [...new Set([...existing, domain])].sort();
}

/** Immutably remove one entry. */
export function withoutDomain(existing: readonly string[], domain: string): string[] {
  return existing.filter((d) => d !== domain);
}
