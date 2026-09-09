import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatGroupTitle,
  needsTitleRefresh,
  parseGroupTitle,
  recognizeGroupTitle
} from '../src/domain/groupTitle';
import { CATEGORY_LABEL } from '../src/constants/categoryLabels';
import { ALL_CATEGORIES } from '../src/constants/categories';
import { CATEGORY_COLOR } from '../src/constants/colors';

test('titles are the Japanese label, with an optional ordinal', () => {
  assert.equal(formatGroupTitle('Dev', null), '開発');
  assert.equal(formatGroupTitle('Dev', 2), '開発 2');
  assert.equal(formatGroupTitle('Misc', null), 'その他');
});

test('every category round-trips through format and parse', () => {
  for (const category of ALL_CATEGORIES) {
    assert.equal(parseGroupTitle(formatGroupTitle(category, null)), category);
    assert.equal(parseGroupTitle(formatGroupTitle(category, 3)), category);
  }
});

test('legacy English titles are still recognized as ours', () => {
  // Groups created before the Japanese switch are still in people's
  // windows and saved tab groups; losing them would strand the tabs.
  assert.equal(parseGroupTitle('Dev'), 'Dev');
  assert.equal(parseGroupTitle('Dev 2'), 'Dev');
  assert.equal(parseGroupTitle('Misc'), 'Misc');
  assert.equal(parseGroupTitle('Research 10'), 'Research');
});

test('titles that are not ours are rejected', () => {
  assert.equal(parseGroupTitle('開発中のもの'), null);
  assert.equal(parseGroupTitle('Deployment'), null);
  assert.equal(parseGroupTitle('開発 0'), null);
  assert.equal(parseGroupTitle('開発 x'), null);
  assert.equal(parseGroupTitle(''), null);
  assert.equal(parseGroupTitle(undefined), null);
});

test('recognition still requires the canonical colour', () => {
  assert.equal(recognizeGroupTitle('開発', CATEGORY_COLOR.Dev), 'Dev');
  assert.equal(recognizeGroupTitle('Dev', CATEGORY_COLOR.Dev), 'Dev');
  assert.equal(recognizeGroupTitle('開発', 'red'), null);
  assert.equal(recognizeGroupTitle('開発', undefined), null);
});

test('an English title we own is refreshed to Japanese', () => {
  assert.equal(needsTitleRefresh('Dev', 'Dev', null), true);
  assert.equal(needsTitleRefresh('Dev 2', 'Dev', 2), true);
});

test('a title already canonical is left alone', () => {
  assert.equal(needsTitleRefresh('開発', 'Dev', null), false);
  assert.equal(needsTitleRefresh('開発 2', 'Dev', 2), false);
});

test('a title the user chose themselves is never rewritten', () => {
  assert.equal(needsTitleRefresh('自分の作業', 'Dev', null), false);
  assert.equal(needsTitleRefresh('', 'Dev', null), false);
  assert.equal(needsTitleRefresh(undefined, 'Dev', null), false);
});

test('a title belonging to a different category is not rewritten', () => {
  // Our Dev group renamed to another of our labels is ambiguous;
  // leave it rather than guess which one the user meant.
  assert.equal(needsTitleRefresh('レビュー', 'Dev', null), false);
});

test('labels are short enough for a tab strip', () => {
  for (const category of ALL_CATEGORIES) {
    assert.ok(
      CATEGORY_LABEL[category].length <= 6,
      `${category} label too long: ${CATEGORY_LABEL[category]}`
    );
  }
});
