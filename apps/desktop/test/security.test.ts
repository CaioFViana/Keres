import { describe, expect, it } from 'vitest';
import { assertValidServerId, isTrustedRendererUrl } from '../src/security';

describe('desktop IPC security', () => {
  it('accepts only the internal app renderer origin', () => {
    expect(isTrustedRendererUrl('app://app/')).toBe(true);
    expect(isTrustedRendererUrl('app://app/settings')).toBe(true);
    expect(isTrustedRendererUrl('https://app/')).toBe(false);
    expect(isTrustedRendererUrl('app://app.evil/')).toBe(false);
    expect(isTrustedRendererUrl(undefined)).toBe(false);
  });

  it('rejects unsafe server identifiers', () => {
    expect(() => assertValidServerId('server_01-A')).not.toThrow();
    expect(() => assertValidServerId('../outside')).toThrow('Invalid server identifier.');
    expect(() => assertValidServerId('')).toThrow('Invalid server identifier.');
  });
});
