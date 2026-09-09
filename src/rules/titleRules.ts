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
  // Bare "doc"/"docs" is not evidence — it appears in ordinary prose
  // and in half the titles on a documentation-heavy site. Only the
  // spelled-out words are precise enough for a last-resort rule.
  { name: 'title-docs', titleInclude: /\b(documentation|api reference)\b/i, category: 'Research' }
] as const;
