import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import StoryCollaborationSection from '../../src/components/features/story/StoryCollaborationSection/StoryCollaborationSection';
import StoryFieldsForm from '../../src/components/features/story/StoryFieldsForm/StoryFieldsForm';

jest.mock('../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#fff',
      error: '#f00',
      onPrimary: '#fff',
      onPrimaryContainer: '#001',
      primary: '#00f',
      primaryContainer: '#dde',
      surface: '#eee',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
  // `utils/i18n.ts` calls `i18n.use(initReactI18next)`; without the export the
  // module crashes with "undefined module" (StoryFieldsForm pulls it in).
  initReactI18next: { type: '3rdParty', init: jest.fn() },
}));

jest.mock('@expo/vector-icons', () => {
  const ReactActual = require('react');
  const { Text } = jest.requireActual('react-native');
  return {
    Ionicons: ({ name }: { name: string }) =>
      ReactActual.createElement(Text, { testID: `icon-${name}` }, name),
  };
});

jest.mock('../../src/hooks/useResponsiveLayout', () => ({
  __esModule: true,
  useResponsiveLayout: () => ({ isCompact: true, isMedium: false, isWide: false }),
}));

jest.mock('../../src/components/common', () => {
  const ReactActual = require('react');
  const { Text, View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    Button: ({
      children,
      onPress,
      disabled,
    }: {
      children: React.ReactNode;
      onPress: () => void;
      disabled?: boolean;
    }) =>
      ReactActual.createElement(
        Text,
        { testID: `button-${String(children)}`, onPress, disabled },
        children,
      ),
    SingleSelectPill: (props: Record<string, any>) =>
      ReactActual.createElement(View, {
        testID: `pill-${String(props.placeholder ?? 'plain')}`,
        ...props,
      }),
  };
});

jest.mock('../../src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    SingleSelectPill: (props: Record<string, any>) =>
      ReactActual.createElement(View, {
        testID: `pill-${String(props.placeholder ?? 'plain')}`,
        ...props,
      }),
  };
});

jest.mock('../../src/components/common/inputs/TextInput/TextInput', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, any>) =>
      ReactActual.createElement(View, {
        testID: `input-${String(props.placeholder ?? 'plain')}`,
        ...props,
      }),
  };
});

jest.mock('../../src/components/common/controls/ThemedSwitch/ThemedSwitch', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) =>
      ReactActual.createElement(View, { testID: 'themed-switch', ...props }),
  };
});

let mockCollaboration: any = null;
jest.mock('../../src/hooks/useStoryServerCollaboration', () => ({
  __esModule: true,
  useStoryServerCollaboration: (...args: unknown[]) => {
    (mockCollaborationCalls as unknown[]).push(args);
    return mockCollaboration;
  },
}));
const mockCollaborationCalls: unknown[][] = [];

const collaborationState = (overrides = {}) => ({
  serverId: null,
  linkedServer: null,
  uploadTargetServerId: null,
  setUploadTargetServerId: jest.fn(),
  isOwnerOnServer: false,
  collaborators: null,
  serverActionLoading: false,
  addableFriends: [],
  selectedFriendId: null,
  setSelectedFriendId: jest.fn(),
  selectedPermissionType: 'reader',
  setSelectedPermissionType: jest.fn(),
  handleSendToServer: jest.fn(),
  handleAddCollaborator: jest.fn(),
  handleUpdateCollaboratorPermission: jest.fn(),
  handleRemoveCollaborator: jest.fn(),
  handleUnlinkFromServer: jest.fn(),
  uploadServerOptions: [],
  addableFriendOptions: [],
  ...overrides,
});

const linkedOwner = (overrides = {}) =>
  collaborationState({
    serverId: 'server-1',
    linkedServer: { id: 'server-1', name: 'Home' },
    isOwnerOnServer: true,
    collaborators: [],
    ...overrides,
  });

const collaborator = (overrides = {}) => ({
  id: 'col-1',
  userId: 'user-2',
  permissionType: 'reader',
  user: { username: 'bob' },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCollaborationCalls.length = 0;
  mockCollaboration = collaborationState();
});

