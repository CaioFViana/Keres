import { cleanup, fireEvent, render } from '@testing-library/react-native';
import React from 'react';

jest.mock('@expo/vector-icons', () => ({ __esModule: true, Ionicons: () => null }));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
    i18n: { language: 'en' },
  }),
}));
jest.mock('../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      card: '#fff',
      border: '#ddd',
      text: '#111',
      textSecondary: '#666',
      primary: '#00f',
      onPrimary: '#fff',
    },
  }),
}));

import StoryWritingSection from '../../src/components/features/story/StoryWritingSection/StoryWritingSection';

const NOW = new Date('2026-10-08T12:00:00.000Z');

function setup(overrides: Partial<React.ComponentProps<typeof StoryWritingSection>> = {}) {
  const handlers = {
    onContinue: jest.fn(),
    onNewScene: jest.fn(),
    onNewCharacter: jest.fn(),
    onNewNote: jest.fn(),
    onOpenManuscript: jest.fn(),
    onExportManuscript: jest.fn(),
    onPublishManuscript: jest.fn(),
  };
  const props: React.ComponentProps<typeof StoryWritingSection> = {
    resume: {
      id: 'scene-1',
      name: 'The bridge',
      chapterName: 'Arrival',
      editedAt: new Date('2026-10-08T10:00:00.000Z'),
    },
    chapterCount: 3,
    sceneCount: 12,
    canEdit: true,
    now: NOW,
    ...handlers,
    ...overrides,
  };
  return { handlers, element: <StoryWritingSection {...props} /> };
}

afterEach(() => {
  cleanup();
});

describe('StoryWritingSection', () => {
  it('offers the scene last written in, with its chapter and how long ago', async () => {
    const { element, handlers } = setup();
    const view = await render(element);

    expect(view.getByText('The bridge')).toBeTruthy();
    expect(view.getByText(/Arrival · story_writing_edited/)).toBeTruthy();
    await fireEvent.press(view.getByTestId('story-writing-continue'));

    expect(handlers.onContinue).toHaveBeenCalledWith('scene-1');
  });

  it('says "open" and not "continue" to someone who cannot edit', async () => {
    const { element } = setup({ canEdit: false });
    const view = await render(element);

    expect(view.getByText('story_writing_open')).toBeTruthy();
    expect(view.queryByText('story_writing_continue')).toBeNull();
    expect(view.queryByTestId('story-writing-scene')).toBeNull();
  });

  it('starts a scene, a character or a note from the shortcuts', async () => {
    const { element, handlers } = setup();
    const view = await render(element);

    await fireEvent.press(view.getByTestId('story-writing-scene'));
    await fireEvent.press(view.getByTestId('story-writing-character'));
    await fireEvent.press(view.getByTestId('story-writing-note'));

    expect(handlers.onNewScene).toHaveBeenCalledTimes(1);
    expect(handlers.onNewCharacter).toHaveBeenCalledTimes(1);
    expect(handlers.onNewNote).toHaveBeenCalledTimes(1);
  });

  it('shows the manuscript as the scenes and chapters it adds up to, to read or export', async () => {
    const { element, handlers } = setup();
    const view = await render(element);

    expect(
      view.getByText('story_writing_scenes:{"count":12} · story_writing_chapters:{"count":3}'),
    ).toBeTruthy();
    await fireEvent.press(view.getByTestId('story-writing-read'));
    await fireEvent.press(view.getByTestId('story-writing-export'));

    expect(handlers.onOpenManuscript).toHaveBeenCalledTimes(1);
    expect(handlers.onExportManuscript).toHaveBeenCalledTimes(1);
  });

  it('publishes the manuscript from its card, unless the story cannot be published', async () => {
    const { element, handlers } = setup();
    const view = await render(element);

    await fireEvent.press(view.getByTestId('story-writing-publish'));
    expect(handlers.onPublishManuscript).toHaveBeenCalledTimes(1);

    const withoutPublish = setup({ onPublishManuscript: undefined });
    const bare = await render(withoutPublish.element);
    expect(bare.queryByTestId('story-writing-publish')).toBeNull();
  });

  it('has nothing to resume or export in a story with no scenes, but can still be read', async () => {
    const { element, handlers } = setup({ resume: null, sceneCount: 0, chapterCount: 0 });
    const view = await render(element);

    expect(view.queryByTestId('story-writing-resume')).toBeNull();
    expect(view.getByText('story_writing_manuscript_empty')).toBeTruthy();
    await fireEvent.press(view.getByTestId('story-writing-export'));
    expect(handlers.onExportManuscript).not.toHaveBeenCalled();
    await fireEvent.press(view.getByTestId('story-writing-read'));
    expect(handlers.onOpenManuscript).toHaveBeenCalledTimes(1);
  });
});
