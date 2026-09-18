import { cleanup, fireEvent, render } from '@testing-library/react-native';
import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import type { CustomAttributeValues } from '../../../src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import { CharacterFormContent } from '../../../src/screens/characters/CharacterFormContent';

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

jest.mock('../../../src/components/common/inputs/SuggestionTextInput/SuggestionTextInput', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      placeholder,
      value,
      onChangeText,
      type,
      storyId,
    }: {
      placeholder: string;
      value: string;
      onChangeText: (next: string) => void;
      type: string;
      storyId: string;
    }) => (
      <Text testID={`suggest-${type}`} onPress={() => onChangeText(`typed:${type}`)}>
        {`${placeholder}=${value}@${storyId}`}
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
        values,
        onChange,
      }: {
        storyId: string;
        fields: unknown[];
        values: object;
        onChange: (fieldId: string, value: string) => void;
      }) => (
        <>
          <Text testID="custom-fields">
            {JSON.stringify({ storyId, fields: fields.length, values })}
          </Text>
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

jest.mock('../../../src/components/features/stats/ModeManager/ModeManager', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    ModeManager: (props: {
      modes: { id: string }[];
      editable: boolean;
      onCreate: (mode: { name: string }) => Promise<void>;
      onUpdate: (modeId: string, mode: object) => Promise<void>;
      onDelete: (modeId: string) => Promise<void>;
    }) => (
      <>
        <Text testID="mode-manager">
          {JSON.stringify({
            modes: props.modes.map((m) => m.id),
            editable: props.editable,
          })}
        </Text>
        <Text testID="mode-create" onPress={() => props.onCreate({ name: 'New mode' })}>
          create
        </Text>
        <Text testID="mode-update" onPress={() => props.onUpdate('mode-1', { name: 'Renamed' })}>
          update
        </Text>
        <Text testID="mode-delete" onPress={() => props.onDelete('mode-1')}>
          delete
        </Text>
      </>
    ),
  };
});

jest.mock(
  '../../../src/components/features/stats/CharacterStatValuesEditor/CharacterStatValuesEditor',
  () => {
    const { Text } = require('react-native');
    return {
      __esModule: true,
      CharacterStatValuesEditor: (props: {
        characterId: string;
        editable: boolean;
        onSetValue: (args: { modeId: string; statId: string; value: number }) => Promise<void>;
        onClearValue: (args: { modeId: string; statId: string }) => Promise<void>;
      }) => (
        <>
          <Text testID="stat-editor">
            {JSON.stringify({ characterId: props.characterId, editable: props.editable })}
          </Text>
          <Text
            testID="stat-set"
            onPress={() => props.onSetValue({ modeId: 'mode-1', statId: 'stat-1', value: 3 })}
          >
            set
          </Text>
          <Text
            testID="stat-clear"
            onPress={() => props.onClearValue({ modeId: 'mode-1', statId: 'stat-1' })}
          >
            clear
          </Text>
        </>
      ),
    };
  },
);

