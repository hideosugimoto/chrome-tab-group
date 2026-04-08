import type { Category, ClassifyInput, DomainRule } from '../types';
import { parseUrl } from '../utils/url';
import { isLocalUrl } from '../rules/localPatterns';
import { DOMAIN_RULES } from '../rules/domainRules';
import { PATH_RULES } from '../rules/pathRules';
import { TITLE_RULES } from '../rules/titleRules';

/**
 * Pure classification function. No Chrome API. No I/O.
 *
 * Order:
 *   1. Local environment heuristics (URL host/path keywords).
 *   2. Domain rules (host + optional path/title qualifiers).
 *   3. Domain-agnostic path rules.
 *   4. Title keyword rules.
 *   5. Misc.
 *
 * customRules (from settings) are evaluated *before* the built-in
 * domain rules so users can override defaults without editing source.
 */
export function classify(
  input: ClassifyInput,
  customRules: readonly DomainRule[] = []
): Category {
  const url = input.url ?? '';
  const title = input.title ?? '';
  const parsed = parseUrl(url);
  if (!parsed.ok) return 'Misc';

  // 1. Local environments are never overridden by service domain.
  if (isLocalUrl(url)) return 'Local';

  // 2. Custom + built-in domain rules.
  const allRules = [...customRules, ...DOMAIN_RULES];
  const sorted = sortByPriority(allRules);
  const domainHit = sorted.find((r) => matchRule(r, parsed, title, url));
  if (domainHit) return domainHit.category;

  // 3. Path-only rules.
  const pathHit = PATH_RULES.find((r) => matchRule(r, parsed, title, url));
  if (pathHit) return pathHit.category;

  // 4. Title-only rules.
  const titleHit = TITLE_RULES.find((r) => matchRule(r, parsed, title, url));
  if (titleHit) return titleHit.category;

  return 'Misc';
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
