import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { HelpIndexScreen } from '../../src/screens/help/HelpIndexScreen';

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
      key === 'help_search_results_count' ? `${options?.count} resultados` : key,
  }),
}));

describe('HelpIndexScreen', () => {
  beforeEach(() => mockNavigate.mockClear());

  it('searches and opens the selected result', async () => {
    const { getAllByText, getByLabelText } = await render(<HelpIndexScreen />);

    await fireEvent.changeText(getByLabelText('help_search_placeholder'), 'personagens');
    await fireEvent.press(getAllByText('Personagens')[0]);

    expect(mockNavigate).toHaveBeenCalledWith('HelpPage', { pageId: 'characters' });
  });

  it('clears an active search with the accessible clear button', async () => {
    const { getByLabelText } = await render(<HelpIndexScreen />);

    const input = getByLabelText('help_search_placeholder');
    await fireEvent.changeText(input, 'personagens');
    await fireEvent.press(getByLabelText('help_search_clear'));

    expect(input.props.value).toBe('');
  });
});
