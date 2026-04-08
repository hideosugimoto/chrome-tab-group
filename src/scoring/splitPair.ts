import type { Category, SplitPairCandidate } from '../types';
import { jaccard } from '../utils/text';
import { parseUrl, rootDomain } from '../utils/url';
import { classify } from '../domain/classify';

/**
 * Pure scoring for "two tabs that are likely worth viewing side-by-side".
 *
 * No Chrome API. Takes raw tab-like objects and returns top candidates.
 *
 * Composition (weights are intentionally simple — easy to tune later):
 *   score = categoryAffinity * 4
 *         + recencyProximity * 2
 *         + titleSim         * 2
 *         + domainSim        * 1
 *         + classicPairBonus
 */

export interface PairableTab {
  id?: number;
  url?: string;
  title?: string;
  /** chrome.tabs.Tab.lastAccessed if available (ms epoch). */
  lastAccessed?: number;
}

const RECENCY_HALF_LIFE_SECONDS = 60;

/** Affinity table — symmetric. Values in [0, 1]. */
const AFFINITY: ReadonlyArray<readonly [Category, Category, number]> = [
  ['Review', 'Local', 1.0],
  ['Review', 'Dev', 0.9],
  ['Docs', 'Local', 0.9],
  ['Research', 'Dev', 0.9],
  ['Review', 'Chat', 0.8],
  ['Cloud', 'Dev', 0.7],
  ['Cloud', 'Local', 0.7],
  ['Data', 'Cloud', 0.7],
  ['Data', 'Dev', 0.6],
  ['Design', 'Local', 0.8],
  ['Design', 'Dev', 0.7],
  ['AI', 'Docs', 0.8],
  ['AI', 'Dev', 0.8],
  ['AI', 'Research', 0.8],
  ['Review', 'Docs', 0.7],
  ['Chat', 'Review', 0.8]
];

/** Classic, well-known pairs that engineers actually open together. */
const CLASSIC_PAIRS: ReadonlyArray<readonly [Category, Category]> = [
  ['Review', 'Local'],
  ['Docs', 'Local'],
  ['Research', 'Dev'],
  ['Review', 'Dev'],
  ['Cloud', 'Local'],
  ['Data', 'Cloud'],
  ['Design', 'Local'],
  ['Chat', 'Review'],
  ['AI', 'Docs'],
  ['AI', 'Dev']
];

function affinityScore(a: Category, b: Category): number {
  if (a === b) return 0; // same category isn't a "split pair"
  for (const [x, y, w] of AFFINITY) {
    if ((x === a && y === b) || (x === b && y === a)) return w;
  }
  return 0.1; // tiny default — different categories at least have *some* affinity
}

function classicBonus(a: Category, b: Category): number {
  for (const [x, y] of CLASSIC_PAIRS) {
    if ((x === a && y === b) || (x === b && y === a)) return 0.5;
  }
  return 0;
}

function recencyProximity(a: PairableTab, b: PairableTab): number {
  const ta = a.lastAccessed ?? 0;
  const tb = b.lastAccessed ?? 0;
  if (!ta || !tb) return 0.2; // unknown — small neutral score
  const diffSec = Math.abs(ta - tb) / 1000;
  return 1 / (1 + diffSec / RECENCY_HALF_LIFE_SECONDS);
}

function domainSim(a: PairableTab, b: PairableTab): number {
  const ha = parseUrl(a.url ?? '').hostname;
  const hb = parseUrl(b.url ?? '').hostname;
  if (!ha || !hb) return 0;
  if (ha === hb) return 1;
  if (rootDomain(ha) === rootDomain(hb)) return 0.5;
  return 0;
}

function titleSim(a: PairableTab, b: PairableTab): number {
  return jaccard(a.title ?? '', b.title ?? '');
}

export interface SuggestOptions {
  topN?: number;
}

export function suggestSplitPairs(
  tabs: readonly PairableTab[],
  opts: SuggestOptions = {}
): SplitPairCandidate[] {
  const topN = opts.topN ?? 5;
  if (tabs.length < 2) return [];

  const classified = tabs.map((t) => ({
    tab: t,
    category: classify({ url: t.url ?? '', title: t.title ?? '' })
  }));

  const candidates: SplitPairCandidate[] = [];
  for (let i = 0; i < classified.length; i += 1) {
    for (let j = i + 1; j < classified.length; j += 1) {
      const A = classified[i]!;
      const B = classified[j]!;
      const aff = affinityScore(A.category, B.category);
      if (aff <= 0.1) continue; // skip near-zero affinity to keep list relevant

      const score =
        aff * 4 +
        recencyProximity(A.tab, B.tab) * 2 +
        titleSim(A.tab, B.tab) * 2 +
        domainSim(A.tab, B.tab) * 1 +
        classicBonus(A.category, B.category);

      candidates.push({
        a: A.tab as unknown as chrome.tabs.Tab,
        b: B.tab as unknown as chrome.tabs.Tab,
        score: Math.round(score * 100) / 100,
        reason: `${A.category} × ${B.category}`
      });
    }
  }

  candidates.sort((x, y) => y.score - x.score);
  return candidates.slice(0, topN);
}
