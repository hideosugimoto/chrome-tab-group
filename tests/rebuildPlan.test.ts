import { test } from 'node:test';
import assert from 'node:assert/strict';

import { selectRebuildTabs, type RebuildTab } from '../src/domain/rebuildPlan';

const tab = (tabId: number, groupId: number, organizable = true): RebuildTab => ({
  tabId,
  groupId,
  organizable
});

test('releases every tab in a group we own', () => {
  const sel = selectRebuildTabs([tab(1, 10), tab(2, 10)], new Set([10]));
  assert.deepEqual(sel.toUngroup, [1, 2]);
  assert.deepEqual(sel.touched, [1, 2]);
});

test('releases non-organizable tabs from our groups too', () => {
  // A tab whose domain was excluded after it had already been grouped
  // must come back out, or it is stranded there forever.
  const sel = selectRebuildTabs([tab(1, 10, false)], new Set([10]));
  assert.deepEqual(sel.toUngroup, [1]);
  assert.deepEqual(sel.touched, [1]);
});

test("never releases or snapshots a tab in the user's own group", () => {
  const sel = selectRebuildTabs([tab(1, 99)], new Set([10]));
  assert.deepEqual(sel.toUngroup, []);
  assert.deepEqual(sel.touched, []);
});

test('snapshots ungrouped organizable tabs without ungrouping them', () => {
  const sel = selectRebuildTabs([tab(1, -1)], new Set([10]));
  assert.deepEqual(sel.toUngroup, []);
  assert.deepEqual(sel.touched, [1]);
});

test('ignores ungrouped tabs that are not organizable', () => {
  const sel = selectRebuildTabs([tab(1, -1, false)], new Set([10]));
  assert.deepEqual(sel.touched, []);
});

test('an empty owned set makes rebuild a plain organize', () => {
  const sel = selectRebuildTabs([tab(1, -1), tab(2, 99)], new Set());
  assert.deepEqual(sel.toUngroup, []);
  assert.deepEqual(sel.touched, [1]);
});

test('a tidy window with nothing to do touches nothing', () => {
  const sel = selectRebuildTabs([tab(1, 99), tab(2, -1, false)], new Set([10]));
  assert.deepEqual(sel.toUngroup, []);
  assert.deepEqual(sel.touched, []);
});

test('mixed window: ours released, user groups untouched, strays snapshotted', () => {
  const sel = selectRebuildTabs(
    [tab(1, 10), tab(2, 11), tab(3, 99), tab(4, -1), tab(5, -1, false)],
    new Set([10, 11])
  );
  assert.deepEqual(sel.toUngroup, [1, 2]);
  assert.deepEqual(sel.touched, [1, 2, 4]);
});
