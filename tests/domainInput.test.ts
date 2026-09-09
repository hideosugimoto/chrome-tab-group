import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeDomainInput,
  validateNewDomain,
  withDomain,
  withoutDomain
} from '../src/domain/domainInput';

test('a bare hostname passes through, lowercased and trimmed', () => {
  assert.equal(normalizeDomainInput('  Example.COM '), 'example.com');
});

test('a pasted URL is reduced to its host', () => {
  assert.equal(normalizeDomainInput('https://mail.google.com/mail/u/0/#inbox'), 'mail.google.com');
  assert.equal(normalizeDomainInput('http://example.com/'), 'example.com');
  assert.equal(normalizeDomainInput('example.com/path'), 'example.com');
});

test('port, credentials and trailing dots are stripped', () => {
  assert.equal(normalizeDomainInput('localhost:3000'), 'localhost');
  assert.equal(normalizeDomainInput('https://user:pw@git.example.com:8443/x'), 'git.example.com');
  assert.equal(normalizeDomainInput('example.com.'), 'example.com');
});

test('junk is rejected rather than silently accepted', () => {
  assert.equal(normalizeDomainInput(''), null);
  assert.equal(normalizeDomainInput('   '), null);
  assert.equal(normalizeDomainInput('not a domain'), null);
  assert.equal(normalizeDomainInput('例え.com'), null);
  assert.equal(normalizeDomainInput('-example.com'), null);
  assert.equal(normalizeDomainInput('example-.com'), null);
  assert.equal(normalizeDomainInput('https://'), null);
});

test('validateNewDomain reports why it refused', () => {
  assert.deepEqual(validateNewDomain('  ', []), { ok: false, error: 'empty' });
  assert.deepEqual(validateNewDomain('not a domain', []), { ok: false, error: 'invalid' });
  assert.deepEqual(validateNewDomain('Example.com', ['example.com']), {
    ok: false,
    error: 'duplicate'
  });
  assert.deepEqual(validateNewDomain('https://example.com/x', []), {
    ok: true,
    domain: 'example.com'
  });
});

test('withDomain sorts, dedupes and does not mutate', () => {
  const base = ['b.com'];
  const next = withDomain(base, 'a.com');
  assert.deepEqual(base, ['b.com']);
  assert.deepEqual(next, ['a.com', 'b.com']);
  assert.deepEqual(withDomain(next, 'a.com'), ['a.com', 'b.com']);
});

test('withoutDomain does not mutate', () => {
  const base = ['a.com', 'b.com'];
  assert.deepEqual(withoutDomain(base, 'a.com'), ['b.com']);
  assert.deepEqual(base, ['a.com', 'b.com']);
});
