import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';
import {
  compileStoryReader,
  type CompileStoryReaderInput,
  type ReaderRules,
} from '../../../manuscript/reader/storyReader';

const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

const windows: { close: () => void }[] = [];
afterEach(() => {
  while (windows.length) windows.pop()!.close();
});

/** The page as a browser runs it: scripts on, no network, and (for now) no page around it. */
function open(html: string) {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://reader.test/',
  });
  windows.push(dom.window);
  const { document } = dom.window;
  const click = (selector: string) => {
    const target = document.querySelector<HTMLButtonElement>(selector);
    if (!target) throw new Error(`Nothing to click at ${selector}`);
    target.click();
  };
  const choices = () => [...document.querySelectorAll<HTMLButtonElement>('#view .choice')];
  const choice = (text: string) => {
    const found = choices().find((button) => button.textContent?.startsWith(text));
    if (!found) throw new Error(`No choice "${text}" among ${choices().map((c) => c.textContent)}`);
    return found;
  };
  return { dom, document, click, choices, choice };
}

const scene = (
  id: string,
  name: string,
  index: number,
  body: string,
  overrides: Record<string, unknown> = {},
) => ({ id, chapterId: null, name, index, body, isDeleted: false, ...overrides });

const rules = (overrides: Partial<ReaderRules> = {}): ReaderRules => ({
  groups: [],
  checks: [],
  effects: [],
  items: [],
  ...overrides,
});

/**
 * A: start. Taking the key path grants the key (B); the locked door (C) needs it; C sets a trigger
 * the last choice is blocked by; D is an ending.
 */
function keyStory(): CompileStoryReaderInput {
  return {
    storyTitle: 'The Key',
    storyType: 'branching',
    chapters: [],
    scenes: [
      scene('a', 'Hall', 1, 'You stand in the hall.', { isStart: true }),
      scene('b', 'Cellar', 2, 'Damp stone.'),
      scene('c', 'Vault', 3, 'Gold, everywhere.'),
      scene('d', 'Street', 4, 'Home at last.'),
    ],
    choices: [
      { id: 'c-key', sceneId: 'a', nextSceneId: 'b', text: 'Fetch the key' },
      { id: 'c-door', sceneId: 'a', nextSceneId: 'c', text: 'Open the locked door' },
      { id: 'c-back', sceneId: 'b', nextSceneId: 'a', text: 'Return upstairs' },
      { id: 'c-leave', sceneId: 'c', nextSceneId: 'd', text: 'Leave quietly' },
      { id: 'c-loot', sceneId: 'c', nextSceneId: 'd', text: 'Leave with the loot' },
    ],
    rules: rules({
      items: [{ id: 'key', name: 'Brass Key' }],
      effects: [
        {
          entityType: 'Choice',
          entityId: 'c-key',
          effectType: 'itemGrant',
          itemId: 'key',
          triggerName: null,
          isDeleted: false,
        },
        {
          entityType: 'Scene',
          entityId: 'c',
          effectType: 'triggerSet',
          itemId: null,
          triggerName: 'secretAlarm',
          isDeleted: false,
        },
      ],
      groups: [
        { id: 'g-door', choiceId: 'c-door', combinator: 'AND', isDeleted: false },
        { id: 'g-loot', choiceId: 'c-loot', combinator: 'AND', isDeleted: false },
      ],
      checks: [
        {
          groupId: 'g-door',
          mode: 'enable',
          type: 'inventory',
          sceneId: null,
          minVisits: null,
          itemId: 'key',
          itemPresence: 'has',
          triggerName: null,
          triggerState: null,
          isDeleted: false,
        },
        {
          groupId: 'g-loot',
          mode: 'block',
          type: 'trigger',
          sceneId: null,
          minVisits: null,
          itemId: null,
          itemPresence: null,
          triggerName: 'secretAlarm',
          triggerState: 'set',
          isDeleted: false,
        },
      ],
    }),
  };
}

const READER_OPTIONS = { includeSceneNames: true, language: 'en' } as const;

