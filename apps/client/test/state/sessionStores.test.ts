/**
 * @jest-environment node
 */
jest.mock('../../src/services/ClientSettingsService', () => ({
  __esModule: true,
  getClientSettings: jest.fn(),
  updateClientSettings: jest.fn(),
}));

import * as ClientSettingsService from '../../src/services/ClientSettingsService';
import { useGalleryMediaViewerStore } from '../../src/state/galleryMediaViewerStore';
import { useHeaderBackActionStore } from '../../src/state/headerBackActionStore';
import { useLocationMapDraftStore } from '../../src/state/locationMapDraftStore';
import { usePresenceMatrixViewerStore } from '../../src/state/presenceMatrixViewerStore';
import { useThemeStore } from '../../src/state/themeStore';

const settingsService = ClientSettingsService as unknown as {
  getClientSettings: jest.Mock;
  updateClientSettings: jest.Mock;
};
const db = {} as never;

beforeEach(() => {
  jest.clearAllMocks();
  useGalleryMediaViewerStore.getState().close();
  useLocationMapDraftStore.getState().reset();
  usePresenceMatrixViewerStore.getState().close();
  useHeaderBackActionStore.setState({ backAction: undefined, crossStackReturnAction: undefined });
  useThemeStore.getState().resetTheme();
});

describe('small session stores', () => {
  it('opens and closes the gallery preview without navigation state', () => {
    useGalleryMediaViewerStore.getState().open('gallery-1');
    expect(useGalleryMediaViewerStore.getState().galleryId).toBe('gallery-1');

    useGalleryMediaViewerStore.getState().close();
    expect(useGalleryMediaViewerStore.getState().galleryId).toBeNull();
  });

  it('keeps an unsaved location-map drawing until it is explicitly cleared', () => {
    const draft = {
      mapId: 'map-1',
      storyId: 'story-1',
      content: { nodes: [], images: [] },
      savedContent: { nodes: [], images: [] },
    };
    useLocationMapDraftStore.getState().remember(draft);

    expect(useLocationMapDraftStore.getState().draft).toEqual(draft);
    useLocationMapDraftStore.getState().clear();
    expect(useLocationMapDraftStore.getState().draft).toBeNull();
  });

  it('records each presence-matrix destination and clears it after the overlay closes', () => {
    usePresenceMatrixViewerStore.getState().openCharacter('character-1');
    expect(usePresenceMatrixViewerStore.getState().request).toEqual({
      kind: 'character',
      characterId: 'character-1',
    });

    usePresenceMatrixViewerStore.getState().openItemList();
    expect(usePresenceMatrixViewerStore.getState().request).toEqual({ kind: 'item' });

    usePresenceMatrixViewerStore.getState().close();
    expect(usePresenceMatrixViewerStore.getState().request).toBeNull();
  });

  it('only clears the matching header action and consumes a cross-stack return once', () => {
    const first = jest.fn();
    const second = jest.fn();
    const returnToOrigin = jest.fn();
    useHeaderBackActionStore.getState().setBackAction(first);
    useHeaderBackActionStore.getState().clearBackAction(second);
    expect(useHeaderBackActionStore.getState().backAction).toBe(first);

    useHeaderBackActionStore.getState().clearBackAction(first);
    expect(useHeaderBackActionStore.getState().backAction).toBeUndefined();

    useHeaderBackActionStore.getState().setCrossStackReturnAction(returnToOrigin);
    expect(useHeaderBackActionStore.getState().consumeCrossStackReturnAction()).toBe(returnToOrigin);
    expect(useHeaderBackActionStore.getState().consumeCrossStackReturnAction()).toBeUndefined();
  });
});

describe('theme persistence', () => {
  it('hydrates, persists a choice, toggles it and returns to the safe default', async () => {
    settingsService.getClientSettings.mockResolvedValue({ darkMode: true });
    await useThemeStore.getState().initializeTheme(db);
    expect(useThemeStore.getState().darkMode).toBe(true);

    await useThemeStore.getState().setDarkMode(db, false);
    expect(settingsService.updateClientSettings).toHaveBeenLastCalledWith(db, { darkMode: false });
    expect(useThemeStore.getState().darkMode).toBe(false);

    await useThemeStore.getState().toggleDarkMode(db);
    expect(settingsService.updateClientSettings).toHaveBeenLastCalledWith(db, { darkMode: true });
    expect(useThemeStore.getState().darkMode).toBe(true);

    useThemeStore.getState().resetTheme();
    expect(useThemeStore.getState().darkMode).toBe(false);
  });
});
