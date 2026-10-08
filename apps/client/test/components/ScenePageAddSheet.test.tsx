import { cleanup, fireEvent, render } from '@testing-library/react-native';
import type React from 'react';

let mockChoices = { sketches: [] as unknown[], images: [] as unknown[] };

jest.mock('@expo/vector-icons', () => ({ __esModule: true, Ionicons: () => null }));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      surface: '#fff',
      text: '#111',
      textSecondary: '#666',
      border: '#ddd',
      primary: '#00f',
    },
  }),
}));
jest.mock('../../src/components/layout/ResponsiveModal/ResponsiveModal', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
      visible ? <View>{children}</View> : null,
  };
});
jest.mock('../../src/hooks/useGalleryMedia', () => ({
  __esModule: true,
  useScenePageChoices: () => mockChoices,
}));

import ScenePageAddSheet from '../../src/components/features/scenes/ScenePages/ScenePageAddSheet';

const handlers = {
  onClose: jest.fn(),
  onDraw: jest.fn(),
  onUpload: jest.fn(),
  onChooseExisting: jest.fn(),
};
const renderSheet = (props: Partial<React.ComponentProps<typeof ScenePageAddSheet>> = {}) =>
  render(<ScenePageAddSheet visible storyId="story-1" kind="page" {...handlers} {...props} />);

beforeEach(() => {
  jest.clearAllMocks();
  mockChoices = { sketches: [], images: [] };
});
afterEach(() => cleanup());

describe('ScenePageAddSheet', () => {
  it('offers drawing and uploading to a story with nothing to choose from, and no empty picker', async () => {
    const view = await renderSheet();

    expect(view.getByTestId('scene-pages-door-draw')).toBeTruthy();
    expect(view.getByTestId('scene-pages-door-upload')).toBeTruthy();
    expect(view.queryByTestId('scene-pages-door-existing')).toBeNull();
    expect(view.getByText('scene_pages_door_upload')).toBeTruthy();
  });

  it('offers the existing ones once the story has a sketch or a picture', async () => {
    mockChoices = { sketches: [{ id: 'sk-1' }], images: [] };
    const view = await renderSheet();

    await fireEvent.press(view.getByTestId('scene-pages-door-existing'));

    expect(handlers.onChooseExisting).toHaveBeenCalledTimes(1);
  });

  it('opens each door through its own handler', async () => {
    const view = await renderSheet();

    await fireEvent.press(view.getByTestId('scene-pages-door-draw'));
    await fireEvent.press(view.getByTestId('scene-pages-door-upload'));

    expect(handlers.onDraw).toHaveBeenCalledTimes(1);
    expect(handlers.onUpload).toHaveBeenCalledTimes(1);
  });

  it('speaks of frames in a storyboard', async () => {
    const view = await renderSheet({ kind: 'frame' });

    expect(view.getByText('scene_pages_add_sheet_title_frame')).toBeTruthy();
    expect(view.getByText('scene_pages_door_draw_frame')).toBeTruthy();
  });

  it('asks for one picture, not several, when changing a page picture', async () => {
    const view = await renderSheet({ replacing: true });

    expect(view.getByText('scene_pages_replace_title')).toBeTruthy();
    expect(view.getByText('scene_pages_door_upload_one')).toBeTruthy();
  });
});
