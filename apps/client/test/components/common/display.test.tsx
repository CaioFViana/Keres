import { avatarColorFromSeed } from '@keres/shared';
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import Avatar from '../../../src/components/common/display/Avatar/Avatar';
import CollapsibleCard from '../../../src/components/common/display/CollapsibleCard/CollapsibleCard';
import DetailField from '../../../src/components/common/display/DetailField/DetailField';
import EntityMetadata from '../../../src/components/common/display/EntityMetadata/EntityMetadata';
import EntityRelationList from '../../../src/components/common/display/EntityRelationList/EntityRelationList';
import SummaryCard from '../../../src/components/common/display/SummaryCard/SummaryCard';
import TagList from '../../../src/components/common/display/TagList/TagList';
import {
  MentionMatcherContext,
  MentionNavigationContext,
} from '../../../src/mentions/MentionContext';
import { EMPTY_MENTION_MATCHER } from '../../../src/utils/entityMentions';

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

jest.mock('../../../src/vocabulary/useStoryVocabulary', () => ({
  useStoryVocabulary: () => ({
    term: (type: string, plural = false) => (plural ? `${type}s` : type),
  }),
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

describe('Avatar', () => {
  it('uses the chosen color, icon and size', async () => {
    const screen = await render(<Avatar color="#123456" icon="planet" seed="u1" size={64} />);

    const circle = screen.container.queryAll(
      (node) => StyleSheet.flatten(node.props.style)?.width === 64,
    )[0];
    expect(StyleSheet.flatten(circle.props.style)).toMatchObject({
      height: 64,
      borderRadius: 32,
      backgroundColor: '#123456',
    });
    const icon = screen.container.queryAll((node) => node.type === 'Icon')[0];
    expect(icon.props.name).toBe('planet');
    expect(icon.props.size).toBeCloseTo(64 * 0.58);
  });

  it('falls back to a deterministic color and the default icon', async () => {
    const first = await render(<Avatar seed="same-seed" />);
    const second = await render(<Avatar color={null} icon={null} seed="same-seed" />);

    const backgroundOf = (screen: Awaited<ReturnType<typeof render>>) =>
      StyleSheet.flatten(
        screen.container.queryAll((node) => StyleSheet.flatten(node.props.style)?.width === 40)[0]
          .props.style,
      ).backgroundColor;
    expect(backgroundOf(first)).toBe(avatarColorFromSeed('same-seed'));
    expect(backgroundOf(second)).toBe(backgroundOf(first));
  });

  it('tints the icon for contrast on light and dark backgrounds', async () => {
    const light = await render(<Avatar color="#ffffff" seed="u1" />);
    expect(light.container.queryAll((node) => node.type === 'Icon')[0].props.color).toBe(
      'rgba(0, 0, 0, 0.6)',
    );

    const dark = await render(<Avatar color="#000000" seed="u1" />);
    expect(dark.container.queryAll((node) => node.type === 'Icon')[0].props.color).toBe(
      'rgba(255, 255, 255, 0.75)',
    );
  });
});

describe('CollapsibleCard', () => {
  it('renders the title and children, expanded by default', async () => {
    const screen = await render(
      <CollapsibleCard title="Relations">
        <Text>child body</Text>
      </CollapsibleCard>,
    );

    expect(screen.getByText('Relations')).toBeTruthy();
    expect(screen.getByText('child body')).toBeTruthy();
    expect(screen.container.queryAll((node) => node.type === 'Icon')[0].props.name).toBe(
      'chevron-up',
    );
  });

  it('toggles open and closed when the header is pressed', async () => {
    const screen = await render(
      <CollapsibleCard title="Relations" initialExpanded={false}>
        <Text>child body</Text>
      </CollapsibleCard>,
    );

    expect(screen.container.queryAll((node) => node.type === 'Icon')[0].props.name).toBe(
      'chevron-down',
    );
    await fireEvent.press(screen.container.queryAll((node) => node.type === 'Icon')[0]);
    expect(screen.container.queryAll((node) => node.type === 'Icon')[0].props.name).toBe(
      'chevron-up',
    );
  });

  it('accepts content measurements without crashing', async () => {
    const screen = await render(
      <CollapsibleCard title="Relations">
        <Text>child body</Text>
      </CollapsibleCard>,
    );

    const measured = screen.container.queryAll((node) => typeof node.props.onLayout === 'function');
    expect(measured.length).toBeGreaterThan(0);
    await fireEvent(measured[0], 'layout', { nativeEvent: { layout: { height: 120 } } });
    await fireEvent(measured[0], 'layout', { nativeEvent: { layout: { height: 0 } } });
  });
});

describe('DetailField basics', () => {
  const renderField = (value: string, onPress?: () => void) =>
    render(
      <MentionMatcherContext.Provider value={EMPTY_MENTION_MATCHER}>
        <MentionNavigationContext.Provider value={() => {}}>
          <DetailField label="Gender" value={value} onPress={onPress} />
        </MentionNavigationContext.Provider>
      </MentionMatcherContext.Provider>,
    );

  it('renders label and plain value', async () => {
    const screen = await renderField('Stargazer');
    expect(screen.getByText('Gender')).toBeTruthy();
    expect(screen.getByText('Stargazer')).toBeTruthy();
  });

  it('renders a whole-value link when onPress is given', async () => {
    const onPress = jest.fn();
    const screen = await renderField('Mentor', onPress);
    await fireEvent.press(screen.getByText('Mentor'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('EntityMetadata', () => {
  it('shows version and formatted dates inside a collapsed card', async () => {
    const createdAt = new Date('2024-05-06T10:00:00Z');
    const updatedAt = new Date('2024-05-07T15:30:00Z');
    const screen = await render(
      <EntityMetadata version={7} createdAt={createdAt} updatedAt={updatedAt} />,
    );

    expect(screen.getByText('metadata_title')).toBeTruthy();
    expect(screen.getByText('version')).toBeTruthy();
    const versionRow = screen.getByText('version').parent!;
    const versionValue = versionRow.children.filter((child) => typeof child !== 'string')[1] as {
      props: { children?: unknown };
    };
    expect(String(versionValue.props.children)).toBe('7');
    expect(
      screen.getByText(
        createdAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        updatedAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
      ),
    ).toBeTruthy();
  });
});

describe('EntityRelationList', () => {
  it('shows the empty text when there are no items', async () => {
    const screen = await render(<EntityRelationList items={[]} emptyText="Nothing here" />);
    const empty = screen.getByText('Nothing here');
    expect(StyleSheet.flatten(empty.props.style).fontStyle).toBe('italic');
  });

  it('renders rows with icons, details, trailing content and links', async () => {
    const onPress = jest.fn();
    const screen = await render(
      <EntityRelationList
        emptyText="Nothing here"
        items={[
          {
            id: 'a',
            title: 'Lyra',
            icon: 'person',
            color: '#123456',
            details: <Text>explorer</Text>,
            onPress,
            testID: 'row-a',
          },
          {
            id: 'b',
            title: '',
            icon: 'person',
            color: '#123456',
            leading: <Text>custom leading</Text>,
            trailing: <Text>custom trailing</Text>,
            testID: 'row-b',
          },
        ]}
      />,
    );

    expect(screen.getByText('Lyra')).toBeTruthy();
    expect(screen.getByText('explorer')).toBeTruthy();
    expect(screen.getByText('custom leading')).toBeTruthy();
    expect(screen.getByText('custom trailing')).toBeTruthy();
    // The linked row renders its leading icon plus the chevron; the custom row none.
    expect(screen.container.queryAll((node) => node.type === 'Icon')).toHaveLength(2);
    await fireEvent.press(screen.getByText('Lyra'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('row-a')).toBeTruthy();
    expect(screen.getByTestId('row-b')).toBeTruthy();
  });

  it('drops the divider on the last row only', async () => {
    const screen = await render(
      <EntityRelationList
        emptyText="Nothing here"
        items={[
          { id: 'a', title: 'First', icon: 'person', color: '#111111' },
          { id: 'b', title: 'Second', icon: 'person', color: '#111111' },
        ]}
      />,
    );

    const rowOf = (text: string) => screen.getByText(text).parent?.parent;
    expect(StyleSheet.flatten(rowOf('First')?.props.style).borderBottomWidth).toBe(
      StyleSheet.hairlineWidth,
    );
    expect(StyleSheet.flatten(rowOf('Second')?.props.style).borderBottomWidth).toBe(0);
  });
});

describe('SummaryCard', () => {
  it('titles the card with story totals and renders only defined tiles', async () => {
    const screen = await render(
      <SummaryCard totalStories={4} branchingStories={1} characterCount={3} />,
    );

    expect(screen.getByText(/total_stories_summary/)).toBeTruthy();
    expect(screen.getByText('Characters')).toBeTruthy();
    const tile = screen.getByText('Characters').parent!;
    const count = tile.children.filter((child) => typeof child !== 'string')[1] as {
      props: { children?: unknown };
    };
    expect(String(count.props.children)).toBe('3');
    expect(screen.queryByText('notes')).toBeNull();
  });

  it('shows the analysis banner and forwards its press', async () => {
    const onPress = jest.fn();
    const screen = await render(
      <SummaryCard title="Story" noteCount={2} analysisSummary={{ issueCount: 5, onPress }} />,
    );

    await fireEvent.press(screen.getByText('story_analysis_issues_found'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows the no-issue banner when the analysis is clean', async () => {
    const screen = await render(
      <SummaryCard title="Story" analysisSummary={{ issueCount: 0, onPress: () => {} }} />,
    );

    expect(screen.getByText('story_analysis_no_issues')).toBeTruthy();
  });

  it('adds fork and choice tiles for branching stories', async () => {
    const screen = await render(
      <SummaryCard title="Story" isBranchingStory branchingStoryForkCount={2} choiceCount={9} />,
    );

    expect(screen.getByText('forks')).toBeTruthy();
    expect(screen.getByText('Choices')).toBeTruthy();
    const tile = screen.getByText('Choices').parent!;
    const count = tile.children.filter((child) => typeof child !== 'string')[1] as {
      props: { children?: unknown };
    };
    expect(String(count.props.children)).toBe('9');
  });
});

describe('TagList', () => {
  it('renders nothing when empty without a fallback message', async () => {
    const screen = await render(<TagList tags={[]} />);
    expect(screen.toJSON()).toBeNull();
  });

  it('renders the fallback message when empty', async () => {
    const screen = await render(<TagList tags={[]} emptyMessage="No tags yet" />);
    expect(screen.getByText('No tags yet')).toBeTruthy();
  });

  it('renders compact pills with valid colors and a fallback for invalid ones', async () => {
    const screen = await render(
      <TagList
        tags={[
          { id: 'a', name: 'Magic', color: '#112233' },
          { id: 'b', name: 'Broken', color: 'not-a-color' },
        ]}
      />,
    );

    const pillOf = (text: string) => screen.getByText(text).parent;
    expect(StyleSheet.flatten(pillOf('Magic')?.props.style).backgroundColor).toBe('#112233');
    expect(StyleSheet.flatten(pillOf('Broken')?.props.style).backgroundColor).toBe('#f5f5f5');
  });

  it('removes chips through the remove button', async () => {
    const onRemoveTag = jest.fn();
    const screen = await render(
      <TagList variant="chip" tags={[{ id: 'a', name: 'Magic' }]} onRemoveTag={onRemoveTag} />,
    );

    await fireEvent.press(screen.getByLabelText('remove'));
    expect(onRemoveTag).toHaveBeenCalledWith('a');
  });

  it('renders chips without remove buttons when no handler is given', async () => {
    const screen = await render(<TagList variant="chip" tags={[{ id: 'a', name: 'Magic' }]} />);

    expect(screen.getByText('Magic')).toBeTruthy();
    expect(screen.queryByLabelText('remove')).toBeNull();
  });
});
