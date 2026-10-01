import { act, render } from '@testing-library/react-native';
import { useContext, useEffect } from 'react';
import { Text } from 'react-native';

jest.mock('drizzle-orm', () => ({
  __esModule: true,
  and: jest.fn(() => ({})),
  eq: jest.fn(() => ({})),
}));
jest.mock('../../src/db', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock factories cannot use imports.
  const React = require('react');
  return { __esModule: true, DrizzleContext: React.createContext(null) };
});
jest.mock('../../src/db/schema', () => {
  const table = (name: string) => ({ storyId: {}, isDeleted: {}, __name: name });
  return {
    __esModule: true,
    characters: table('characters'),
    locations: table('locations'),
    items: table('items'),
    scenes: table('scenes'),
    chapters: table('chapters'),
    notes: table('notes'),
    worldRules: table('worldRules'),
    plots: table('plots'),
    storySchemaFields: table('storySchemaFields'),
    attributeValues: table('attributeValues'),
  };
});
jest.mock('../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: jest.fn(),
}));
jest.mock('../../src/utils/EventEmitter', () => ({
  __esModule: true,
  entityEventEmitter: { on: jest.fn(), off: jest.fn() },
}));
jest.mock('../../src/hooks/useEntityRefreshLifecycle', () => ({
  __esModule: true,
  useEntityInitialLoad: jest.fn(),
}));
jest.mock('../../src/utils/entityOptions', () => ({
  __esModule: true,
  loadEntityOptions: jest.fn(),
}));

const mockDebounce = jest.fn((fn: (...args: unknown[]) => void) => {
  const wrapped = (...args: unknown[]) => fn(...args);
  (wrapped as unknown as { cancel: jest.Mock }).cancel = jest.fn();
  return wrapped;
});
jest.mock('../../src/utils/debounce', () => ({
  __esModule: true,
  debounce: (...args: unknown[]) => (mockDebounce as (...callArgs: unknown[]) => unknown)(...args),
}));

import { DrizzleContext } from '../../src/db';
import { useEntityInitialLoad } from '../../src/hooks/useEntityRefreshLifecycle';
import {
  MentionAmbiguityContext,
  MentionBacklinksContext,
  MentionMatcherContext,
} from '../../src/mentions/MentionContext';
import {
  MENTIONABLE_ENTITY_TYPES,
  MentionMatcherProvider,
} from '../../src/mentions/MentionMatcherProvider';
import { useStoryStore } from '../../src/state/storyStore';
import { entityEventEmitter } from '../../src/utils/EventEmitter';
import { EMPTY_MENTION_MATCHER } from '../../src/utils/entityMentions';
import { loadEntityOptions } from '../../src/utils/entityOptions';

const rowsByTable: Record<string, Record<string, unknown>[]> = {};

const drizzleDb = {
  select: jest.fn(() => ({
    from: jest.fn((table: { __name?: string }) => ({
      where: jest.fn(() => ({
        all: jest.fn(async () => (table.__name ? (rowsByTable[table.__name] ?? []) : [])),
      })),
    })),
  })),
};

function Probe() {
  const matcher = useContext(MentionMatcherContext);
  const backlinks = useContext(MentionBacklinksContext);
  const ambiguities = useContext(MentionAmbiguityContext);
  return <Text testID="probe">{`${matcher.isEmpty}:${backlinks.size}:${ambiguities.size}`}</Text>;
}

function renderProvider(story: any, db: any) {
  (useStoryStore as unknown as jest.Mock).mockImplementation((selector: any) =>
    selector({ selectedStory: story }),
  );
  return render(
    <DrizzleContext.Provider value={db}>
      <MentionMatcherProvider>
        <Probe />
      </MentionMatcherProvider>
    </DrizzleContext.Provider>,
  );
}

const initialLoad = () =>
  (useEntityInitialLoad as jest.Mock).mock.calls[0][0] as () => Promise<void>;

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(rowsByTable)) delete rowsByTable[key];
  (loadEntityOptions as jest.Mock).mockResolvedValue([]);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

it('covers the eight entity types prose can name', () => {
  expect([...MENTIONABLE_ENTITY_TYPES]).toEqual([
    'Character',
    'Location',
    'Item',
    'Scene',
    'Chapter',
    'Note',
    'WorldRule',
    'Plot',
  ]);
});

it('stays empty and unsubscribed when the story cannot auto-link', async () => {
  const screen = await renderProvider(null, null);
  await act(async () => {
    await initialLoad()();
  });

  expect(screen.getByTestId('probe').props.children).toBe('true:0:0');
  expect(loadEntityOptions).not.toHaveBeenCalled();
  expect(entityEventEmitter.on).not.toHaveBeenCalled();
});

