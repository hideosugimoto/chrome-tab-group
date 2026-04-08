import { parseUrl } from '../utils/url';

/**
 * Local / dev environment detection.
 *
 * Order: hostname check first (cheap), then label-based env keywords on
 * subdomain / path. We use word-boundary aware checks to avoid matching
 * "production" by accident.
 */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

const ENV_KEYWORDS = [
  'localhost',
  'staging',
  'stage',
  'stg',
  'dev',
  'develop',
  'qa',
  'test',
  'preview',
  'sandbox',
  'preprod',
  'pre-prod',
  'uat'
];

const ENV_LABEL_RE = new RegExp(
  '(^|[.\\-/_])(' + ENV_KEYWORDS.join('|') + ')([.\\-/_]|$)',
  'i'
);

export function isLocalUrl(rawUrl: string): boolean {
  const p = parseUrl(rawUrl);
  if (!p.ok) return false;

  if (LOCAL_HOSTS.has(p.hostname)) return true;
  if (p.hostname.endsWith('.local')) return true;
  if (p.hostname.endsWith('.localhost')) return true;
  // Private network heuristic — treat as local-ish.
  if (/^10\./.test(p.hostname)) return true;
  if (/^192\.168\./.test(p.hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(p.hostname)) return true;

  // Subdomain or path keyword (e.g. staging.example.com, app.com/qa/...).
  if (ENV_LABEL_RE.test(p.hostname)) return true;
  if (ENV_LABEL_RE.test(p.pathname)) return true;

  return false;
}
