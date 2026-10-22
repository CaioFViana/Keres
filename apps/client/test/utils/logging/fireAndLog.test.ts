/**
 * @jest-environment node
 */
import { fireAndLog } from '@/src/utils/logging/fireAndLog';
import { logger } from '@/src/utils/logging/logger';

describe('fireAndLog', () => {
  let logged: jest.SpyInstance;

  beforeEach(() => {
    logged = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logged.mockRestore();
  });

  it('logs a rejection with what the work was', async () => {
    const failure = new Error('offline');

    fireAndLog(Promise.reject(failure), 'The refresh');
    await Promise.resolve();
    await Promise.resolve();

    expect(logged).toHaveBeenCalledWith('The refresh failed:', failure);
  });

  it('says nothing when the work succeeds', async () => {
    fireAndLog(Promise.resolve('done'), 'The refresh');
    await Promise.resolve();
    await Promise.resolve();

    expect(logged).not.toHaveBeenCalled();
  });

  it('ignores a handler that returned nothing', () => {
    expect(() => fireAndLog(undefined, 'The refresh')).not.toThrow();
    expect(logged).not.toHaveBeenCalled();
  });
});
