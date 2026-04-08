import type { DomainRule } from '../types';

/**
 * Title keyword fallback. Last resort before Misc.
 *
 * These should be high-precision: "Pull request" in a title is much
 * stronger evidence than "review" alone, which can mean many things.
 */
export const TITLE_RULES: readonly DomainRule[] = [
  { name: 'title-pr', titleInclude: /\b(pull request|merge request|PR #)/i, category: 'Review' },
  { name: 'title-issue', titleInclude: /\b(issue|ticket|task) #?\d+/i, category: 'Review' },
  { name: 'title-build', titleInclude: /\b(build|deploy|deployment|pipeline|workflow run)\b/i, category: 'Cloud' },
  { name: 'title-spec', titleInclude: /\b(spec|specification|design doc|RFC)\b/i, category: 'Docs' },
  { name: 'title-docs', titleInclude: /\b(documentation|docs?)\b/i, category: 'Research' }
] as const;
