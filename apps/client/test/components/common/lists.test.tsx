import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import FavoriteButton from '../../../src/components/common/lists/GenericExpandedListItemWithActions/Buttons/FavoriteButton';
import ViewDetailsButton from '../../../src/components/common/lists/GenericExpandedListItemWithActions/Buttons/ViewDetailsButton';
import GenericExpandedListItemWithActions from '../../../src/components/common/lists/GenericExpandedListItemWithActions/GenericExpandedListItemWithActions';
import GenericFilterSortList from '../../../src/components/common/lists/GenericFilterSortList/GenericFilterSortList';
import GenericListItem from '../../../src/components/common/lists/GenericListItem/GenericListItem';

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

// The filter/sort pills open through ResponsiveModal, which reads the system bottom inset.
// The hook needs a SafeAreaProvider that these unit tests do not mount, so stub it.
jest.mock('../../../src/hooks/useFormScrollBottomPadding', () => ({
  useFormScrollBottomPadding: () => 0,
}));

jest.mock('../../../src/components/common/modals/AdvancedSearchModal/AdvancedSearchModal', () => {
  const react = jest.requireActual('react') as typeof import('react');
  const native = jest.requireActual('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    default: ({ isVisible, onClose, onSearch }: any) =>
      isVisible
        ? react.createElement(
            react.Fragment,
            null,
            react.createElement(native.Text, { testID: 'adv-open' }, 'advanced'),
            react.createElement(
              native.Text,
              { testID: 'adv-go', onPress: () => onSearch({ name: 'x' }) },
              'adv-go',
            ),
            react.createElement(
              native.Text,
              { testID: 'adv-close', onPress: onClose },
              'adv-close',
            ),
          )
        : null,
  };
});

