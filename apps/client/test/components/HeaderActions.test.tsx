/** @jest-environment node */
import { fireEvent, render } from '@testing-library/react-native';
import HeaderActions from '../../src/components/common/navigation/HeaderActions/HeaderActions';
import { useResponsiveLayout } from '../../src/hooks/useResponsiveLayout';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: { text: '#111', primary: '#00f', surface: '#eee', border: '#ddd' },
  }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../../src/hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: jest.fn(() => ({
    width: 1400,
    height: 900,
    breakpoint: 'wide',
    isCompact: false,
    isMedium: false,
    isWide: true,
  })),
}));

const mockLayout = useResponsiveLayout as jest.Mock;
const COMPACT = {
  width: 390,
  height: 844,
  breakpoint: 'compact',
  isCompact: true,
  isMedium: false,
  isWide: false,
};
const WIDE = {
  width: 1400,
  height: 900,
  breakpoint: 'wide',
  isCompact: false,
  isMedium: false,
  isWide: true,
};

beforeEach(() => {
  mockLayout.mockReturnValue(WIDE);
});

function iconOf(button: { props: { children?: unknown } }): Record<string, unknown> {
  const children = button.props.children;
  const icon = Array.isArray(children) ? children[0] : children;
  return (icon as { props: Record<string, unknown> }).props;
}

it('hides unavailable actions and prevents disabled or busy actions from firing', async () => {
  const onPress = jest.fn();
  const screen = await render(
    <HeaderActions
      actions={[
        { id: 'hidden', icon: 'add', label: 'Hidden', visible: false, onPress },
        { id: 'disabled', icon: 'add', label: 'Disabled', disabled: true, onPress },
        { id: 'busy', icon: 'add', label: 'Busy', busy: true, onPress },
        { id: 'edit', icon: 'pencil-outline', label: 'Edit', onPress },
      ]}
    />,
  );
  expect(screen.queryByLabelText('Hidden')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Disabled'));
  await fireEvent.press(screen.getByLabelText('Busy'));
  expect(onPress).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText('Edit'));
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('tints active actions with the primary color', async () => {
  const screen = await render(
    <HeaderActions
      actions={[
        { id: 'off', icon: 'eye-outline', label: 'Off', active: false, onPress: jest.fn() },
        { id: 'on', icon: 'eye', label: 'On', active: true, onPress: jest.fn() },
      ]}
    />,
  );

  expect(iconOf(screen.getByLabelText('Off')).color).toBe('#111');
  expect(iconOf(screen.getByLabelText('On')).color).toBe('#00f');
});

it('collapses multiple actions into a burger menu on compact screens', async () => {
  mockLayout.mockReturnValue(COMPACT);
  const onEdit = jest.fn();
  const onShare = jest.fn();
  const screen = await render(
    <HeaderActions
      actions={[
        { id: 'edit', icon: 'pencil-outline', label: 'Edit', onPress: onEdit },
        { id: 'share', icon: 'share-outline', label: 'Share', onPress: onShare },
      ]}
    />,
  );

  expect(screen.getByTestId('header-actions-menu')).toBeTruthy();
  expect(screen.queryByText('Edit')).toBeNull();
  expect(screen.queryByText('Share')).toBeNull();

  await fireEvent.press(screen.getByTestId('header-actions-menu'));
  expect(screen.getByText('Edit')).toBeTruthy();
  expect(screen.getByText('Share')).toBeTruthy();

  await fireEvent.press(screen.getByText('Share'));
  expect(onShare).toHaveBeenCalledTimes(1);
  expect(onEdit).not.toHaveBeenCalled();
  // Selecting closes the menu again.
  expect(screen.queryByText('Edit')).toBeNull();
});

it('ignores disabled and busy rows in the compact menu', async () => {
  mockLayout.mockReturnValue(COMPACT);
  const onPress = jest.fn();
  const screen = await render(
    <HeaderActions
      actions={[
        { id: 'disabled', icon: 'add', label: 'Disabled', disabled: true, onPress },
        { id: 'busy', icon: 'add', label: 'Busy', busy: true, onPress },
      ]}
    />,
  );

  await fireEvent.press(screen.getByTestId('header-actions-menu'));
  await fireEvent.press(screen.getByText('Disabled'));
  await fireEvent.press(screen.getByText('Busy'));
  expect(onPress).not.toHaveBeenCalled();
});

it('closes the compact menu from the backdrop without firing', async () => {
  mockLayout.mockReturnValue(COMPACT);
  const onPress = jest.fn();
  const screen = await render(
    <HeaderActions
      actions={[
        { id: 'edit', icon: 'pencil-outline', label: 'Edit', onPress },
        { id: 'share', icon: 'share-outline', label: 'Share', onPress },
      ]}
    />,
  );

  await fireEvent.press(screen.getByTestId('header-actions-menu'));
  expect(screen.getByText('Edit')).toBeTruthy();

  await fireEvent.press(screen.getByTestId('header-actions-menu-backdrop'));
  expect(screen.queryByText('Edit')).toBeNull();
  expect(onPress).not.toHaveBeenCalled();
});

it('keeps a single action inline on compact screens, with no burger', async () => {
  mockLayout.mockReturnValue(COMPACT);
  const onPress = jest.fn();
  const screen = await render(
    <HeaderActions
      actions={[
        { id: 'hidden', icon: 'add', label: 'Hidden', visible: false, onPress },
        { id: 'edit', icon: 'pencil-outline', label: 'Edit', onPress },
      ]}
    />,
  );

  expect(screen.queryByTestId('header-actions-menu')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Edit'));
  expect(onPress).toHaveBeenCalledTimes(1);
});
