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
  /** Reserved for future custom rules editor. */
  customRules?: DomainRule[];
  /** Reserved: per-URL category overrides. */
  categoryOverrides?: Record<string, Category>;
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
  tabs: UndoTabSnapshot[];
  groups: UndoGroupSnapshot[];
}

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