describe('StoryCollaborationSection', () => {
  const sectionProps = () => ({
    storyId: 'story-1',
    allowReaderComments: false,
    onAllowReaderCommentsChange: jest.fn(),
    canManageStoryPolicy: true,
  });

  it('scopes the collaboration to the story it is given', async () => {
    await render(<StoryCollaborationSection {...sectionProps()} />);

    expect(mockCollaborationCalls[0]).toEqual(['story-1']);
  });

  it('says so when there is no server to send the story to', async () => {
    const screen = await render(<StoryCollaborationSection {...sectionProps()} />);

    expect(screen.getByText('no_registered_servers')).toBeTruthy();
  });

  it('sends the story to the chosen server', async () => {
    mockCollaboration = collaborationState({
      uploadServerOptions: [{ label: 'Home', value: 'server-1' }],
    });
    const screen = await render(<StoryCollaborationSection {...sectionProps()} />);

    expect(screen.getByText('send_to_server_description')).toBeTruthy();
    const send = () => screen.getByTestId('button-send_to_server');
    expect(send().props.disabled).toBe(true);

    mockCollaboration.uploadTargetServerId = 'server-1';
    await screen.rerender(<StoryCollaborationSection {...sectionProps()} />);
    expect(send().props.disabled).toBe(false);

    await fireEvent.press(send());
    expect(mockCollaboration.handleSendToServer).toHaveBeenCalledTimes(1);
  });

  it('changes the upload target from the picker', async () => {
    mockCollaboration = collaborationState({
      uploadServerOptions: [{ label: 'Home', value: 'server-1' }],
    });
    const screen = await render(<StoryCollaborationSection {...sectionProps()} />);

    await act(async () => {
      screen.getByTestId('pill-select_server').props.onValueChange('server-1');
    });

    expect(mockCollaboration.setUploadTargetServerId).toHaveBeenCalledWith('server-1');
  });

  it('shows the linked server, falling back to its id', async () => {
    mockCollaboration = linkedOwner();
    const named = await render(<StoryCollaborationSection {...sectionProps()} />);
    expect(named.getByText('Home')).toBeTruthy();

    mockCollaboration = linkedOwner({ linkedServer: { id: 'server-1', name: null } });
    const unnamed = await render(<StoryCollaborationSection {...sectionProps()} />);
    expect(unnamed.getByText('server-1')).toBeTruthy();
  });

  it('lets the owner toggle reader comments, unless the policy is locked', async () => {
    mockCollaboration = linkedOwner();
    const props = sectionProps();
    const screen = await render(<StoryCollaborationSection {...props} />);

    expect(screen.getByText('allow_reader_comments')).toBeTruthy();
    const toggle = screen.getByTestId('themed-switch');
    expect(toggle.props.value).toBe(false);
    expect(toggle.props.disabled).toBe(false);

    await act(async () => {
      toggle.props.onValueChange(true);
    });
    expect(props.onAllowReaderCommentsChange).toHaveBeenCalledWith(true);

    const locked = await render(
      <StoryCollaborationSection {...props} canManageStoryPolicy={false} />,
    );
    expect(locked.getByTestId('themed-switch').props.disabled).toBe(true);
  });

  it('hides the policy and the collaborators from non-owners', async () => {
    mockCollaboration = linkedOwner({ isOwnerOnServer: false });
    const screen = await render(<StoryCollaborationSection {...sectionProps()} />);

    expect(screen.queryByText('allow_reader_comments')).toBeNull();
    expect(screen.queryByText('collaborators_title')).toBeNull();
  });

  it('says so when there is nobody left to add', async () => {
    mockCollaboration = linkedOwner();
    const screen = await render(<StoryCollaborationSection {...sectionProps()} />);

    expect(screen.getByText('collaborators_title')).toBeTruthy();
    expect(screen.getByText('no_addable_friends')).toBeTruthy();
    expect(screen.getByText('no_collaborators')).toBeTruthy();
  });

  it('adds the chosen friend with the chosen permission', async () => {
    mockCollaboration = linkedOwner({
      addableFriendOptions: [{ label: 'bob', value: 'user-2' }],
      selectedFriendId: 'user-2',
    });
    const screen = await render(<StoryCollaborationSection {...sectionProps()} />);

    expect(screen.getByTestId('button-add').props.disabled).toBe(false);

    await act(async () => {
      screen.getByTestId('pill-select_permission_type').props.onValueChange('writer');
    });
    expect(mockCollaboration.setSelectedPermissionType).toHaveBeenCalledWith('writer');

    await fireEvent.press(screen.getByTestId('button-add'));
    expect(mockCollaboration.handleAddCollaborator).toHaveBeenCalledTimes(1);
  });

  it('refuses to add without a friend', async () => {
    mockCollaboration = linkedOwner({
      addableFriendOptions: [{ label: 'bob', value: 'user-2' }],
    });
    const screen = await render(<StoryCollaborationSection {...sectionProps()} />);

    expect(screen.getByTestId('button-add').props.disabled).toBe(true);
  });

  it('lists the collaborators with their permission, and removes them', async () => {
    mockCollaboration = linkedOwner({
      collaborators: [collaborator(), collaborator({ id: 'col-2', userId: 'user-9', user: null })],
    });
    const screen = await render(<StoryCollaborationSection {...sectionProps()} />);

    expect(screen.getByText('bob')).toBeTruthy();
    expect(screen.getByText('user-9')).toBeTruthy();

    // Row pills carry no placeholder (only the add-form pill does), so they render plain.
    const permissionPills = screen.getAllByTestId('pill-plain');
    // The add form is hidden without addable friends, so every plain pill is a row.
    expect(permissionPills).toHaveLength(2);
    expect(permissionPills.map((pill) => pill.props.value)).toEqual(['reader', 'reader']);
    await act(async () => {
      permissionPills[0].props.onValueChange('writer');
    });
    expect(mockCollaboration.handleUpdateCollaboratorPermission).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'col-1' }),
      'writer',
    );

    await act(async () => {
      permissionPills[0].props.onValueChange('owner');
    });
    expect(mockCollaboration.handleUpdateCollaboratorPermission).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getAllByLabelText('remove')[0]);
    expect(mockCollaboration.handleRemoveCollaborator).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'col-1' }),
    );
  });

  it('blocks unlinking while collaborators remain, and frees it once empty', async () => {
    mockCollaboration = linkedOwner({ collaborators: [collaborator()] });
    const blocked = await render(<StoryCollaborationSection {...sectionProps()} />);

    expect(blocked.getByText('unlink_blocked_by_collaborators')).toBeTruthy();
    expect(blocked.getByTestId('button-unlink_from_server_title').props.disabled).toBe(true);

    mockCollaboration = linkedOwner({ collaborators: [] });
    const free = await render(<StoryCollaborationSection {...sectionProps()} />);
    const unlink = free.getByTestId('button-unlink_from_server_title');
    expect(unlink.props.disabled).toBe(false);

    await fireEvent.press(unlink);
    expect(mockCollaboration.handleUnlinkFromServer).toHaveBeenCalledTimes(1);
  });

  it('blocks unlinking while loading or before the list arrives', async () => {
    mockCollaboration = linkedOwner({ collaborators: null });
    const pending = await render(<StoryCollaborationSection {...sectionProps()} />);
    expect(pending.getByTestId('button-unlink_from_server_title').props.disabled).toBe(true);

    mockCollaboration = linkedOwner({ collaborators: [], serverActionLoading: true });
    const loading = await render(<StoryCollaborationSection {...sectionProps()} />);
    expect(loading.getByTestId('button-unlink_from_server_title').props.disabled).toBe(true);
  });
});

