import { act, fireEvent, render, renderHook } from '@testing-library/react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import DetailContainer from '../../../src/components/layout/DetailContainer/DetailContainer';
import { DetailTabPanels, DetailTabs } from '../../../src/components/layout/DetailTabs/DetailTabs';
import { useDetailTab, useDetailTabItems } from '../../../src/hooks/useDetailTab';
import { detailTabForField } from '../../../src/utils/detailTabs';

jest.mock('../../../src/theme', () => ({
  useTheme: () => ({
    isDarkMode: false,
    colors: {
      primary: '#0000ff',
      background: '#ffffff',
      border: '#dddddd',
      text: '#111111',
      textSecondary: '#555555',
    },
  }),
}));

jest.mock('../../../src/hooks/useFormScrollBottomPadding', () => ({
  useFormScrollBottomPadding: () => 0,
}));

const TABS = [
  { key: 'details', label: 'Details' },
  { key: 'relations', label: 'Relations' },
  { key: 'other', label: 'Other' },
] as const;

type Key = (typeof TABS)[number]['key'];

describe('DetailTabs', () => {
  it('shows every tab and marks the one on show', async () => {
    const view = await render(<DetailTabs tabs={TABS} value="relations" onChange={() => {}} />);

    expect(view.getByText('Details')).toBeTruthy();
    expect(view.getByText('Relations')).toBeTruthy();
    expect(view.getByText('Other')).toBeTruthy();
    expect(view.getByTestId('detail-tab-relations').props.accessibilityState).toEqual({
      selected: true,
    });
    expect(view.getByTestId('detail-tab-other').props.accessibilityState).toEqual({
      selected: false,
    });
  });

  it('uses the theme: the selected tab is underlined in the primary color', async () => {
    const view = await render(<DetailTabs tabs={TABS} value="details" onChange={() => {}} />);

    const underline = (key: string) =>
      StyleSheet.flatten(view.getByTestId(`detail-tab-${key}`).props.style).borderBottomColor;
    expect(underline('details')).toBe('#0000ff');
    expect(underline('other')).toBe('transparent');
  });

  it('reports the tab that was pressed', async () => {
    const onChange = jest.fn();
    const view = await render(<DetailTabs tabs={TABS} value="details" onChange={onChange} />);

    await fireEvent.press(view.getByTestId('detail-tab-other'));

    expect(onChange).toHaveBeenCalledWith('other');
  });
});

describe('DetailTabPanels', () => {
  const Harness = ({ start = 'details' as Key }: { start?: Key }) => {
    const [value, setValue] = useState<Key>(start);
    return (
      <>
        <Text testID="go-relations" onPress={() => setValue('relations')}>
          relations
        </Text>
        <Text testID="go-details" onPress={() => setValue('details')}>
          details
        </Text>
        <DetailTabPanels
          value={value}
          panels={{
            details: <Text>details body</Text>,
            relations: <Text>relations body</Text>,
            other: <Text>other body</Text>,
          }}
        />
      </>
    );
  };

  it('builds only the tab on show', async () => {
    const view = await render(<Harness />);

    expect(view.getByText('details body')).toBeTruthy();
    expect(view.queryByText('relations body', { includeHiddenElements: true })).toBeNull();
    expect(view.queryByText('other body', { includeHiddenElements: true })).toBeNull();
  });

  it('builds a tab the first time it opens and keeps it, hidden, when another opens', async () => {
    const view = await render(<Harness />);

    await fireEvent.press(view.getByTestId('go-relations'));
    expect(view.getByText('relations body')).toBeTruthy();
    expect(view.queryByText('details body')).toBeNull();

    await fireEvent.press(view.getByTestId('go-details'));
    expect(view.getByText('details body')).toBeTruthy();
    expect(view.queryByText('relations body')).toBeNull();
    // Built once and still there, only hidden.
    expect(view.getByText('relations body', { includeHiddenElements: true })).toBeTruthy();
    expect(
      StyleSheet.flatten(
        view.getByTestId('detail-panel-relations', { includeHiddenElements: true }).props.style,
      ),
    ).toMatchObject({ display: 'none' });
  });

  it('can start on any tab', async () => {
    const view = await render(<Harness start="relations" />);

    expect(view.getByText('relations body')).toBeTruthy();
    expect(view.queryByText('details body', { includeHiddenElements: true })).toBeNull();
  });
});

