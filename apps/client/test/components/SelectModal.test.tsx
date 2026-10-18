import { fireEvent, render, waitFor } from '@testing-library/react-native';
import SelectModal, {
  groupsOf,
  type SelectModalProps,
} from '@/src/components/common/modals/SelectModal/SelectModal';

jest.mock('react-native-safe-area-context', () => ({
  __esModule: true,
  useSafeAreaInsets: jest.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 })),
}));

jest.mock('@/src/theme', () => ({
  useTheme: () => ({
    isDarkMode: false,
    colors: {
      background: '#fff',
      border: '#ddd',
      primary: '#00f',
      primaryContainer: '#ddf',
      surface: '#fff',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, number>) =>
      values ? `${key}:${Object.values(values).join('/')}` : key,
  }),
}));

const options = [
  { label: 'Atena', value: 'atena' },
  { label: 'Keres', value: 'keres' },
  { label: 'Zoe', value: 'zoe' },
];

const groups = [
  { key: 'Character', label: 'Characters', options },
  { key: 'Location', label: 'Locations', options: [{ label: 'Delphi', value: 'delphi' }] },
  { key: 'Item', label: 'Items', options: [] },
];

const flat = (overrides: Partial<SelectModalProps> = {}): SelectModalProps => ({
  visible: true,
  onClose: jest.fn(),
  source: { options },
  selectedValues: [],
  onSelectionChange: jest.fn(),
  title: 'Pick one',
  ...overrides,
});

const grouped = (overrides: Partial<SelectModalProps> = {}) =>
  flat({ source: { groups }, title: 'Pick an entity', ...overrides });

describe('groupsOf', () => {
  it('turns a flat list into one group, so the type step is skipped', () => {
    const result = groupsOf({ options });

    expect(result).toHaveLength(1);
    expect(result[0].options).toBe(options);
  });

  it('keeps the groups as they are', () => {
    expect(groupsOf({ groups })).toBe(groups);
  });
});

