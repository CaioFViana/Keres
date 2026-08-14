import { render } from '@testing-library/react-native';
import React from 'react';
import { HelpPageScreen } from '../../src/screens/help/HelpPageScreen';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void) => effect(),
  useNavigation: () => ({ push: jest.fn() }),
  useRoute: () => ({ params: { pageId: 'page-that-does-not-exist' } }),
}));

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: { background: '#fff', text: '#111', textSecondary: '#555' },
  }),
}));

jest.mock('../../src/utils/documentTitle', () => ({ setDocumentTitle: jest.fn() }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'pt' }, t: (key: string) => key }),
}));

it('shows an explicit error for an unknown page id', async () => {
  const { getByText } = await render(<HelpPageScreen />);

  expect(getByText('help_page_not_found')).toBeTruthy();
});
