import { test } from 'node:test';
import assert from 'node:assert/strict';

import { planUndoRegroup } from '../src/domain/undoPlan';
import type { UndoGroupSnapshot, UndoTabSnapshot } from '../src/types';

const tab = (tabId: number, groupId: number): UndoTabSnapshot => ({
  tabId,
  groupId,
  index: tabId,
  pinned: false
});

const meta = (groupId: number, title: string): UndoGroupSnapshot => ({
  groupId,
  title,
  color: 'blue',
  collapsed: false
});

test('reuses a group that survived the ungroup step', () => {
  const steps = planUndoRegroup([tab(1, 10)], [meta(10, 'Dev')], new Set([10]));
  assert.equal(steps.length, 1);
  assert.equal(steps[0]?.reuseGroupId, 10);
  assert.deepEqual(steps[0]?.tabIds, [1]);
});

test('recreates a group that the ungroup step destroyed', () => {
  const steps = planUndoRegroup([tab(1, 10)], [meta(10, 'Dev')], new Set());
  assert.equal(steps[0]?.reuseGroupId, null);
  assert.equal(steps[0]?.meta?.title, 'Dev');
});

test('ungrouped tabs produce no step', () => {
  assert.deepEqual(planUndoRegroup([tab(1, -1), tab(2, -1)], [], new Set()), []);
});

test('tabs from the same old group are batched into one step', () => {
  const steps = planUndoRegroup([tab(1, 10), tab(2, 10)], [meta(10, 'Dev')], new Set([10]));
  assert.equal(steps.length, 1);
  assert.deepEqual(steps[0]?.tabIds, [1, 2]);
});

test('a vanished group with no recorded metadata is skipped, not invented', () => {
  assert.deepEqual(planUndoRegroup([tab(1, 10)], [], new Set()), []);
});

test('a surviving group with no metadata is still rejoined', () => {
  const steps = planUndoRegroup([tab(1, 10)], [], new Set([10]));
  assert.equal(steps.length, 1);
  assert.equal(steps[0]?.reuseGroupId, 10);
  assert.equal(steps[0]?.meta, null);
});

test('separate old groups produce separate steps', () => {
  const steps = planUndoRegroup(
    [tab(1, 10), tab(2, 11)],
    [meta(10, 'Dev'), meta(11, 'Docs')],
    new Set([10])
  );
  assert.equal(steps.length, 2);
  assert.equal(steps.find((s) => s.tabIds.includes(1))?.reuseGroupId, 10);
  assert.equal(steps.find((s) => s.tabIds.includes(2))?.reuseGroupId, null);
});
