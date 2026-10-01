import { AttributeType, encodeAttributeValue } from '@keres/shared';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import AttributeValueInput from '../../../src/components/common/forms/CustomAttributeFields/AttributeValueInput';
import CustomAttributeFields, {
  getDefaultCustomAttributeValues,
  validateRequiredCustomAttributes,
} from '../../../src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import EntityFormContainer from '../../../src/components/common/forms/EntityFormContainer/EntityFormContainer';
import FormContainer from '../../../src/components/common/forms/FormContainer/FormContainer';
import FormField from '../../../src/components/common/forms/FormField/FormField';
import FormSwitchField from '../../../src/components/common/forms/FormSwitchField/FormSwitchField';
import type { StorySchemaFieldSelect } from '../../../src/db/schema';

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

jest.mock('../../../src/hooks/useFormScrollBottomPadding', () => ({
  useFormScrollBottomPadding: () => 58,
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

jest.mock('../../../src/hooks/useEntityPickerOptions', () => ({
  useEntityPickerOptions: () => ({
    options: [{ id: 'e1', name: 'Ent One' }],
    loading: false,
    reload: jest.fn(),
  }),
}));

jest.mock('../../../src/components/common/inputs/TextInput/TextInput', () => {
  const react = jest.requireActual('react') as typeof import('react');
  const native = jest.requireActual('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    default: ({ value, onChangeText, multiline, keyboardType, editable }: any) =>
      react.createElement(
        react.Fragment,
        null,
        react.createElement(
          native.Text,
          { testID: 'stub-text' },
          `${value ?? ''}|ml:${String(!!multiline)}|kb:${keyboardType ?? 'default'}|ed:${String(editable)}`,
        ),
        onChangeText
          ? react.createElement(
              native.Text,
              { testID: 'stub-text-change', onPress: () => onChangeText('typed') },
              'change',
            )
          : null,
      ),
  };
});

jest.mock('../../../src/components/common/controls/ThemedSwitch/ThemedSwitch', () => {
  const react = jest.requireActual('react') as typeof import('react');
  const native = jest.requireActual('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    default: ({ value, onValueChange, accessibilityLabel }: any) =>
      react.createElement(
        native.Text,
        { testID: 'stub-switch', onPress: () => onValueChange(!value) },
        `${accessibilityLabel ?? ''}:${String(value)}`,
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
          { testID: 'stub-date' },
          `${placeholder ?? ''}=${value ?? 'none'}`,
        ),
        react.createElement(
          native.Text,
          { testID: 'stub-date-pick', onPress: () => onChange('2024-01-02') },
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
        react.createElement(native.Text, { testID: 'stub-storydate' }, value ?? 'none'),
        react.createElement(
          native.Text,
          { testID: 'stub-storydate-pick', onPress: () => onChange('101') },
          'pick-storydate',
        ),
      ),
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
        react.createElement(native.Text, { testID: `stub-sugg-${type}` }, `${type}=${value}`),
        react.createElement(
          native.Text,
          { testID: 'stub-sugg-pick', onPress: () => onChangeText('picked') },
          'pick-sugg',
        ),
      ),
  };
});

jest.mock('../../../src/components/common/inputs/SuggestionListInput/SuggestionListInput', () => {
  const react = jest.requireActual('react') as typeof import('react');
  const native = jest.requireActual('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    default: ({ values, onChange }: any) =>
      react.createElement(
        react.Fragment,
        null,
        react.createElement(native.Text, { testID: 'stub-list' }, (values ?? []).join(',')),
        react.createElement(
          native.Text,
          { testID: 'stub-list-pick', onPress: () => onChange(['a', 'b']) },
          'pick-list',
        ),
      ),
  };
});

jest.mock('../../../src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => {
  const react = jest.requireActual('react') as typeof import('react');
  const native = jest.requireActual('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    default: ({ selectedValues, onSelectionChange, placeholder }: any) =>
      react.createElement(
        react.Fragment,
        null,
        react.createElement(
          native.Text,
          { testID: 'stub-multi' },
          `${placeholder ?? ''}=${selectedValues.join(',')}`,
        ),
        react.createElement(
          native.Text,
          {
            testID: 'stub-multi-pick',
            onPress: () => onSelectionChange(selectedValues.length ? [] : ['e1']),
          },
          'pick-multi',
        ),
      ),
  };
});

const textField = (overrides: Partial<StorySchemaFieldSelect> = {}) =>
  ({
    id: 'f1',
    name: 'Nickname',
    description: 'Call sign',
    isRequired: true,
    type: AttributeType.TEXT,
    defaultValue: null,
    targetEntityType: null,
    ...overrides,
  }) as unknown as StorySchemaFieldSelect;

describe('getDefaultCustomAttributeValues', () => {
  it('prefills every field with its default, even when null', () => {
    expect(
      getDefaultCustomAttributeValues([
        textField({ id: 'f1', defaultValue: 'dflt' }),
        textField({ id: 'f2', defaultValue: null }),
      ]),
    ).toEqual({ f1: 'dflt', f2: null });
  });
});

describe('validateRequiredCustomAttributes', () => {
  it('reports the first empty required field', () => {
    const fields = [
      textField({ id: 'f1', name: 'First' }),
      textField({ id: 'f2', name: 'Second' }),
    ];
    expect(validateRequiredCustomAttributes(fields, { f1: '  ', f2: 'ok' })).toBe('First');
    expect(validateRequiredCustomAttributes(fields, { f1: 'ok', f2: null })).toBe('Second');
    expect(validateRequiredCustomAttributes(fields, { f1: 'ok', f2: 'ok' })).toBeNull();
  });

  it('ignores optional fields', () => {
    const fields = [textField({ id: 'f1', isRequired: false })];
    expect(validateRequiredCustomAttributes(fields, { f1: '' })).toBeNull();
  });

  it('treats an empty suggestion list as missing', () => {
    const fields = [textField({ id: 'f1', type: AttributeType.SUGGESTION_LIST })];
    expect(
      validateRequiredCustomAttributes(fields, {
        f1: encodeAttributeValue(AttributeType.SUGGESTION_LIST, []),
      }),
    ).toBe('Nickname');
    expect(
      validateRequiredCustomAttributes(fields, {
        f1: encodeAttributeValue(AttributeType.SUGGESTION_LIST, ['x']),
      }),
    ).toBeNull();
  });
});

describe('CustomAttributeFields', () => {
  it('renders nothing when the schema has no fields', async () => {
    const screen = await render(
      <CustomAttributeFields storyId="s1" fields={[]} values={{}} onChange={() => {}} />,
    );
    expect(screen.toJSON()).toBeNull();
  });

  it('renders labels with required markers, descriptions and wired inputs', async () => {
    const onChange = jest.fn();
    const screen = await render(
      <CustomAttributeFields
        storyId="s1"
        fields={[
          textField(),
          textField({ id: 'f2', name: 'Bio', isRequired: false, description: null }),
        ]}
        values={{ f1: 'Ly', f2: '' }}
        onChange={onChange}
      />,
    );

    expect(screen.getByText('Nickname *')).toBeTruthy();
    expect(screen.getByText('Call sign')).toBeTruthy();
    expect(screen.getByText('Bio')).toBeTruthy();
    await fireEvent.press(screen.getAllByTestId('stub-text-change')[0]);
    expect(onChange).toHaveBeenCalledWith('f1', 'typed');
  });

  it('renders an entity picker for entity fields', async () => {
    const screen = await render(
      <CustomAttributeFields
        storyId="s1"
        fields={[textField({ type: AttributeType.ENTITY, targetEntityType: 'Character' as never })]}
        values={{ f1: '' }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByTestId('stub-multi')).toBeTruthy();
  });
});

describe('AttributeValueInput', () => {
  it.each([
    [AttributeType.TEXT, 'hello|ml:false|kb:default|ed:undefined'],
    ['mystery-type', 'hello|ml:false|kb:default|ed:undefined'],
    [AttributeType.LONG_TEXT, 'hello|ml:true|kb:default|ed:undefined'],
    [AttributeType.NUMBER, 'hello|ml:false|kb:numeric|ed:undefined'],
  ])('renders plain text for %s', async (type, expected) => {
    const screen = await render(
      <AttributeValueInput type={type} value="hello" onChange={() => {}} />,
    );
    expect(screen.getByText(expected as string)).toBeTruthy();
  });

  it('toggles booleans as text flags', async () => {
    const onChange = jest.fn();
    const screen = await render(
      <AttributeValueInput type={AttributeType.BOOLEAN} value="true" onChange={onChange} />,
    );
    expect(screen.getByText(':true')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('stub-switch'));
    expect(onChange).toHaveBeenCalledWith('false');
  });

  it('delegates dates to the pickers', async () => {
    const onChange = jest.fn();
    const date = await render(
      <AttributeValueInput
        type={AttributeType.DATE}
        value="2024-05-06"
        onChange={onChange}
        placeholder="Birthday"
      />,
    );
    expect(date.getByText('Birthday=2024-05-06')).toBeTruthy();
    await fireEvent.press(date.getByTestId('stub-date-pick'));
    expect(onChange).toHaveBeenCalledWith('2024-01-02');

    const storyDate = await render(
      <AttributeValueInput type={AttributeType.STORY_DATE} value="" onChange={onChange} />,
    );
    expect(storyDate.getByText('none')).toBeTruthy();
    await fireEvent.press(storyDate.getByTestId('stub-storydate-pick'));
    expect(onChange).toHaveBeenCalledWith('101');
  });

  it('uses suggestions only when the field identity exists', async () => {
    const onChange = jest.fn();
    const withIdentity = await render(
      <AttributeValueInput
        type={AttributeType.SUGGESTION}
        value=""
        onChange={onChange}
        storyId="s1"
        suggestionFieldId="f1"
      />,
    );
    expect(withIdentity.getByText('custom:f1=')).toBeTruthy();
    await fireEvent.press(withIdentity.getByTestId('stub-sugg-pick'));
    expect(onChange).toHaveBeenCalledWith('picked');

    const withoutIdentity = await render(
      <AttributeValueInput type={AttributeType.SUGGESTION} value="raw" onChange={() => {}} />,
    );
    expect(withoutIdentity.getByText('raw|ml:false|kb:default|ed:undefined')).toBeTruthy();
  });

  it('decodes and encodes suggestion lists', async () => {
    const onChange = jest.fn();
    const screen = await render(
      <AttributeValueInput
        type={AttributeType.SUGGESTION_LIST}
        value={encodeAttributeValue(AttributeType.SUGGESTION_LIST, ['x', 'y']) as string}
        onChange={onChange}
        storyId="s1"
        suggestionFieldId="f1"
      />,
    );
    expect(screen.getByText('x,y')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('stub-list-pick'));
    expect(onChange).toHaveBeenCalledWith(
      encodeAttributeValue(AttributeType.SUGGESTION_LIST, ['a', 'b']),
    );
  });

  it('keeps unreadable values as a single legacy item', async () => {
    const screen = await render(
      <AttributeValueInput
        type={AttributeType.SUGGESTION_LIST}
        value="not-json{{{"
        onChange={() => {}}
      />,
    );
    expect(screen.getByTestId('stub-list').props.children).toBe('not-json{{{');
  });

  it('picks entities by id and clears back to null', async () => {
    const onChange = jest.fn();
    const screen = await render(
      <AttributeValueInput
        type={AttributeType.ENTITY}
        value=""
        onChange={onChange}
        placeholder="Mentor"
        storyId="s1"
        targetEntityType={'Character' as never}
      />,
    );
    expect(screen.getByText('Mentor=')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('stub-multi-pick'));
    expect(onChange).toHaveBeenCalledWith('e1');

    const filled = await render(
      <AttributeValueInput
        type={AttributeType.ENTITY}
        value="e1"
        onChange={onChange}
        storyId="s1"
        targetEntityType={'Character' as never}
      />,
    );
    await fireEvent.press(filled.getByTestId('stub-multi-pick'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('renders a read-only field when the entity target is unknown', async () => {
    const screen = await render(
      <AttributeValueInput type={AttributeType.ENTITY} value="raw" onChange={() => {}} />,
    );
    expect(screen.getByText('raw|ml:false|kb:default|ed:false')).toBeTruthy();
    expect(screen.queryByTestId('stub-text-change')).toBeNull();
  });
});

describe('FormField', () => {
  it('renders label, control, help and error', async () => {
    const screen = await render(
      <FormField label="Name" required help="Shown everywhere" error="Required">
        <Text>control</Text>
      </FormField>,
    );

    expect(screen.getByText('Name *')).toBeTruthy();
    expect(screen.getByText('control')).toBeTruthy();
    expect(screen.getByText('Shown everywhere')).toBeTruthy();
    const error = screen.getByText('Required');
    expect(StyleSheet.flatten(error.props.style).color).toBe('#ff0000');
    expect(error.props.accessibilityLiveRegion).toBe('polite');
  });

  it('hands the label identity to function children', async () => {
    const child: jest.Mock = jest.fn(() => <Text testID="inner">control</Text>);
    const screen = await render(<FormField label="Name">{child}</FormField>);

    expect(child).toHaveBeenCalledTimes(1);
    const accessibility = child.mock.calls[0][0];
    expect(accessibility.accessibilityLabel).toBe('Name');
    const label = screen.container.queryAll(
      (node) => node.props.nativeID === accessibility.accessibilityLabelledBy,
    );
    expect(label).toHaveLength(1);
  });
});

describe('FormSwitchField', () => {
  it('pairs the label with the switch', async () => {
    const onValueChange = jest.fn();
    const screen = await render(
      <FormSwitchField label="Airplane mode" value={false} onValueChange={onValueChange} />,
    );

    expect(screen.getByText('Airplane mode')).toBeTruthy();
    expect(screen.getByText('Airplane mode:false')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('stub-switch'));
    expect(onValueChange).toHaveBeenCalledWith(true);
  });
});

describe('FormContainer', () => {
  it('centers content and keeps style on the scroll chrome', async () => {
    const screen = await render(
      <FormContainer style={{ opacity: 0.5 }}>
        <Text>auth body</Text>
      </FormContainer>,
    );

    expect(screen.getByText('auth body')).toBeTruthy();
    const scroll = screen.container.queryAll((node) => node.type === 'RCTScrollView')[0];
    expect(StyleSheet.flatten(scroll.props.style).opacity).toBe(0.5);
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle)).toMatchObject({
      maxWidth: 840,
      justifyContent: 'center',
      paddingBottom: 58,
    });
  });
});

describe('EntityFormContainer widths', () => {
  it('constrains the reading width', async () => {
    const screen = await render(
      <EntityFormContainer title="Edit" description="Fields below" width="reading">
        <Text>form body</Text>
      </EntityFormContainer>,
    );

    expect(screen.getByText('Edit')).toBeTruthy();
    expect(screen.getByText('Fields below')).toBeTruthy();
    const scroll = screen.container.queryAll((node) => node.type === 'RCTScrollView')[0];
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle).maxWidth).toBe(960);
  });
});
