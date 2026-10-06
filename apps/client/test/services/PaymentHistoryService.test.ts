/**
 * @jest-environment node
 */
import * as schema from '../../src/db/schema';
import type { ServerSelect } from '../../src/db/schema';

const mockGetHistory = jest.fn();
jest.mock('../../src/services/PaymentApiService', () => ({
  __esModule: true,
  paymentApi: { getHistory: (...args: unknown[]) => mockGetHistory(...args) },
}));

import {
  createPaymentHistoryService,
  PAYMENT_HISTORY_CHANGED,
} from '../../src/services/PaymentHistoryService';
import { entityEventEmitter } from '../../src/utils/EventEmitter';
import { entityBase } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

const server = (id: string) =>
  ({
    id,
    idUser: 'me',
    userName: 'Me',
    tag: 'me',
    name: id,
    url: `https://${id}.test`,
    ...entityBase,
  }) as ServerSelect;

const item = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  kind: 'payment_succeeded',
  tierName: 'Pro',
  amountCents: 2500,
  currency: 'BRL',
  createdAt: '2026-10-04T12:00:00.000Z',
  ...over,
});

beforeEach(async () => {
  jest.clearAllMocks();
  database = await createTestDatabase();
  await database.db.insert(schema.servers).values([server('a'), server('b')]);
});
afterEach(() => database.close());

describe('PaymentHistoryService', () => {
  it("keeps the server's answer on the device, newest first, without anything of the provider's", async () => {
    mockGetHistory.mockResolvedValueOnce({
      items: [
        item('02', { createdAt: '2026-10-05T12:00:00.000Z', amountCents: 3000 }),
        item('01'),
        item('00', { kind: 'gift_granted', amountCents: 0, createdAt: '2026-09-01T12:00:00.000Z' }),
      ],
      nextBefore: null,
    });
    const service = createPaymentHistoryService(database.db);

    expect(await service.syncWithServer(server('a'))).toBe('synced');

    const rows = await service.getForServer('a');
    expect(rows.map((row) => row.id)).toEqual(['02', '01', '00']);
    expect(rows[0]).toMatchObject({ tierName: 'Pro', amountCents: 3000, currency: 'BRL' });
    expect(rows[0].createdAt).toEqual(new Date('2026-10-05T12:00:00.000Z'));
    // Only these columns exist: nothing to hold a reference, a token or a way to pay.
    expect(Object.keys(rows[0]).sort()).toEqual(
      ['amountCents', 'createdAt', 'currency', 'id', 'kind', 'serverId', 'tierName'].sort(),
    );
  });

  it('replaces what was saved for that server only, and says so', async () => {
    const service = createPaymentHistoryService(database.db);
    mockGetHistory.mockResolvedValueOnce({ items: [item('old')], nextBefore: null });
    await service.syncWithServer(server('a'));
    mockGetHistory.mockResolvedValueOnce({ items: [item('other')], nextBefore: null });
    await service.syncWithServer(server('b'));
    const changed = jest.fn();
    entityEventEmitter.on(PAYMENT_HISTORY_CHANGED, changed);

    mockGetHistory.mockResolvedValueOnce({
      items: [item('new-1'), item('new-2')],
      nextBefore: null,
    });
    await service.syncWithServer(server('a'));
    entityEventEmitter.off(PAYMENT_HISTORY_CHANGED, changed);

    expect((await service.getForServer('a')).map((row) => row.id).sort()).toEqual([
      'new-1',
      'new-2',
    ]);
    expect((await service.getForServer('b')).map((row) => row.id)).toEqual(['other']);
    expect(changed).toHaveBeenCalledWith('a');
  });

  it('follows the pages until the server has no more', async () => {
    mockGetHistory
      .mockResolvedValueOnce({ items: [item('03'), item('02')], nextBefore: '02' })
      .mockResolvedValueOnce({ items: [item('01')], nextBefore: null });
    const service = createPaymentHistoryService(database.db);

    await service.syncWithServer(server('a'));

    expect(mockGetHistory).toHaveBeenNthCalledWith(1, expect.anything(), {
      limit: 100,
      before: undefined,
    });
    expect(mockGetHistory).toHaveBeenNthCalledWith(2, expect.anything(), {
      limit: 100,
      before: '02',
    });
    expect((await service.getForServer('a')).map((row) => row.id)).toEqual(['03', '02', '01']);
  });

  it('keeps the saved copy when the server cannot be reached, or does not have the route', async () => {
    const service = createPaymentHistoryService(database.db);
    mockGetHistory.mockResolvedValueOnce({ items: [item('kept')], nextBefore: null });
    await service.syncWithServer(server('a'));

    mockGetHistory.mockRejectedValueOnce({ code: 'ERR_NETWORK' });
    expect(await service.syncWithServer(server('a'))).toBe('offline');
    mockGetHistory.mockRejectedValueOnce({ response: { status: 404 } });
    expect(await service.syncWithServer(server('a'))).toBe('unsupported');

    expect((await service.getForServer('a')).map((row) => row.id)).toEqual(['kept']);
  });

  it('lets any other failure through, and still keeps the saved copy', async () => {
    const service = createPaymentHistoryService(database.db);
    mockGetHistory.mockResolvedValueOnce({ items: [item('kept')], nextBefore: null });
    await service.syncWithServer(server('a'));

    mockGetHistory.mockRejectedValueOnce({ response: { status: 500 } });
    await expect(service.syncWithServer(server('a'))).rejects.toBeDefined();

    expect((await service.getForServer('a')).map((row) => row.id)).toEqual(['kept']);
  });

  it('can replace a history with an empty one: the server says there is nothing', async () => {
    const service = createPaymentHistoryService(database.db);
    mockGetHistory.mockResolvedValueOnce({ items: [item('gone')], nextBefore: null });
    await service.syncWithServer(server('a'));

    mockGetHistory.mockResolvedValueOnce({ items: [], nextBefore: null });
    await service.syncWithServer(server('a'));

    expect(await service.getForServer('a')).toEqual([]);
  });
});
