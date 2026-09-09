import { parseUrl } from '../utils/url';

/**
 * Local / dev environment detection.
 *
 * Deliberately split in two, because the two halves carry very
 * different confidence and so run at different points in `classify.ts`:
 *
 *   isLocalHostUrl — the hostname itself says "not production"
 *     (localhost, a private IP, staging.example.com). Nothing outranks
 *     this: a real service domain is never one of these.
 *
 *   isLocalPathUrl — only a path segment hints at an environment
 *     (example.com/staging/login). Weak evidence, because real services
 *     have paths like /preview and repositories named "dev". It runs
 *     *after* the domain rules, so it can only claim unknown hosts.
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

/**
 * Whole path segments only.
 *
 * The `[.\-_]` boundaries used for hostnames are right there
 * (`staging-app.example.com`) but wrong for paths, where they also
 * swallow `/test-driven-development/` and `/dev-blog/`.
 */
const PATH_ENV_RE = new RegExp(
  '(^|/)(' + PATH_ENV_KEYWORDS.join('|') + ')(/|$)',
  'i'
);

/** Hostname alone identifies a non-production environment. */
export function isLocalHostUrl(rawUrl: string): boolean {
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
  return HOST_ENV_RE.test(p.hostname);
}

/**
 * A path segment hints at an environment (e.g. app.com/qa/...).
 * Only meaningful once the domain rules have declined the URL.
 */
export function isLocalPathUrl(rawUrl: string): boolean {
  const p = parseUrl(rawUrl);
  if (!p.ok) return false;
  return PATH_ENV_RE.test(p.pathname);
}
