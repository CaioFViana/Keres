import { act, fireEvent, render } from '@testing-library/react-native';
import React, { createRef } from 'react';
import SeeAlsoManager, {
  type SeeAlsoManagerHandle,
} from '../../src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';

jest.mock('../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#fff',
      error: '#f00',
      onPrimary: '#fff',
      primary: '#00f',
      surface: '#eee',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@expo/vector-icons', () => {
  const ReactActual = require('react');
  const { Text } = jest.requireActual('react-native');
  return {
    Ionicons: ({ name }: { name: string }) =>
      ReactActual.createElement(Text, { testID: `icon-${name}` }, name),
  };
});

const mockSave = jest.fn();
const mockPersist = jest.fn();
let mockRelations: any[] = [];
jest.mock('../../src/hooks/useSeeAlsoRelations', () => ({
  __esModule: true,
  useSeeAlsoRelations: (...args: unknown[]) => {
    (mockRelationCalls as unknown[]).push(args);
    return { relations: mockRelations, save: mockSave, persistSeeAlsoRelations: mockPersist };
  },
}));
const mockRelationCalls: unknown[][] = [];

const mockOptionsByValue = new Map<string, { name: string; color: string }>();
const mockGroupedOptions = [
  { key: 'Character', label: 'Characters', options: [] },
  { key: 'WorldRule:lore', label: 'Lore', options: [] },
  { key: 'Scene', label: 'Scenes', options: [] },
];
jest.mock('../../src/hooks/useSeeAlsoEntityOptions', () => {
  const actual = jest.requireActual('../../src/hooks/useSeeAlsoEntityOptions');
  return {
    ...actual,
    __esModule: true,
    useSeeAlsoEntityOptions: (...args: unknown[]) => {
      (mockOptionsCalls as unknown[]).push(args);
      return {
        groupedOptions: mockGroupedOptions,
        optionsByValue: mockOptionsByValue,
      };
    },
  };
});
const mockOptionsCalls: unknown[][] = [];

const mockNavigate = jest.fn();
jest.mock('../../src/hooks/useNavigateToEntityDetail', () => ({
  __esModule: true,
  useNavigateToEntityDetail: () => mockNavigate,
}));

jest.mock('../../src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) =>
      ReactActual.createElement(View, { testID: 'multi-select', ...props }),
  };
});

const relation = (overrides = {}) => ({
  relationId: 'rel-1',
  otherType: 'Character',
  otherId: 'c-1',
  ...overrides,
});

const baseProps = () => ({
  storyId: 'story-1',
  entityType: 'Scene' as const,
  entityId: 'scene-1',
  editable: true,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRelationCalls.length = 0;
  mockOptionsCalls.length = 0;
  mockRelations = [relation()];
  mockOptionsByValue.clear();
  mockOptionsByValue.set('Character:c-1', { name: 'Alice', color: '#f00' });
});

describe('SeeAlsoManager', () => {
  it('wires the hooks to the entity it is given', async () => {
    await render(<SeeAlsoManager {...baseProps()} allowedEntityTypes={['Character']} />);

    expect(mockRelationCalls[0]).toEqual(['story-1', 'Scene', 'scene-1', ['Character']]);
    expect(mockOptionsCalls[0]).toEqual(['story-1', 'Scene', 'scene-1']);
  });

  it('counts its links in the title and names them from the options', async () => {
    const screen = await render(<SeeAlsoManager {...baseProps()} />);

    expect(screen.getByText('see_also_title (1)')).toBeTruthy();
    expect(screen.getByText('Alice')).toBeTruthy();
  });

  it('honors a custom title', async () => {
    const screen = await render(<SeeAlsoManager {...baseProps()} title="Mentions" />);

    expect(screen.getByText('Mentions (1)')).toBeTruthy();
  });

  it('falls back to the id when the option is gone', async () => {
    mockOptionsByValue.clear();
    const screen = await render(<SeeAlsoManager {...baseProps()} />);

    expect(screen.getByText('c-1')).toBeTruthy();
  });

  it('shows the empty state when nothing is linked', async () => {
    mockRelations = [];
    const screen = await render(<SeeAlsoManager {...baseProps()} />);

    expect(screen.getByText('see_also_empty')).toBeTruthy();
  });

  it('limits the picker to the allowed types, world-rule groups included', async () => {
    const screen = await render(
      <SeeAlsoManager {...baseProps()} allowedEntityTypes={['WorldRule']} />,
    );

    const groups = screen.getByTestId('multi-select').props.groups as { key: string }[];
    expect(groups.map((group) => group.key)).toEqual(['WorldRule:lore']);
  });

  it('hides the picker when read-only', async () => {
    const screen = await render(<SeeAlsoManager {...baseProps()} editable={false} />);

    expect(screen.queryByTestId('multi-select')).toBeNull();
  });

  it('saves the decoded selection, dropping what does not decode', async () => {
    const screen = await render(<SeeAlsoManager {...baseProps()} />);
    expect(screen.getByTestId('multi-select').props.selectedValues).toEqual(['Character:c-1']);

    await act(async () => {
      screen
        .getByTestId('multi-select')
        .props.onSelectionChange(['Character:c-2', 'Bogus:c-9', 'not-a-value']);
    });

    expect(mockSave).toHaveBeenCalledWith([{ entityType: 'Character', entityId: 'c-2' }]);
  });

  it('opens the linked entity when read-only, never while editing', async () => {
    // The card starts collapsed with its content untouchable; the reader opens it first.
    const readOnly = await render(<SeeAlsoManager {...baseProps()} editable={false} />);
    await fireEvent.press(readOnly.getByText('see_also_title (1)'));
    await fireEvent.press(readOnly.getByText('Alice'));
    expect(mockNavigate).toHaveBeenCalledWith('Character', 'c-1');

    mockNavigate.mockClear();
    const editing = await render(<SeeAlsoManager {...baseProps()} />);
    // While editing the rows stay plain: the chevron only marks tappable rows.
    expect(editing.queryByTestId('icon-chevron-forward')).toBeNull();
    await fireEvent.press(editing.getByText('see_also_title (1)'));
    await fireEvent.press(editing.getByText('Alice'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('exposes the pending persistence to the form through its ref', async () => {
    const ref = createRef<SeeAlsoManagerHandle>();
    await render(<SeeAlsoManager {...baseProps()} ref={ref} />);
    mockPersist.mockResolvedValue(undefined);

    await act(async () => {
      await ref.current?.persistPending('scene-2');
    });

    expect(mockPersist).toHaveBeenCalledWith('scene-2');
  });
});
