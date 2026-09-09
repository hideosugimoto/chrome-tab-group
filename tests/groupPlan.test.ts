import { test } from 'node:test';
import assert from 'node:assert/strict';

import { planGrouping, type ManagedGroup, type PlanTab } from '../src/domain/groupPlan';

const tab = (tabId: number, category: PlanTab['category'], currentGroupId = -1): PlanTab => ({
  tabId,
  category,
  currentGroupId
});

test('creates one group per category for ungrouped tabs', () => {
  const plan = planGrouping([tab(1, 'Dev'), tab(2, 'Chat'), tab(3, 'Dev')], []);
  assert.equal(plan.assignments.length, 0);
  // CATEGORY_ORDER puts Chat before Dev.
  assert.deepEqual(plan.creations, [
    { category: 'Chat', tabIds: [2] },
    { category: 'Dev', tabIds: [1, 3] }
  ]);
  assert.deepEqual(plan.touchedTabIds.sort(), [1, 2, 3]);
});

test('adds tabs to an existing managed group instead of creating one', () => {
  const managed: ManagedGroup[] = [{ groupId: 10, category: 'Dev' }];
  const plan = planGrouping([tab(1, 'Dev'), tab(2, 'Dev')], managed);
  assert.deepEqual(plan.creations, []);
  assert.deepEqual(plan.assignments, [{ groupId: 10, category: 'Dev', tabIds: [1, 2] }]);
});

test('tabs already in the correct group are not touched', () => {
  const managed: ManagedGroup[] = [{ groupId: 10, category: 'Dev' }];
  const plan = planGrouping([tab(1, 'Dev', 10), tab(2, 'Dev', -1)], managed);
  assert.deepEqual(plan.assignments, [{ groupId: 10, category: 'Dev', tabIds: [2] }]);
  assert.deepEqual(plan.touchedTabIds, [2]);
});

test('a reclassified tab moves out of the wrong managed group', () => {
  const managed: ManagedGroup[] = [
    { groupId: 10, category: 'Dev' },
    { groupId: 11, category: 'Docs' }
  ];
  // Tab 1 sits in the Dev group but now classifies as Docs.
  const plan = planGrouping([tab(1, 'Docs', 10)], managed);
  assert.deepEqual(plan.assignments, [{ groupId: 11, category: 'Docs', tabIds: [1] }]);
});

test('an empty plan touches nothing', () => {
  const managed: ManagedGroup[] = [{ groupId: 10, category: 'Dev' }];
  const plan = planGrouping([tab(1, 'Dev', 10)], managed);
  assert.deepEqual(plan.assignments, []);
  assert.deepEqual(plan.creations, []);
  assert.deepEqual(plan.touchedTabIds, []);
});

test('minTabsPerNewGroup suppresses creating a group for a lone tab', () => {
  const plan = planGrouping([tab(1, 'Dev'), tab(2, 'Chat'), tab(3, 'Chat')], [], {
    minTabsPerNewGroup: 2
  });
  assert.deepEqual(plan.creations, [{ category: 'Chat', tabIds: [2, 3] }]);
  assert.deepEqual(plan.touchedTabIds, [2, 3]);
});

test('minTabsPerNewGroup does not block joining an existing group', () => {
  const managed: ManagedGroup[] = [{ groupId: 10, category: 'Dev' }];
  const plan = planGrouping([tab(1, 'Dev')], managed, { minTabsPerNewGroup: 5 });
  assert.deepEqual(plan.assignments, [{ groupId: 10, category: 'Dev', tabIds: [1] }]);
});

test('skipCategories prevents new groups for that category only', () => {
  const plan = planGrouping([tab(1, 'Misc'), tab(2, 'Dev')], [], { skipCategories: ['Misc'] });
  assert.deepEqual(plan.creations, [{ category: 'Dev', tabIds: [2] }]);
});

test('duplicate managed groups for one category collapse to the first', () => {
  const managed: ManagedGroup[] = [
    { groupId: 10, category: 'Dev' },
    { groupId: 12, category: 'Dev' }
  ];
  const plan = planGrouping([tab(1, 'Dev', 12)], managed);
  assert.deepEqual(plan.assignments, [{ groupId: 10, category: 'Dev', tabIds: [1] }]);
});
