import { fireEvent, render } from '@testing-library/react-native';
import StoryCollaborationSection from '../../src/components/features/story/StoryCollaborationSection/StoryCollaborationSection';

const mockLeave = jest.fn();
let mockCollaboration: Record<string, unknown> = {};

jest.mock('../../src/hooks/useStoryServerCollaboration', () => ({
  useStoryServerCollaboration: () => mockCollaboration,
}));
jest.mock('../../src/hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: () => ({ isCompact: false }),
}));
// The barrel pulls in half of the app: only the two controls the section draws are needed.
jest.mock('@/src/components/common', () => {
  const { Text, TouchableOpacity } = require('react-native');
  return {
    Button: ({ children, onPress, disabled, testID }: any) => (
      <TouchableOpacity testID={testID} disabled={disabled} onPress={onPress}>
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
    SingleSelectPill: () => null,
  };
});
jest.mock('@/src/components/common/controls/ThemedSwitch/ThemedSwitch', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      border: '#ddd',
      card: '#fff',
      surface: '#fff',
      text: '#111',
      textSecondary: '#555',
      primary: '#00f',
      primaryContainer: '#ccf',
      onPrimaryContainer: '#001',
      onPrimary: '#fff',
      error: '#f00',
      background: '#fff',
    },
  }),
}));

const base = {
  serverId: 'server-1',
  linkedServer: { id: 'server-1', name: 'Main' },
  uploadServerOptions: [],
  uploadTargetServerId: null,
  setUploadTargetServerId: jest.fn(),
  collaborators: null,
  pendingInvitations: [],
  serverActionLoading: false,
  addableFriendOptions: [],
  selectedFriendId: null,
  setSelectedFriendId: jest.fn(),
  selectedPermissionType: 'reader',
  setSelectedPermissionType: jest.fn(),
  handleLeaveStory: (...args: unknown[]) => mockLeave(...args),
};

const section = (onLeftStory?: () => void) => (
  <StoryCollaborationSection
    storyId="story-1"
    allowReaderComments={false}
    onAllowReaderCommentsChange={jest.fn()}
    canManageStoryPolicy={false}
    onLeftStory={onLeftStory}
  />
);

beforeEach(() => jest.clearAllMocks());

describe("the collaborator's way out of a story", () => {
  it("offers somebody else's story a leave button, which hands over what to do once they are out", async () => {
    mockCollaboration = { ...base, isOwnerOnServer: false };
    const onLeft = jest.fn();
    const view = await render(section(onLeft));

    expect(view.getByText('leave_story_hint')).toBeTruthy();
    await fireEvent.press(view.getByTestId('leave-story-button'));

    expect(mockLeave).toHaveBeenCalledWith(onLeft);
  });

  it('is off while another server action runs', async () => {
    mockCollaboration = { ...base, isOwnerOnServer: false, serverActionLoading: true };
    const view = await render(section());

    await fireEvent.press(view.getByTestId('leave-story-button'));

    expect(mockLeave).not.toHaveBeenCalled();
  });

  it('is not offered to the owner, nor before the role is known, nor to an unlinked story', async () => {
    mockCollaboration = { ...base, isOwnerOnServer: true, collaborators: [] };
    const owner = await render(section());
    expect(owner.queryByTestId('leave-story-zone')).toBeNull();
    owner.unmount();

    mockCollaboration = { ...base, isOwnerOnServer: null };
    const unknown = await render(section());
    expect(unknown.queryByTestId('leave-story-zone')).toBeNull();
    unknown.unmount();

    mockCollaboration = { ...base, serverId: null, linkedServer: null, isOwnerOnServer: false };
    const local = await render(section());
    expect(local.queryByTestId('leave-story-zone')).toBeNull();
  });
});
