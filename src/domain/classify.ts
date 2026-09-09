import type {
  Category,
  ClassifyInput,
  ClassifyResult,
  DomainRule
} from '../types';
import { parseUrl } from '../utils/url';
import { isLocalHostUrl, isLocalPathUrl } from '../rules/localPatterns';
import { DOMAIN_RULES } from '../rules/domainRules';
import { PATH_RULES } from '../rules/pathRules';
import { TITLE_RULES } from '../rules/titleRules';
import { lookupOverride } from './overrides';

export interface ClassifyContext {
  customRules?: readonly DomainRule[];
  overrides?: Readonly<Record<string, Category>>;
}

/**
 * Pure classification. No Chrome API. No I/O.
 *
 * Order:
 *   0. User overrides — explicit user intent beats every rule.
 *   1. Local environment by hostname (localhost, private IP, staging.*).
 *   2. Custom rules, then built-in domain rules.
 *   3. Local environment by path segment (/staging/, /qa/, ...).
 *   4. Domain-agnostic path rules.
 *   5. Title keyword rules.
 *   6. Misc.
 *
 * Steps 1 and 3 are the same heuristic split by confidence. A hostname
 * that says "not production" is decisive, so it runs first. A mere path
 * segment is not: github.com/acme/dev is a repository and
 * vercel.com/acme/preview is a real product page, so the path half runs
 * only after the domain rules have declined the URL.
 *
 * Returns the matched rule name so the UI can explain *why* a tab
 * landed where it did — the thing an AI organizer cannot do.
 */
export function classifyDetailed(
  input: ClassifyInput,
  context: ClassifyContext = {}
): ClassifyResult {
  const url = input.url ?? '';
  const title = input.title ?? '';
  const parsed = parseUrl(url);
  if (!parsed.ok) return { category: 'Misc', source: 'fallback', ruleName: null };

  // 0. User overrides win outright.
  const override = lookupOverride(parsed.hostname, parsed.pathname, context.overrides);
  if (override) {
    return { category: override.category, source: 'override', ruleName: override.key };
  }

  // 1. A local-looking hostname is never overridden by a service domain.
  if (isLocalHostUrl(url)) return { category: 'Local', source: 'local', ruleName: 'local-host' };

  // 2. Custom rules first so users can shadow the built-ins.
  const customRules = context.customRules ?? [];
  const customHit = sortByPriority(customRules).find((r) => matchRule(r, parsed, title, url));
  if (customHit) {
    return { category: customHit.category, source: 'custom', ruleName: customHit.name ?? null };
  }

  const domainHit = sortByPriority(DOMAIN_RULES).find((r) => matchRule(r, parsed, title, url));
  if (domainHit) {
    return { category: domainHit.category, source: 'domain', ruleName: domainHit.name ?? null };
  }

  // 3. Environment keyword in the path — only for hosts no rule claimed.
  if (isLocalPathUrl(url)) {
    return { category: 'Local', source: 'local', ruleName: 'local-path' };
  }

  // 4. Path-only rules.
  const pathHit = PATH_RULES.find((r) => matchRule(r, parsed, title, url));
  if (pathHit) {
    return { category: pathHit.category, source: 'path', ruleName: pathHit.name ?? null };
  }

  // 5. Title-only rules.
  const titleHit = TITLE_RULES.find((r) => matchRule(r, parsed, title, url));
  if (titleHit) {
    return { category: titleHit.category, source: 'title', ruleName: titleHit.name ?? null };
  }

  return { category: 'Misc', source: 'fallback', ruleName: null };
}

/** Category-only convenience wrapper. */
export function classify(
  input: ClassifyInput,
  customRules: readonly DomainRule[] = [],
  overrides?: Readonly<Record<string, Category>>
): Category {
  return classifyDetailed(input, { customRules, overrides }).category;
}

function sortByPriority(rules: readonly DomainRule[]): readonly DomainRule[] {
  // Stable sort: keep array order, only push higher-priority items up.
  return [...rules].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

function matchRule(
  rule: DomainRule,
  parsed: ReturnType<typeof parseUrl>,
  title: string,
  fullUrl: string
): boolean {
  if (rule.hostMatch && !rule.hostMatch.test(parsed.hostname)) return false;
  if (rule.pathExclude && rule.pathExclude.test(parsed.pathname)) return false;
  if (rule.pathInclude && !rule.pathInclude.test(parsed.pathname)) return false;
  if (rule.titleInclude && !rule.titleInclude.test(title)) return false;
  if (rule.urlInclude && !rule.urlInclude.test(fullUrl)) return false;

  // A rule with no matchers at all is invalid — skip it.
  const hasAnyMatcher =
    !!rule.hostMatch ||
    !!rule.pathInclude ||
    !!rule.titleInclude ||
    !!rule.urlInclude;
  return hasAnyMatcher;
}
