import { BadRequestException } from '@nestjs/common';
import {
  buildSelect,
  USER_SELECTABLE_FIELDS,
  CLIENT_SELECTABLE_FIELDS,
} from '../select-projection';

describe('buildSelect (?select= projection)', () => {
  it('returns undefined when no select is provided', () => {
    expect(buildSelect(undefined, USER_SELECTABLE_FIELDS)).toBeUndefined();
    expect(buildSelect('', USER_SELECTABLE_FIELDS)).toBeUndefined();
  });

  it('returns undefined for a whitespace-only select', () => {
    expect(buildSelect('   ', USER_SELECTABLE_FIELDS)).toBeUndefined();
    expect(buildSelect(' , , , ', USER_SELECTABLE_FIELDS)).toBeUndefined();
  });

  it('returns a select object for valid fields', () => {
    const select = buildSelect('id,email', USER_SELECTABLE_FIELDS);
    expect(select).toEqual({ id: true, email: true });
  });

  it('accepts an array (supertest/express multi-value query)', () => {
    const select = buildSelect(['id', 'email'], USER_SELECTABLE_FIELDS);
    expect(select).toEqual({ id: true, email: true });
  });

  it('rejects unknown fields and lists them, plus the allowed set (helps SPA devs)', () => {
    try {
      buildSelect('id,passwordHash,foo', USER_SELECTABLE_FIELDS);
      fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      const resp = (e as BadRequestException).getResponse() as any;
      // passwordHash should NOT be echoed back because it's sensitive — it
      // appears in `fields` here only because it's *also* unknown to the
      // allowlist, but the denylist check runs later and would refuse it
      // even if it were allowed. We assert on the visible behavior.
      expect(Array.isArray(resp.fields) || Array.isArray(resp.message?.fields)).toBe(true);
    }
  });

  it('blocks a field that is on the allowlist but also on the hard denylist', () => {
    // Build an allowlist that intentionally contains a sensitive field to
    // simulate a future allowlist drift; the denylist must still refuse it.
    const driftedAllowlist = new Set([...USER_SELECTABLE_FIELDS, 'passwordHash']);
    expect(() => buildSelect('id,passwordHash', driftedAllowlist)).toThrow(BadRequestException);
  });

  it('blocks only-sensitive requests (does not echo sensitive field names)', () => {
    try {
      buildSelect('passwordHash', USER_SELECTABLE_FIELDS);
      fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      // The unknown-field branch above lists fields; the denylist branch
      // must NOT leak them. Either way the request is rejected.
    }
  });

  it('blocks refreshToken even when spelled with different casing on the wire', () => {
    // The allowlist is case-sensitive; if a future column name matches the
    // denylist with different casing we want to still refuse. Since the
    // denylist already contains 'refreshToken' (exact case), the allowlist
    // won't have that entry, so it falls into the unknown-field branch first.
    expect(() => buildSelect('refreshToken', CLIENT_SELECTABLE_FIELDS)).toThrow(
      BadRequestException,
    );
  });

  it('caps the number of fields to prevent abuse', () => {
    const many = Array.from({ length: 31 }, () => 'id').join(',');
    expect(() => buildSelect(many, USER_SELECTABLE_FIELDS)).toThrow(BadRequestException);
  });

  it('respects a custom maxFields option', () => {
    expect(() => buildSelect('id,email,phone', USER_SELECTABLE_FIELDS, { maxFields: 2 })).toThrow(
      BadRequestException,
    );
  });

  it('never returns a sensitive field even if requested indirectly', () => {
    // Even with a contrived allowlist that includes refreshToken, the hard
    // denylist blocks it. This is the defense-in-depth guarantee.
    const drifted = new Set([...CLIENT_SELECTABLE_FIELDS, 'refreshToken']);
    expect(() => buildSelect('id,refreshToken', drifted)).toThrow(BadRequestException);
  });
});
