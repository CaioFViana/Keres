import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { HelpIndexScreen } from '../../src/screens/help/HelpIndexScreen';
import { storyDeviceLibrary } from '../../src/storyDevices/library';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void) => effect(),
  useNavigation: () => ({ navigate: mockNavigate, push: mockNavigate }),
  useRoute: jest.fn(),
}));

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      primary: '#00f',
      primaryContainer: '#ddf',
      surface: '#fff',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

jest.mock('../../src/utils/documentTitle', () => ({ setDocumentTitle: jest.fn() }));

jest.mock('../../src/utils/debounce', () => ({
  debounce: (callback: (...args: any[]) => void) => {
    const immediate = (...args: any[]) => callback(...args);
    immediate.cancel = jest.fn();
    return immediate;
  },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'pt' },
    t: (key: string, options?: { count?: number }) =>
      key === 'story_devices_search_results_count' ? `${options?.count} recursos` : key,
  }),
}));

describe('story devices index', () => {
  beforeEach(() => mockNavigate.mockClear());

  it('renders the device sections instead of the help sections', async () => {
    const { getByText, queryByText } = await render(
      <HelpIndexScreen library={storyDeviceLibrary} />,
    );

    expect(getByText('story_devices_section_structure')).toBeTruthy();
    expect(queryByText('help_section_stories')).toBeNull();
  });

  it('searches by the english name and opens the device page route', async () => {
    const { getAllByText, getByLabelText } = await render(
      <HelpIndexScreen library={storyDeviceLibrary} />,
    );

    await fireEvent.changeText(getByLabelText('story_devices_search_placeholder'), 'macguffin');
    await fireEvent.press(getAllByText('MacGuffin')[0]);

    expect(mockNavigate).toHaveBeenCalledWith('DevicePage', { pageId: 'macguffin' });
  });

  it('offers the opening page when a search finds nothing', async () => {
    const { getByText, getByLabelText } = await render(
      <HelpIndexScreen library={storyDeviceLibrary} />,
    );

    await fireEvent.changeText(getByLabelText('story_devices_search_placeholder'), 'zzzzzz');
    await fireEvent.press(getByText('story_devices_no_results_hint'));

    expect(mockNavigate).toHaveBeenCalledWith('DevicePage', { pageId: 'how-to-use-devices' });
  });
});