describe('DetailContainer with tabs', () => {
  const stickyIndices = (view: Awaited<ReturnType<typeof render>>) =>
    view.container.queryAll((node) => node.type === 'RCTScrollView')[0].props.stickyHeaderIndices;

  it('keeps the tab bar at the top of the scroll view, after the title', async () => {
    const view = await render(
      <DetailContainer title="Aria" tabs={<Text>bar</Text>}>
        <Text>body</Text>
      </DetailContainer>,
    );

    expect(stickyIndices(view)).toEqual([1]);
  });

  it('counts the description too, and sticks to the first child without a title', async () => {
    const withDescription = await render(
      <DetailContainer title="Aria" description="About" tabs={<Text>bar</Text>}>
        <Text>body</Text>
      </DetailContainer>,
    );
    expect(stickyIndices(withDescription)).toEqual([2]);

    const bare = await render(
      <DetailContainer tabs={<Text>bar</Text>}>
        <Text>body</Text>
      </DetailContainer>,
    );
    expect(stickyIndices(bare)).toEqual([0]);
  });

  it('sticks nothing when there are no tabs', async () => {
    const view = await render(
      <DetailContainer title="Aria">
        <Text>body</Text>
      </DetailContainer>,
    );

    expect(stickyIndices(view)).toBeUndefined();
  });

  it('scrolls back to the top when the reset key changes, and not before', async () => {
    const scrollTo = jest
      .spyOn(ScrollView.prototype as unknown as { scrollTo: () => void }, 'scrollTo')
      .mockImplementation(() => {});
    const Probe = ({ tab }: { tab: string }) => (
      <DetailContainer title="Aria" scrollResetKey={tab}>
        <Text>body</Text>
      </DetailContainer>
    );
    const view = await render(<Probe tab="details" />);
    expect(scrollTo).not.toHaveBeenCalled();

    await view.rerender(<Probe tab="details" />);
    expect(scrollTo).not.toHaveBeenCalled();

    await view.rerender(<Probe tab="relations" />);
    expect(scrollTo).toHaveBeenCalledWith({ y: 0, animated: false });
    scrollTo.mockRestore();
  });
});

describe('detailTabForField', () => {
  it('sends the extra notes and the custom attributes to the other tab', () => {
    expect(detailTabForField('extraNotes')).toBe('other');
    expect(detailTabForField('custom:01ABC')).toBe('other');
  });

  it('keeps the schema fields on the details', () => {
    expect(detailTabForField('biography')).toBe('details');
    expect(detailTabForField('summary')).toBe('details');
  });
});

describe('useDetailTab', () => {
  it('starts on the details', async () => {
    const { result } = await renderHook(() => useDetailTab(undefined));

    expect(result.current[0]).toBe('details');
  });

  it('starts on the tab holding the field a landing is for', async () => {
    const { result } = await renderHook(() => useDetailTab({ field: 'custom:abc' }));

    expect(result.current[0]).toBe('other');
  });

  it('follows the person, and a new landing target takes the screen to its tab', async () => {
    const first = { field: 'biography' };
    const second = { field: 'extraNotes' };
    const { result, rerender } = await renderHook(
      ({ target }: { target?: { field: string } }) => useDetailTab(target),
      { initialProps: { target: first } as { target?: { field: string } } },
    );

    await act(async () => result.current[1]('relations'));
    expect(result.current[0]).toBe('relations');

    await rerender({ target: first });
    expect(result.current[0]).toBe('relations');

    await rerender({ target: second });
    expect(result.current[0]).toBe('other');
  });
});

describe('useDetailTabItems', () => {
  it('names the three tabs in order', async () => {
    const t = ((key: string) => key) as never;
    const { result } = await renderHook(() => useDetailTabItems(t));

    expect(result.current).toEqual([
      { key: 'details', label: 'detail_tab_details' },
      { key: 'relations', label: 'detail_tab_relations' },
      { key: 'other', label: 'detail_tab_other' },
    ]);
  });
});
