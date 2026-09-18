import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    useNavigation: () => ({
      navigate: mockNavigate,
      getParent: () => ({ setOptions: jest.fn() }),
    }),
    useFocusEffect: (callback: () => void | (() => void)) => react.useEffect(callback, [callback]),
  };
});
jest.mock('@expo/vector-icons', () => ({
  __esModule: true,
  Ionicons: () => null,
}));
jest.mock('@/src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('@/src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#fff',
      primary: '#00f',
      text: '#111',
      textSecondary: '#666',
    },
  }),
}));
jest.mock('../../../src/utils/documentTitle', () => ({
  __esModule: true,
  setDocumentTitle: () => undefined,
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));

import CustomizationIndexScreen from '../../../src/screens/customization/CustomizationIndexScreen';

const ROUTES = [
  'StoryAppearance',
  'StoryArcList',
  'Vocabulary',
  'StoryCalendarList',
  'StorySchemaList',
  'Suggestions',
  'StatList',
] as const;

beforeEach(() => {
  jest.clearAllMocks();
});

it('renders one entry per customization area', async () => {
  const screen = await render(<CustomizationIndexScreen />);

  expect(screen.getByText('customization_intro')).toBeTruthy();
  for (const route of ROUTES) {
    expect(screen.getByTestId(`customization-${route}`)).toBeTruthy();
  }
});

it('navigates to the tapped customization area', async () => {
  const screen = await render(<CustomizationIndexScreen />);

  fireEvent.press(screen.getByTestId('customization-Vocabulary'));
  expect(mockNavigate).toHaveBeenCalledWith('Vocabulary');

  fireEvent.press(screen.getByTestId('customization-StatList'));
  expect(mockNavigate).toHaveBeenCalledWith('StatList');
});
