type ConsoleChannel = 'error' | 'warn' | 'log' | 'info';

type ConsoleSpies = {
  [K in ConsoleChannel]?: jest.SpiedFunction<(typeof console)[K]>;
};

/**
 * Mutes selected `console` channels for the duration of `run`, then restores them.
 *
 * Use on intentional failure paths: the production code still logs, the assertion still
 * passes, and the suite output stays readable. The returned spies remain available inside
 * `run` so a test can assert `toHaveBeenCalled` before restore.
 */
export async function withSilencedConsole<T>(
  channels: ReadonlyArray<ConsoleChannel>,
  run: (spies: ConsoleSpies) => T | Promise<T>,
): Promise<T> {
  const spies: ConsoleSpies = {};
  for (const channel of channels) {
    spies[channel] = jest.spyOn(console, channel).mockImplementation((() => undefined) as never);
  }
  try {
    return await run(spies);
  } finally {
    for (const channel of channels) {
      spies[channel]?.mockRestore();
    }
  }
}
