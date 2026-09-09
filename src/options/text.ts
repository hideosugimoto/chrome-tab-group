/**
 * All dynamic user-facing text for the options page.
 * Static copy lives in options.html. Same convention as popup/text.ts.
 */

import type { Category } from '../types';
import type { DomainInputError } from '../domain/domainInput';
import { CATEGORY_LABEL } from '../constants/categoryLabels';

export const UI = {
  categoryLabel: (category: Category): string => CATEGORY_LABEL[category],

  overrideCount: (n: number): string => `修正 ${n} 件を保存しています`,
  overrideFiltered: (shown: number, total: number): string =>
    `${total} 件中 ${shown} 件を表示`,

  overrideUpdated: (key: string, category: string): string => `${key} → ${category} に変更しました`,
  overrideRemoved: (key: string): string => `${key} の修正を削除しました`,
  overridesCleared: (n: number): string => `${n} 件の修正をすべて削除しました`,
  confirmClearAll: (n: number): string =>
    `保存されている修正 ${n} 件をすべて削除します。よろしいですか？`,

  scopeSite: 'サイト全体',
  scopePath: 'パス配下',

  domainAdded: (domain: string): string => `${domain} を追加しました`,
  domainRemoved: (domain: string): string => `${domain} を削除しました`,

  loadFailed: '設定を読み込めませんでした',
  saveFailed: '保存できませんでした',

  error: (message: string): string => `エラー: ${message}`
} as const;

export function domainErrorText(error: DomainInputError): string {
  switch (error) {
    case 'empty':
      return 'ドメインを入力してください';
    case 'invalid':
      return 'ドメインとして読み取れません（例: example.com）';
    case 'duplicate':
      return 'すでに登録されています';
    default:
      return '追加できませんでした';
  }
}
