import { cleanup, fireEvent, render } from '@testing-library/react-native';
import type { Story } from '@keres/shared/entities/Story';
import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import { MainDashboardContent } from '../../../src/screens/mainstorystack/MainDashboardContent';

jest.mock('../../../src/theme', () => {
  const actual = jest.requireActual('../../../src/theme');
  return {
    ...actual,
    useTheme: () => ({
      isDarkMode: false,
      colors: {
        primary: '#0000ff',
        text: '#111111',
        textSecondary: '#555555',
      },
    }),
  };
});

jest.mock('../../../src/components/layout/DetailContainer/DetailContainer', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ title, children }: { title: string; children?: ReactNode }) => (
      <>
        <Text testID="detail-title">{title}</Text>
        {children}
      </>
    ),
  };
});

jest.mock('../../../src/components/layout/ScreenSection/ScreenSection', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      title,
      actions,
      children,
    }: {
      title: string;
      actions?: ReactNode;
      children?: ReactNode;
    }) => (
      <>
        <Text testID={`section-${title}`}>{title}</Text>
        {actions}
        {children}
      </>
    ),
  };
});

jest.mock('../../../src/components/common/display/SummaryCard/SummaryCard', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: {
      title: string;
      isBranchingStory?: boolean;
      branchingStoryForkCount?: number;
      analysisSummary?: { issueCount: number };
    }) => (
      <Text testID="summary-card">
        {JSON.stringify({
          title: props.title,
          isBranching: props.isBranchingStory ?? false,
          forks: props.branchingStoryForkCount ?? null,
          analysisIssues: props.analysisSummary ? props.analysisSummary.issueCount : null,
        })}
      </Text>
    ),
  };
});

jest.mock(
  '../../../src/components/features/operation-log/OperationLogList/OperationLogList',
  () => {
    const { Text } = require('react-native');
    return {
      __esModule: true,
      default: ({ storyId, limit }: { storyId: string; limit: number }) => (
        <Text testID="oplog">{`oplog:${storyId}:${limit}`}</Text>
      ),
    };
  },
);

jest.mock('../../../src/components/features/sync/SyncConflictBanner/SyncConflictBanner', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ count, onPress }: { count: number; onPress: () => void }) => (
      <Text testID="conflict-banner" onPress={onPress}>
        {`banner:${count}`}
      </Text>
    ),
  };
});

jest.mock(
  '../../../src/components/features/sync/SyncConflictReviewSheet/SyncConflictReviewSheet',
  () => {
    const { Text } = require('react-native');
    return {
      __esModule: true,
      default: ({ visible, onClose }: { visible: boolean; onClose: () => void }) => (
        <>
          <Text testID="conflict-sheet">{visible ? 'sheet-open' : 'sheet-closed'}</Text>
          <Text testID="conflict-sheet-close" onPress={onClose}>
            close
          </Text>
        </>
      ),
    };
  },
);

const t = ((key: string) => key) as unknown as TFunction;

function makeStory(overrides: Partial<Story> = {}): Story {
  return {
    id: 'story-1',
    userId: 'user-1',
    title: 'My Story',
    type: 'linear',
    description: null,
    genre: null,
    language: null,
    author: null,
    isFavorite: false,
    favoriteBehavior: 'individual',
    extraNotes: null,
    theme: null,
    timelineEpochDay: null,
    timelineEpochSeconds: null,
    normalizeSceneTiming: false,
    allowReaderComments: false,
    completenessChecks: false,
    autoLinkMentions: false,
    statSystem: false,
    statNotation: 'letter',
    vocabulary: null,
    serverId: null,
    lastOperationLog: 0,
    lastServerSyncedLog: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    version: 1,
    isDeleted: false,
    deletedAt: null,
    ...overrides,
  };
}

const baseCounts = {
  characterCount: undefined,
  locationCount: undefined,
  chapterCount: undefined,
  sceneCount: undefined,
  choiceCount: undefined,
  noteCount: undefined,
  worldRuleCount: undefined,
  itemCount: undefined,
  galleryCount: undefined,
  tagCount: undefined,
  customAttributeCount: undefined,
  forkCount: undefined,
  analysisIssueCount: undefined,
};

function baseProps(overrides = {}) {
  return {
    story: makeStory(),
    t,
    conflictCount: 0,
    conflictSheetOpen: false,
    onOpenConflictSheet: jest.fn(),
    onCloseConflictSheet: jest.fn(),
    ...baseCounts,
    onOpenAnalysis: jest.fn(),
    onOpenOperationLog: jest.fn(),
    ...overrides,
  };
}

