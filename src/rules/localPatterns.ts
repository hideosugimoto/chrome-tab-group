import { parseUrl } from '../utils/url';

/**
 * Local / dev environment detection.
 *
 * Order: hostname check first (cheap), then label-based env keywords on
 * subdomain / path. We use word-boundary aware checks to avoid matching
 * "production" by accident.
 */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

/**
 * Hostname keyword set is intentionally narrower than the path set.
 *
 * `dev`, `develop`, and `test` are extremely common as the FIRST label
 * of legitimate production subdomains (`dev.azure.com`, `dev.to`,
 * `dev.mysql.com`, `test.com`, ...). Including them on the host side
 * would shadow real domain rules. We keep them only for path matching,
 * where `/dev/`, `/test/` are much more strongly correlated with
 * environment paths.
 */
const HOST_ENV_KEYWORDS = [
  'localhost',
  'staging',
  'stage',
  'stg',
  'qa',
  'uat',
  'preview',
  'sandbox',
  'preprod',
  'pre-prod'
];

const PATH_ENV_KEYWORDS = [...HOST_ENV_KEYWORDS, 'dev', 'develop', 'test'];

const HOST_ENV_RE = new RegExp(
  '(^|[.\\-/_])(' + HOST_ENV_KEYWORDS.join('|') + ')([.\\-/_]|$)',
  'i'
);

const PATH_ENV_RE = new RegExp(
  '(^|[.\\-/_])(' + PATH_ENV_KEYWORDS.join('|') + ')([.\\-/_]|$)',
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

  // Subdomain keyword (e.g. staging.example.com) — narrow set only.
  if (HOST_ENV_RE.test(p.hostname)) return true;
  // Path keyword (e.g. app.com/qa/..., app.com/dev/...) — broader set.
  if (PATH_ENV_RE.test(p.pathname)) return true;

  return false;
}
