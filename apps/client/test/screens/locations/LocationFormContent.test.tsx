import { cleanup, fireEvent, render } from '@testing-library/react-native';
import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import type { CustomAttributeValues } from '../../../src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import {
  LocationFormContent,
  type LocationFormContentProps,
} from '../../../src/screens/locations/LocationFormContent';

jest.mock('../../../src/components/common/controls/Button/Button', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      onPress,
      disabled,
      children,
    }: {
      onPress: () => void;
      disabled?: boolean;
      children?: ReactNode;
    }) => (
      <Text testID={`btn-${children}`} onPress={disabled ? undefined : onPress}>
        {`${children}:${disabled ? 'disabled' : 'enabled'}`}
      </Text>
    ),
  };
});

jest.mock('../../../src/components/common/forms/EntityFormContainer/EntityFormContainer', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      title,
      description,
      actions,
      children,
    }: {
      title: string;
      description?: string;
      actions?: ReactNode;
      children?: ReactNode;
    }) => (
      <>
        <Text testID="form-title">{title}</Text>
        <Text testID="form-description">{description ?? 'no-description'}</Text>
        {actions}
        {children}
      </>
    ),
  };
});

jest.mock('../../../src/components/common/forms/FormField/FormField', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      label,
      children,
    }: {
      label: string;
      children?: ReactNode | ((field: object) => ReactNode);
    }) => (
      <>
        <Text testID={`field-${label}`}>{label}</Text>
        {typeof children === 'function' ? children({}) : children}
      </>
    ),
  };
});

jest.mock('../../../src/components/common/forms/FormSwitchField/FormSwitchField', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      label,
      value,
      onValueChange,
    }: {
      label: string;
      value: boolean;
      onValueChange: (next: boolean) => void;
    }) => (
      <Text testID={`switch-${label}`} onPress={() => onValueChange(!value)}>
        {`${label}:${value}`}
      </Text>
    ),
  };
});

jest.mock('../../../src/components/common/inputs/TextInput/TextInput', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      placeholder,
      value,
      onChangeText,
      multiline,
    }: {
      placeholder: string;
      value: string;
      onChangeText: (next: string) => void;
      multiline?: boolean;
    }) => (
      <Text testID={`input-${placeholder}`} onPress={() => onChangeText(`typed:${placeholder}`)}>
        {`${placeholder}=${value}${multiline ? ':multi' : ''}`}
      </Text>
    ),
  };
});

jest.mock(
  '../../../src/components/common/forms/CustomAttributeFields/CustomAttributeFields',
  () => {
    const { Text } = require('react-native');
    return {
      __esModule: true,
      default: ({
        storyId,
        fields,
        onChange,
      }: {
        storyId: string;
        fields: unknown[];
        onChange: (fieldId: string, value: string) => void;
      }) => (
        <>
          <Text testID="custom-fields">{`${storyId}:${fields.length}`}</Text>
          <Text testID="custom-fields-change" onPress={() => onChange('f-1', 'v-1')}>
            change
          </Text>
        </>
      ),
    };
  },
);

jest.mock('../../../src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      options,
      selectedValues,
      onSelectionChange,
      label,
    }: {
      options: { label: string; value: string; color: string }[];
      selectedValues: string[];
      onSelectionChange: (next: string[]) => void;
      label: string;
    }) => (
      <>
        <Text testID="tag-picker">{JSON.stringify({ label, options, selectedValues })}</Text>
        <Text
          testID="tag-picker-change"
          onPress={() => onSelectionChange([...selectedValues, 'tag-9'])}
        >
          change
        </Text>
      </>
    ),
  };
});

jest.mock('../../../src/components/features/notes/NoteManager', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: {
      currentStoryId: string;
      currentEntityId: string;
      onSave: (relation: object) => Promise<void>;
      onDelete: (relationId: string) => Promise<void>;
    }) => (
      <>
        <Text testID="note-manager">{`${props.currentStoryId}:${props.currentEntityId}`}</Text>
        <Text testID="note-save" onPress={() => props.onSave({ id: 'nr-1' })}>
          save
        </Text>
        <Text testID="note-delete" onPress={() => props.onDelete('nr-1')}>
          delete
        </Text>
      </>
    ),
  };
});

