import { describe, expect, it } from 'vitest';
import { createExclusiveGate } from '../../src/utils/exclusive';

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('createExclusiveGate', () => {
  it('runs jobs one at a time, in the order they were asked', async () => {
    const exclusively = createExclusiveGate();
    const events: string[] = [];
    const job = (name: string, ms: number) => async () => {
      events.push(`${name} start`);
      await pause(ms);
      events.push(`${name} end`);
      return name;
    };

    const results = await Promise.all([
      exclusively(job('slow', 30)),
      exclusively(job('quick', 1)),
      exclusively(job('last', 1)),
    ]);

    expect(results).toEqual(['slow', 'quick', 'last']);
    expect(events).toEqual([
      'slow start',
      'slow end',
      'quick start',
      'quick end',
      'last start',
      'last end',
    ]);
  });

  it('does not let a failing job hold up the ones behind it', async () => {
    const exclusively = createExclusiveGate();

    const failing = exclusively(async () => {
      throw new Error('boom');
    });
    const after = exclusively(() => 'still ran');

    await expect(failing).rejects.toThrow('boom');
    await expect(after).resolves.toBe('still ran');
  });

  it('takes plain (synchronous) jobs too', async () => {
    const exclusively = createExclusiveGate();
    await expect(exclusively(() => 42)).resolves.toBe(42);
  });

  it('keeps separate gates separate', async () => {
    const one = createExclusiveGate();
    const other = createExclusiveGate();
    const events: string[] = [];

    await Promise.all([
      one(async () => {
        await pause(20);
        events.push('one');
      }),
      other(async () => {
        events.push('other');
      }),
    ]);

    expect(events).toEqual(['other', 'one']);
  });
});
