/**
 * All user-facing text for the popup, in one place.
 *
 * The UI is Japanese by deliberate choice, not by Chrome's UI
 * language: this is a Japanese-first tool, and `chrome.i18n` would
 * fall back to English for anyone running Chrome in English.
 *
 * Category names (Dev / Review / Chat …) stay English on purpose —
 * they are also the tab group titles, and `domain/groupTitle.ts`
 * parses them back to recognize the groups we own.
 *
 * The background never sends prose; it sends codes that this file
 * turns into text.
 */

import type { UndoFailureReason } from '../types';
import type { ActiveTabExclusion } from '../background/index';

export const UI = {
  loading: '読み込み中…',
  noActiveTab: 'アクティブなタブがありません',
  untitled: '(タイトルなし)',

  tabCount: (total: number): string => `このウィンドウのタブ: ${total} 件`,
  noOrganizableTabs: '整理対象のタブがありません',
  skippedNote: (n: number): string => `${n} 件は自分で作ったグループ内のため対象外です`,

  scopeHost: (key: string): string => `このサイト（${key}）`,
  scopePath: (key: string): string => `このパス（${key}）`,
  scopePathUnavailable: 'このパス（指定不可）',

  organizing: '整理中…',
  organizeNoop: 'すべて整理済みです',
  organizeDone: (moved: number, created: number): string =>
    `${moved} 件のタブを整理しました（新規グループ ${created} 件）`,

  scoring: '候補を計算中…',
  suggestionCount: (n: number): string => `候補 ${n} 件`,
  noPairs: '適切な候補は見つかりませんでした',
  pairScore: (reason: string, score: number): string => `${reason} · スコア ${score}`,

  undoing: '取り消し中…',
  undoDone: '整理前の状態に戻しました',

  applying: '適用中…',
  overrideApplied: (key: string, category: string, affected: number): string =>
    `${key} → ${category}（このウィンドウの ${affected} 件に適用）`,
  resetting: '戻しています…',
  overrideReset: (key: string): string => `${key} をルールの判定に戻しました`,

  error: (message: string): string => `エラー: ${message}`
} as const;

/** Why the tab landed in its category. */
export function explainRule(source: string, ruleName: string | null): string {
  switch (source) {
    case 'override':
      return `あなたの修正 · ${ruleName ?? ''}`;
    case 'local':
      return 'ルール: ローカル環境';
    case 'fallback':
      return 'ルール未一致 — カテゴリを選ぶと記憶します';
    default:
      return `ルール: ${ruleName ?? source}`;
  }
}

/** Why Organize would leave this particular tab where it is. */
export function explainExclusion(exclusion: ActiveTabExclusion): string | null {
  switch (exclusion) {
    case 'unsupported-url':
      return 'ブラウザ内部ページのため整理対象外です';
    case 'pinned':
      return 'ピン留め中のためこのタブは動きません（ルールはサイトに適用）';
    case 'excluded-domain':
      return '除外ドメインのためこのタブは動きません（ルールは適用）';
    default:
      return null;
  }
}

export const NOT_CORRECTABLE = 'ルールを作れる URL がありません';

export function undoFailure(reason: UndoFailureReason | undefined): string {
  switch (reason) {
    case 'no-snapshot':
      return '取り消せる操作がありません';
    case 'tabs-gone':
      return '対象のタブが残っていないため取り消せません';
    default:
      return '取り消せませんでした';
  }
}

/** Error codes thrown by the background, mapped to display text. */
export function errorText(message: string): string {
  switch (message) {
    case 'no-url':
      return 'このタブには対象となる URL がありません';
    case 'no-host-scope':
      return 'このURLにはサイト単位のルールを作れません';
    case 'no-path-scope':
      return 'このURLにはパス単位のルールを作れません';
    case 'nothing-to-reset':
      return 'このURLに戻せる設定はありません';
    default:
      return message;
  }
}
