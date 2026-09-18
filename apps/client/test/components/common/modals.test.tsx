import { AttributeType } from '@keres/shared';
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import AdvancedSearchModal from '../../../src/components/common/modals/AdvancedSearchModal/AdvancedSearchModal';
import ReorderModal from '../../../src/components/common/modals/ReorderModal/ReorderModal';
import type { StorySchemaFieldSelect } from '../../../src/db/schema';
import { useStorySchemaFields } from '../../../src/hooks/useStorySchemaFields';

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

jest.mock('../../../src/hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: () => ({
    width: 390,
    height: 844,
    breakpoint: 'compact',
    isCompact: true,
    isMedium: false,
    isWide: false,
  }),
}));

jest.mock('../../../src/hooks/useStorySchemaFields', () => ({
  useStorySchemaFields: jest.fn(() => []),
}));

jest.mock('../../../src/hooks/useEntityPickerOptions', () => ({
  useEntityPickerOptions: () => ({
    options: [{ id: 'e1', name: 'Ent One' }],
    loading: false,
    reload: jest.fn(),
  }),
}));

jest.mock('../../../src/components/layout/ResponsiveModal/ResponsiveModal', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    default: ({ visible, children }: any) =>
      visible ? react.createElement(react.Fragment, null, children) : null,
  };
});

jest.mock('../../../src/components/common/inputs/SuggestionTextInput/SuggestionTextInput', () => {
  const react = jest.requireActual('react') as typeof import('react');
  const native = jest.requireActual('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    default: ({ value, onChangeText, type }: any) =>
      react.createElement(
        react.Fragment,
        null,
        react.createElement(native.Text, { testID: `sugg-${type}` }, `${type}=${value}`),
        react.createElement(
          native.Text,
          { testID: `sugg-pick-${type}`, onPress: () => onChangeText('picked') },
          'pick-sugg',
        ),
      ),
  };
});

jest.mock('../../../src/components/common/inputs/DatePickerInput/DatePickerInput', () => {
  const react = jest.requireActual('react') as typeof import('react');
  const native = jest.requireActual('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    default: ({ value, onChange, placeholder }: any) =>
      react.createElement(
        react.Fragment,
        null,
        react.createElement(
          native.Text,
          { testID: `dpick-${placeholder}` },
          `${placeholder}=${value ?? 'none'}`,
        ),
        react.createElement(
          native.Text,
          {
            testID: `dpick-pick-${placeholder}`,
            onPress: () => onChange('2024-03-04'),
          },
          'pick-date',
        ),
      ),
  };
});

jest.mock('../../../src/components/common/inputs/StoryDateInput/StoryDateInput', () => {
  const react = jest.requireActual('react') as typeof import('react');
  const native = jest.requireActual('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    default: ({ value, onChange }: any) =>
      react.createElement(
        react.Fragment,
        null,
        react.createElement(native.Text, { testID: 'sdpick' }, value ?? 'none'),
        react.createElement(
          native.Text,
          { testID: 'sdpick-pick', onPress: () => onChange('7') },
          'pick-storydate',
        ),
      ),
  };
});

jest.mock('../../../src/components/common/inputs/ColorPickerInput/ColorPickerInput', () => {
  const react = jest.requireActual('react') as typeof import('react');
  const native = jest.requireActual('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    default: ({ currentColor, onSelectColor, placeholder }: any) =>
      react.createElement(
        react.Fragment,
        null,
        react.createElement(
          native.Text,
          { testID: `cpick-${placeholder}` },
          `${placeholder}=${currentColor}`,
        ),
        react.createElement(
          native.Text,
          {
            testID: `cpick-pick-${placeholder}`,
            onPress: () => onSelectColor('#aabbcc'),
          },
          'pick-color',
        ),
      ),
  };
});

const mockSchemaFields = useStorySchemaFields as jest.Mock;

