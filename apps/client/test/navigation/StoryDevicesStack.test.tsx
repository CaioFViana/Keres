import { act, render } from '@testing-library/react-native';
import React from 'react';

const mockScreens: Array<Record<string, any>> = [];

jest.mock('@react-navigation/native-stack', () => ({
  __esModule: true,
  createNativeStackNavigator: () => ({
    Navigator: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Screen: (props: Record<string, any>) => {
      mockScreens.push(props);
      return typeof props.children === 'function' ? props.children() : null;
    },
  }),
}));
jest.mock('../../src/screens/help/HelpIndexScreen', () => ({
  __esModule: true,
  HelpIndexScreen: jest.fn(() => null),
}));
jest.mock('../../src/screens/help/HelpPageScreen', () => ({
  __esModule: true,
  HelpPageScreen: jest.fn(() => null),
}));
jest.mock('../../src/storyDevices/library', () => ({
  __esModule: true,
  storyDeviceLibrary: { id: 'test-library' },
}));

import StoryDevicesStackNavigator from '../../src/navigation/StoryDevicesStack';
import { HelpIndexScreen } from '../../src/screens/help/HelpIndexScreen';
import { HelpPageScreen } from '../../src/screens/help/HelpPageScreen';
import { storyDeviceLibrary } from '../../src/storyDevices/library';

beforeEach(() => {
  jest.clearAllMocks();
  mockScreens.length = 0;
});

it('renders the help screens against the story-device library', async () => {
  await render(<StoryDevicesStackNavigator />);

  expect(mockScreens.map((screen) => screen.name)).toEqual(['DeviceIndex', 'DevicePage']);
  expect(HelpIndexScreen).toHaveBeenCalledWith(
    expect.objectContaining({ library: storyDeviceLibrary, openSections: { start: true } }),
    undefined,
  );
  expect(HelpPageScreen).toHaveBeenCalledWith(
    expect.objectContaining({ library: storyDeviceLibrary }),
    undefined,
  );
});

it('shares collapsible-section state with the device index', async () => {
  await render(<StoryDevicesStackNavigator />);
  const { onOpenSectionsChange } = (HelpIndexScreen as jest.Mock).mock.calls[0][0];

  await act(async () => {
    onOpenSectionsChange({ start: true, devices: true });
  });

  const last = (HelpIndexScreen as jest.Mock).mock.calls.at(-1)[0];
  expect(last.openSections).toEqual({ start: true, devices: true });
});