jest.mock(
  '../../../src/components/features/relations/CharacterRelationManager/CharacterRelationManager',
  () => {
    const { Text } = require('react-native');
    return {
      __esModule: true,
      default: () => <Text testID="relation-manager">relations</Text>,
    };
  },
);

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
    formTitle: 'Create character',
    formDescription: 'Fill the fields',
    copy: { saveLabel: 'Save', deleteLabel: 'Delete', formDescription: 'Fill the fields' },
    handleSave: jest.fn(),
    saving: false,
    deleting: false,
    isEditing: true,
    handleDelete: jest.fn(),
    colors: { error: '#ff0000', primaryContainer: '#eeeeff' },
    t,
    name: 'Aria',
    setName: noop,
    title: 'Captain',
    setTitle: noop,
    description: 'A scout',
    setDescription: noop,
    gender: 'female',
    setGender: noop,
    race: 'Elf',
    setRace: noop,
    subrace: 'Wood elf',
    setSubrace: noop,
    personality: 'Bold',
    setPersonality: noop,
    motivation: 'Freedom',
    setMotivation: noop,
    qualities: 'Quick',
    setQualities: noop,
    weaknesses: 'Impatient',
    setWeaknesses: noop,
    biography: 'Born far away',
    setBiography: noop,
    plannedTimeline: 'Act one',
    setPlannedTimeline: noop,
    isFavorite: false,
    setIsFavorite: noop,
    extraNotes: 'Notes',
    setExtraNotes: noop,
    commonInputStyles: { input: {}, multiline: {} },
    selectedStory: { id: 'story-1', statSystem: true },
    customFields: [],
    customValues: {} as CustomAttributeValues,
    setCustomValues: jest.fn(),
    styles: { tagSection: {}, noteSection: {} },
    availableTags: [{ id: 'tag-1', name: 'Hero', color: null }],
    selectedTagIds: ['tag-1'],
    handleTagSelectionChange: jest.fn(),
    currentCharacterId: 'char-1',
    characterModes: [{ id: 'mode-1', order: 2 }],
    modeService: () => ({
      createMode: jest.fn(async () => {}),
      updateMode: jest.fn(async () => {}),
      deleteMode: jest.fn(async () => {}),
    }),
    userId: 'user-1',
    statData: { modes: [], stats: [] },
    statRelationService: () => ({
      setValue: jest.fn(async () => {}),
      clearValue: jest.fn(async () => {}),
    }),
    characterRelations: [],
    allCharacters: [],
    handleSaveRelation: jest.fn(),
    handleDeleteRelation: jest.fn(),
    characterNoteRelations: [],
    allNotes: [],
    saveNoteRelation: jest.fn(async () => {}),
    deleteNoteRelation: jest.fn(async () => {}),
    seeAlsoManagerRef: { current: null },
    ...overrides,
  };
}

type View = { getByTestId: (id: string) => { props: { children: unknown } } };

function jsonOf(view: View, testID: string) {
  return JSON.parse(view.getByTestId(testID).props.children as string);
}

