import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import SuggestionTextInput from '../../../src/components/common/inputs/SuggestionTextInput/SuggestionTextInput';
import TextInput from '../../../src/components/common/inputs/TextInput/TextInput';
import { KeyboardAwareContext } from '../../../src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import { useSuggestions } from '../../../src/hooks/useSuggestions';

jest.mock('../../../src/theme', () => {
  const actual = jest.requireActual('../../../src/theme');
  return {
    ...actual,
    useTheme: () => ({
      isDarkMode: false,
      colors: {
        primary: '#0000ff',
        primaryContainer: '#ddddff',
        onPrimary: '#ffffff',
        onPrimaryContainer: '#000088',
        secondary: '#00aaaa',
        onSecondary: '#ffffff',
        background: '#ffffff',
        surface: '#f5f5f5',
        card: '#eeeeee',
        onSurface: '#111111',
        text: '#111111',
        textSecondary: '#555555',
        border: '#dddddd',
        error: '#ff0000',
        onError: '#ffffff',
        accent: '#00ff00',
        onAccent: '#001100',
        notification: '#ffaa00',
        onNotification: '#221100',
        shadow: '#000000',
      },
    }),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Icon',
  MaterialCommunityIcons: 'MIcon',
}));

jest.mock('../../../src/hooks/useSuggestions', () => ({
  useSuggestions: jest.fn(() => ({ suggestions: [], loading: false, reload: jest.fn() })),
}));

jest.mock('../../../src/components/layout/ResponsiveModal/ResponsiveModal', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    default: ({ visible, children }: any) =>
      visible ? react.createElement(react.Fragment, null, children) : null,
  };
});

const mockSuggestions = useSuggestions as jest.Mock;