function summaryJson(view: { getByTestId: (id: string) => { props: { children: unknown } } }) {
  return JSON.parse(view.getByTestId('summary-card').props.children as string);
}

describe('MainDashboardContent', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the empty state without a story', async () => {
    const view = await render(<MainDashboardContent {...baseProps({ story: null })} />);
    expect(view.getByTestId('detail-title').props.children).toBe('no_story_selected');
    expect(view.queryByTestId('conflict-banner')).toBeNull();
    expect(view.queryByTestId('section-story_details_section')).toBeNull();
    expect(view.queryByTestId('oplog')).toBeNull();
    expect(summaryJson(view)).toMatchObject({ isBranching: false, analysisIssues: null });
    expect(view.getByTestId('conflict-sheet').props.children).toBe('sheet-closed');
  });

  it('renders identity fields and wires the conflict banner and operation log', async () => {
    const props = baseProps({
      story: makeStory({
        genre: 'Fantasy',
        author: 'Author',
        language: 'en',
        theme: 'ocean',
        description: 'Desc',
        extraNotes: 'Notes',
        serverId: 'server-1',
        lastServerSyncedLog: 42,
      }),
      conflictCount: 3,
    });
    const view = await render(<MainDashboardContent {...props} />);
    expect(view.getByText('My Story')).toBeTruthy();
    expect(view.getByText('Fantasy')).toBeTruthy();
    expect(view.getByText('Author')).toBeTruthy();
    expect(view.getByText('language_english')).toBeTruthy();
    expect(view.getByText('theme_ocean_label')).toBeTruthy();
    expect(view.getByText('Desc')).toBeTruthy();
    expect(view.getByText('Notes')).toBeTruthy();
    expect(view.getByText('42')).toBeTruthy();
    expect(view.getByTestId('conflict-banner').props.children).toBe('banner:3');
    await fireEvent.press(view.getByTestId('conflict-banner'));
    expect(props.onOpenConflictSheet).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('oplog').props.children).toBe('oplog:story-1:5');
    await fireEvent.press(view.getByLabelText('view_all_operations'));
    expect(props.onOpenOperationLog).toHaveBeenCalledTimes(1);
  });

  it('labels branching and linear stories', async () => {
    const branching = await render(
      <MainDashboardContent {...baseProps({ story: makeStory({ type: 'branching' }) })} />,
    );
    expect(branching.getByText('branching')).toBeTruthy();
    expect(summaryJson(branching).isBranching).toBe(true);
    const linear = await render(<MainDashboardContent {...baseProps()} />);
    expect(linear.getByText('linear')).toBeTruthy();
  });

  it('falls back for missing and unknown themes', async () => {
    const missing = await render(<MainDashboardContent {...baseProps()} />);
    expect(missing.getByText('theme_default_label')).toBeTruthy();
    const unknown = await render(
      <MainDashboardContent {...baseProps({ story: makeStory({ theme: 'bogus' }) })} />,
    );
    expect(unknown.getByText('theme_default_label')).toBeTruthy();
  });

  it('resolves the language label or echoes unknown codes', async () => {
    const unknown = await render(
      <MainDashboardContent {...baseProps({ story: makeStory({ language: 'xx' }) })} />,
    );
    expect(unknown.getByText('xx')).toBeTruthy();
    const missing = await render(<MainDashboardContent {...baseProps()} />);
    expect(missing.queryByText('language_english')).toBeNull();
  });

  it('hides blank optional fields', async () => {
    const view = await render(
      <MainDashboardContent
        {...baseProps({
          story: makeStory({ genre: '   ', author: '', description: '  ', extraNotes: null }),
        })}
      />,
    );
    expect(view.queryByTestId('section-story_details_section')).toBeTruthy();
    expect(view.queryByText('genre')).toBeNull();
    expect(view.queryByText('author')).toBeNull();
  });

  it('passes the analysis summary only with a story id and a defined count', async () => {
    const withCount = await render(
      <MainDashboardContent {...baseProps({ analysisIssueCount: 7, forkCount: 2 })} />,
    );
    expect(summaryJson(withCount)).toMatchObject({ analysisIssues: 7, forks: 2 });
    const withoutCount = await render(<MainDashboardContent {...baseProps()} />);
    expect(summaryJson(withoutCount).analysisIssues).toBeNull();
  });

  it('opens and closes the conflict review sheet', async () => {
    const props = baseProps({ conflictSheetOpen: true });
    const view = await render(<MainDashboardContent {...props} />);
    expect(view.getByTestId('conflict-sheet').props.children).toBe('sheet-open');
    await fireEvent.press(view.getByTestId('conflict-sheet-close'));
    expect(props.onCloseConflictSheet).toHaveBeenCalledTimes(1);
  });
});
