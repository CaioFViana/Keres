const mockNavigate = jest.fn();
let mockCanManage = true;
let mockRoleLoading = false;
const mockExportJson = jest.fn();
const mockExportZip = jest.fn();
let mockExporting = false;
let mockServerless = false;
const mockBackupArgs = jest.fn();

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
jest.mock('@expo/vector-icons', () => ({ __esModule: true, Ionicons: () => null }));
jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => ({ navigate: (...args: unknown[]) => mockNavigate(...args) }),
}));
jest.mock('../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      surface: '#fff',
      background: '#fff',
      card: '#fff',
      border: '#ddd',
      text: '#111',
      textSecondary: '#666',
      primary: '#00f',
      onPrimary: '#fff',
      error: '#f00',
    },
  }),
}));
jest.mock('../../../src/theme/commonStyles', () => ({
  __esModule: true,
  commonScreenStyleDefs: () => ({ container: {} }),
}));
jest.mock('../../../src/components/layout/ScreenSection/ScreenSection', () => {
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ title }: { title: string }) => <Text>{title}</Text> };
});
jest.mock('../../../src/hooks/useScreenHeader', () => ({ useScreenHeader: () => {} }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({ useBackButtonHandler: () => {} }));
jest.mock('../../../src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canManageStoryPolicy: mockCanManage, loading: mockRoleLoading }),
}));
jest.mock('../../../src/hooks/useStoryBackupExport', () => ({
  useStoryBackupExport: (story: unknown) => {
    mockBackupArgs(story);
    return { exporting: mockExporting, exportJson: mockExportJson, exportZip: mockExportZip };
  },
}));
jest.mock('../../../src/state/storyStore', () => ({
  useStoryStore: (selector: (state: unknown) => unknown) =>
    selector({ selectedStory: { id: 'story-1', title: 'Epic' } }),
}));
jest.mock('../../../src/utils/clientFlavor', () => ({
  __esModule: true,
  isServerless: () => mockServerless,
}));

import { cleanup, fireEvent, render } from '@testing-library/react-native';
import StoryShareIndexScreen from '../../../src/screens/storyshare/StoryShareIndexScreen';

beforeEach(() => {
  jest.clearAllMocks();
  mockExporting = false;
  mockServerless = false;
  mockCanManage = true;
  mockRoleLoading = false;
});
afterEach(() => cleanup());

describe('StoryShareIndexScreen', () => {
  it('opens the publishing screen', async () => {
    const view = await render(<StoryShareIndexScreen />);

    await fireEvent.press(view.getByTestId('story-share-publish'));

    expect(mockNavigate).toHaveBeenCalledWith('StoryPublish');
  });

  it('opens the manuscript export inside this stack, so back returns here', async () => {
    const view = await render(<StoryShareIndexScreen />);

    await fireEvent.press(view.getByTestId('story-share-manuscript'));

    expect(mockNavigate).toHaveBeenCalledWith('ManuscriptExport');
  });

  it('makes the copy of the open story as data or with media', async () => {
    const view = await render(<StoryShareIndexScreen />);

    expect(mockBackupArgs).toHaveBeenCalledWith({ id: 'story-1', title: 'Epic' });
    await fireEvent.press(view.getByTestId('story-share-backup-json'));
    await fireEvent.press(view.getByTestId('story-share-backup-zip'));

    expect(mockExportJson).toHaveBeenCalledTimes(1);
    expect(mockExportZip).toHaveBeenCalledTimes(1);
  });

  it('does not offer a second copy while one is being made', async () => {
    mockExporting = true;
    const view = await render(<StoryShareIndexScreen />);

    await fireEvent.press(view.getByTestId('story-share-backup-json'));

    expect(mockExportJson).not.toHaveBeenCalled();
    expect(view.getByText('export_story_in_progress')).toBeTruthy();
  });

  it('does not open publishing for someone who is not the owner, and says why', async () => {
    mockCanManage = false;
    const view = await render(<StoryShareIndexScreen />);

    await fireEvent.press(view.getByTestId('story-share-publish'));

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(view.getByText('story_share_publish_owner_only')).toBeTruthy();
    expect(view.getByTestId('story-share-backup-json')).toBeTruthy();
  });

  it('does not lock publishing while the role is still being read', async () => {
    mockCanManage = false;
    mockRoleLoading = true;
    const view = await render(<StoryShareIndexScreen />);

    await fireEvent.press(view.getByTestId('story-share-publish'));

    expect(mockNavigate).toHaveBeenCalledWith('StoryPublish');
  });

  it('has no publishing in a build without a server', async () => {
    mockServerless = true;
    const view = await render(<StoryShareIndexScreen />);

    expect(view.queryByTestId('story-share-publish')).toBeNull();
    expect(view.getByTestId('story-share-manuscript')).toBeTruthy();
  });
});
