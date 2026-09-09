// Shared types for the extension. Pure types only — no runtime imports.

export type Category =
  | 'Chat'
  | 'Review'
  | 'Dev'
  | 'Local'
  | 'Docs'
  | 'Research'
  | 'Cloud'
  | 'Data'
  | 'Design'
  | 'AI'
  | 'Misc';

/** Subset of chrome.tabs.Tab that classification needs. Pure-function friendly. */
export interface ClassifyInput {
  url: string;
  title: string;
}

/** Which stage of the pipeline decided the category. */
export type ClassifySource =
  | 'override'
  | 'local'
  | 'custom'
  | 'domain'
  | 'path'
  | 'title'
  | 'fallback';

/** Explainable classification result. */
export interface ClassifyResult {
  category: Category;
  source: ClassifySource;
  /** Name of the matched rule, or the override key. Null for fallback. */
  ruleName: string | null;
}

/** Granularity of a user override. */
export type OverrideScope = 'host' | 'hostPath';

export interface OverrideHit {
  key: string;
  category: Category;
  scope: OverrideScope;
}

/** Rule definition. All fields except `category` are optional matchers. */
export interface DomainRule {
  /** Matched against parsed URL hostname. */
  hostMatch?: RegExp;
  /** Matched against pathname (with leading slash, no query). */
  pathInclude?: RegExp;
  /** If matches, this rule is skipped. Used to subtract sub-paths. */
  pathExclude?: RegExp;
  /** Matched against tab title. */
  titleInclude?: RegExp;
  /** Matched against full URL (host + path + search). Escape hatch. */
  urlInclude?: RegExp;
  category: Category;
  /** Higher = evaluated earlier. Defaults to 0. */
  priority?: number;
  /** For debugging / explainability. */
  name?: string;
}

export interface Settings {
  ignorePinnedTabs: boolean;
  keepActiveTabPosition: boolean;
  userExcludedDomains: string[];
  /**
   * Reorder the groups we own into CATEGORY_ORDER after organizing.
   * Costs tab movement on every run; turn off for a calmer tab strip.
   */
  sortGroupsByCategory: boolean;
  /**
   * Inside each group we own, keep tabs from the same site adjacent.
   * Like sortGroupsByCategory this costs tab movement, and for the
   * same reason it is skipped on scoped and automatic runs.
   */
  sortTabsByDomain: boolean;
  /**
   * Re-adopt groups that carry our canonical title + color when the
   * registry has been lost (extension reload/update, browser restart).
   * Off = groups not in the registry are treated as the user's.
   */
  adoptMatchingGroups: boolean;
  /**
   * Absorb newly opened tabs into groups that already exist, without
   * pressing anything. Never creates a group; see background/autoGroup.ts.
   */
  autoGroupEnabled: boolean;
  /** User corrections. Key -> category. See domain/overrides.ts. */
  categoryOverrides?: Record<string, Category>;
  /** Reserved for future custom rules editor. */
  customRules?: DomainRule[];
  /** Reserved: history of accepted split-pair suggestions. */
  splitPairHistory?: SplitPairHistoryEntry[];
}

export interface SplitPairHistoryEntry {
  at: number;
  tabIdA: number;
  tabIdB: number;
}

export interface UndoTabSnapshot {
  tabId: number;
  index: number;
  groupId: number; // -1 if ungrouped
  pinned: boolean;
}

export interface UndoGroupSnapshot {
  groupId: number;
  title: string;
  color: chrome.tabGroups.ColorEnum;
  collapsed: boolean;
}

export interface UndoSnapshot {
  windowId: number;
  takenAt: number;
  /** Only the tabs the operation actually touched. */
  tabs: UndoTabSnapshot[];
  /** Metadata for the groups those tabs came from. */
  groups: UndoGroupSnapshot[];
}

/** Machine-readable reasons an undo could not run. The popup maps
 *  these to display text; the background never emits prose. */
export type UndoFailureReason = 'no-snapshot' | 'tabs-gone';

export interface CategoryCount {
  category: Category;
  count: number;
}

export interface SplitPairCandidate {
  a: chrome.tabs.Tab;
  b: chrome.tabs.Tab;
  score: number;
  reason: string;
}