describe('GenericListItem', () => {
  const base = {
    headerContent: <Text>header</Text>,
    leadingIcon: <Text>leading</Text>,
    expandedContent: <Text>expanded-body</Text>,
    rightActions: <Text>actions</Text>,
  };

  it('renders the header row and forwards presses', async () => {
    const onPress = jest.fn();
    const screen = await render(
      <GenericListItem
        {...base}
        isOpen={false}
        onPress={onPress}
        accessibilityLabel="row-toggle"
      />,
    );

    expect(screen.getByText('header')).toBeTruthy();
    expect(screen.getByText('leading')).toBeTruthy();
    expect(screen.getByText('actions')).toBeTruthy();
    const toggle = screen.getByLabelText('row-toggle');
    expect(toggle.props.accessibilityState).toEqual({ expanded: false });
    await fireEvent.press(toggle);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('keeps both the measured and the animated copy of the body', async () => {
    const screen = await render(<GenericListItem {...base} isOpen onPress={() => {}} />);
    expect(screen.getAllByText('expanded-body')).toHaveLength(2);
  });

  it('accepts body measurements without crashing', async () => {
    const screen = await render(<GenericListItem {...base} isOpen onPress={() => {}} />);
    const measured = screen.container.queryAll((node) => typeof node.props.onLayout === 'function');
    expect(measured.length).toBeGreaterThan(0);
    await fireEvent(measured[0], 'layout', { nativeEvent: { layout: { height: 44 } } });
  });

  it('tightens spacing for nested density', async () => {
    const marginOf = async (density: 'default' | 'nested') => {
      const screen = await render(
        <GenericListItem {...base} isOpen={false} onPress={() => {}} density={density} />,
      );
      const containers = screen.container.queryAll(
        (node) => StyleSheet.flatten(node.props.style)?.marginVertical !== undefined,
      );
      return StyleSheet.flatten(containers[0].props.style).marginVertical;
    };
    expect(await marginOf('default')).toBe(4);
    expect(await marginOf('nested')).toBe(2);
  });
});

describe('FavoriteButton', () => {
  it('shows the state and toggles on press', async () => {
    const onPress = jest.fn();
    const off = await render(<FavoriteButton isFavorite={false} onPress={onPress} />);
    const offIcon = off.container.queryAll((node) => node.type === 'MIcon')[0];
    expect(offIcon.props.name).toBe('star-outline');
    expect(offIcon.props.color).toBe('#555555');
    await fireEvent.press(offIcon);
    expect(onPress).toHaveBeenCalledTimes(1);

    const on = await render(<FavoriteButton isFavorite onPress={() => {}} />);
    const onIcon = on.container.queryAll((node) => node.type === 'MIcon')[0];
    expect(onIcon.props.name).toBe('star');
    expect(onIcon.props.color).toBe('#0000ff');
  });
});

describe('ViewDetailsButton', () => {
  it('uses the primary color by default and forwards presses', async () => {
    const onPress = jest.fn();
    const screen = await render(<ViewDetailsButton onPress={onPress} />);
    const icon = screen.container.queryAll((node) => node.type === 'MIcon')[0];
    expect(icon.props.name).toBe('eye');
    expect(icon.props.color).toBe('#0000ff');
    await fireEvent.press(icon);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('accepts a color override', async () => {
    const screen = await render(<ViewDetailsButton onPress={() => {}} color="#123456" />);
    expect(screen.container.queryAll((node) => node.type === 'MIcon')[0].props.color).toBe(
      '#123456',
    );
  });
});

describe('GenericExpandedListItemWithActions', () => {
  const renderRow = ({ item: itemOverride, ...rest }: Record<string, any> = {}) =>
    render(
      <GenericExpandedListItemWithActions
        item={{ id: 'x', ...itemOverride }}
        renderHeaderContent={() => <Text>Lyra</Text>}
        renderExpandedContent={() => <Text>Explorer</Text>}
        accessibilityLabel="row-toggle"
        {...rest}
      />,
    );

  const chevron = (screen: Awaited<ReturnType<typeof render>>) =>
    screen.container.queryAll(
      (node) => node.type === 'MIcon' && ['chevron-up', 'chevron-down'].includes(node.props.name),
    )[0].props.name;

  it('toggles uncontrolled state and reports it', async () => {
    const onExpandedChange = jest.fn();
    const screen = await renderRow({ onExpandedChange });
    expect(chevron(screen)).toBe('chevron-down');
    await fireEvent.press(screen.getByLabelText('row-toggle'));
    expect(onExpandedChange).toHaveBeenCalledWith(true);
    expect(chevron(screen)).toBe('chevron-up');
  });

  it('stays controlled when isExpanded is given', async () => {
    const onExpandedChange = jest.fn();
    const screen = await renderRow({ isExpanded: true, onExpandedChange });
    expect(chevron(screen)).toBe('chevron-up');
    await fireEvent.press(screen.getByLabelText('row-toggle'));
    expect(onExpandedChange).toHaveBeenCalledWith(false);
    expect(chevron(screen)).toBe('chevron-up');
  });

  it('toggles favorites with the inverted state', async () => {
    const onToggleFavorite = jest.fn();
    const screen = await renderRow({ item: { isFavorite: false }, onToggleFavorite });
    const star = screen.container.queryAll(
      (node) => node.type === 'MIcon' && node.props.name === 'star-outline',
    )[0];
    await fireEvent.press(star);
    expect(onToggleFavorite).toHaveBeenCalledWith('x', true);
  });

  it('hides the favorite action when the item has no favorite state', async () => {
    const screen = await renderRow({ onToggleFavorite: () => {} });
    expect(
      screen.container.queryAll(
        (node) => node.type === 'MIcon' && String(node.props.name).startsWith('star'),
      ),
    ).toHaveLength(0);
  });

  it('opens details on demand', async () => {
    const onViewDetails = jest.fn();
    const screen = await renderRow({ onViewDetails });
    const eye = screen.container.queryAll(
      (node) => node.type === 'MIcon' && node.props.name === 'eye',
    )[0];
    await fireEvent.press(eye);
    expect(onViewDetails).toHaveBeenCalledWith('x');
  });

  it('shows an appearance override icon and hides it otherwise', async () => {
    const withAppearance = await renderRow({
      entityAppearance: { icon: 'planet', color: '#123456' },
    });
    expect(withAppearance.getByTestId('entity-list-item-icon').props.name).toBe('planet');

    const plain = await renderRow({});
    expect(plain.queryByTestId('entity-list-item-icon')).toBeNull();
  });
});

describe('GenericFilterSortList', () => {
  const baseProps = () => ({
    data: [
      { id: '1', name: 'One' },
      { id: '2', name: 'Two' },
    ],
    renderItem: ({ item }: { item: { name: string } }) => <Text>row-{item.name}</Text>,
    keyExtractor: (item: { id: string }) => item.id,
    onSearch: jest.fn(),
    onFilterChange: jest.fn(),
    selectedFilterValues: [] as string[],
    onSortChange: jest.fn(),
    onSortDirectionChange: jest.fn(),
    currentSortDirection: 'asc' as const,
  });

  it('searches live and commits on submit', async () => {
    const props = baseProps();
    const onSearchSubmit = jest.fn();
    const screen = await render(
      <GenericFilterSortList {...props} onSearchSubmit={onSearchSubmit} />,
    );

    const search = screen.getByPlaceholderText('search');
    await fireEvent.changeText(search, 'Ly');
    expect(props.onSearch).toHaveBeenCalledWith('Ly');
    await fireEvent(search, 'submitEditing');
    expect(onSearchSubmit).toHaveBeenCalledTimes(1);
  });

  it('counts results with contextual metadata', async () => {
    const props = baseProps();
    const screen = await render(<GenericFilterSortList {...props} resultsMeta="2 nested" />);
    expect(screen.getByText(/total_results_found/)).toBeTruthy();
  });

  it('shows empty states', async () => {
    const props = { ...baseProps(), data: [] as { id: string; name: string }[] };
    const fallback = await render(<GenericFilterSortList {...props} />);
    expect(fallback.getByText('no_items_found')).toBeTruthy();

    const custom = await render(
      <GenericFilterSortList {...props} emptyListComponent={<Text>make one</Text>} />,
    );
    expect(custom.getByText('make one')).toBeTruthy();
    expect(custom.queryByText('no_items_found')).toBeNull();
  });

  it('filters through the tag picker', async () => {
    const props = baseProps();
    const screen = await render(
      <GenericFilterSortList
        {...props}
        filterOptions={[
          { label: 'Tag A', value: 'a' },
          { label: 'Tag B', value: 'b' },
        ]}
      />,
    );

    await fireEvent.press(screen.getAllByTestId('multiselect-trigger')[0]);
    await fireEvent.press(screen.getByTestId('multiselect-option-a'));
    expect(props.onFilterChange).toHaveBeenCalledWith(['a']);
  });

  it('filters through colored tag options', async () => {
    const props = baseProps();
    const screen = await render(
      <GenericFilterSortList
        {...props}
        filterOptions={[{ label: 'Tag A', value: 'a', color: '#112233' }]}
      />,
    );

    await fireEvent.press(screen.getAllByTestId('multiselect-trigger')[0]);
    await fireEvent.press(screen.getByTestId('multiselect-option-a'));
    expect(props.onFilterChange).toHaveBeenCalledWith(['a']);
  });

  it('sorts through the single picker and flips direction', async () => {
    const props = baseProps();
    const screen = await render(
      <GenericFilterSortList {...props} sortOptions={[{ label: 'Name', value: 'name' }]} />,
    );

    await fireEvent.press(screen.getAllByTestId('multiselect-trigger')[1]);
    await fireEvent.press(screen.getByTestId('multiselect-option-name'));
    expect(props.onSortChange).toHaveBeenCalledWith('name');

    const arrow = () =>
      screen.container.queryAll(
        (node) => node.type === 'Icon' && ['arrow-up', 'arrow-down'].includes(node.props.name),
      )[0];
    expect(arrow().props.name).toBe('arrow-up');
    await fireEvent.press(arrow());
    expect(props.onSortDirectionChange).toHaveBeenCalledWith('desc');
    expect(arrow().props.name).toBe('arrow-down');
  });

  it('cycles the favorite filter', async () => {
    const onFavoriteFilterChange = jest.fn();
    const props = baseProps();
    const screen = await render(
      <GenericFilterSortList {...props} onFavoriteFilterChange={onFavoriteFilterChange} />,
    );

    const favoriteIcon = () =>
      screen.container.queryAll(
        (node) =>
          node.type === 'Icon' && ['star', 'star-outline', 'ban-outline'].includes(node.props.name),
      )[0];
    expect(favoriteIcon().props.name).toBe('star-outline');
    await fireEvent.press(favoriteIcon());
    expect(onFavoriteFilterChange).toHaveBeenCalledWith('favorite');
    await fireEvent.press(favoriteIcon());
    expect(onFavoriteFilterChange).toHaveBeenCalledWith('not-favorite');
    await fireEvent.press(favoriteIcon());
    expect(onFavoriteFilterChange).toHaveBeenCalledWith('all');
  });

  it('hides the favorite filter when disabled', async () => {
    const props = baseProps();
    const screen = await render(<GenericFilterSortList {...props} disableFavoriteFilter />);
    expect(
      screen.container.queryAll(
        (node) =>
          node.type === 'Icon' && ['star', 'star-outline', 'ban-outline'].includes(node.props.name),
      ),
    ).toHaveLength(0);
  });

  it('starts from controlled filter states', async () => {
    const props = baseProps();
    const screen = await render(
      <GenericFilterSortList
        {...props}
        filterOptions={[{ label: 'Tag A', value: 'a' }]}
        selectedFilterValues={['a']}
        currentFavoriteFilterState="favorite"
      />,
    );

    expect(screen.getByText('Tag A')).toBeTruthy();
    expect(
      screen.container.queryAll((node) => node.type === 'Icon' && node.props.name === 'star')[0],
    ).toBeTruthy();
  });

  it('keeps advanced search closed without searchable context', async () => {
    const props = baseProps();
    const screen = await render(<GenericFilterSortList {...props} />);

    const advanced = screen.container.queryAll(
      (node) => node.type === 'Icon' && node.props.name === 'search-outline',
    )[0];
    await fireEvent.press(advanced);
    expect(screen.queryByTestId('adv-open')).toBeNull();
  });

  it('submits advanced search criteria', async () => {
    const onAdvancedSearch = jest.fn();
    const props = baseProps();
    const screen = await render(
      <GenericFilterSortList
        {...props}
        entityName="Character"
        storyId="s1"
        onAdvancedSearch={onAdvancedSearch}
      />,
    );

    const advanced = screen.container.queryAll(
      (node) => node.type === 'Icon' && node.props.name === 'search-outline',
    )[0];
    await fireEvent.press(advanced);
    expect(screen.getByTestId('adv-open')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('adv-go'));
    expect(onAdvancedSearch).toHaveBeenCalledWith({ name: 'x' });
    expect(screen.queryByTestId('adv-open')).toBeNull();
  });

  it('renders grids with extra filter chrome', async () => {
    const props = baseProps();
    const screen = await render(
      <GenericFilterSortList
        {...props}
        numColumns={2}
        filterComponent={<Text>extra filters</Text>}
      />,
    );

    expect(screen.getByText('extra filters')).toBeTruthy();
    expect(screen.getByText('row-One')).toBeTruthy();
    expect(screen.getByText('row-Two')).toBeTruthy();
  });

  it('falls back to plain text without a guided empty state', async () => {
    const props = baseProps();
    const screen = await render(
      <GenericFilterSortList {...props} data={[] as { id: string; name: string }[]} />,
    );

    expect(screen.getByText('no_items_found')).toBeTruthy();
    expect(screen.queryByTestId('guided-empty-state')).toBeNull();
  });

  it('guides the empty list with a title, a hint and actions', async () => {
    const first = jest.fn();
    const second = jest.fn();
    const props = baseProps();
    const screen = await render(
      <GenericFilterSortList
        {...props}
        data={[] as { id: string; name: string }[]}
        entityName="Item"
        emptyStateTitle="Empty title"
        emptyStateMessage="Empty hint"
        emptyStateActions={[
          { label: 'Do first', onPress: first, testID: 'empty-first' },
          { label: 'Do second', onPress: second, testID: 'empty-second' },
        ]}
      />,
    );

    expect(screen.getByTestId('guided-empty-state')).toBeTruthy();
    expect(screen.getByTestId('guided-empty-icon')).toBeTruthy();
    const [iconWrap] = screen.container.queryAll(
      (node) => node.props?.testID === 'guided-empty-icon',
    );
    const [icon] = iconWrap.queryAll((node) => node.type === 'Icon');
    expect(icon.props.name).toBe('cube');
    expect(screen.getByText('Empty title')).toBeTruthy();
    expect(screen.getByText('Empty hint')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('empty-first'));
    expect(first).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByText('Do second'));
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('shows at most two empty-state actions', async () => {
    const props = baseProps();
    const screen = await render(
      <GenericFilterSortList
        {...props}
        data={[] as { id: string; name: string }[]}
        emptyStateActions={[
          { label: 'One', onPress: jest.fn(), testID: 'empty-one' },
          { label: 'Two', onPress: jest.fn(), testID: 'empty-two' },
          { label: 'Three', onPress: jest.fn(), testID: 'empty-three' },
        ]}
      />,
    );

    expect(screen.getByTestId('empty-one')).toBeTruthy();
    expect(screen.getByTestId('empty-two')).toBeTruthy();
    expect(screen.queryByTestId('empty-three')).toBeNull();
  });

  it('lets an explicit empty component win over the guided one', async () => {
    const props = baseProps();
    const screen = await render(
      <GenericFilterSortList
        {...props}
        data={[] as { id: string; name: string }[]}
        emptyListComponent={<Text>custom empty</Text>}
        emptyStateTitle="Empty title"
      />,
    );

    expect(screen.getByText('custom empty')).toBeTruthy();
    expect(screen.queryByTestId('guided-empty-state')).toBeNull();
  });
});
