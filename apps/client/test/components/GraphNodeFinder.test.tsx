jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      text: '#111',
      textSecondary: '#555',
      surface: '#fff',
      border: '#ddd',
      primary: '#00f',
      background: '#fff',
    },
  }),
  getCommonInputStyles: () => ({ input: {} }),
}));
jest.mock('../../src/components/common/inputs/TextInput/TextInput', () => {
  const { TextInput: RNTextInput } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => <RNTextInput {...(props as object)} />,
  };
});

import { fireEvent, render } from '@testing-library/react-native';
import GraphNodeFinder, {
  findOptions,
  foldForSearch,
  MAX_FINDER_RESULTS,
} from '../../src/components/features/graphs/GraphNodeFinder/GraphNodeFinder';

const OPTIONS = [
  { id: '1', label: 'João da Silva' },
  { id: '2', label: 'Maria João' },
  { id: '3', label: 'Ana' },
];

describe('foldForSearch', () => {
  it('ignores case, accents and surrounding blanks', () => {
    expect(foldForSearch('  JOÃO ')).toBe('joao');
    expect(foldForSearch('Ação')).toBe('acao');
  });
});

describe('findOptions', () => {
  it('finds nothing for an empty query', () => {
    expect(findOptions(OPTIONS, '')).toEqual([]);
    expect(findOptions(OPTIONS, '   ')).toEqual([]);
  });

  it('matches without caring for accents, those that start with the query first', () => {
    expect(findOptions(OPTIONS, 'joao').map((o) => o.id)).toEqual(['1', '2']);
  });

  it('finds the middle of a name too', () => {
    expect(findOptions(OPTIONS, 'silva').map((o) => o.id)).toEqual(['1']);
  });

  it('stops at the limit', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: String(i), label: `Anna ${i}` }));

    expect(findOptions(many, 'ann')).toHaveLength(MAX_FINDER_RESULTS);
  });
});

describe('GraphNodeFinder', () => {
  it('shows no list until the author types', async () => {
    const view = await render(
      <GraphNodeFinder options={OPTIONS} placeholder="Find" onPick={jest.fn()} />,
    );

    expect(view.queryByText('Ana')).toBeNull();
    expect(view.getByTestId('graph-node-finder-input')).toBeTruthy();
  });

  it('lists the matches and picks one, then clears itself', async () => {
    const onPick = jest.fn();
    const view = await render(
      <GraphNodeFinder options={OPTIONS} placeholder="Find" onPick={onPick} />,
    );

    await fireEvent.changeText(view.getByTestId('graph-node-finder-input'), 'ana');
    await fireEvent.press(view.getByRole('button', { name: 'Ana' }));

    expect(onPick).toHaveBeenCalledWith('3');
    expect(view.getByTestId('graph-node-finder-input').props.value).toBe('');
    expect(view.queryByRole('button', { name: 'Ana' })).toBeNull();
  });

  it('picks the first match on submit', async () => {
    const onPick = jest.fn();
    const view = await render(
      <GraphNodeFinder options={OPTIONS} placeholder="Find" onPick={onPick} />,
    );
    const input = view.getByTestId('graph-node-finder-input');

    await fireEvent.changeText(input, 'joao');
    await fireEvent(input, 'submitEditing');

    expect(onPick).toHaveBeenCalledWith('1');
  });

  it('does nothing on submit when nothing matches', async () => {
    const onPick = jest.fn();
    const view = await render(
      <GraphNodeFinder options={OPTIONS} placeholder="Find" onPick={onPick} />,
    );
    const input = view.getByTestId('graph-node-finder-input');

    await fireEvent.changeText(input, 'zzz');
    await fireEvent(input, 'submitEditing');

    expect(onPick).not.toHaveBeenCalled();
  });
});
