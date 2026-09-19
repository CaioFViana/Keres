import { render } from '@testing-library/react-native';
import React from 'react';

const mockUseScreenTour = jest.fn();
const mockSetSelectedStory = jest.fn();
let mockSelectedStory: { id: string; vocabulary: null } | null = {
  id: 'story-1',
  vocabulary: null,
};

jest.mock('../../../src/guides/useScreenTour', () => ({
  __esModule: true,
  useScreenTour: (...args: unknown[]) => mockUseScreenTour(...args),
}));
jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => ({ goBack: jest.fn() }),
}));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../../src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: () => undefined,
}));
jest.mock('../../../src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canManageStoryPolicy: true }),
}));
jest.mock('../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: () => ({
    selectedStory: mockSelectedStory,
    setSelectedStory: mockSetSelectedStory,
  }),
}));
jest.mock('../../../src/db', () => ({ __esModule: true, useDrizzle: () => ({}) }));
jest.mock('@/src/services/storymanagement/StoryService', () => ({
  __esModule: true,
  createStoryService: () => ({}),
}));
jest.mock('../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      surface: '#fff',
      card: '#fff',
      text: '#111',
      textSecondary: '#555',
      border: '#ddd',
      primary: '#00f',
      onPrimary: '#fff',
      error: '#f00',
    },
  }),
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
jest.mock('@/src/components/common', () => ({
  __esModule: true,
  Button: () => null,
  SingleSelectPill: () => null,
  TextInput: () => null,
}));
jest.mock('@/src/components/common/controls/FormActions/FormActions', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.View, { testID: 'vocabulary-scroll' }, children);
  },
}));

import VocabularyScreen from '../../../src/screens/customization/VocabularyScreen';

beforeEach(() => {
  jest.clearAllMocks();
  mockSelectedStory = { id: 'story-1', vocabulary: null };
});

it('requests its guided tour', async () => {
  await render(<VocabularyScreen />);

  expect(mockUseScreenTour).toHaveBeenCalledWith('Vocabulary');
});
