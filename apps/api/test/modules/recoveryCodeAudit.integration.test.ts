import { beforeEach, describe, expect, it } from 'vitest';
import { adminUserService } from '../../src/services/AdminUserService';
import { newId, registerUser, request } from '../helpers/app';
import { truncateAll } from '../helpers/database';

beforeEach(truncateAll);

/** One fresh batch issued the way the admin panel does it: regenerating for an existing user. */
async function adminIssuedCode(): Promise<{ username: string; code: string }> {
  const user = await registerUser(`audit_${newId().slice(-10).toLowerCase()}`);
  const codes = await adminUserService.regenerateRecoveryCodes(user.userId);
  return { username: user.username, code: codes[0] };
}

const redeem = (username: string, recoveryCode: string) =>
  request('POST', '/auth/forgot-password', {
    body: { username, recoveryCode, newPassword: 'nova-senha-123' },
  });

describe('a recovery code as a person actually types it', () => {
  it('works exactly as issued by the admin panel', async () => {
    const { username, code } = await adminIssuedCode();

    const { status } = await redeem(username, code);

    expect(status).toBe(200);
  });

  it.each([
    ['in lowercase (a keyboard that does not capitalize)', (code: string) => code.toLowerCase()],
    ['without the hyphen', (code: string) => code.replace('-', '')],
    ['with a space instead of the hyphen', (code: string) => code.replace('-', ' ')],
    ['with an en dash from a word processor', (code: string) => code.replace('-', '–')],
    ['with spaces around it', (code: string) => `  ${code}  `],
    ['with a trailing newline from a paste', (code: string) => `${code}\n`],
    ['with a non-breaking space', (code: string) => code.replace('-', ' ')],
  ])('is accepted %s', async (_label, variant) => {
    const { username, code } = await adminIssuedCode();

    const { status } = await redeem(username, variant(code));

    expect(status).toBe(200);
  });

  it('is accepted for a username typed with stray spaces', async () => {
    const { username, code } = await adminIssuedCode();

    const { status } = await redeem(` ${username} `, code);

    expect(status).toBe(200);
  });

  it('still refuses a code that is simply wrong', async () => {
    const { username } = await adminIssuedCode();

    const { status, data } = await redeem(username, 'AAAAA-AAAAA');

    expect(status).toBe(401);
    expect(data.message).toBe('Invalid username or recovery code.');
  });
});

describe('the attempt limit of a recovery code', () => {
  it('says when it is the limit, not the code, that refuses - with a status of its own', async () => {
    const { username, code } = await adminIssuedCode();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await redeem(username, 'AAAAA-AAAAA')).status).toBe(401);
    }
    const locked = await redeem(username, code);

    expect(locked.status).toBe(429);
    expect(locked.data.message).toMatch(/too many attempts/i);
    expect(locked.data.message).toMatch(/minutes/i);
  });

  it('is not spent by the attempts of a different account', async () => {
    const first = await adminIssuedCode();
    const second = await adminIssuedCode();
    for (let attempt = 0; attempt < 5; attempt += 1) await redeem(first.username, 'AAAAA-AAAAA');

    expect((await redeem(second.username, second.code)).status).toBe(200);
  });
});
