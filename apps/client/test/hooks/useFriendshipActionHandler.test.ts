/** @jest-environment node */
jest.mock('react-i18next', () => {
  const t = (key: string) => key;
  return { __esModule: true, useTranslation: () => ({ t }) };
});
jest.mock('../../src/state/notificationStore', () => ({
  __esModule: true,
  useNotificationStore: jest.fn(),
}));
jest.mock('../../src/utils/AppAlert', () => ({ __esModule: true, AppAlert: { alert: jest.fn() } }));

import { renderHook } from '@testing-library/react-native';
import { useFriendshipActionHandler } from '../../src/hooks/useFriendshipActionHandler';
import { useNotificationStore } from '../../src/state/notificationStore';
import { AppAlert } from '../../src/utils/AppAlert';

const showNotification = jest.fn();
const alert = (AppAlert as unknown as { alert: jest.Mock }).alert;

async function openAction(
  getServer = jest.fn(() => ({ idUser: 'current-user' })),
  action = jest.fn(async () => undefined),
) {
  const onSuccess = jest.fn();
  const { result } = await renderHook(() =>
    useFriendshipActionHandler(getServer as never, onSuccess),
  );
  result.current(
    action,
    'Confirmar',
    'Tem certeza?',
    'Concluído',
    'Falhou',
  )('friendship-1', 'server-1');
  const buttons = alert.mock.calls[0][2] as { style?: string; onPress?: () => Promise<void> }[];
  return { action, buttons, getServer, onSuccess };
}

beforeEach(() => {
  jest.clearAllMocks();
  (useNotificationStore as unknown as jest.Mock).mockReturnValue({ showNotification });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

it('asks for confirmation, performs the transition, and refreshes on success', async () => {
  const { action, buttons, getServer, onSuccess } = await openAction();

  await buttons.find((button) => !button.style)?.onPress?.();

  expect(getServer).toHaveBeenCalledWith('server-1');
  expect(action).toHaveBeenCalledWith('friendship-1', 'current-user');
  expect(showNotification).toHaveBeenCalledWith('Concluído', 'success');
  expect(onSuccess).toHaveBeenCalledTimes(1);
});

it('does not call the API when the user is no longer logged into that server', async () => {
  const { action, buttons } = await openAction(jest.fn(() => undefined) as never);

  await buttons.find((button) => !button.style)?.onPress?.();

  expect(action).not.toHaveBeenCalled();
  expect(showNotification).toHaveBeenCalledWith('not_logged_in_to_server', 'error');
});

it('reports action failures without refreshing the friendship list', async () => {
  const failingAction = jest.fn(async () => {
    throw new Error('offline');
  });
  const { buttons, onSuccess } = await openAction(undefined, failingAction);

  await buttons.find((button) => !button.style)?.onPress?.();

  expect(showNotification).toHaveBeenCalledWith('Falhou', 'error');
  expect(onSuccess).not.toHaveBeenCalled();
});
