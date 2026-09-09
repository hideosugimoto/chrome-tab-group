import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DOMAIN_RULES } from '../src/rules/domainRules';

/**
 * The rule table is evaluated with Array.prototype.find, so a row is
 * unreachable if any earlier row matches the same host without adding a
 * path / title / URL qualifier. Two rows shipped dead this way
 * (`confluence` behind `jira-bare`, `bigquery` behind `gcp-console`),
 * and nothing caught it because a dead rule fails silently — the tab
 * just lands in the wrong group.
 */

/** Best-effort representative hostname for a hostMatch regex. */
function sampleHost(re: RegExp): string | null {
  let s = re.source;
  s = s.replace(/^\(\^\|\\\.\)/, '').replace(/^\^/, '').replace(/\$$/, '');
  s = s.replace(/\(([^()]*)\)\?/g, '$1');
  s = s.replace(/\(([^()]*)\)/g, (_m, inner: string) => inner.split('|')[0]);
  s = s.replace(/\\\./g, '.').replace(/\\/g, '');
  if (!s || /[[\]*+?{}]/.test(s)) return null;
  return s.startsWith('.') ? 'sub' + s : s;
}

function isQualified(rule: (typeof DOMAIN_RULES)[number]): boolean {
  return !!(rule.pathInclude || rule.titleInclude || rule.urlInclude || rule.pathExclude);
}

test('no domain rule is shadowed into unreachability', () => {
  const dead: string[] = [];

  DOMAIN_RULES.forEach((rule, i) => {
    if (!rule.hostMatch) return;
    const host = sampleHost(rule.hostMatch);
    // Skip regexes this sampler cannot represent rather than fail on them.
    if (!host || !rule.hostMatch.test(host)) return;

    for (let j = 0; j < i; j++) {
      const earlier = DOMAIN_RULES[j];
      if (!earlier.hostMatch?.test(host)) continue;
      if (isQualified(earlier)) continue;
      dead.push(`${rule.name} is unreachable behind ${earlier.name} (host ${host})`);
      break;
    }
  });

  assert.deepEqual(dead, []);
});

test('every rule carries at least one matcher', () => {
  for (const rule of DOMAIN_RULES) {
    assert.ok(
      rule.hostMatch || rule.pathInclude || rule.titleInclude || rule.urlInclude,
      `${rule.name} has no matcher and can never fire`
    );
  }
});

test('rule names are unique', () => {
  const names = DOMAIN_RULES.map((r) => r.name);
  assert.equal(new Set(names).size, names.length);
});