jest.mock(
  '../../../src/components/features/relations/LocationRelationManager/LocationRelationManager',
  () => {
    const { Text } = require('react-native');
    return {
      __esModule: true,
      default: (props: {
        currentLocationId: string;
        allLocations: unknown[];
        allLocationRelations: unknown[];
        onSetParent: (id: string | null) => void;
        onAddChild: (id: string) => void;
        onAddConnection: (id: string) => void;
        onRemoveRelation: (id: string) => void;
      }) => (
        <>
          <Text testID="relation-manager">
            {JSON.stringify({
              current: props.currentLocationId,
              locations: props.allLocations.length,
              relations: props.allLocationRelations.length,
            })}
          </Text>
          <Text testID="rel-set-parent" onPress={() => props.onSetParent('loc-parent')}>
            parent
          </Text>
          <Text testID="rel-add-child" onPress={() => props.onAddChild('loc-child')}>
            child
          </Text>
          <Text testID="rel-add-connection" onPress={() => props.onAddConnection('loc-peer')}>
            peer
          </Text>
          <Text testID="rel-remove" onPress={() => props.onRemoveRelation('rel-1')}>
            remove
          </Text>
        </>
      ),
    };
  },
);

jest.mock('../../../src/components/features/seealso/SeeAlsoManager/SeeAlsoManager', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: () => <Text testID="seealso-marker">seealso</Text>,
  };
});

const t = ((key: string) => key) as unknown as TFunction;

function baseProps(overrides = {}) {
  const noop = jest.fn();
  return {
    formTitle: 'Create location',
    formDescription: 'Fill the fields',
    copy: { saveLabel: 'Save', deleteLabel: 'Delete', formDescription: 'Fill the fields' },
    handleSave: jest.fn(),
    saving: false,
    deleting: false,
    isEditing: true,
    handleDelete: jest.fn(),
    colors: { error: '#ff0000', primaryContainer: '#eeeeff' },
    t,
    name: 'Keep',
    setName: noop,
    description: 'A stronghold',
    setDescription: noop,
    climate: 'Cold',
    setClimate: noop,
    culture: 'Northern',
    setCulture: noop,
    politics: 'Council',
    setPolitics: noop,
    isFavorite: true,
    setIsFavorite: noop,
    extraNotes: 'Notes',
    setExtraNotes: noop,
    commonInputStyles: { input: {}, multiline: {} },
    selectedStory: { id: 'story-1' },
    customFields: [],
    customValues: {} as CustomAttributeValues,
    setCustomValues: jest.fn(),
    styles: { tagSection: {}, noteSection: {} },
    availableTags: [
      { id: 'tag-1', name: 'City', color: '#f00' },
      { id: 'tag-2', name: 'Ruin', color: null },
    ],
    selectedTagIds: ['tag-1'],
    handleTagSelectionChange: jest.fn(),
    currentLocationId: 'loc-1',
    locationNoteRelations: [],
    allNotes: [],
    saveNoteRelation: jest.fn(async () => {}),
    deleteNoteRelation: jest.fn(async () => {}),
    allLocations: [{ id: 'loc-2', name: 'Harbor' }],
    allLocationRelations: [{ id: 'rel-1' }],
    handleSetParent: jest.fn(),
    handleAddChild: jest.fn(),
    handleAddConnection: jest.fn(),
    handleRemoveLocationRelation: jest.fn(),
    seeAlsoManagerRef: { current: null },
    ...overrides,
  };
}

type View = { getByTestId: (id: string) => { props: { children?: unknown } } };

function jsonOf(view: View, testID: string) {
  return JSON.parse(view.getByTestId(testID).props.children as string);
}