describe('CharacterFormContent', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the title, actions and all text fields', async () => {
    const props = baseProps();
    const view = await render(<CharacterFormContent {...(props as never)} />);
    expect(view.getByTestId('form-title').props.children).toBe('Create character');
    expect(view.getByTestId('form-description').props.children).toBe('Fill the fields');
    expect(view.getByTestId('btn-Save').props.children).toBe('Save:enabled');
    expect(view.getByTestId('btn-Delete').props.children).toBe('Delete:enabled');
    await fireEvent.press(view.getByTestId('btn-Save'));
    expect(props.handleSave).toHaveBeenCalledTimes(1);
    await fireEvent.press(view.getByTestId('btn-Delete'));
    expect(props.handleDelete).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('input-name_placeholder').props.children).toBe('name_placeholder=Aria');
    expect(view.getByTestId('input-biography_placeholder').props.children).toBe(
      'biography_placeholder=Born far away:multi',
    );
    expect(view.getByTestId('suggest-character_gender').props.children).toBe(
      'gender_placeholder=female@story-1',
    );
    expect(view.getByTestId('switch-is_favorite').props.children).toBe('is_favorite:false');
  });

  it('forwards text edits to the setters', async () => {
    const props = baseProps();
    const view = await render(<CharacterFormContent {...(props as never)} />);
    await fireEvent.press(view.getByTestId('input-name_placeholder'));
    expect(props.setName).toHaveBeenCalledWith('typed:name_placeholder');
    await fireEvent.press(view.getByTestId('suggest-character_race'));
    expect(props.setRace).toHaveBeenCalledWith('typed:character_race');
    await fireEvent.press(view.getByTestId('switch-is_favorite'));
    expect(props.setIsFavorite).toHaveBeenCalledWith(true);
  });

  it('hides the delete button when creating and disables actions while busy', async () => {
    const creating = await render(
      <CharacterFormContent {...(baseProps({ isEditing: false }) as never)} />,
    );
    expect(creating.queryByTestId('btn-Delete')).toBeNull();
    const busy = await render(<CharacterFormContent {...(baseProps({ saving: true }) as never)} />);
    expect(busy.getByTestId('btn-Save').props.children).toBe('Save:disabled');
  });

  it('wires custom attributes, tags, notes and see-also', async () => {
    const props = baseProps();
    const view = await render(<CharacterFormContent {...(props as never)} />);
    expect(jsonOf(view, 'custom-fields')).toMatchObject({ storyId: 'story-1', fields: 0 });
    await fireEvent.press(view.getByTestId('custom-fields-change'));
    expect(props.setCustomValues).toHaveBeenCalledTimes(1);
    const updater = props.setCustomValues.mock.calls[0][0];
    expect(updater({})).toEqual({ 'f-1': 'v-1' });
    expect(jsonOf(view, 'tag-picker')).toMatchObject({
      label: 'character_tags',
      options: [{ label: 'Hero', value: 'tag-1', color: '#eeeeff' }],
      selectedValues: ['tag-1'],
    });
    await fireEvent.press(view.getByTestId('tag-picker-change'));
    expect(props.handleTagSelectionChange).toHaveBeenCalledWith(['tag-1', 'tag-9']);
    expect(view.getByTestId('note-manager').props.children).toBe('story-1:char-1');
    await fireEvent.press(view.getByTestId('note-save'));
    expect(props.saveNoteRelation).toHaveBeenCalledWith({ id: 'nr-1' });
    await fireEvent.press(view.getByTestId('note-delete'));
    expect(props.deleteNoteRelation).toHaveBeenCalledWith('nr-1');
    expect(view.getByTestId('relation-manager')).toBeTruthy();
    expect(view.getByTestId('seealso-marker')).toBeTruthy();
  });

  it('creates, updates and deletes modes through the mode service', async () => {
    const createMode = jest.fn(async () => {});
    const updateMode = jest.fn(async () => {});
    const deleteMode = jest.fn(async () => {});
    const view = await render(
      <CharacterFormContent
        {...(baseProps({ modeService: () => ({ createMode, updateMode, deleteMode }) }) as never)}
      />,
    );
    expect(jsonOf(view, 'mode-manager')).toEqual({ modes: ['mode-1'], editable: true });
    await fireEvent.press(view.getByTestId('mode-create'));
    expect(createMode).toHaveBeenCalledWith('user-1', {
      storyId: 'story-1',
      characterId: 'char-1',
      name: 'New mode',
      order: 3,
    });
    await fireEvent.press(view.getByTestId('mode-update'));
    expect(updateMode).toHaveBeenCalledWith('user-1', 'mode-1', { name: 'Renamed' });
    await fireEvent.press(view.getByTestId('mode-delete'));
    expect(deleteMode).toHaveBeenCalledWith('user-1', 'mode-1');
  });

  it('sets and clears stat values through the stat relation service', async () => {
    const setValue = jest.fn(async () => {});
    const clearValue = jest.fn(async () => {});
    const view = await render(
      <CharacterFormContent
        {...(baseProps({ statRelationService: () => ({ setValue, clearValue }) }) as never)}
      />,
    );
    expect(jsonOf(view, 'stat-editor')).toEqual({ characterId: 'char-1', editable: true });
    await fireEvent.press(view.getByTestId('stat-set'));
    expect(setValue).toHaveBeenCalledWith('user-1', {
      storyId: 'story-1',
      characterId: 'char-1',
      modeId: 'mode-1',
      statId: 'stat-1',
      value: 3,
    });
    await fireEvent.press(view.getByTestId('stat-clear'));
    expect(clearValue).toHaveBeenCalledWith('user-1', {
      characterId: 'char-1',
      modeId: 'mode-1',
      statId: 'stat-1',
    });
  });

  it('hides the stat editor without the stat system and managers without a story', async () => {
    const noStats = await render(
      <CharacterFormContent
        {...(baseProps({ selectedStory: { id: 'story-1', statSystem: false } }) as never)}
      />,
    );
    expect(noStats.queryByTestId('stat-editor')).toBeNull();
    expect(noStats.getByTestId('mode-manager')).toBeTruthy();
    const noStory = await render(
      <CharacterFormContent {...(baseProps({ selectedStory: null }) as never)} />,
    );
    expect(noStory.queryByTestId('mode-manager')).toBeNull();
    expect(noStory.queryByTestId('note-manager')).toBeNull();
    expect(noStory.queryByTestId('relation-manager')).toBeNull();
    expect(noStory.queryByTestId('seealso-marker')).toBeNull();
  });
});
