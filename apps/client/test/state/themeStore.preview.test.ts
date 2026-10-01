jest.mock('../../src/services/ClientSettingsService', () => ({
  getClientSettings: jest.fn(),
  updateClientSettings: jest.fn(),
}));

import { updateClientSettings } from '../../src/services/ClientSettingsService';
import { useThemeStore } from '../../src/state/themeStore';

describe('previewDarkMode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useThemeStore.getState().resetTheme();
  });

  it('shows the other theme without writing anything: the first run has no settings row yet', () => {
    useThemeStore.getState().previewDarkMode(true);

    expect(useThemeStore.getState().darkMode).toBe(true);
    expect(updateClientSettings).not.toHaveBeenCalled();
  });

  it('can be undone the same way', () => {
    useThemeStore.getState().previewDarkMode(true);
    useThemeStore.getState().previewDarkMode(false);

    expect(useThemeStore.getState().darkMode).toBe(false);
  });
});