describe('SelectModal, visibility', () => {
  it('draws nothing while it is not visible', async () => {
    const screen = await render(<SelectModal {...flat({ visible: false })} />);

    expect(screen.queryByPlaceholderText('search')).toBeNull();
    expect(screen.queryByText('Pick one')).toBeNull();
  });

  it('opens and closes as its owner says', async () => {
    const props = flat({ visible: false });
    const screen = await render(<SelectModal {...props} />);

    await screen.rerender(<SelectModal {...props} visible />);
    expect(screen.getByText('Pick one')).toBeTruthy();
    expect(screen.getByTestId('multiselect-option-atena')).toBeTruthy();

    await screen.rerender(<SelectModal {...props} visible={false} />);
    await waitFor(() => expect(screen.queryByText('Pick one')).toBeNull());
  });

  it('asks its owner to close from the backdrop', async () => {
    const props = flat();
    const screen = await render(<SelectModal {...props} />);

    await fireEvent.press(screen.getByTestId('responsive-modal-backdrop'));

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});

describe('SelectModal, a flat list', () => {
  it('goes straight to the search, titled by the owner', async () => {
    const screen = await render(<SelectModal {...flat()} />);

    expect(screen.getByText('Pick one')).toBeTruthy();
    expect(screen.getByPlaceholderText('search')).toBeTruthy();
    expect(screen.queryByLabelText('go_back')).toBeNull();
    expect(screen.getByText('Zoe')).toBeTruthy();
  });

  it('narrows the options by the search, whatever the case', async () => {
    const screen = await render(<SelectModal {...flat()} />);

    await fireEvent.changeText(screen.getByPlaceholderText('search'), '  ZO ');

    expect(screen.getByText('Zoe')).toBeTruthy();
    expect(screen.queryByText('Atena')).toBeNull();
    expect(screen.queryByText('Keres')).toBeNull();
  });

  it('words the search and the empty list as the owner asks', async () => {
    const screen = await render(
      <SelectModal
        {...flat({ searchPlaceholder: 'Find someone', noOptionsText: 'Nobody here' })}
      />,
    );

    await fireEvent.changeText(screen.getByPlaceholderText('Find someone'), 'nothing like this');

    expect(screen.getByText('Nobody here')).toBeTruthy();
  });

  it('has a default for the empty list', async () => {
    const screen = await render(<SelectModal {...flat({ source: { options: [] } })} />);

    expect(screen.getByText('no_tags_available')).toBeTruthy();
  });

  it('marks the options that are selected', async () => {
    const screen = await render(<SelectModal {...flat({ selectedValues: ['keres'] })} />);

    expect(screen.getByTestId('multiselect-check-keres').children.length).toBe(1);
    expect(screen.getByTestId('multiselect-check-atena').children.length).toBe(0);
  });

  it('draws the icon of an option with its own colour', async () => {
    const screen = await render(
      <SelectModal
        {...flat({
          source: { options: [{ label: 'Hero', value: 'hero', icon: 'star', color: '#f00' }] },
        })}
      />,
    );

    expect(screen.getByTestId('multiselect-option-icon-hero')).toBeTruthy();
  });
});

describe('SelectModal, several values', () => {
  it('adds and removes values and stays open', async () => {
    const props = flat({ selectedValues: ['atena'] });
    const screen = await render(<SelectModal {...props} />);

    await fireEvent.press(screen.getByTestId('multiselect-option-keres'));
    expect(props.onSelectionChange).toHaveBeenLastCalledWith(['atena', 'keres']);

    await fireEvent.press(screen.getByTestId('multiselect-option-atena'));
    expect(props.onSelectionChange).toHaveBeenLastCalledWith([]);

    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('keeps the options not yet chosen out of reach at the limit', async () => {
    const props = flat({ selectedValues: ['atena', 'keres'], maxSelections: 2 });
    const screen = await render(<SelectModal {...props} />);

    await fireEvent.press(screen.getByTestId('multiselect-option-zoe'));
    expect(props.onSelectionChange).not.toHaveBeenCalled();

    // A chosen one can still be taken out.
    await fireEvent.press(screen.getByTestId('multiselect-option-keres'));
    expect(props.onSelectionChange).toHaveBeenCalledWith(['atena']);
  });
});

describe('SelectModal, one value', () => {
  it('replaces the selection and asks to close', async () => {
    const props = flat({ singleSelect: true, selectedValues: ['atena'] });
    const screen = await render(<SelectModal {...props} />);

    await fireEvent.press(screen.getByTestId('multiselect-option-keres'));

    expect(props.onSelectionChange).toHaveBeenCalledWith(['keres']);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('clears the value when it is chosen again', async () => {
    const props = flat({ singleSelect: true, selectedValues: ['atena'] });
    const screen = await render(<SelectModal {...props} />);

    await fireEvent.press(screen.getByTestId('multiselect-option-atena'));

    expect(props.onSelectionChange).toHaveBeenCalledWith([]);
  });

  it('keeps a required value when it may not be cleared', async () => {
    const props = flat({ singleSelect: true, allowDeselect: false, selectedValues: ['atena'] });
    const screen = await render(<SelectModal {...props} />);

    await fireEvent.press(screen.getByTestId('multiselect-option-atena'));

    expect(props.onSelectionChange).toHaveBeenCalledWith(['atena']);
  });

  it('ignores the limit, which is for several values', async () => {
    const props = flat({ singleSelect: true, maxSelections: 1, selectedValues: ['atena'] });
    const screen = await render(<SelectModal {...props} />);

    await fireEvent.press(screen.getByTestId('multiselect-option-zoe'));

    expect(props.onSelectionChange).toHaveBeenCalledWith(['zoe']);
  });
});

describe('SelectModal, groups', () => {
  it('asks for the type first, with how many of each are chosen', async () => {
    const screen = await render(<SelectModal {...grouped({ selectedValues: ['delphi'] })} />);

    expect(screen.getByText('Pick an entity')).toBeTruthy();
    expect(screen.queryByPlaceholderText('search')).toBeNull();
    expect(screen.getByText('Characters')).toBeTruthy();
    expect(screen.getByText('grouped_select_count_total:3')).toBeTruthy();
    expect(screen.getByText('grouped_select_count_selected:1/1')).toBeTruthy();
  });

  it('does not open a group that is empty', async () => {
    const screen = await render(<SelectModal {...grouped()} />);

    await fireEvent.press(screen.getByText('Items'));

    expect(screen.queryByPlaceholderText('search')).toBeNull();
  });

  it('goes into a group, titled by it, and back', async () => {
    const screen = await render(<SelectModal {...grouped()} />);

    await fireEvent.press(screen.getByText('Characters'));
    expect(screen.getByText('Atena')).toBeTruthy();
    expect(screen.getByPlaceholderText('search')).toBeTruthy();
    expect(screen.queryByText('Pick an entity')).toBeNull();

    await fireEvent.changeText(screen.getByPlaceholderText('search'), 'ke');
    await fireEvent.press(screen.getByLabelText('go_back'));

    expect(screen.getByText('Pick an entity')).toBeTruthy();
    expect(screen.getByText('Locations')).toBeTruthy();
    // The search does not follow into the next group.
    await fireEvent.press(screen.getByText('Locations'));
    expect(screen.getByPlaceholderText('search').props.value).toBe('');
    expect(screen.getByText('Delphi')).toBeTruthy();
  });

  it('starts over at the types every time it opens', async () => {
    const props = grouped();
    const screen = await render(<SelectModal {...props} />);
    await fireEvent.press(screen.getByText('Characters'));
    await fireEvent.changeText(screen.getByPlaceholderText('search'), 'zo');

    await screen.rerender(<SelectModal {...props} visible={false} />);
    await screen.rerender(<SelectModal {...props} visible />);

    expect(screen.getByText('Pick an entity')).toBeTruthy();
    expect(screen.queryByPlaceholderText('search')).toBeNull();
    await fireEvent.press(screen.getByText('Characters'));
    expect(screen.getByPlaceholderText('search').props.value).toBe('');
    expect(screen.getByText('Atena')).toBeTruthy();
  });

  it('skips the type step when there is only one group', async () => {
    const screen = await render(<SelectModal {...grouped({ source: { groups: [groups[0]] } })} />);

    expect(screen.getByPlaceholderText('search')).toBeTruthy();
    expect(screen.getByText('Atena')).toBeTruthy();
    expect(screen.queryByLabelText('go_back')).toBeNull();
  });
});
