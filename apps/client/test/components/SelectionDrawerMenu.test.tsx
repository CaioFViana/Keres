import { cleanup, render } from '@testing-library/react-native';

let mockUnseenAdmin = false;
let mockUnseenMessages = false;
let mockServerless = false;
let mockGroupedProps: Record<string, unknown> = {};

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => mockTranslation,
}));
const mockT = (key: string) => key;
const mockTranslation = { t: mockT };
jest.mock('../../src/state/unseenMessagesStore', () => ({
  __esModule: true,
  useHasUnseenAdminMessages: () => mockUnseenAdmin,
  useHasUnseenMessages: () => mockUnseenMessages,
}));
jest.mock('../../src/utils/clientFlavor', () => ({
  __esModule: true,
  isServerless: () => mockServerless,
}));
jest.mock('../../src/components/common/navigation/GroupedDrawerMenu/GroupedDrawerMenu', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockGroupedProps = props;
    return null;
  },
}));

import SelectionDrawerMenu from '../../src/components/common/navigation/SelectionDrawerMenu/SelectionDrawerMenu';

const renderMenu = () =>
  render(
    <SelectionDrawerMenu
      state={{ routes: [], index: 0 } as never}
      navigation={{} as never}
      drawerId="story-selection"
    />,
  );

beforeEach(() => {
  mockUnseenAdmin = false;
  mockUnseenMessages = false;
  mockServerless = false;
  mockGroupedProps = {};
});
afterEach(() => cleanup());

describe('SelectionDrawerMenu', () => {
  it('marks the servers when their administrators wrote something unopened', async () => {
    mockUnseenAdmin = true;
    await renderMenu();

    expect(mockGroupedProps.badges).toEqual({
      ServerManagementDrawer: { kind: 'dot' },
      FriendshipDrawer: undefined,
    });
  });

  it('marks the friends when a message is unopened', async () => {
    mockUnseenMessages = true;
    await renderMenu();

    expect(mockGroupedProps.badges).toEqual({
      ServerManagementDrawer: undefined,
      FriendshipDrawer: { kind: 'dot' },
    });
  });

  it('has no server group in a serverless build', async () => {
    mockServerless = true;
    await renderMenu();

    expect((mockGroupedProps.groups as { id: string }[]).map((group) => group.id)).toEqual([
      'create',
    ]);
  });

  it('keeps its own record of the open groups', async () => {
    await renderMenu();

    expect(mockGroupedProps.storageKey).toBe('@keres/drawer-groups/story-selection');
  });
});
