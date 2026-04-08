import type { DomainRule } from '../types';

/**
 * Domain-agnostic path heuristics.
 *
 * Used after domainRules failed. Catches generic patterns that show up
 * across many self-hosted tools (Redmine clones, custom Backlog,
 * internal admin systems, etc.).
 */
export const PATH_RULES: readonly DomainRule[] = [
  { name: 'path-pull', pathInclude: /\/(pull|pulls|pull-request|pull-requests|merge_requests?)(\/|$)/i, category: 'Review' },
  { name: 'path-issue', pathInclude: /\/(issues?|tickets?|tasks?)(\/|$)/i, category: 'Review' },
  { name: 'path-review', pathInclude: /\/(reviews?|approvals?)(\/|$)/i, category: 'Review' },
  { name: 'path-pipeline', pathInclude: /\/(actions|pipelines?|workflows?|builds?|deployments?)(\/|$)/i, category: 'Cloud' },
  { name: 'path-dashboard', pathInclude: /\/(dashboard|metrics|monitor|monitoring|alerts?)(\/|$)/i, category: 'Cloud' },
  { name: 'path-docs', pathInclude: /\/(docs?|wiki|spec|specs|specification)(\/|$)/i, category: 'Docs' }
] as const;
