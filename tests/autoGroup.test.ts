import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isAutoGroupTrigger } from '../src/domain/autoGroupTrigger';
import { planGrouping, type ManagedGroup, type PlanTab } from '../src/domain/groupPlan';

const tab = (tabId: number, category: PlanTab['category'], currentGroupId = -1): PlanTab => ({
  tabId,
  category,
  currentGroupId
});

// ─── Trigger filtering ──────────────────────────────────────────────

test('a URL change triggers the automatic pass', () => {
  assert.equal(isAutoGroupTrigger({ url: 'https://a.test/' }, 'https://a.test/'), true);
});

test('load completion triggers the automatic pass', () => {
  assert.equal(isAutoGroupTrigger({ status: 'complete' }, 'https://a.test/'), true);
});

test('a groupId change alone never triggers — that is our own write', () => {
  assert.equal(isAutoGroupTrigger({ groupId: 7 }, 'https://a.test/'), false);
});

test('title, favicon and loading noise do not trigger', () => {
  assert.equal(isAutoGroupTrigger({ status: 'loading' }, 'https://a.test/'), false);
  assert.equal(isAutoGroupTrigger({}, 'https://a.test/'), false);
});

test('a tab with no URL never triggers', () => {
  assert.equal(isAutoGroupTrigger({ status: 'complete' }, undefined), false);
  assert.equal(isAutoGroupTrigger({ url: 'https://a.test/' }, ''), false);
});

// ─── assignOnly planning (what the automatic pass runs) ─────────────

test('assignOnly absorbs a stray tab into an existing group', () => {
  const managed: ManagedGroup[] = [{ groupId: 10, category: 'Review' }];
  const plan = planGrouping([tab(1, 'Review')], managed, { allowNewGroups: false });
  assert.deepEqual(plan.assignments, [{ groupId: 10, category: 'Review', tabIds: [1] }]);
  assert.deepEqual(plan.creations, []);
});

test('assignOnly never creates a group, and leaves the tab put', () => {
  const plan = planGrouping([tab(1, 'Review'), tab(2, 'Review')], [], {
    allowNewGroups: false
  });
  assert.deepEqual(plan.creations, []);
  assert.deepEqual(plan.assignments, []);
  assert.deepEqual(plan.touchedTabIds, []);
});

test('assignOnly moves a PR opened from Slack out of the Chat group', () => {
  // Chrome puts a link opened inside the Chat group into Chat; the
  // tab classifies as Review, so it should move to the Review group.
  const managed: ManagedGroup[] = [
    { groupId: 10, category: 'Chat' },
    { groupId: 11, category: 'Review' }
  ];
  const plan = planGrouping([tab(1, 'Review', 10)], managed, { allowNewGroups: false });
  assert.deepEqual(plan.assignments, [{ groupId: 11, category: 'Review', tabIds: [1] }]);
});

test('assignOnly leaves a tab alone when its category has no group yet', () => {
  const managed: ManagedGroup[] = [{ groupId: 10, category: 'Chat' }];
  const plan = planGrouping([tab(1, 'Review', 10)], managed, { allowNewGroups: false });
  assert.deepEqual(plan.assignments, []);
  assert.deepEqual(plan.touchedTabIds, []);
});

test('allowNewGroups defaults to true so manual Organize is unchanged', () => {
  const plan = planGrouping([tab(1, 'Review')], []);
  assert.deepEqual(plan.creations, [{ category: 'Review', tabIds: [1] }]);
});
