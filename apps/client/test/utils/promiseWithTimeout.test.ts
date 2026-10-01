import { promiseWithTimeout } from '../../src/utils/promiseWithTimeout';

describe('promiseWithTimeout', () => {
  it('resolves with the original value', async () => {
    await expect(promiseWithTimeout(Promise.resolve('ok'), 50, 'boot')).resolves.toBe('ok');
  });

  it('rejects with the original error', async () => {
    const failure = new Error('wasm 404');
    await expect(promiseWithTimeout(Promise.reject(failure), 50, 'boot')).rejects.toBe(failure);
  });

  it('rejects on the deadline when the promise hangs', async () => {
    const hanging = new Promise<never>(() => {});
    await expect(promiseWithTimeout(hanging, 10, 'CanvasKit boot')).rejects.toThrow(
      'CanvasKit boot timed out after 10ms',
    );
  });
});
