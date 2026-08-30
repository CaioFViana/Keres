import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';

jest.mock('../../src/components/common', () => ({
  __esModule: true,
  Button: ({ children }: { children: React.ReactNode }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.Text, null, children);
  },
  Select: () => null,
  TextInput: (props: import('react-native').TextInputProps) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.TextInput, props);
  },
}));
jest.mock('../../src/components/common/controls/FormActions/FormActions', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('../../src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: () => ({}) }));
jest.mock('../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canManageStoryPolicy: true }),
}));
jest.mock('../../src/services/storymanagement/StoryService', () => ({
  __esModule: true,
  createStoryService: () => ({ updateStory: jest.fn() }),
}));
jest.mock('../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#fff',
      surface: '#eee',
      text: '#111',
      textSecondary: '#666',
      primary: '#00f',
    },
  }),
}));
jest.mock('../../src/theme/commonStyles', () => ({
  __esModule: true,
  getCommonContainerStyles: () => ({ container: {} }),
}));
jest.mock('../../src/utils/AppAlert', () => ({ __esModule: true, AppAlert: { alert: jest.fn() } }));
jest.mock('../../src/utils/documentTitle', () => ({
  __esModule: true,
  setDocumentTitle: () => undefined,
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    useNavigation: () => ({ goBack: jest.fn(), getParent: () => ({ setOptions: jest.fn() }) }),
    useFocusEffect: (callback: () => void | (() => void)) => react.useEffect(callback, [callback]),
  };
});

// The store can legitimately return a fresh Story object after unrelated store updates. The form
// must not treat that reference change as an instruction to replace the draft currently being typed.
const mockBaseStory = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FUT',
  userId: '01ARZ3NDEKTSV4RRFFQ69G5FUS',
  vocabulary: null,
};
jest.mock('../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: () => ({ selectedStory: { ...mockBaseStory }, setSelectedStory: jest.fn() }),
}));

import VocabularyScreen from '../../src/screens/customization/VocabularyScreen';

describe('VocabularyScreen draft', () => {
  it('keeps an edited term when the store returns an equivalent Story object', async () => {
    const screen = await render(<VocabularyScreen />);
    const firstTerm = screen.getByTestId('vocabulary-Character-singular');

    await act(async () => {
      fireEvent.changeText(firstTerm, 'Hero');
    });

    expect(screen.getByTestId('vocabulary-Character-singular').props.value).toBe('Hero');
    expect(screen.getByTestId('vocabulary-footer-spacer')).toBeTruthy();
  });
});
