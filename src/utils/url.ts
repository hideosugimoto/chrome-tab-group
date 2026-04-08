/** URL helpers. Pure functions. */

export interface ParsedUrl {
  ok: boolean;
  protocol: string;
  hostname: string;
  pathname: string;
  search: string;
  full: string;
}

export function parseUrl(raw: string): ParsedUrl {
  try {
    const u = new URL(raw);
    return {
      ok: true,
      protocol: u.protocol,
      hostname: u.hostname.toLowerCase(),
      pathname: u.pathname,
      search: u.search,
      full: u.toString()
    };
  } catch {
    return { ok: false, protocol: '', hostname: '', pathname: '', search: '', full: raw ?? '' };
  }
}

/** Returns the eTLD+1-ish domain (last two labels). Sufficient for similarity. */
export function rootDomain(hostname: string): string {
  if (!hostname) return '';
  const parts = hostname.split('.').filter(Boolean);
  if (parts.length <= 2) return hostname;
  return parts.slice(-2).join('.');
}
