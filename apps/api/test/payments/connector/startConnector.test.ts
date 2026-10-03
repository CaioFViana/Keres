import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getPaymentConnector,
  setPaymentConnector,
} from '../../../src/services/payments/PaymentConnectorRegistry';
import { startPaymentConnector } from '../../../src/services/payments/connector/startConnector';
import { logger } from '../../../src/utils/logger';
import { connectorDouble, KERES_KEY } from '../../helpers/connectorDouble';

const config = { url: 'https://connector.test/pay-base', secrets: [KERES_KEY], timeoutMs: 2000 };

/** A network that fails the first `failures` times it is asked, and then is the connector. */
function flaky(failures: number) {
  const double = connectorDouble();
  let calls = 0;
  const fetchImpl = ((input: RequestInfo | URL, init?: RequestInit) => {
    calls += 1;
    if (calls <= failures) return Promise.reject(new Error('ECONNREFUSED'));
    return double.fetchImpl(input, init);
  }) as typeof fetch;
  return { fetchImpl, calls: () => calls };
}

const settle = async () => {
  for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
};

beforeEach(() => {
  vi.useFakeTimers();
  setPaymentConnector(null);
  vi.spyOn(logger, 'info').mockImplementation(() => undefined);
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  setPaymentConnector(null);
});

describe('starting the connection to the payment connector', () => {
  it('does nothing when there is no connector to connect to', async () => {
    const fetchImpl = vi.fn();

    const stop = startPaymentConnector({ config: null, fetchImpl: fetchImpl as never });
    await settle();

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(getPaymentConnector()).toBeNull();
    expect(stop).toBeTypeOf('function');
    stop();
  });

  it('connects at once when the connector answers, makes it the connector of the server, and says so', async () => {
    const onConnected = vi.fn();
    const network = flaky(0);

    startPaymentConnector({ config, fetchImpl: network.fetchImpl, onConnected });
    await vi.advanceTimersByTimeAsync(0);
    await settle();

    expect(getPaymentConnector()?.id).toBe('acme');
    expect(onConnected).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('"acme" connected'));
  });

  it('keeps trying, longer each time, until the connector answers: a connector that starts after the server is not left out', async () => {
    const onConnected = vi.fn();
    const network = flaky(3);

    startPaymentConnector({ config, fetchImpl: network.fetchImpl, onConnected });
    await vi.advanceTimersByTimeAsync(0);
    expect(network.calls()).toBe(1);
    expect(getPaymentConnector()).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('trying again in 2 s'));

    await vi.advanceTimersByTimeAsync(2000);
    expect(network.calls()).toBe(2);
    expect(logger.warn).toHaveBeenLastCalledWith(expect.stringContaining('trying again in 4 s'));

    await vi.advanceTimersByTimeAsync(4000);
    expect(network.calls()).toBe(3);
    expect(logger.warn).toHaveBeenLastCalledWith(expect.stringContaining('trying again in 8 s'));
    expect(getPaymentConnector()).toBeNull();
    expect(onConnected).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(8000);
    await settle();
    expect(network.calls()).toBe(4);
    expect(getPaymentConnector()?.id).toBe('acme');
    expect(onConnected).toHaveBeenCalledTimes(1);

    // And it stops trying once it is connected.
    await vi.advanceTimersByTimeAsync(120_000);
    expect(network.calls()).toBe(4);
  });

  it('never waits more than a minute between tries', async () => {
    const network = flaky(100);

    startPaymentConnector({ config, fetchImpl: network.fetchImpl });
    await vi.advanceTimersByTimeAsync(0);
    for (const wait of [2, 4, 8, 16, 32, 60, 60]) {
      await vi.advanceTimersByTimeAsync(wait * 1000);
    }

    expect(logger.warn).toHaveBeenLastCalledWith(expect.stringContaining('trying again in 60 s'));
  });

  it('says why it could not connect, without saying anything of what the network answered', async () => {
    const network = flaky(1);

    startPaymentConnector({ config, fetchImpl: network.fetchImpl });
    await vi.advanceTimersByTimeAsync(0);

    const message = vi.mocked(logger.warn).mock.calls[0][0] as string;
    expect(message).toContain('not available yet');
    expect(message).toContain('Payments are off until it answers');
    expect(message).not.toContain('ECONNREFUSED');
  });

  it('stops trying when the server stops, and leaves no connector behind', async () => {
    const network = flaky(100);

    const stop = startPaymentConnector({ config, fetchImpl: network.fetchImpl });
    await vi.advanceTimersByTimeAsync(0);
    expect(network.calls()).toBe(1);
    stop();
    await vi.advanceTimersByTimeAsync(300_000);

    expect(network.calls()).toBe(1);
    expect(getPaymentConnector()).toBeNull();
  });

  it('does not take the connector into use if the server stopped while it was answering', async () => {
    const network = flaky(0);

    const stop = startPaymentConnector({ config, fetchImpl: network.fetchImpl });
    stop();
    await vi.advanceTimersByTimeAsync(0);
    await settle();

    expect(getPaymentConnector()).toBeNull();
  });
});
