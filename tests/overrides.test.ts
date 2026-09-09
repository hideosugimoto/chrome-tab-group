import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  firstPathSegment,
  hostKeyOf,
  hostPathKeyOf,
  lookupOverride,
  overrideKeyFor,
  overrideKeysFor,
  withOverride,
  withoutOverrides
} from '../src/domain/overrides';

test('hostKeyOf normalizes case and rejects empty', () => {
  assert.equal(hostKeyOf('GitHub.com'), 'github.com');
  assert.equal(hostKeyOf('  '), null);
});

test('firstPathSegment picks the first non-empty segment', () => {
  assert.equal(firstPathSegment('/myorg/repo/pull/1'), 'myorg');
  assert.equal(firstPathSegment('/MyOrg/'), 'myorg');
  assert.equal(firstPathSegment('/'), null);
  assert.equal(firstPathSegment(''), null);
});

test('hostPathKeyOf is null when there is no path segment', () => {
  assert.equal(hostPathKeyOf('github.com', '/myorg/repo'), 'github.com/myorg');
  assert.equal(hostPathKeyOf('github.com', '/'), null);
});

test('overrideKeysFor returns most specific first', () => {
  assert.deepEqual(overrideKeysFor('github.com', '/myorg/repo'), [
    'github.com/myorg',
    'github.com'
  ]);
  assert.deepEqual(overrideKeysFor('github.com', '/'), ['github.com']);
});

test('overrideKeyFor honours the requested scope', () => {
  assert.equal(overrideKeyFor('github.com', '/myorg/x', 'host'), 'github.com');
  assert.equal(overrideKeyFor('github.com', '/myorg/x', 'hostPath'), 'github.com/myorg');
  assert.equal(overrideKeyFor('github.com', '/', 'hostPath'), null);
});

test('lookupOverride prefers the hostPath key over the host key', () => {
  const overrides = { 'github.com': 'Docs', 'github.com/myorg': 'Dev' } as const;
  assert.deepEqual(lookupOverride('github.com', '/myorg/repo', overrides), {
    key: 'github.com/myorg',
    category: 'Dev',
    scope: 'hostPath'
  });
  assert.deepEqual(lookupOverride('github.com', '/other/repo', overrides), {
    key: 'github.com',
    category: 'Docs',
    scope: 'host'
  });
});

test('lookupOverride returns null with no overrides', () => {
  assert.equal(lookupOverride('github.com', '/a/b', undefined), null);
  assert.equal(lookupOverride('github.com', '/a/b', {}), null);
});

test('withOverride and withoutOverrides do not mutate their input', () => {
  const base = { 'a.com': 'Dev' } as const;
  const added = withOverride(base, 'b.com', 'Docs');
  assert.deepEqual(base, { 'a.com': 'Dev' });
  assert.deepEqual(added, { 'a.com': 'Dev', 'b.com': 'Docs' });

  const removed = withoutOverrides(added, ['a.com']);
  assert.deepEqual(added, { 'a.com': 'Dev', 'b.com': 'Docs' });
  assert.deepEqual(removed, { 'b.com': 'Docs' });
});