describe('LocationFormContent', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the title, actions and all fields', async () => {
    const props = baseProps();
    const view = await render(
      <LocationFormContent {...(props as unknown as LocationFormContentProps)} />,
    );
    expect(view.getByTestId('form-title').props.children).toBe('Create location');
    expect(view.getByTestId('btn-Save').props.children).toBe('Save:enabled');
    expect(view.getByTestId('btn-Delete').props.children).toBe('Delete:enabled');
    await fireEvent.press(view.getByTestId('btn-Save'));
    expect(props.handleSave).toHaveBeenCalledTimes(1);
    await fireEvent.press(view.getByTestId('btn-Delete'));
    expect(props.handleDelete).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('input-name_placeholder').props.children).toBe('name_placeholder=Keep');
    expect(view.getByTestId('input-description_placeholder').props.children).toBe(
      'description_placeholder=A stronghold:multi',
    );
    expect(view.getByTestId('input-climate_placeholder').props.children).toBe(
      'climate_placeholder=Cold',
    );
    expect(view.getByTestId('input-culture_placeholder').props.children).toBe(
      'culture_placeholder=Northern',
    );
    expect(view.getByTestId('input-politics_placeholder').props.children).toBe(
      'politics_placeholder=Council',
    );
    expect(view.getByTestId('switch-is_favorite').props.children).toBe('is_favorite:true');
  });

  it('forwards edits to the setters', async () => {
    const props = baseProps();
    const view = await render(
      <LocationFormContent {...(props as unknown as LocationFormContentProps)} />,
    );
    await fireEvent.press(view.getByTestId('input-climate_placeholder'));
    expect(props.setClimate).toHaveBeenCalledWith('typed:climate_placeholder');
    await fireEvent.press(view.getByTestId('input-politics_placeholder'));
    expect(props.setPolitics).toHaveBeenCalledWith('typed:politics_placeholder');
    await fireEvent.press(view.getByTestId('switch-is_favorite'));
    expect(props.setIsFavorite).toHaveBeenCalledWith(false);
    await fireEvent.press(view.getByTestId('custom-fields-change'));
    expect(props.setCustomValues).toHaveBeenCalledTimes(1);
    const updater = props.setCustomValues.mock.calls[0][0];
    expect(updater({})).toEqual({ 'f-1': 'v-1' });
  });

  it('hides the delete button when creating and disables actions while deleting', async () => {
    const creating = await render(
      <LocationFormContent
        {...(baseProps({ isEditing: false }) as unknown as LocationFormContentProps)}
      />,
    );
    expect(creating.queryByTestId('btn-Delete')).toBeNull();
    const busy = await render(
      <LocationFormContent
        {...(baseProps({ deleting: true }) as unknown as LocationFormContentProps)}
      />,
    );
    expect(busy.getByTestId('btn-Delete').props.children).toBe('Delete:disabled');
  });

  it('wires tags with the primary container fallback color', async () => {
    const props = baseProps();
    const view = await render(
      <LocationFormContent {...(props as unknown as LocationFormContentProps)} />,
    );
    expect(jsonOf(view, 'tag-picker')).toMatchObject({
      label: 'location_tags',
      options: [
        { label: 'City', value: 'tag-1', color: '#f00' },
        { label: 'Ruin', value: 'tag-2', color: '#eeeeff' },
      ],
      selectedValues: ['tag-1'],
    });
    await fireEvent.press(view.getByTestId('tag-picker-change'));
    expect(props.handleTagSelectionChange).toHaveBeenCalledWith(['tag-1', 'tag-9']);
  });

  it('wires notes, location relations and see-also', async () => {
    const props = baseProps();
    const view = await render(
      <LocationFormContent {...(props as unknown as LocationFormContentProps)} />,
    );
    expect(view.getByTestId('note-manager').props.children).toBe('story-1:loc-1');
    await fireEvent.press(view.getByTestId('note-save'));
    expect(props.saveNoteRelation).toHaveBeenCalledWith({ id: 'nr-1' });
    await fireEvent.press(view.getByTestId('note-delete'));
    expect(props.deleteNoteRelation).toHaveBeenCalledWith('nr-1');
    expect(jsonOf(view, 'relation-manager')).toEqual({
      current: 'loc-1',
      locations: 1,
      relations: 1,
    });
    await fireEvent.press(view.getByTestId('rel-set-parent'));
    expect(props.handleSetParent).toHaveBeenCalledWith('loc-parent');
    await fireEvent.press(view.getByTestId('rel-add-child'));
    expect(props.handleAddChild).toHaveBeenCalledWith('loc-child');
    await fireEvent.press(view.getByTestId('rel-add-connection'));
    expect(props.handleAddConnection).toHaveBeenCalledWith('loc-peer');
    await fireEvent.press(view.getByTestId('rel-remove'));
    expect(props.handleRemoveLocationRelation).toHaveBeenCalledWith('rel-1');
    expect(view.getByTestId('seealso-marker')).toBeTruthy();
  });

  it('hides the story-gated managers without a story', async () => {
    const view = await render(
      <LocationFormContent
        {...(baseProps({ selectedStory: null }) as unknown as LocationFormContentProps)}
      />,
    );
    expect(view.queryByTestId('note-manager')).toBeNull();
    expect(view.queryByTestId('relation-manager')).toBeNull();
    expect(view.queryByTestId('seealso-marker')).toBeNull();
  });
});
