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

test('a path segment named after an environment does not beat a real service', () => {
  // Regression: /dev/, /test/ and /preview/ used to be checked before the
  // domain rules, so every one of these landed in Local.
  assert.equal(classifyDetailed({ url: 'https://github.com/acme/dev', title: '' }).ruleName, 'github-bare');
  assert.equal(classifyDetailed({ url: 'https://qiita.com/items/test', title: '' }).ruleName, 'qiita');
  assert.equal(classifyDetailed({ url: 'https://vercel.com/acme/preview', title: '' }).ruleName, 'vercel');
});

test('an environment path still wins on a host no rule claims', () => {
  const r = classifyDetailed({ url: 'https://myapp.example/staging/login', title: '' });
  assert.equal(r.category, 'Local');
  assert.equal(r.source, 'local');
  assert.equal(r.ruleName, 'local-path');
});

test('a local-looking hostname is decided before any domain rule', () => {
  const r = classifyDetailed({ url: 'http://staging.example.com/issues/1', title: '' });
  assert.equal(r.category, 'Local');
  assert.equal(r.ruleName, 'local-host');
  assert.equal(classifyDetailed({ url: 'http://192.168.1.10:8080/', title: '' }).category, 'Local');
});

test('environment keywords match whole path segments only', () => {
  // "test-driven-development" is prose, not an environment.
  const r = classifyDetailed({ url: 'https://example.invalid/test-driven-development', title: '' });
  assert.equal(r.category, 'Misc');
});

test('Confluence outranks the bare Jira rule on atlassian.net', () => {
  const r = classifyDetailed({ url: 'https://acme.atlassian.net/wiki/spaces/ENG/pages/1', title: '' });
  assert.equal(r.category, 'Docs');
  assert.equal(r.ruleName, 'confluence');
  // Jira itself must keep working.
  assert.equal(classifyDetailed({ url: 'https://acme.atlassian.net/browse/P-1', title: '' }).category, 'Review');
});

test('BigQuery outranks the bare GCP console rule', () => {
  const r = classifyDetailed({ url: 'https://console.cloud.google.com/bigquery?project=x', title: '' });
  assert.equal(r.category, 'Data');
  assert.equal(r.ruleName, 'bigquery');
  // The rest of the console must stay Cloud.
  assert.equal(classifyDetailed({ url: 'https://console.cloud.google.com/run', title: '' }).category, 'Cloud');
});

test('a bare "docs" in a title is not enough to force Research', () => {
  assert.equal(classifyDetailed({ url: 'https://example.invalid/x', title: 'Docs are great' }).category, 'Misc');
  assert.equal(
    classifyDetailed({ url: 'https://example.invalid/x', title: 'Stripe Documentation' }).category,
    'Research'
  );
});
