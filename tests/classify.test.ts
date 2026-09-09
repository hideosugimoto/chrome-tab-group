import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classify, classifyDetailed } from '../src/domain/classify';

test('built-in rules still classify the obvious cases', () => {
  assert.equal(classify({ url: 'https://github.com/o/r/pull/1', title: 'PR' }), 'Review');
  assert.equal(classify({ url: 'https://app.slack.com/client/T1', title: 'Slack' }), 'Chat');
  assert.equal(classify({ url: 'http://localhost:3000/', title: 'app' }), 'Local');
});

test('classifyDetailed reports the matched rule name', () => {
  const r = classifyDetailed({ url: 'https://github.com/o/r/pull/1', title: 'PR' });
  assert.equal(r.category, 'Review');
  assert.equal(r.source, 'domain');
  assert.equal(r.ruleName, 'github-pr');
});

test('unmatched URLs fall back to Misc with no rule name', () => {
  const r = classifyDetailed({ url: 'https://example.invalid/x', title: 'x' });
  assert.equal(r.category, 'Misc');
  assert.equal(r.source, 'fallback');
  assert.equal(r.ruleName, null);
});

test('unparsable URLs are Misc rather than throwing', () => {
  assert.equal(classifyDetailed({ url: 'not a url', title: '' }).category, 'Misc');
});

test('an override beats the built-in domain rule', () => {
  const r = classifyDetailed(
    { url: 'https://github.com/o/r/pull/1', title: 'PR' },
    { overrides: { 'github.com': 'Docs' } }
  );
  assert.equal(r.category, 'Docs');
  assert.equal(r.source, 'override');
  assert.equal(r.ruleName, 'github.com');
});

test('an override beats the local-environment heuristic', () => {
  const r = classifyDetailed(
    { url: 'http://localhost:3000/admin', title: 'admin' },
    { overrides: { localhost: 'Dev' } }
  );
  assert.equal(r.category, 'Dev');
  assert.equal(r.source, 'override');
});

test('the more specific override wins', () => {
  const overrides = { 'github.com': 'Docs', 'github.com/myorg': 'Dev' } as const;
  assert.equal(
    classifyDetailed({ url: 'https://github.com/myorg/r', title: '' }, { overrides }).category,
    'Dev'
  );
  assert.equal(
    classifyDetailed({ url: 'https://github.com/other/r', title: '' }, { overrides }).category,
    'Docs'
  );
});

test('custom rules shadow the built-ins', () => {
  const r = classifyDetailed(
    { url: 'https://github.com/o/r/pull/1', title: 'PR' },
    { customRules: [{ name: 'mine', hostMatch: /github\.com$/, category: 'Design' }] }
  );
  assert.equal(r.category, 'Design');
  assert.equal(r.source, 'custom');
  assert.equal(r.ruleName, 'mine');
});
