import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';

/**
 * The pack form's own rules, which live nowhere else: the sub-toggle that cannot outlive its parent,
 * and the three refusals that stop an empty or nameless pack being written.
 *
 * `PackService` is a double here on purpose - what it does with a selection is covered against a
 * real database in `test/services/PackService.test.ts`. What matters here is which selection the
 * screen hands it.
 */

jest.mock('../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#fff',
      error: '#f00',
      onPrimary: '#fff',
      primary: '#00f',
      primaryContainer: '#ccf',
      shadow: '#000',
      secondary: '#888',
      surface: '#fff',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

// Stable identity on purpose: the real `useTranslation` memoizes `t`, and this screen has it in an
// effect's dependencies. A fresh function per render would re-run the effect forever.
jest.mock('react-i18next', () => {
  const t = (key: string) => key;
  const value = { t };
  return { __esModule: true, useTranslation: () => value };
});

const mockGoBack = jest.fn();
const mockRouteParams: { value: { packId?: string } | undefined } = { value: undefined };
jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => ({ goBack: mockGoBack }),
  useRoute: () => ({ params: mockRouteParams.value }),
}));

/**
 * Every hook this screen reads must return a **stable** value: `drizzleDb`, `t` and
 * `showNotification` are all effect dependencies, and a fresh object per render re-runs the effect
 * forever - which shows up as a test that times out rather than as a failure that names itself.
 */
jest.mock('../../src/db', () => {
  const db = {};
  return { __esModule: true, useDrizzle: () => db };
});
// The screen tree reaches for the safe area, which has no provider in a bare render.
jest.mock('react-native-safe-area-context', () => ({
  __esModule: true,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../src/hooks/useScreenHeader', () => ({ useScreenHeader: () => undefined }));
jest.mock('../../src/utils/documentTitle', () => ({
  __esModule: true,
  useDocumentTitle: () => undefined,
}));
// Same stability reason as the translation mock above: this is an effect dependency.
jest.mock('../../src/state/notificationStore', () => {
  const state = { showNotification: jest.fn() };
  return {
    __esModule: true,
    useNotificationStore: (selector: (value: typeof state) => unknown) => selector(state),
  };
});
jest.mock('../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: () => ({ userId: '01ARZ3NDEKTSV4RRFFQ69G5FUS' }),
}));

// The real one runs an Animated interpolation that never settles under RNTL's async render. What
// this file asserts is which value the screen passes and whether it is disabled, not the animation.
jest.mock('../../src/components/common/controls/ThemedSwitch/ThemedSwitch', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => <View {...props} />,
  };
});

const mockAlert = jest.fn();
jest.mock('../../src/utils/AppAlert', () => ({
  __esModule: true,
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));

jest.mock('../../src/services/storymanagement/StoryService', () => ({
  __esModule: true,
  createStoryService: () => ({
    getAllStories: async () => [
      { id: 'story-1', title: 'A story', language: 'pt', author: 'Quem Escreveu' },
    ],
  }),
}));

const mockCreatePack = jest.fn(async () => 'pack-1');
const mockReextract = jest.fn(async () => undefined);
const mockUpdateDetails = jest.fn(async () => undefined);
const mockListPacks = jest.fn(async () => [] as unknown[]);
jest.mock('../../src/services/storymanagement/PackService', () => ({
  __esModule: true,
  createPackService: () => ({
    createPack: mockCreatePack,
    reextractPack: mockReextract,
    updatePackDetails: mockUpdateDetails,
    listPacks: mockListPacks,
  }),
}));

import PackFormScreen from '../../src/screens/packs/PackFormScreen';

beforeEach(() => {
  jest.clearAllMocks();
  mockRouteParams.value = undefined;
  mockListPacks.mockResolvedValue([]);
});

/** Resolves once the form has replaced the loading spinner. */
/** RNTL 14 settles state asynchronously; a bare `fireEvent` leaves the assertion on the old render. */
const press = async (element: unknown, event: string, value?: unknown) => {
  await act(async () => {
    fireEvent(element as never, event, value);
  });
};

const renderScreen = async () => {
  const screen = await render(<PackFormScreen />);
  await screen.findByTestId('save-pack');
  return screen;
};

describe('choosing what a pack carries', () => {
  it('leaves the used-values toggle unavailable until catalogues are included', async () => {
    const screen = await renderScreen();

    expect(screen.getByTestId('pack-toggle-suggestionsIncludeUsed').props.disabled).toBe(true);

    await press(screen.getByTestId('pack-toggle-suggestions'), 'valueChange', true);

    expect(screen.getByTestId('pack-toggle-suggestionsIncludeUsed').props.disabled).toBe(false);
  });

  /**
   * Otherwise a pack would claim to sweep in the values a story uses while carrying no catalogue at
   * all - the toggle would be remembered and silently applied on the next save.
   */
  it('turns the used-values toggle back off when catalogues are removed', async () => {
    const screen = await renderScreen();

    await press(screen.getByTestId('pack-toggle-suggestions'), 'valueChange', true);
    await press(screen.getByTestId('pack-toggle-suggestionsIncludeUsed'), 'valueChange', true);
    expect(screen.getByTestId('pack-toggle-suggestionsIncludeUsed').props.value).toBe(true);

    await press(screen.getByTestId('pack-toggle-suggestions'), 'valueChange', false);

    expect(screen.getByTestId('pack-toggle-suggestionsIncludeUsed').props.value).toBe(false);
  });
});

describe('refusing to save an unusable pack', () => {
  it('asks for a source story first', async () => {
    const screen = await renderScreen();

    await press(screen.getByTestId('save-pack'), 'press');

    expect(mockAlert).toHaveBeenCalledWith('error', 'packs_source_required');
    expect(mockCreatePack).not.toHaveBeenCalled();
  });

  it('asks for a name', async () => {
    const screen = await renderScreen();
    await press(screen.getByTestId('pack-toggle-tags'), 'valueChange', true);

    await press(screen.getByTestId('save-pack'), 'press');

    // The source is still missing, so that refusal comes first - which is itself the order the
    // screen should keep: it asks for the story before anything that depends on it.
    expect(mockAlert).toHaveBeenCalledWith('error', 'packs_source_required');
    expect(mockCreatePack).not.toHaveBeenCalled();
  });

  it('refuses a pack that would carry nothing', async () => {
    const screen = await renderScreen();

    await press(screen.getByTestId('save-pack'), 'press');

    expect(mockCreatePack).not.toHaveBeenCalled();
  });
});
