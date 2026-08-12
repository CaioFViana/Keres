import { beforeEach, describe, expect, it } from 'vitest';
import { newId, registerUser, request, type TestUser } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let ana: TestUser;

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
});

describe('GET /user/details/:userId', () => {
  it('returns the public profile of another user', async () => {
    const bia = await registerUser('bia');

    const { status, data } = await request('GET', `/user/details/${bia.userId}`, { token: ana.token });

    expect(status).toBe(200);
    expect(data).toMatchObject({ id: bia.userId, username: 'bia' });
  });

  it('never exposes the password hash', async () => {
    const { data } = await request('GET', `/user/details/${ana.userId}`, { token: ana.token });

    expect(data.password).toBeUndefined();
    expect(JSON.stringify(data)).not.toContain('$2b$');
  });

  it('answers 404 for a well-formed id that belongs to nobody', async () => {
    const { status, data } = await request('GET', `/user/details/${newId()}`, { token: ana.token });

    expect(status).toBe(404);
    expect(data.message).toBe('User not found');
  });

  it('rejects an id that is not a ULID', async () => {
    const { status } = await request('GET', '/user/details/curto', { token: ana.token });

    expect(status).toBe(422);
  });

  it('requires a session', async () => {
    const { status } = await request('GET', `/user/details/${ana.userId}`);

    expect(status).toBe(401);
  });
});

describe('GET /user/by-tag/:tag', () => {
  it('resolves a user by the tag seeded from their username', async () => {
    const { status, data } = await request('GET', '/user/by-tag/ana', { token: ana.token });

    expect(status).toBe(200);
    expect(data.id).toBe(ana.userId);
  });

  it('matches the tag regardless of case, since people type it by hand', async () => {
    const { status, data } = await request('GET', '/user/by-tag/ANA', { token: ana.token });

    expect(status).toBe(200);
    expect(data.id).toBe(ana.userId);
  });

  it('answers 404 for a tag nobody claimed', async () => {
    const { status } = await request('GET', '/user/by-tag/ninguem', { token: ana.token });

    expect(status).toBe(404);
  });

  it('requires a session', async () => {
    const { status } = await request('GET', '/user/by-tag/ana');

    expect(status).toBe(401);
  });
});

describe('PUT /user/tag', () => {
  it('changes the tag and makes the user findable by it', async () => {
    const { status } = await request('PUT', '/user/tag', { token: ana.token, body: { tag: 'aninha' } });

    expect(status).toBe(200);
    const lookup = await request('GET', '/user/by-tag/aninha', { token: ana.token });
    expect(lookup.data.id).toBe(ana.userId);
  });

  it('frees the previous tag for someone else to take', async () => {
    await request('PUT', '/user/tag', { token: ana.token, body: { tag: 'aninha' } });
    const bia = await registerUser('bia');

    const { status } = await request('PUT', '/user/tag', { token: bia.token, body: { tag: 'ana' } });

    expect(status).toBe(200);
  });

  it('refuses a tag another account already holds', async () => {
    const bia = await registerUser('bia');

    const { status, data } = await request('PUT', '/user/tag', { token: bia.token, body: { tag: 'ana' } });

    expect(status).toBe(409);
    expect(data.message).toBe('Tag is already taken.');
  });

  it('rejects a tag the schema does not accept', async () => {
    const { status } = await request('PUT', '/user/tag', { token: ana.token, body: { tag: '' } });

    expect(status).toBe(400);
  });

  it('requires a session', async () => {
    const { status } = await request('PUT', '/user/tag', { body: { tag: 'aninha' } });

    expect(status).toBe(401);
  });
});

describe('PUT /user/profile', () => {
  it('updates only the fields that were sent', async () => {
    await request('PUT', '/user/profile', { token: ana.token, body: { bio: 'Escritora', avatarColor: '#ff0000' } });

    const { data } = await request('PUT', '/user/profile', { token: ana.token, body: { avatarIcon: 'book' } });

    expect(data).toMatchObject({ bio: 'Escritora', avatarColor: '#ff0000', avatarIcon: 'book' });
  });

  it('clears a field when it is explicitly set to null', async () => {
    await request('PUT', '/user/profile', { token: ana.token, body: { bio: 'Escritora' } });

    const { data } = await request('PUT', '/user/profile', { token: ana.token, body: { bio: null } });

    expect(data.bio).toBeNull();
  });

  it('requires a session', async () => {
    const { status } = await request('PUT', '/user/profile', { body: { bio: 'oi' } });

    expect(status).toBe(401);
  });
});

describe('PUT /user/password', () => {
  it('changes the password when the current one is right', async () => {
    const { status } = await request('PUT', '/user/password', {
      token: ana.token,
      body: { currentPassword: ana.password, newPassword: 'nova-senha-123' },
    });

    expect(status).toBe(200);
  });

  it('makes the new password the one that logs in', async () => {
    await request('PUT', '/user/password', {
      token: ana.token,
      body: { currentPassword: ana.password, newPassword: 'nova-senha-123' },
    });

    const withNew = await request('POST', '/auth/login', { body: { username: 'ana', password: 'nova-senha-123' } });
    const withOld = await request('POST', '/auth/login', { body: { username: 'ana', password: ana.password } });

    expect(withNew.status).toBe(200);
    expect(withOld.status).toBe(401);
  });

  it('refuses to change the password without the current one', async () => {
    const { status } = await request('PUT', '/user/password', {
      token: ana.token,
      body: { currentPassword: 'chute', newPassword: 'nova-senha-123' },
    });

    expect(status).toBe(401);
  });

  it('leaves the old password working when the change is refused', async () => {
    await request('PUT', '/user/password', {
      token: ana.token,
      body: { currentPassword: 'chute', newPassword: 'nova-senha-123' },
    });

    const { status } = await request('POST', '/auth/login', { body: { username: 'ana', password: ana.password } });
    expect(status).toBe(200);
  });

  it('requires a session', async () => {
    const { status } = await request('PUT', '/user/password', {
      body: { currentPassword: ana.password, newPassword: 'nova-senha-123' },
    });

    expect(status).toBe(401);
  });
});
