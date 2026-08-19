jest.mock('react-native-safe-area-context', () => ({
  __esModule: true,
  useSafeAreaInsets: jest.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 })),
}));

jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: jest.fn(() => ({})) }));
jest.mock('../../src/services/storymanagement/SuggestionService', () => ({
  createSuggestionService: jest.fn(),
}));
jest.mock('../../src/components/layout/ResponsiveModal/ResponsiveModal', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
      visible ? <>{children}</> : null,
  };
});

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import SuggestionListInput from '../../src/components/common/inputs/SuggestionListInput/SuggestionListInput';
import { createSuggestionService } from '../../src/services/storymanagement/SuggestionService';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      onPrimary: '#fff',
      primary: '#00f',
      primaryContainer: '#ddf',
      surface: '#fff',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

jest.mock('../../src/theme/commonStyles', () => ({
  getCommonInputStyles: () => ({ input: {} }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const getSuggestions = jest.fn().mockResolvedValue([
  ['elf', 2],
  ['dwarf', 1],
]);

beforeEach(() => {
  getSuggestions.mockClear();
  (createSuggestionService as jest.Mock).mockReturnValue({ getSuggestions });
});

describe('SuggestionListInput', () => {
  it('adds a typed value', async () => {
    const onChange = jest.fn();
    const screen = await render(
      <SuggestionListInput
        values={[]}
        onChange={onChange}
        type="custom:traits"
        storyId="story-1"
        placeholder="traits"
      />,
    );

    await fireEvent.changeText(screen.getByTestId('suggestion-list-draft'), 'Elf');
    await fireEvent.press(screen.getByTestId('suggestion-list-add'));
    expect(onChange).toHaveBeenCalledWith(['Elf']);
  });

  it('refuses a duplicate regardless of letter case', async () => {
    const onChange = jest.fn();
    const screen = await render(
      <SuggestionListInput
        values={['Elf']}
        onChange={onChange}
        type="custom:traits"
        storyId="story-1"
        placeholder="traits"
      />,
    );

    await fireEvent.changeText(screen.getByTestId('suggestion-list-draft'), 'elf');
    await fireEvent.press(screen.getByTestId('suggestion-list-add'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('removes a chip', async () => {
    const onChange = jest.fn();
    const screen = await render(
      <SuggestionListInput
        values={['elf', 'dwarf']}
        onChange={onChange}
        type="custom:traits"
        storyId="story-1"
        placeholder="traits"
      />,
    );

    await fireEvent.press(screen.getByTestId('suggestion-list-remove-elf'));
    expect(onChange).toHaveBeenCalledWith(['dwarf']);
  });

  it('filters the catalog and toggles a suggestion without closing', async () => {
    const onChange = jest.fn();
    const screen = await render(
      <SuggestionListInput
        values={['elf']}
        onChange={onChange}
        type="custom:traits"
        storyId="story-1"
        placeholder="traits"
      />,
    );

    await fireEvent.press(screen.getByTestId('suggestion-list-catalog'));
    await waitFor(() => expect(screen.getByTestId('suggestion-list-option-dwarf')).toBeTruthy());

    await fireEvent.changeText(screen.getByTestId('suggestion-list-search'), 'dwa');
    await waitFor(() => {
      expect(screen.getByTestId('suggestion-list-option-dwarf')).toBeTruthy();
      expect(screen.queryByTestId('suggestion-list-option-elf')).toBeNull();
    });

    await fireEvent.press(screen.getByTestId('suggestion-list-option-dwarf'));
    expect(onChange).toHaveBeenCalledWith(['elf', 'dwarf']);
    expect(screen.getByTestId('suggestion-list-option-dwarf')).toBeTruthy();
  });
});
