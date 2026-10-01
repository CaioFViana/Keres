/**
 * @jest-environment jsdom
 */
const mockRegistry: Array<any> = [];
const mockUserState: { initializeSettings: jest.Mock; userId: string | null } = {
  initializeSettings: jest.fn(),
  userId: 'user-1',
};
const mockThemeState = { setDarkMode: jest.fn() };
const mockStoryState = { setSelectedStory: jest.fn() };
const mockStoryService = { getAllStories: jest.fn(), getStoryById: jest.fn() };
const mockExampleService = { installExampleStory: jest.fn() };

jest.mock('../../src/services/ClientSettingsService', () => ({
  __esModule: true,
  getClientSettings: jest.fn(),
  createClientSettings: jest.fn(),
}));
jest.mock('../../src/exampleStories/generated/registry', () => ({
  __esModule: true,
  get exampleStoryRegistry() {
    return mockRegistry;
  },
}));
jest.mock('../../src/services/storymanagement/ExampleStoryService', () => ({
  __esModule: true,
  createExampleStoryService: jest.fn(() => mockExampleService),
}));
jest.mock('../../src/services/storymanagement/StoryService', () => ({
  __esModule: true,
  createStoryService: jest.fn(() => mockStoryService),
}));
jest.mock('../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: { getState: () => mockStoryState },
}));
jest.mock('../../src/state/themeStore', () => ({
  __esModule: true,
  useThemeStore: { getState: () => mockThemeState },
}));
jest.mock('../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: { getState: () => mockUserState },
}));
jest.mock('../../src/utils/i18n', () => ({
  __esModule: true,
  default: { changeLanguage: jest.fn() },
}));

import { createClientSettings, getClientSettings } from '../../src/services/ClientSettingsService';
import { prepareShowcase } from '../../src/showcase/prepareShowcase';
import i18n from '../../src/utils/i18n';

const db = { marker: 'db' } as any;
const request = { story: 'alice', stack: 'PlotsStack', theme: 'light', language: 'en' } as any;
const installedStory = { id: 'story-1', title: 'Alice', isDeleted: false };

function seedRegistry() {
  mockRegistry.length = 0;
  mockRegistry.push({
    slug: 'alice',
    languages: [{ language: 'en', story: { story: { title: 'Alice' } } }],
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  seedRegistry();
  delete document.documentElement.dataset.keresShowcase;
  mockUserState.userId = 'user-1';
  mockUserState.initializeSettings.mockResolvedValue(undefined);
  mockThemeState.setDarkMode.mockResolvedValue(undefined);
  (i18n.changeLanguage as jest.Mock).mockResolvedValue(undefined);
  (getClientSettings as jest.Mock).mockResolvedValue(null);
  (createClientSettings as jest.Mock).mockResolvedValue(undefined);
  mockStoryService.getAllStories.mockResolvedValue([]);
  mockStoryService.getStoryById.mockResolvedValue(installedStory);
  mockExampleService.installExampleStory.mockResolvedValue({
    status: 'installed',
    storyId: 'story-1',
  });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

it('installs the example, selects it and flags readiness', async () => {
  await expect(prepareShowcase(db, request)).resolves.toBe(true);

  expect(i18n.changeLanguage).toHaveBeenCalledWith('en');
  expect(createClientSettings).toHaveBeenCalledWith(
    db,
    expect.objectContaining({ localUsername: 'Keres', language: 'en', darkMode: false }),
  );
  expect(mockUserState.initializeSettings).toHaveBeenCalledWith(db);
  expect(mockThemeState.setDarkMode).toHaveBeenCalledWith(db, false);
  expect(mockExampleService.installExampleStory).toHaveBeenCalledWith('user-1', 'alice', 'en');
  expect(mockStoryState.setSelectedStory).toHaveBeenCalledWith(installedStory);
  expect(document.documentElement.dataset.keresShowcase).toBe('ready');
});

it('reuses an already-installed story without reinstalling', async () => {
  mockStoryService.getAllStories.mockResolvedValue([
    { id: 'other', title: 'Other', isDeleted: false },
    { id: 'story-9', title: 'Alice', isDeleted: false },
  ]);

  await expect(prepareShowcase(db, request)).resolves.toBe(true);

  expect(mockExampleService.installExampleStory).not.toHaveBeenCalled();
  expect(mockStoryState.setSelectedStory).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'story-9' }),
  );
});

it('skips creation when client settings already exist', async () => {
  (getClientSettings as jest.Mock).mockResolvedValue({ id: 'settings' });

  await expect(prepareShowcase(db, request)).resolves.toBe(true);

  expect(createClientSettings).not.toHaveBeenCalled();
});

it('applies the requested dark theme', async () => {
  await expect(prepareShowcase(db, { ...request, theme: 'dark' })).resolves.toBe(true);

  expect(createClientSettings).toHaveBeenCalledWith(
    db,
    expect.objectContaining({ darkMode: true }),
  );
  expect(mockThemeState.setDarkMode).toHaveBeenCalledWith(db, true);
});

it('fails when no local user exists after settings setup', async () => {
  mockUserState.userId = null;

  await expect(prepareShowcase(db, request)).resolves.toBe(false);

  expect(console.warn).toHaveBeenCalledWith(
    '[showcase] sem usuário local depois de criar as configurações.',
  );
  expect(mockStoryState.setSelectedStory).not.toHaveBeenCalled();
});

it('fails when the example cannot be installed', async () => {
  mockExampleService.installExampleStory.mockResolvedValue({ status: 'not_found' });

  await expect(prepareShowcase(db, request)).resolves.toBe(false);

  expect(console.error).toHaveBeenCalledWith(
    '[showcase] não foi possível instalar o exemplo:',
    'not_found',
  );
});

it('fails when the installed story cannot be read back', async () => {
  mockStoryService.getStoryById.mockResolvedValue(undefined);

  await expect(prepareShowcase(db, request)).resolves.toBe(false);
});

it('fails closed on unexpected errors', async () => {
  (i18n.changeLanguage as jest.Mock).mockRejectedValue(new Error('i18n down'));

  await expect(prepareShowcase(db, request)).resolves.toBe(false);

  expect(console.error).toHaveBeenCalledWith(
    '[showcase] falha ao preparar a vitrine:',
    expect.any(Error),
  );
});