describe('a branching reader', () => {
  it('is one self-contained page: no requests, a restrictive policy, its data embedded', () => {
    const html = decode(compileStoryReader(keyStory(), READER_OPTIONS).bytes);

    expect(html).toContain("default-src 'none'");
    expect(html).not.toMatch(/<(?:script|img|link|iframe)[^>]+(?:src|href)=/i);
    expect(html).not.toMatch(/https?:\/\//);
    const { document } = open(html);
    const data = JSON.parse(document.getElementById('story-data')!.textContent!);
    expect(Object.keys(data.scenes)).toEqual(['a', 'b', 'c', 'd']);
    expect(data.start).toMatchObject({ prompt: null, options: [{ to: 'a' }] });
  });

  it('reads scene by scene, gating choices on what was collected', () => {
    const { document, click, choice, choices } = open(
      decode(compileStoryReader(keyStory(), READER_OPTIONS).bytes),
    );

    // The start page first.
    expect(document.querySelector('.story-title')!.textContent).toBe('The Key');
    click('#view .choice.primary');
    expect(document.querySelector('.scene-name')!.textContent).toBe('Hall');
    expect(document.querySelector('.text')!.textContent).toContain('You stand in the hall.');
    expect(choices().map((button) => [button.textContent, button.disabled])).toEqual([
      ['Fetch the key', false],
      ['Open the locked door', true],
    ]);

    choice('Fetch the key').click();
    expect(document.querySelector('.scene-name')!.textContent).toBe('Cellar');
    choice('Return upstairs').click();
    // The key is in the pack now: the door opens.
    expect(choice('Open the locked door').disabled).toBe(false);
    choice('Open the locked door').click();
    expect(document.querySelector('.scene-name')!.textContent).toBe('Vault');
    // Entering the vault set a trigger that blocks the loot - and nothing says why.
    expect(choice('Leave with the loot').disabled).toBe(true);
    // (The trigger name travels in the page's data, like the rules do; what the reader sees is only a shut door.)
    expect(document.getElementById('view')!.textContent).not.toContain('secretAlarm');
    choice('Leave quietly').click();
    expect(document.querySelector('.scene-name')!.textContent).toBe('Street');
    expect(document.querySelector('.end-mark')!.textContent).toBe('The End');
  });

  it('shows the inventory (items only) and the path walked', () => {
    const { document, click, choice } = open(
      decode(compileStoryReader(keyStory(), READER_OPTIONS).bytes),
    );
    click('#view .choice.primary');
    choice('Fetch the key').click();

    click('#act-bag');
    expect([...document.querySelectorAll('#sheet-body li')].map((li) => li.textContent)).toEqual([
      'Brass Key',
    ]);
    click('#sheet-close');
    click('#act-path');
    expect([...document.querySelectorAll('#sheet-body li')].map((li) => li.textContent)).toEqual([
      'Hall',
      'Cellar',
    ]);
  });

  it('steps back to the state before a choice, effects included', () => {
    const { document, click, choice } = open(
      decode(compileStoryReader(keyStory(), READER_OPTIONS).bytes),
    );
    click('#view .choice.primary');
    choice('Fetch the key').click();
    click('#act-back');

    expect(document.querySelector('.scene-name')!.textContent).toBe('Hall');
    // The key was un-taken with the step: the door is shut again.
    expect(choice('Open the locked door').disabled).toBe(true);
    expect((document.querySelector('#act-back') as HTMLButtonElement).disabled).toBe(true);
  });

  it('starts over from the beginning', () => {
    const { document, click, choice } = open(
      decode(compileStoryReader(keyStory(), READER_OPTIONS).bytes),
    );
    click('#view .choice.primary');
    choice('Fetch the key').click();
    click('#act-home');
    expect(document.querySelector('.story-title')).not.toBeNull();
  });

  it('leaves scene names out when the options ask for numbers only', () => {
    const { document, click } = open(
      decode(compileStoryReader(keyStory(), { language: 'en' }).bytes),
    );
    click('#view .choice.primary');
    expect(document.querySelector('.scene-name')).toBeNull();
    expect(document.querySelector('.text')!.textContent).toContain('You stand in the hall.');
  });

  it('keeps a scene the choices cannot reach, after the reachable ones', () => {
    const story = keyStory();
    story.scenes.push(scene('lost', 'Attic', 5, 'Dust.'));
    const { document } = open(decode(compileStoryReader(story, READER_OPTIONS).bytes));
    const data = JSON.parse(document.getElementById('story-data')!.textContent!);
    expect(Object.keys(data.scenes)).toEqual(['a', 'b', 'c', 'd', 'lost']);
  });

  it('asks where to begin when a story has several starts', () => {
    const story = keyStory();
    story.scenes.push(scene('e', 'Attic', 5, 'Dust.', { isStart: true }));
    const { document } = open(
      decode(
        compileStoryReader(story, {
          ...READER_OPTIONS,
          labels: { chooseStart: 'Where to?', beginAt: 'Begin' },
        }).bytes,
      ),
    );

    expect(document.querySelector('.prompt')!.textContent).toBe('Where to?');
    const options = [...document.querySelectorAll('#view .choice.primary')].map(
      (button) => button.textContent,
    );
    expect(options).toEqual(['Hall', 'Attic']);
    document.querySelectorAll<HTMLButtonElement>('#view .choice.primary')[1]!.click();
    expect(document.querySelector('.scene-name')!.textContent).toBe('Attic');
  });

  it('shows an empty story as empty', () => {
    const { document } = open(
      decode(
        compileStoryReader(
          { storyTitle: 'Nothing', storyType: 'branching', chapters: [], scenes: [], choices: [] },
          READER_OPTIONS,
        ).bytes,
      ),
    );
    expect(document.querySelector('.start .note')!.textContent).toContain('no scenes');
  });

  it('uses the publisher language for its own words', () => {
    const { document } = open(
      decode(
        compileStoryReader(keyStory(), {
          ...READER_OPTIONS,
          readerLabels: { newGame: 'Começar a ler', back: 'Voltar' },
        }).bytes,
      ),
    );
    expect(document.querySelector('#view .choice.primary')!.textContent).toBe('Começar a ler');
    expect(document.querySelector('#act-back')!.textContent).toBe('Voltar');
  });

  it('runs no script a scene wrote: text is escaped, names too', () => {
    const story = keyStory();
    story.scenes[0] = scene('a', '<img src=x onerror="window.pwned=1">', 1, 'Hi.', {
      isStart: true,
    });
    story.scenes[1] = scene(
      'b',
      'Cellar',
      2,
      '</script><script>window.pwned = 2</script><img src=x onerror="window.pwned=3">',
    );
    story.choices[0] = { ...story.choices[0], text: '</script><b>Fetch</b>' };
    const html = decode(compileStoryReader(story, READER_OPTIONS).bytes);
    const { dom, document, click, choices } = open(html);

    click('#view .choice.primary');
    click('#view .choice:not(:disabled)');

    expect((dom.window as unknown as { pwned?: number }).pwned).toBeUndefined();
    expect(document.querySelectorAll('script')).toHaveLength(2);
    expect(document.querySelector('#view img')).toBeNull();
    expect(document.querySelector('.text')!.textContent).toContain('window.pwned = 2');
    expect(choices().length).toBeGreaterThan(0);
  });
});

describe('a linear reader', () => {
  const linear = (): CompileStoryReaderInput => ({
    storyTitle: 'Long Road',
    storyType: 'linear',
    chapters: [{ id: 'ch', name: 'Arrival', index: 1, type: 'chapter' }],
    scenes: [
      scene('s1', 'Dusk', 1, 'The road ahead.\n\nA second **bold** line.', { chapterId: 'ch' }),
      scene('s2', 'Night', 2, 'Stars.', { chapterId: 'ch' }),
    ],
    choices: [],
  });

  it('is the manuscript page with a contents index and a bar', () => {
    const html = decode(compileStoryReader(linear(), READER_OPTIONS).bytes);
    const { document } = open(html);

    expect(document.querySelector('h1.title')!.textContent).toBe('Long Road');
    expect(document.querySelector('nav.toc')).not.toBeNull();
    expect(document.querySelector('#act-contents')).not.toBeNull();
    expect(document.body.textContent).toContain('The road ahead.');
    expect(document.querySelector('strong')!.textContent).toBe('bold');
    expect(html).not.toMatch(/https?:\/\//);
  });

  it('honors the typography asked, except the point size (the reader has its own)', () => {
    const html = decode(
      compileStoryReader(linear(), {
        ...READER_OPTIONS,
        style: { fontFamily: 'sans', fontSize: 14, paragraphStyle: 'block' },
      }).bytes,
    );
    expect(html).toContain('Helvetica');
    expect(html).toContain('text-indent: 0; margin: 0 0 1em');
    expect(html).not.toContain('font-size: 14pt');
  });
});

describe('the bridge to the showcase page', () => {
  /** A showcase page in miniature: an iframe of the reader and the two-message protocol. */
  function embed(html: string, stored: unknown[]) {
    const host = new JSDOM('<!DOCTYPE html><iframe id="frame"></iframe>', {
      runScripts: 'dangerously',
      pretendToBeVisual: true,
      url: 'https://showcase.test/',
    });
    windows.push(host.window);
    const frame = host.window.document.getElementById('frame') as HTMLIFrameElement;
    const written: unknown[][] = [];
    host.window.addEventListener('message', (event: MessageEvent) => {
      const message = event.data;
      if (!message || message.keresReader !== 1) return;
      if (message.type === 'load') {
        // jsdom does not fill `source` in for a posted message, so the reply is dispatched by hand,
        // from the page, the way a browser would deliver it.
        const inner = frame.contentWindow as unknown as {
          MessageEvent: typeof MessageEvent;
          dispatchEvent: (event: Event) => boolean;
        };
        inner.dispatchEvent(
          new inner.MessageEvent('message', {
            data: { keresReader: 1, type: 'saves', saves: stored },
            source: host.window as unknown as MessageEventSource,
          }),
        );
      } else if (message.type === 'write') {
        written.push(message.saves);
      }
    });
    // jsdom has no `srcdoc`: the page is written into the frame, and its scripts run all the same.
    const inner = frame.contentDocument!;
    inner.open();
    inner.write(html);
    inner.close();
    return { host, frame, written };
  }

  it('asks the page for its saves, restores the autosave and hands every change back', async () => {
    const html = decode(compileStoryReader(keyStory(), READER_OPTIONS).bytes);
    const stored = [
      {
        id: 'auto',
        kind: 'auto',
        name: 'Autosave',
        at: '2026-09-28T10:00:00.000Z',
        scene: 'Cellar',
        count: 2,
        steps: [
          { s: 'a', c: null },
          { s: 'b', c: 'c-key' },
        ],
      },
      { id: 'prefs', kind: 'prefs', theme: 'sepia', size: 120 },
    ];
    const { frame, written } = embed(html, stored);
    await new Promise((resolve) => setTimeout(resolve, 200));
    const document = frame.contentDocument!;

    // The saved run is offered, and the preferences applied.
    expect(document.documentElement.getAttribute('data-theme')).toBe('sepia');
    expect(document.documentElement.style.getPropertyValue('--scale')).toBe('1.2');
    const again = document.querySelector<HTMLButtonElement>('#view .choice.primary')!;
    expect(again.textContent).toBe('Continue — Cellar');
    again.click();
    expect(document.querySelector('.scene-name')!.textContent).toBe('Cellar');
    // The key granted on the way was replayed, not stored: the door opens after going back up.
    [...document.querySelectorAll<HTMLButtonElement>('#view .choice')]
      .find((button) => button.textContent === 'Return upstairs')!
      .click();
    expect(
      [...document.querySelectorAll<HTMLButtonElement>('#view .choice')].find((button) =>
        button.textContent?.startsWith('Open the locked door'),
      )!.disabled,
    ).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 50));
    const last = written[written.length - 1] as { id: string; kind: string; count?: number }[];
    expect(last.find((save) => save.id === 'auto')).toMatchObject({ kind: 'auto', count: 3 });
    expect(last.find((save) => save.kind === 'prefs')).toMatchObject({ theme: 'sepia', size: 120 });
  });

  it('lists, writes, loads and deletes manual saves', async () => {
    const html = decode(compileStoryReader(keyStory(), READER_OPTIONS).bytes);
    const { frame, written } = embed(html, []);
    await new Promise((resolve) => setTimeout(resolve, 200));
    const document = frame.contentDocument!;

    document.querySelector<HTMLButtonElement>('#view .choice.primary')!.click();
    [...document.querySelectorAll<HTMLButtonElement>('#view .choice')]
      .find((button) => button.textContent === 'Fetch the key')!
      .click();
    document.querySelector<HTMLButtonElement>('#act-saves')!.click();
    (document.querySelector('#sheet-body input.name') as HTMLInputElement).value =
      'Before the vault';
    document.querySelector<HTMLButtonElement>('#sheet-body .pill.on')!.click();

    await new Promise((resolve) => setTimeout(resolve, 50));
    const list = written[written.length - 1] as { kind: string; name: string }[];
    expect(list.filter((save) => save.kind === 'manual').map((save) => save.name)).toEqual([
      'Before the vault',
    ]);
    // Both the autosave and the manual one are listed; the manual can be deleted.
    expect(document.querySelectorAll('#sheet-body .save')).toHaveLength(2);
    const remove = [...document.querySelectorAll<HTMLButtonElement>('#sheet-body .pill')].find(
      (button) => button.textContent === 'Delete',
    )!;
    remove.click();
    expect(document.querySelectorAll('#sheet-body .save')).toHaveLength(1);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const afterDelete = written[written.length - 1] as { kind: string }[];
    expect(afterDelete.some((save) => save.kind === 'manual')).toBe(false);
  });

  it('says progress is not kept when nothing answers', async () => {
    const { document, click } = open(decode(compileStoryReader(keyStory(), READER_OPTIONS).bytes));
    await new Promise((resolve) => setTimeout(resolve, 1700));
    click('#act-saves');
    expect(document.querySelector('#sheet-body .note')!.textContent).toContain('not being kept');
  });
});
