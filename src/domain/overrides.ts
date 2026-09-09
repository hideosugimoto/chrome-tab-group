/**
 * User category overrides.
 *
 * An override is a user statement of the form "tabs matching this key
 * belong to category X", recorded when the user corrects a
 * misclassification from the popup. Overrides win over every built-in
 * rule — they are the user's explicit intent.
 *
 * Two scopes are supported:
 *   - 'host'     -> "github.com"
 *   - 'hostPath' -> "github.com/myorg"  (host + first path segment)
 *
 * Lookup is most-specific-first: a 'hostPath' key beats a 'host' key.
 *
 * Pure functions only. No Chrome API, no I/O.
 */

import type { Category, OverrideHit, OverrideScope } from '../types';

/** Normalized host key, or null when the hostname is unusable. */
export function hostKeyOf(hostname: string): string | null {
  const h = hostname.trim().toLowerCase();
  return h.length > 0 ? h : null;
}

/**
 * First non-empty path segment, lowercased.
 *
 * Lowercasing loses case fidelity (paths are case-sensitive in
 * general) but makes keys stable for the hosts this actually targets
 * — code forges and issue trackers, where the org/project segment is
 * case-insensitive in practice.
 */
export function firstPathSegment(pathname: string): string | null {
  const seg = pathname.split('/').filter((s) => s.length > 0)[0];
  return seg ? seg.toLowerCase() : null;
}

/** Host + first path segment key, or null when the path has no segment. */
export function hostPathKeyOf(hostname: string, pathname: string): string | null {
  const host = hostKeyOf(hostname);
  if (host === null) return null;
  const seg = firstPathSegment(pathname);
  if (seg === null) return null;
  return `${host}/${seg}`;
}

/** The key for an explicit scope choice, or null if not expressible. */
export function overrideKeyFor(
  hostname: string,
  pathname: string,
  scope: OverrideScope
): string | null {
  return scope === 'host' ? hostKeyOf(hostname) : hostPathKeyOf(hostname, pathname);
}

/** Candidate keys for a URL, most specific first. */
export function overrideKeysFor(hostname: string, pathname: string): string[] {
  const keys: string[] = [];
  const hostPath = hostPathKeyOf(hostname, pathname);
  if (hostPath !== null) keys.push(hostPath);
  const host = hostKeyOf(hostname);
  if (host !== null) keys.push(host);
  return keys;
}

/** Find the winning override for a URL, or null when none applies. */
export function lookupOverride(
  hostname: string,
  pathname: string,
  overrides: Readonly<Record<string, Category>> | undefined
): OverrideHit | null {
  if (!overrides) return null;
  for (const key of overrideKeysFor(hostname, pathname)) {
    const category = overrides[key];
    if (category !== undefined) {
      return { key, category, scope: key.includes('/') ? 'hostPath' : 'host' };
    }
  }
  return null;
}

/** Immutably add / replace one override. */
export function withOverride(
  overrides: Readonly<Record<string, Category>> | undefined,
  key: string,
  category: Category
): Record<string, Category> {
  return { ...(overrides ?? {}), [key]: category };
}

/** Immutably drop the given keys. */
export function withoutOverrides(
  overrides: Readonly<Record<string, Category>> | undefined,
  keys: readonly string[]
): Record<string, Category> {
  const drop = new Set(keys);
  const out: Record<string, Category> = {};
  for (const [k, v] of Object.entries(overrides ?? {})) {
    if (!drop.has(k)) out[k] = v;
  }
  return out;
}
