import { beforeEach, describe, expect, it } from 'vitest';
import { InvalidCurrentPasswordError, TagAlreadyTakenError, UserService } from '../../src/services/UserService';
import { registerUser, request } from '../helpers/app';
import { truncateAll } from '../helpers/database';

beforeEach(truncateAll);

describe('UserService', () => {
  it('resolves tags without case sensitivity but refuses a tag another account owns', async () => {
    const ana = await registerUser('ana');
    const bia = await registerUser('bia');
    const service = new UserService();
    await service.updateUserTag(ana.userId, 'Heroine');

    await expect(service.getUserByTag('hErOiNe')).resolves.toMatchObject({ id: ana.userId, tag: 'Heroine' });
    await expect(service.updateUserTag(bia.userId, 'heroine')).rejects.toBeInstanceOf(TagAlreadyTakenError);
  });

  it('requires the current password before changing it, then makes the new password usable', async () => {
    const ana = await registerUser('ana');
    const service = new UserService();

    await expect(service.changeOwnPassword(ana.userId, 'errada', 'senha-nova-123')).rejects.toBeInstanceOf(InvalidCurrentPasswordError);
    await service.changeOwnPassword(ana.userId, ana.password, 'senha-nova-123');

    expect((await request('POST', '/auth/login', {
      body: { username: ana.username, password: 'senha-nova-123' },
    })).status).toBe(200);
  });
});
