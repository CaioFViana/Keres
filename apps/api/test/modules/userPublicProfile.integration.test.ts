import { beforeEach, describe, expect, it } from 'vitest';
import { registerUser, request, type TestUser } from '@test/helpers/app';
import { truncateAll } from '@test/helpers/database';

/**
 * The author page's own texts - biography, links, theme - kept apart from the short bio friends see. They are the
 * account's own to read and write, they never ride on the friend-facing profile, and they leave with the account.
 */

let ana: TestUser;
let bia: TestUser;

const read = (token?: string) => request('GET', '/user/public-profile', { token });
const write = (token: string | undefined, body: unknown) =>
  request('PUT', '/user/public-profile', { token, body });

const link = { label: 'My site', url: 'https://example.com' };

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
  bia = await registerUser('bia');
});

describe('the author page of an account', () => {
  it('starts empty', async () => {
    const response = await read(ana.token);
    expect(response.status).toBe(200);
    expect(response.data).toEqual({ biography: null, links: [], theme: null });
  });

  it('needs a session to read or write', async () => {
    expect((await read()).status).toBe(401);
    expect((await write(undefined, { biography: 'x' })).status).toBe(401);
  });

  it('saves the biography, the links and the theme, and gives them back', async () => {
    const saved = await write(ana.token, {
      biography: '  First line\r\nSecond line  ',
      links: [link, { label: 'Shop', url: 'https://shop.example.com/keres' }],
      theme: 'ocean',
    });
    expect(saved.status).toBe(200);
    expect(saved.data).toEqual({
      biography: 'First line\nSecond line',
      links: [link, { label: 'Shop', url: 'https://shop.example.com/keres' }],
      theme: 'ocean',
    });
    expect((await read(ana.token)).data).toEqual(saved.data);
  });

  it('leaves a field that was not sent as it was, and clears with null or an empty list', async () => {
    await write(ana.token, { biography: 'Hello', links: [link], theme: 'forest' });

    await write(ana.token, { biography: 'Hello again' });
    expect((await read(ana.token)).data).toEqual({
      biography: 'Hello again',
      links: [link],
      theme: 'forest',
    });

    await write(ana.token, { biography: null, links: [], theme: null });
    expect((await read(ana.token)).data).toEqual({ biography: null, links: [], theme: null });
  });

  it('stores a biography of only whitespace as none', async () => {
    await write(ana.token, { biography: ' \n ' });
    expect((await read(ana.token)).data.biography).toBeNull();
  });

  it("is the account's own: another account's page is not touched", async () => {
    await write(ana.token, { biography: 'Ana writes' });
    expect((await read(bia.token)).data.biography).toBeNull();
  });

  it.each([
    ['an address that runs a script', { links: [{ label: 'x', url: 'javascript:alert(1)' }] }],
    ['an address with credentials', { links: [{ label: 'x', url: 'https://u:p@example.com' }] }],
    ['a link without a label', { links: [{ label: ' ', url: 'https://example.com' }] }],
    ['too many links', { links: Array.from({ length: 9 }, () => link) }],
    ['a biography over the limit', { biography: 'x'.repeat(4001) }],
    ['a theme that does not exist', { theme: 'not-a-palette' }],
  ])('refuses %s', async (_name, body) => {
    const response = await write(ana.token, body);
    expect(response.status).toBe(400);
    expect((await read(ana.token)).data).toEqual({ biography: null, links: [], theme: null });
  });

  it('does not travel on the friend-facing profile', async () => {
    await write(ana.token, { biography: 'Only for the author page', theme: 'ocean' });
    const details = await request('GET', `/user/details/${ana.userId}`, { token: bia.token });
    expect(details.status).toBe(200);
    expect(details.data).not.toHaveProperty('biography');
    expect(details.data).not.toHaveProperty('links');
    expect(JSON.stringify(details.data)).not.toContain('Only for the author page');
  });

  it('comes out in the account data export', async () => {
    await write(ana.token, { biography: 'Exported', links: [link] });
    const exported = await request('GET', '/user/data', { token: ana.token });
    expect(exported.status).toBe(200);
    expect(exported.data.publicProfile).toEqual({
      biography: 'Exported',
      links: [link],
      theme: null,
    });
  });
});