describe('TextInput', () => {
  it('edits text and forwards focus and blur', async () => {
    const onChangeText = jest.fn();
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    const screen = await render(
      <TextInput
        testID="field"
        value="a"
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder="Name"
      />,
    );

    const field = screen.getByTestId('field');
    expect(field.props.placeholderTextColor).toBe('#555555');
    await fireEvent.changeText(field, 'ab');
    expect(onChangeText).toHaveBeenCalledWith('ab');
    await fireEvent(field, 'focus');
    expect(onFocus).toHaveBeenCalledTimes(1);
    await fireEvent(field, 'blur');
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('shows the interaction border on focus unless suppressed', async () => {
    const screen = await render(<TextInput testID="field" value="" />);
    const field = screen.getByTestId('field');
    expect(StyleSheet.flatten(field.props.style).borderStyle).toBeUndefined();
    await fireEvent(field, 'focus');
    expect(StyleSheet.flatten(screen.getByTestId('field').props.style).borderStyle).toBe('solid');
    await fireEvent(field, 'blur');
    expect(StyleSheet.flatten(screen.getByTestId('field').props.style).borderStyle).toBeUndefined();
  });

  it('leaves the border alone when the parent draws it', async () => {
    const screen = await render(<TextInput testID="field" value="" suppressInteractionBorder />);
    await fireEvent(screen.getByTestId('field'), 'focus');
    expect(StyleSheet.flatten(screen.getByTestId('field').props.style).borderStyle).toBeUndefined();
  });

  it('lets a requested minHeight win over the single-line height', async () => {
    const fixed = await render(<TextInput testID="field" value="" multiline />);
    expect(StyleSheet.flatten(fixed.getByTestId('field').props.style).height).toBe(50);

    const growing = await render(
      <TextInput testID="field" value="" multiline style={{ minHeight: 100 }} />,
    );
    expect(StyleSheet.flatten(growing.getByTestId('field').props.style)).toMatchObject({
      height: undefined,
      minHeight: 100,
    });
  });

  it('asks the form to scroll the field into view and forwards hover', async () => {
    const requestFocusScroll = jest.fn();
    const onPointerEnter = jest.fn();
    const onPointerLeave = jest.fn();
    const screen = await render(
      <KeyboardAwareContext.Provider value={requestFocusScroll}>
        <TextInput
          testID="field"
          value=""
          onPointerEnter={onPointerEnter}
          onPointerLeave={onPointerLeave}
        />
      </KeyboardAwareContext.Provider>,
    );

    const field = screen.getByTestId('field');
    await fireEvent(field, 'focus');
    expect(requestFocusScroll).toHaveBeenCalledTimes(1);
    await fireEvent(field, 'pointerEnter', {});
    expect(onPointerEnter).toHaveBeenCalledTimes(1);
    await fireEvent(field, 'pointerLeave', {});
    expect(onPointerLeave).toHaveBeenCalledTimes(1);
  });
});

describe('SuggestionTextInput', () => {
  beforeEach(() => {
    mockSuggestions.mockReturnValue({
      suggestions: [
        ['elf', 2],
        ['dwarf', 1],
        ['imp', 0],
      ],
      loading: false,
      reload: jest.fn(),
    });
  });

  it('loads the catalog on mount and renders the value', async () => {
    const reload = jest.fn();
    mockSuggestions.mockReturnValue({ suggestions: [], loading: false, reload });
    const screen = await render(
      <SuggestionTextInput value="el" onChangeText={() => {}} type="race" storyId="s1" />,
    );

    expect(reload).toHaveBeenCalled();
    expect(screen.getByDisplayValue('el')).toBeTruthy();
  });

  it('opens the catalog, filters it and picks a suggestion', async () => {
    const onChangeText = jest.fn();
    const screen = await render(
      <SuggestionTextInput value="" onChangeText={onChangeText} type="race" storyId="s1" />,
    );

    await fireEvent.press(
      screen.container.queryAll(
        (node) => node.type === 'Icon' && node.props.name === 'bulb-outline',
      )[0],
    );
    expect(screen.getByText('elf')).toBeTruthy();
    // The usage count rides beside suggestions that have one, and stays hidden otherwise.
    const textsInRowOf = (text: string) =>
      screen.getByText(text).parent!.children.filter((child) => typeof child !== 'string');
    expect(textsInRowOf('elf')).toHaveLength(2);
    expect(textsInRowOf('imp')).toHaveLength(1);

    await fireEvent.changeText(screen.getByPlaceholderText('search'), 'dwa');
    expect(screen.getByText('dwarf')).toBeTruthy();
    expect(screen.queryByText('elf')).toBeNull();

    await fireEvent.press(screen.getByText('dwarf'));
    expect(onChangeText).toHaveBeenCalledWith('dwarf');
    expect(screen.queryByText('elf')).toBeNull();
  });

  it('closes without choosing', async () => {
    const onChangeText = jest.fn();
    const screen = await render(
      <SuggestionTextInput value="" onChangeText={onChangeText} type="race" storyId="s1" />,
    );

    const toggle = () =>
      screen.container.queryAll(
        (node) => node.type === 'Icon' && node.props.name === 'bulb-outline',
      )[0];
    await fireEvent.press(toggle());
    await fireEvent.press(screen.getByText('close'));
    expect(onChangeText).not.toHaveBeenCalled();
    expect(screen.queryByText('elf')).toBeNull();

    // The toggle also closes when pressed again.
    await fireEvent.press(toggle());
    expect(screen.getByText('elf')).toBeTruthy();
    await fireEvent.press(toggle());
    expect(screen.queryByText('elf')).toBeNull();
  });

  it('shows the empty catalog message when nothing matches', async () => {
    const screen = await render(
      <SuggestionTextInput value="" onChangeText={() => {}} type="race" storyId="s1" />,
    );

    await fireEvent.press(
      screen.container.queryAll(
        (node) => node.type === 'Icon' && node.props.name === 'bulb-outline',
      )[0],
    );
    await fireEvent.changeText(screen.getByPlaceholderText('search'), 'zzz-no-match');
    expect(screen.getByText('no_suggestions_available')).toBeTruthy();
  });
});
