import { AttributeType } from '@keres/shared';
import { fireEvent, render } from '@testing-library/react-native';
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

  /** "Add filter", then the field - how every field past the first one is brought in. */
  const addField = async (screen: Awaited<ReturnType<typeof render>>, key: string, suffix = '') => {
    await fireEvent.press(screen.getByTestId(`advanced-add-filter${suffix}`));
    await fireEvent.press(screen.getByTestId(`advanced-add-option-${key}`));
  };

  it('renders nothing while closed', async () => {
    const screen = await render(<AdvancedSearchModal {...openProps} isVisible={false} />);
    expect(screen.queryByText('advanced_search_title')).toBeNull();
  });

  it('starts with the name only, the other fields one tap away', async () => {
    const screen = await render(<AdvancedSearchModal {...openProps} />);

    expect(screen.getByTestId('advanced-row-name')).toBeTruthy();
    expect(screen.queryByTestId('advanced-row-race')).toBeNull();
    expect(screen.queryByTestId('advanced-row-biography')).toBeNull();
    await fireEvent.press(screen.getByTestId('advanced-add-filter'));
    expect(screen.getByTestId('advanced-add-option-race')).toBeTruthy();
    expect(screen.getByTestId('advanced-add-option-biography')).toBeTruthy();
    // What is already on screen is not offered again.
    expect(screen.queryByTestId('advanced-add-option-name')).toBeNull();
  });

  it('searches native string fields and closes', async () => {
    const onSearch = jest.fn();
    const onClose = jest.fn();
    const screen = await render(
      <AdvancedSearchModal {...openProps} onSearch={onSearch} onClose={onClose} />,
    );

    expect(screen.getByText('advanced_search_title')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('advanced-field-name'), 'Lyra');
    await fireEvent.press(screen.getByTestId('advanced-apply'));
    expect(onSearch).toHaveBeenCalledWith({ name: 'Lyra' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('applies on Enter', async () => {
    const onSearch = jest.fn();
    const onClose = jest.fn();
    const screen = await render(
      <AdvancedSearchModal {...openProps} onSearch={onSearch} onClose={onClose} />,
    );

    await fireEvent.changeText(screen.getByTestId('advanced-field-name'), 'Lyra');
    await fireEvent(screen.getByTestId('advanced-field-name'), 'submitEditing');
    expect(onSearch).toHaveBeenCalledWith({ name: 'Lyra' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('applies only the fields that hold a value', async () => {
    const onSearch = jest.fn();
    const screen = await render(
      <AdvancedSearchModal {...openProps} onSearch={onSearch} initialCriteria={{ name: 'Bo' }} />,
    );

    await fireEvent.changeText(screen.getByTestId('advanced-field-name'), '');
    await fireEvent.press(screen.getByTestId('advanced-apply'));
    expect(onSearch).toHaveBeenCalledWith({});
  });

  it('resets every field without applying until asked', async () => {
    const onSearch = jest.fn();
    const onClose = jest.fn();
    const screen = await render(
      <AdvancedSearchModal {...openProps} onSearch={onSearch} onClose={onClose} />,
    );

    await fireEvent.changeText(screen.getByTestId('advanced-field-name'), 'Lyra');
    await fireEvent.press(screen.getByTestId('advanced-reset'));
    expect(screen.getByTestId('advanced-field-name').props.value).toBe('');
    expect(onSearch).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('advanced-apply'));
    expect(onSearch).toHaveBeenCalledWith({});
  });

  it('takes a field off with its remove button, dropping its value', async () => {
    const onSearch = jest.fn();
    const screen = await render(
      <AdvancedSearchModal
        {...openProps}
        onSearch={onSearch}
        initialCriteria={{ name: 'Bo', race: 'Elf' }}
      />,
    );

    expect(screen.getByTestId('advanced-row-race')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('advanced-remove-race'));
    expect(screen.queryByTestId('advanced-row-race')).toBeNull();
    await fireEvent.press(screen.getByTestId('advanced-apply'));
    expect(onSearch).toHaveBeenCalledWith({ name: 'Bo' });
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

    await addField(screen, 'gender');
    await fireEvent.press(screen.getByTestId('sugg-pick-character_gender'));
    await fireEvent.press(screen.getByTestId('advanced-apply'));
    expect(onSearch).toHaveBeenCalledWith({ gender: 'picked' });
  });

  it('toggles native boolean fields through three states', async () => {
    const onSearch = jest.fn();
    const screen = await render(
      <AdvancedSearchModal {...openProps} entityName="Chapter" onSearch={onSearch} />,
    );

    await addField(screen, 'isFavorite');
    const toggle = () =>
      screen.container.queryAll(
        (node) =>
          node.type === 'Icon' &&
          ['square-outline', 'checkmark-circle', 'close-circle'].includes(node.props.name),
      )[0];
    expect(toggle().props.name).toBe('square-outline');
    await fireEvent.press(toggle());
    await fireEvent.press(screen.getByTestId('advanced-apply'));
    expect(onSearch).toHaveBeenCalledWith({ isFavorite: true });

    await fireEvent.press(toggle());
    await fireEvent.press(screen.getByTestId('advanced-apply'));
    expect(onSearch).toHaveBeenLastCalledWith({ isFavorite: false });
  });

  it('leaves out the fields the list already filters another way', async () => {
    const screen = await render(
      <AdvancedSearchModal {...openProps} entityName="Chapter" excludeFields={['isFavorite']} />,
    );

    await fireEvent.press(screen.getByTestId('advanced-add-filter'));
    expect(screen.queryByTestId('advanced-add-option-isFavorite')).toBeNull();
    expect(screen.getByTestId('advanced-add-option-summary')).toBeTruthy();
  });

  it('still shows an excluded field that carries a value, so it can be removed', async () => {
    const screen = await render(
      <AdvancedSearchModal
        {...openProps}
        entityName="Chapter"
        excludeFields={['isFavorite']}
        initialCriteria={{ isFavorite: true }}
      />,
    );

    expect(screen.getByTestId('advanced-row-isFavorite')).toBeTruthy();
  });

  it('opens the row of a field restored from earlier criteria', async () => {
    const screen = await render(
      <AdvancedSearchModal {...openProps} initialCriteria={{ gender: 'F' }} />,
    );

    expect(screen.getByTestId('advanced-row-gender')).toBeTruthy();
    expect(screen.getByTestId('sugg-character_gender').props.children).toBe('character_gender=F');
  });

  it('searches custom number fields by id', async () => {
    mockSchemaFields.mockReturnValue([customField('cf1', 'Power', AttributeType.NUMBER)]);
    const onSearch = jest.fn();
    const screen = await render(<AdvancedSearchModal {...openProps} onSearch={onSearch} />);

    await addField(screen, 'custom:cf1');
    await fireEvent.changeText(screen.getByTestId('advanced-field-custom:cf1'), '42');
    await fireEvent.press(screen.getByTestId('advanced-apply'));
    expect(onSearch).toHaveBeenCalledWith({ 'custom:cf1': 42 });
  });

  it('does not take letters in a number field as a filter', async () => {
    mockSchemaFields.mockReturnValue([customField('cf1', 'Power', AttributeType.NUMBER)]);
    const onSearch = jest.fn();
    const screen = await render(<AdvancedSearchModal {...openProps} onSearch={onSearch} />);

    await addField(screen, 'custom:cf1');
    await fireEvent.changeText(screen.getByTestId('advanced-field-custom:cf1'), 'abc');
    await fireEvent.press(screen.getByTestId('advanced-apply'));
    expect(onSearch).toHaveBeenCalledWith({});
  });

  it('separates the custom attributes in the list of fields to add', async () => {
    mockSchemaFields.mockReturnValue([customField('cf1', 'Power', AttributeType.NUMBER)]);
    const screen = await render(<AdvancedSearchModal {...openProps} />);

    await fireEvent.press(screen.getByTestId('advanced-add-filter'));
    expect(screen.getByText('advanced_search_custom_section')).toBeTruthy();
    expect(screen.getByText('Power')).toBeTruthy();
  });

  it('searches custom date and story-date fields', async () => {
    mockSchemaFields.mockReturnValue([
      customField('cf2', 'When', AttributeType.DATE),
      customField('cf3', 'Era day', AttributeType.STORY_DATE),
    ]);
    const onSearch = jest.fn();
    const screen = await render(<AdvancedSearchModal {...openProps} onSearch={onSearch} />);

    await addField(screen, 'custom:cf2');
    await addField(screen, 'custom:cf3');
    await fireEvent.press(screen.getByTestId('dpick-pick-When'));
    await fireEvent.press(screen.getByTestId('sdpick-pick'));
    await fireEvent.press(screen.getByTestId('advanced-apply'));
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

    await addField(screen, 'color');
    await fireEvent.press(screen.getByTestId('cpick-pick-field_color'));
    await fireEvent.press(screen.getByTestId('advanced-apply'));
    expect(onSearch).toHaveBeenCalledWith({ color: '#aabbcc' });
  });

  it('searches custom suggestion fields', async () => {
    mockSchemaFields.mockReturnValue([customField('cf6', 'Trait', AttributeType.SUGGESTION)]);
    const onSearch = jest.fn();
    const screen = await render(<AdvancedSearchModal {...openProps} onSearch={onSearch} />);

    await addField(screen, 'custom:cf6');
    await fireEvent.press(screen.getByTestId('sugg-pick-custom:cf6'));
    await fireEvent.press(screen.getByTestId('advanced-apply'));
    expect(onSearch).toHaveBeenCalledWith({ 'custom:cf6': 'picked' });
  });

  it('picks custom entity references and skips targetless ones', async () => {
    mockSchemaFields.mockReturnValue([
      customField('cf7', 'Mentor', AttributeType.ENTITY, 'Character'),
      customField('cf8', 'NoTarget', AttributeType.ENTITY, null),
    ]);
    const onSearch = jest.fn();
    const screen = await render(<AdvancedSearchModal {...openProps} onSearch={onSearch} />);

    await fireEvent.press(screen.getByTestId('advanced-add-filter'));
    expect(screen.queryByTestId('advanced-add-option-custom:cf8')).toBeNull();
    await fireEvent.press(screen.getByTestId('advanced-add-option-custom:cf7'));
    await fireEvent.press(screen.getByTestId('multiselect-trigger'));
    await fireEvent.press(screen.getByTestId('multiselect-option-e1'));
    await fireEvent.press(screen.getByTestId('advanced-apply'));
    expect(onSearch).toHaveBeenCalledWith({ 'custom:cf7': 'e1' });
  });

  it('prefills from initial criteria and follows replacements', async () => {
    const first = { name: 'Bo' };
    const screen = await render(<AdvancedSearchModal {...openProps} initialCriteria={first} />);
    expect(screen.getByTestId('advanced-field-name').props.value).toBe('Bo');

    const second = { name: 'Bo2' };
    await screen.rerender(<AdvancedSearchModal {...openProps} initialCriteria={second} />);
    expect(screen.getByTestId('advanced-field-name').props.value).toBe('Bo2');
  });

  it('starts over from what is applied each time it opens', async () => {
    const applied = { name: 'Bo' };
    const screen = await render(<AdvancedSearchModal {...openProps} initialCriteria={applied} />);
    await fireEvent.changeText(screen.getByTestId('advanced-field-name'), 'typed, never applied');

    await screen.rerender(
      <AdvancedSearchModal {...openProps} initialCriteria={applied} isVisible={false} />,
    );
    await screen.rerender(<AdvancedSearchModal {...openProps} initialCriteria={applied} />);

    expect(screen.getByTestId('advanced-field-name').props.value).toBe('Bo');
  });

  it('works without criteria at all', async () => {
    const screen = await render(
      <AdvancedSearchModal
        entityName="Character"
        storyId="s1"
        isVisible
        onClose={() => {}}
        onSearch={() => {}}
      />,
    );

    expect(screen.getByTestId('advanced-field-name').props.value).toBe('');
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
    await fireEvent.changeText(screen.getByTestId('advanced-field-a:name'), 'X');
    await fireEvent.press(screen.getByTestId('advanced-apply'));
    expect(onSearch).toHaveBeenCalledWith({ 'a:name': 'X' });
  });

  it('adds fields to the scope whose button was pressed', async () => {
    const screen = await render(
      <AdvancedSearchModal
        {...openProps}
        scopes={[
          { entityName: 'Character', prefix: 'a', label: 'Side A' },
          { entityName: 'Chapter', prefix: 'b', label: 'Side B' },
        ]}
      />,
    );

    await addField(screen, 'b:summary', '-b');
    expect(screen.getByTestId('advanced-row-b:summary')).toBeTruthy();
    expect(screen.queryByTestId('advanced-row-a:summary')).toBeNull();
  });
});
