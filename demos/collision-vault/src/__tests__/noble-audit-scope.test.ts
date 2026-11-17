/* What "audited" means for the @noble/hashes version this lab actually ships.
 *
 * src/hashing/md5.ts called it "the audited, dependency-free `@noble/hashes`
 * implementation" with no version. The library records exactly one independent
 * audit — "at version 1.0.0, in Jan 2022, independently, by [Cure53]", scope
 * "everything, besides blake3, sha3-addons, sha1 and argon2" — and this lab
 * pins 2.4.0, which that audit does not cover.
 *
 * Both sides are read here: the comment, and the installed library's own
 * README. An upgrade that changes the audit record, or an edit that drops the
 * version, fails rather than passing quietly.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

const source = read('../hashing/md5.ts');
const nobleReadme = read('../../node_modules/@noble/hashes/README.md');
const pinned = JSON.parse(read('../../package.json')).dependencies['@noble/hashes'];

describe('the @noble/hashes audit claim', () => {
  it('pins a version later than any audit the library records', () => {
    expect(pinned).toBe('^2.4.0');
    expect(nobleReadme).toContain('The library has been audited');
    expect(nobleReadme).toMatch(/at version 1\.0\.0, in Jan 2022, independently, by \[Cure53\]/);
    // Nothing in the 2.x line has been audited.
    expect(nobleReadme).not.toMatch(/at version 2\.\d+\.\d+, in [A-Z]/);
  });

  it('never calls the shipped library simply "audited"', () => {
    expect(source).not.toContain('the audited, dependency-free');
    expect(source).toContain('at version 1.0.0,\n// in Jan 2022, independently, by [Cure53]');
    expect(source).toContain('This lab pins v2.4.0, which that audit\n// does not cover');
  });

  it('quotes the audit scope the library states', () => {
    const scope = 'everything, besides\n// blake3, sha3-addons, sha1 and argon2';
    expect(source).toContain(scope);
    expect(nobleReadme).toContain(
      'Scope: everything, besides `blake3`, `sha3-addons`, `sha1` and `argon2`',
    );
  });
});
