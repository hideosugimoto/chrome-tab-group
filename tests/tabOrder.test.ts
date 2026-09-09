import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  planActiveTabRestore,
  planDomainClusterOrder,
  planTabMoves
} from '../src/domain/tabOrder';

const tab = (tabId: number, url: string) => ({ tabId, url });

test('same-site tabs are pulled next to each other', () => {
  const order = planDomainClusterOrder([
    tab(1, 'https://github.com/a'),
    tab(2, 'https://zenn.dev/x'),
    tab(3, 'https://github.com/b'),
    tab(4, 'https://zenn.dev/y'),
    tab(5, 'https://github.com/c')
  ]);
  assert.deepEqual(order, [1, 3, 5, 2, 4]);
});

test('sites keep the order their first tab already had', () => {
  const order = planDomainClusterOrder([
    tab(1, 'https://zenn.dev/x'),
    tab(2, 'https://github.com/a'),
    tab(3, 'https://zenn.dev/y')
  ]);
  // zenn was seen first, so zenn stays first — no alphabetical shuffle.
  assert.deepEqual(order, [1, 3, 2]);
});

test('subdomains of one site count as the same site', () => {
  const order = planDomainClusterOrder([
    tab(1, 'https://mail.google.com/'),
    tab(2, 'https://github.com/a'),
    tab(3, 'https://docs.google.com/document/d/1')
  ]);
  assert.deepEqual(order, [1, 3, 2]);
});

test('tabs with no usable URL share one bucket instead of scattering', () => {
  const order = planDomainClusterOrder([
    tab(1, 'about:blank'),
    tab(2, 'https://github.com/a'),
    tab(3, '')
  ]);
  assert.deepEqual(order, [1, 3, 2]);
});

test('an already clustered group produces no moves', () => {
  const tabs = [
    tab(1, 'https://github.com/a'),
    tab(2, 'https://github.com/b'),
    tab(3, 'https://zenn.dev/x')
  ];
  assert.deepEqual(planTabMoves([1, 2, 3], planDomainClusterOrder(tabs)), []);
});

test('moves are simulated the way Chrome applies them', () => {
  const moves = planTabMoves([1, 2, 3, 4, 5], [1, 3, 5, 2, 4]);
  // Replaying the moves must reproduce the desired order exactly.
  const strip = [1, 2, 3, 4, 5];
  for (const m of moves) {
    strip.splice(strip.indexOf(m.tabId), 1);
    strip.splice(m.offset, 0, m.tabId);
  }
  assert.deepEqual(strip, [1, 3, 5, 2, 4]);
});

test('only the tabs that are out of place move', () => {
  const moves = planTabMoves([1, 2, 3, 4], [1, 2, 4, 3]);
  assert.deepEqual(moves, [{ tabId: 4, offset: 2 }]);
});

test('a tab that vanished mid-run is skipped, not invented', () => {
  const moves = planTabMoves([1, 3], [1, 2, 3]);
  const strip = [1, 3];
  for (const m of moves) {
    strip.splice(strip.indexOf(m.tabId), 1);
    strip.splice(m.offset, 0, m.tabId);
  }
  assert.deepEqual(strip, [1, 3]);
});

test('an empty group is a no-op', () => {
  assert.deepEqual(planDomainClusterOrder([]), []);
  assert.deepEqual(planTabMoves([], []), []);
});

test('an active tab inside one of our groups is left where the passes put it', () => {
  // Restoring index 3 would drag it out of the group and out of its cluster.
  assert.equal(
    planActiveTabRestore({ originalIndex: 3, tabCount: 20, isInOurGroup: true }),
    null
  );
});

test('an active tab that stayed ungrouped is still nudged back', () => {
  assert.equal(
    planActiveTabRestore({ originalIndex: 3, tabCount: 20, isInOurGroup: false }),
    3
  );
});

test('the restore index is clamped to the tabs that still exist', () => {
  assert.equal(
    planActiveTabRestore({ originalIndex: 40, tabCount: 5, isInOurGroup: false }),
    4
  );
  assert.equal(
    planActiveTabRestore({ originalIndex: -2, tabCount: 5, isInOurGroup: false }),
    0
  );
});

test('an empty window produces no restore', () => {
  assert.equal(
    planActiveTabRestore({ originalIndex: 0, tabCount: 0, isInOurGroup: false }),
    null
  );
});