describe('StoryFieldsForm', () => {
  const formProps = () => ({
    title: 'My story',
    onTitleChange: jest.fn(),
    type: 'linear' as const,
    onTypeChange: jest.fn(),
    description: null as string | null,
    onDescriptionChange: jest.fn(),
    genre: null as string | null,
    onGenreChange: jest.fn(),
    author: null as string | null,
    onAuthorChange: jest.fn(),
    language: null as string | null,
    onLanguageChange: jest.fn(),
    isFavorite: false,
    onIsFavoriteChange: jest.fn(),
    favoriteBehavior: 'global' as const,
    onFavoriteBehaviorChange: jest.fn(),
    extraNotes: null as string | null,
    onExtraNotesChange: jest.fn(),
  });

  it('edits every core field', async () => {
    const props = formProps();
    const screen = await render(<StoryFieldsForm {...props} />);

    expect(screen.getByTestId('input-title_placeholder').props.value).toBe('My story');
    expect(screen.getByTestId('input-description_placeholder').props.value).toBe('');
    await act(async () => {
      screen.getByTestId('input-title_placeholder').props.onChangeText('Renamed');
      screen.getByTestId('input-genre_placeholder').props.onChangeText('Fantasy');
      screen.getByTestId('input-author_placeholder').props.onChangeText('Ada');
      screen.getByTestId('input-extra_notes_placeholder').props.onChangeText('Notes');
    });
    expect(props.onTitleChange).toHaveBeenCalledWith('Renamed');
    expect(props.onGenreChange).toHaveBeenCalledWith('Fantasy');
    expect(props.onAuthorChange).toHaveBeenCalledWith('Ada');
    expect(props.onExtraNotesChange).toHaveBeenCalledWith('Notes');
  });

  it('switches the story type and the language', async () => {
    const props = formProps();
    const screen = await render(<StoryFieldsForm {...props} />);

    expect(screen.getByTestId('pill-select_story_type').props.options).toEqual([
      { label: 'linear', value: 'linear' },
      { label: 'branching', value: 'branching' },
    ]);
    await act(async () => {
      screen.getByTestId('pill-select_story_type').props.onValueChange('branching');
    });
    expect(props.onTypeChange).toHaveBeenCalledWith('branching');

    expect(screen.getByTestId('pill-select_language').props.options).toEqual([
      { label: 'language_english', value: 'en' },
      { label: 'language_portuguese', value: 'pt' },
    ]);
    await act(async () => {
      screen.getByTestId('pill-select_language').props.onValueChange('pt');
    });
    expect(props.onLanguageChange).toHaveBeenCalledWith('pt');
  });

  it('toggles the favorite and picks its behavior, with the matching help', async () => {
    const props = formProps();
    const screen = await render(<StoryFieldsForm {...props} />);

    await act(async () => {
      screen.getByTestId('themed-switch').props.onValueChange(true);
    });
    expect(props.onIsFavoriteChange).toHaveBeenCalledWith(true);

    expect(screen.getByText('favorite_behavior_global_description')).toBeTruthy();
    await act(async () => {
      screen.getByTestId('pill-favorite_behavior').props.onValueChange('individual');
    });
    expect(props.onFavoriteBehaviorChange).toHaveBeenCalledWith('individual');
  });

  it('hides the favorite policy when another screen owns it', async () => {
    const screen = await render(<StoryFieldsForm {...formProps()} showFavoriteBehavior={false} />);

    expect(screen.queryByTestId('pill-favorite_behavior')).toBeNull();
    expect(screen.queryByText('favorite_behavior_global_description')).toBeNull();
  });

  it('locks the owner policies independently', async () => {
    const screen = await render(
      <StoryFieldsForm {...formProps()} typeDisabled favoriteBehaviorDisabled />,
    );

    expect(screen.getByTestId('pill-select_story_type').props.disabled).toBe(true);
    expect(screen.getByTestId('pill-favorite_behavior').props.disabled).toBe(true);
    expect(screen.getByTestId('pill-select_language').props.disabled).toBe(false);
  });

  it('locks everything on a read-only screen', async () => {
    const screen = await render(<StoryFieldsForm {...formProps()} editable={false} />);

    expect(screen.getByTestId('input-title_placeholder').props.editable).toBe(false);
    expect(screen.getByTestId('pill-select_story_type').props.disabled).toBe(true);
    expect(screen.getByTestId('pill-select_language').props.disabled).toBe(true);
    expect(screen.getByTestId('pill-favorite_behavior').props.disabled).toBe(true);
    expect(screen.getByTestId('themed-switch').props.disabled).toBe(true);
  });
});