it('builds an empty index for a story with no named entities', async () => {
  const screen = await renderProvider({ id: 'story-1', autoLinkMentions: true }, drizzleDb);
  await act(async () => {
    await initialLoad()();
  });

  expect(loadEntityOptions).toHaveBeenCalledTimes(MENTIONABLE_ENTITY_TYPES.length);
  expect(screen.getByTestId('probe').props.children).toBe('true:0:0');
  expect(entityEventEmitter.on).toHaveBeenCalledTimes(10);
});

it('indexes loaded names and backlinks', async () => {
  (loadEntityOptions as jest.Mock).mockImplementation(
    async (_db: unknown, _story: string, type: string) =>
      type === 'Character' ? [{ id: 'alice', name: 'Alice' }] : [],
  );
  const screen = await renderProvider({ id: 'story-1', autoLinkMentions: true }, drizzleDb);
  await act(async () => {
    await initialLoad()();
  });

  expect(screen.getByTestId('probe').props.children).toBe('false:0:0');
});

it('resets to empty when the load fails', async () => {
  (loadEntityOptions as jest.Mock).mockRejectedValue(new Error('database unavailable'));
  const screen = await renderProvider({ id: 'story-1', autoLinkMentions: true }, drizzleDb);
  await act(async () => {
    await initialLoad()();
  });

  expect(console.error).toHaveBeenCalledWith(
    'Failed to build the mention matcher:',
    expect.any(Error),
  );
  expect(screen.getByTestId('probe').props.children).toBe('true:0:0');
});

it('unsubscribes on unmount', async () => {
  const screen = await renderProvider({ id: 'story-1', autoLinkMentions: true }, drizzleDb);
  // The `off` calls run in the effect cleanup, which only flushes inside `act`.
  await act(async () => {
    screen.unmount();
  });
  expect(entityEventEmitter.off).toHaveBeenCalledTimes(10);
});

it('debounces event-driven rebuilds behind half a second', async () => {
  await renderProvider({ id: 'story-1', autoLinkMentions: true }, drizzleDb);

  expect(mockDebounce).toHaveBeenCalledWith(expect.any(Function), 500);
  // Every subscription rides the one debounced rebuild, never the raw reload.
  const subscribed = (entityEventEmitter.on as jest.Mock).mock.calls.map((call) => call[1]);
  expect(subscribed).toHaveLength(10);
  expect(new Set(subscribed).size).toBe(1);
});

it('reads only the columns the backlink index consumes', async () => {
  await renderProvider({ id: 'story-1', autoLinkMentions: true }, drizzleDb);
  await act(async () => {
    await initialLoad()();
  });

  const selectCalls = (drizzleDb.select as jest.Mock).mock.calls;
  expect(selectCalls).toHaveLength(10);
  for (const [columns] of selectCalls) {
    expect(columns).toEqual(expect.any(Object));
  }
  expect(Object.keys(selectCalls[0][0]).sort()).toEqual(
    [
      'id',
      'description',
      'personality',
      'motivation',
      'qualities',
      'weaknesses',
      'biography',
      'plannedTimeline',
      'extraNotes',
    ].sort(),
  );
});

it('publishes ambiguous-name suggestions for the story', async () => {
  (loadEntityOptions as jest.Mock).mockImplementation(
    async (_db: unknown, _story: string, type: string) =>
      type === 'Character'
        ? [
            { id: 'c1', name: 'Robin' },
            { id: 'c2', name: 'Robin' },
          ]
        : [],
  );
  rowsByTable.scenes = [{ id: 'scene-1', summary: 'Robin arrives.', extraNotes: null }];
  const screen = await renderProvider({ id: 'story-1', autoLinkMentions: true }, drizzleDb);
  await act(async () => {
    await initialLoad()();
  });

  // Ambiguous names link nothing, so the matcher itself stays empty.
  expect(screen.getByTestId('probe').props.children).toBe('true:0:1');
});

it('exposes the shared empty matcher while disabled', async () => {
  let matcher: unknown;
  const Capture = () => {
    const captured = useContext(MentionMatcherContext);
    useEffect(() => {
      matcher = captured;
    }, [captured]);
    return null;
  };
  (useStoryStore as unknown as jest.Mock).mockImplementation((selector: any) =>
    selector({ selectedStory: null }),
  );
  await render(
    <DrizzleContext.Provider value={null}>
      <MentionMatcherProvider>
        <Capture />
      </MentionMatcherProvider>
    </DrizzleContext.Provider>,
  );
  expect(matcher).toBe(EMPTY_MENTION_MATCHER);
});