// Stable references: both modals resync their draft whenever these identities change.
const EMPTY_CRITERIA = {};
const customField = (
  id: string,
  name: string,
  type: string,
  targetEntityType: string | null = null,
) =>
  ({
    id,
    name,
    type,
    targetEntityType,
    isRequired: false,
    defaultValue: null,
  }) as unknown as StorySchemaFieldSelect;

describe('ReorderModal', () => {
  const items = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
  ];
  const getId = (item: { id: string }) => item.id;
  const getLabel = (item: { label: string }) => item.label;

  it('stays hidden until opened', async () => {
    const screen = await render(
      <ReorderModal
        isVisible={false}
        onClose={() => {}}
        title="Reorder"
        items={items}
        getId={getId}
        getLabel={getLabel}
        onReorderConfirm={async () => {}}
      />,
    );
    // The RN preset renders no Modal content while hidden.
    expect(screen.queryByText('Reorder')).toBeNull();
  });

  it('moves rows and confirms the final order', async () => {
    const onReorderConfirm = jest.fn(async () => {});
    const onClose = jest.fn();
    const screen = await render(
      <ReorderModal
        isVisible
        onClose={onClose}
        title="Reorder"
        items={items}
        getId={getId}
        getLabel={getLabel}
        onReorderConfirm={onReorderConfirm}
      />,
    );

    await fireEvent.press(screen.getByLabelText('A down'));
    await fireEvent.press(screen.getByLabelText('C up'));
    await fireEvent.press(screen.getByText('common_confirm'));
    expect(onReorderConfirm).toHaveBeenCalledWith([
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
      { id: 'a', label: 'A' },
    ]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores moves past either end', async () => {
    const onReorderConfirm = jest.fn(async () => {});
    const screen = await render(
      <ReorderModal
        isVisible
        onClose={() => {}}
        title="Reorder"
        items={items}
        getId={getId}
        getLabel={getLabel}
        onReorderConfirm={onReorderConfirm}
      />,
    );

    await fireEvent.press(screen.getByLabelText('A up'));
    await fireEvent.press(screen.getByLabelText('C down'));
    await fireEvent.press(screen.getByText('common_confirm'));
    expect(onReorderConfirm).toHaveBeenCalledWith(items);
  });

  it('cancels without confirming', async () => {
    const onReorderConfirm = jest.fn(async () => {});
    const onClose = jest.fn();
    const screen = await render(
      <ReorderModal
        isVisible
        onClose={onClose}
        title="Reorder"
        items={items}
        getId={getId}
        getLabel={getLabel}
        onReorderConfirm={onReorderConfirm}
      />,
    );

    await fireEvent.press(screen.getByText('common_cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onReorderConfirm).not.toHaveBeenCalled();
  });

  it('closes through the header button', async () => {
    const onClose = jest.fn();
    const screen = await render(
      <ReorderModal
        isVisible
        onClose={onClose}
        title="Reorder"
        items={items}
        getId={getId}
        getLabel={getLabel}
        onReorderConfirm={async () => {}}
      />,
    );

    await fireEvent.press(screen.getByLabelText('common_cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('refuses to confirm when disabled', async () => {
    const onReorderConfirm = jest.fn(async () => {});
    const screen = await render(
      <ReorderModal
        isVisible
        onClose={() => {}}
        title="Reorder"
        items={items}
        getId={getId}
        getLabel={getLabel}
        onReorderConfirm={onReorderConfirm}
        confirmDisabled
      />,
    );

    await fireEvent.press(screen.getByText('common_confirm'));
    expect(onReorderConfirm).not.toHaveBeenCalled();
  });

  it('shows extras and the empty state, and resyncs on new items', async () => {
    const empty: { id: string; label: string }[] = [];
    const props = {
      onClose: () => {},
      title: 'Reorder',
      getId,
      getLabel,
      onReorderConfirm: async () => {},
    };
    const screen = await render(
      <ReorderModal
        isVisible
        {...props}
        items={empty}
        headerExtra={<Text>chapter picker</Text>}
        emptyListComponent={<Text>nothing to order</Text>}
      />,
    );
    expect(screen.getByText('chapter picker')).toBeTruthy();
    expect(screen.getByText('nothing to order')).toBeTruthy();

    const swapped = [
      { id: 'b', label: 'B' },
      { id: 'a', label: 'A' },
    ];
    await screen.rerender(<ReorderModal isVisible {...props} items={swapped} />);
    expect(screen.queryByText('nothing to order')).toBeNull();
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.getByText('B')).toBeTruthy();
  });
});

describe('AdvancedSearchModal', () => {
  beforeEach(() => {
    mockSchemaFields.mockReturnValue([]);
  });

  const openProps = {
    entityName: 'Character',
    storyId: 's1',
    isVisible: true,
    onClose: () => {},
    onSearch: () => {},
    initialCriteria: EMPTY_CRITERIA,
  };

  it('renders nothing while closed', async () => {
    const screen = await render(<AdvancedSearchModal {...openProps} isVisible={false} />);
    expect(screen.queryByText('advanced_search_title')).toBeNull();
  });

  it('searches native string fields and closes', async () => {
    const onSearch = jest.fn();
    const onClose = jest.fn();
    const screen = await render(
      <AdvancedSearchModal {...openProps} onSearch={onSearch} onClose={onClose} />,
    );

    expect(screen.getByText('advanced_search_title')).toBeTruthy();
    await fireEvent.changeText(screen.getByPlaceholderText('field_name'), 'Lyra');
    await fireEvent.press(screen.getByText('common_search'));
    expect(onSearch).toHaveBeenCalledWith({ name: 'Lyra' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clears every criterion at once', async () => {
    const onSearch = jest.fn();
    const onClose = jest.fn();
    const screen = await render(
      <AdvancedSearchModal {...openProps} onSearch={onSearch} onClose={onClose} />,
    );

    await fireEvent.changeText(screen.getByPlaceholderText('field_name'), 'Lyra');
    await fireEvent.press(screen.getByText('common_clear'));
    expect(onSearch).toHaveBeenCalledWith({});
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes through the header button', async () => {
    const onClose = jest.fn();
    const screen = await render(<AdvancedSearchModal {...openProps} onClose={onClose} />);

    const close = screen.container.queryAll(
      (node) => node.type === 'Icon' && node.props.name === 'close',
    )[0];
    await fireEvent.press(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('searches native suggestion fields', async () => {
    const onSearch = jest.fn();
    const screen = await render(<AdvancedSearchModal {...openProps} onSearch={onSearch} />);

    await fireEvent.press(screen.getByTestId('sugg-pick-character_gender'));
    await fireEvent.press(screen.getByText('common_search'));
    expect(onSearch).toHaveBeenCalledWith({ gender: 'picked' });
  });

  it('toggles native boolean fields through three states', async () => {
    const onSearch = jest.fn();
    const screen = await render(
      <AdvancedSearchModal {...openProps} entityName="Chapter" onSearch={onSearch} />,
    );

    const toggle = () =>
      screen.container.queryAll(
        (node) =>
          node.type === 'Icon' &&
          ['square-outline', 'checkmark-circle', 'close-circle'].includes(node.props.name),
      )[0];
    expect(toggle().props.name).toBe('square-outline');
    await fireEvent.press(toggle());
    await fireEvent.press(screen.getByText('common_search'));
    expect(onSearch).toHaveBeenCalledWith({ isFavorite: true });

    await fireEvent.press(toggle());
    await fireEvent.press(screen.getByText('common_search'));
    expect(onSearch).toHaveBeenLastCalledWith({ isFavorite: false });
  });

  it('searches custom number fields by id', async () => {
    mockSchemaFields.mockReturnValue([customField('cf1', 'Power', AttributeType.NUMBER)]);
    const onSearch = jest.fn();
    const screen = await render(<AdvancedSearchModal {...openProps} onSearch={onSearch} />);

    await fireEvent.changeText(screen.getByPlaceholderText('Power'), '42');
    await fireEvent.press(screen.getByText('common_search'));
    expect(onSearch).toHaveBeenCalledWith({ 'custom:cf1': 42 });
  });

  it('searches custom date and story-date fields', async () => {
    mockSchemaFields.mockReturnValue([
      customField('cf2', 'When', AttributeType.DATE),
      customField('cf3', 'Era day', AttributeType.STORY_DATE),
    ]);
    const onSearch = jest.fn();
    const screen = await render(<AdvancedSearchModal {...openProps} onSearch={onSearch} />);

    await fireEvent.press(screen.getByTestId('dpick-pick-When'));
    await fireEvent.press(screen.getByTestId('sdpick-pick'));
    await fireEvent.press(screen.getByText('common_search'));
    expect(onSearch).toHaveBeenCalledWith({
      'custom:cf2': '2024-03-04',
      'custom:cf3': '7',
    });
  });

  it('searches native color fields', async () => {
    const onSearch = jest.fn();
    const screen = await render(
      <AdvancedSearchModal {...openProps} entityName="Tag" onSearch={onSearch} />,
    );

    await fireEvent.press(screen.getByTestId('cpick-pick-field_color'));
    await fireEvent.press(screen.getByText('common_search'));
    expect(onSearch).toHaveBeenCalledWith({ color: '#aabbcc' });
  });

  it('searches custom suggestion fields', async () => {
    mockSchemaFields.mockReturnValue([customField('cf6', 'Trait', AttributeType.SUGGESTION)]);
    const onSearch = jest.fn();
    const screen = await render(<AdvancedSearchModal {...openProps} onSearch={onSearch} />);

    await fireEvent.press(screen.getByTestId('sugg-pick-custom:cf6'));
    await fireEvent.press(screen.getByText('common_search'));
    expect(onSearch).toHaveBeenCalledWith({ 'custom:cf6': 'picked' });
  });

  it('picks custom entity references and skips targetless ones', async () => {
    mockSchemaFields.mockReturnValue([
      customField('cf7', 'Mentor', AttributeType.ENTITY, 'Character'),
      customField('cf8', 'NoTarget', AttributeType.ENTITY, null),
    ]);
    const onSearch = jest.fn();
    const screen = await render(<AdvancedSearchModal {...openProps} onSearch={onSearch} />);

    expect(screen.queryByText('NoTarget')).toBeNull();
    await fireEvent.press(screen.getByTestId('multiselect-trigger'));
    await fireEvent.press(screen.getByTestId('multiselect-option-e1'));
    await fireEvent.press(screen.getByText('common_search'));
    expect(onSearch).toHaveBeenCalledWith({ 'custom:cf7': 'e1' });
  });

  it('prefills from initial criteria and follows replacements', async () => {
    const first = { name: 'Bo' };
    const screen = await render(<AdvancedSearchModal {...openProps} initialCriteria={first} />);
    expect(screen.getByPlaceholderText('field_name').props.value).toBe('Bo');

    const second = { name: 'Bo2' };
    await screen.rerender(<AdvancedSearchModal {...openProps} initialCriteria={second} />);
    expect(screen.getByPlaceholderText('field_name').props.value).toBe('Bo2');
  });

  it('prefixes criteria per scope', async () => {
    const onSearch = jest.fn();
    const screen = await render(
      <AdvancedSearchModal
        {...openProps}
        onSearch={onSearch}
        scopes={[
          { entityName: 'Character', prefix: 'a', label: 'Side A' },
          { entityName: 'Chapter', prefix: 'b', label: 'Side B' },
        ]}
      />,
    );

    expect(screen.getByText('Side A')).toBeTruthy();
    expect(screen.getByText('Side B')).toBeTruthy();
    await fireEvent.changeText(screen.getAllByPlaceholderText('field_name')[0], 'X');
    await fireEvent.press(screen.getByText('common_search'));
    expect(onSearch).toHaveBeenCalledWith({ 'a:name': 'X' });
  });
});
