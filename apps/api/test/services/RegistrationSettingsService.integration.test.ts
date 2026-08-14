import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import {
  REGISTRATION_SETTINGS_SINGLETON_ID,
  registrationSettings,
  users,
} from '../../src/db/schema';
import { RegistrationSettingsService } from '../../src/services/RegistrationSettingsService';
import { newId } from '../helpers/app';
import { truncateAll } from '../helpers/database';

beforeEach(truncateAll);

describe('RegistrationSettingsService integration', () => {
  it('lazily creates the singleton and applies manual registration state', async () => {
    const service = new RegistrationSettingsService();
    expect(await service.isOpenForRegistration()).toBe(true);
    expect(
      await db.query.registrationSettings.findFirst({
        where: (fields, { eq }) => eq(fields.id, REGISTRATION_SETTINGS_SINGLETON_ID),
      }),
    ).toMatchObject({ isRegistrationOpen: true, autoManage: false });

    await service.update({ isRegistrationOpen: false });
    expect(await service.isOpenForRegistration()).toBe(false);
  });

  it('computes automatic availability from the active-user cap', async () => {
    const service = new RegistrationSettingsService();
    await service.update({ autoManage: true, maxUsers: 2, isRegistrationOpen: false });
    expect(await service.isOpenForRegistration()).toBe(true);

    await db.insert(users).values([
      { id: newId(), username: 'ana', tag: 'ana', password: 'x' },
      { id: newId(), username: 'bia', tag: 'bia', password: 'x' },
      { id: newId(), username: 'carla', tag: 'carla', password: 'x', isDeleted: true },
    ] as never);
    expect(await service.isOpenForRegistration()).toBe(false);

    await service.update({ maxUsers: null });
    expect(await service.isOpenForRegistration()).toBe(true);
  });

  it('returns the updated singleton settings to the administrative caller', async () => {
    const updated = await new RegistrationSettingsService().update({
      autoManage: true,
      maxUsers: 5,
    });
    expect(updated).toMatchObject({
      id: REGISTRATION_SETTINGS_SINGLETON_ID,
      autoManage: true,
      maxUsers: 5,
    });
    expect(await db.select().from(registrationSettings)).toHaveLength(1);
  });
});
