import { parseUrl } from '../utils/url';

/**
 * Returns true if the URL must be left untouched (special / unmovable).
 * - chrome://, chrome-extension://, devtools://, edge://, about:, view-source:
 * - empty / unparsable URLs
 *
 * Pinned-tab handling and user-excluded domains are handled separately
 * by the organize pipeline (they depend on settings, not on the URL itself).
 */
const SPECIAL_PROTOCOLS = new Set([
  'chrome:',
  'chrome-extension:',
  'devtools:',
  'edge:',
  'about:',
  'view-source:',
  'file:'
]);

export function isExcludedUrl(rawUrl: string | undefined): boolean {
  if (!rawUrl) return true;
  const p = parseUrl(rawUrl);
  if (!p.ok) return true;
  if (SPECIAL_PROTOCOLS.has(p.protocol)) return true;
  // Chrome's New Tab Page surfaces as chrome:// — already covered.
  return false;
}

export function isUserExcludedDomain(rawUrl: string, excludedDomains: string[]): boolean {
  if (!excludedDomains.length) return false;
  const p = parseUrl(rawUrl);
  if (!p.ok) return false;
  return excludedDomains.some((d) => {
    const norm = d.trim().toLowerCase();
    if (!norm) return false;
    return p.hostname === norm || p.hostname.endsWith('.' + norm);
  });
}
