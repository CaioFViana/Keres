/**
 * @jest-environment node
 */
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../../src/utils/AppAlert', () => ({ __esModule: true, AppAlert: { alert: jest.fn() } }));

import { renderHook } from '@testing-library/react-native';
import { useConfirmDelete } from '../../src/hooks/useConfirmDelete';
import { AppAlert } from '../../src/utils/AppAlert';

const alert = (AppAlert as unknown as { alert: jest.Mock }).alert;

const OPTIONS = {
  titleKey: 'delete_tag_title',
  messageKey: 'delete_tag_message',
  successKey: 'tag_deleted',
  failureKey: 'failed_to_delete_tag',
};

/** It opens the dialog and returns the buttons it offered. */
async function openDialog(overrides: Record<string, unknown> = {}) {
  const { result } = await renderHook(() => useConfirmDelete());
  const onConfirm = jest.fn(async () => undefined);
  result.current({ ...OPTIONS, onConfirm, ...overrides } as never);

  const [title, message, buttons, options] = alert.mock.calls[0];
  return { title, message, buttons, options, onConfirm };
}

const pressDelete = async (buttons: any[]) => {
  await buttons.find((button) => button.style === 'destructive').onPress();
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('the confirmation dialog', () => {
  it('asks before deleting anything', async () => {
    const { title, message, onConfirm } = await openDialog();

    expect(title).toBe('delete_tag_title');
    expect(message).toBe('delete_tag_message');
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('prefers already-resolved copy when a screen supplies it', async () => {
    const { title, message } = await openDialog({
      title: 'Excluir Heroína',
      message: 'Tem certeza de que deseja excluir Heroína?',
    });

    expect(title).toBe('Excluir Heroína');
    expect(message).toBe('Tem certeza de que deseja excluir Heroína?');
  });

  it('offers a cancel and a destructive option, in that order', async () => {
    const { buttons } = await openDialog();

    expect(buttons.map((button: any) => button.style)).toEqual(['cancel', 'destructive']);
  });

  it('can be dismissed by tapping outside', async () => {
    const { options } = await openDialog();

    expect(options.cancelable).toBe(true);
  });

  it('does nothing when the user cancels', async () => {
    const { buttons, onConfirm } = await openDialog();

    expect(buttons[0].onPress).toBeUndefined();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('after confirming', () => {
  it('runs the delete', async () => {
    const { buttons, onConfirm } = await openDialog();

    await pressDelete(buttons);

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('tells the user it worked', async () => {
    const { buttons } = await openDialog();

    await pressDelete(buttons);

    expect(alert).toHaveBeenCalledWith('success', 'tag_deleted');
  });

  it('uses a resolved success message when one is given', async () => {
    const { buttons } = await openDialog({ successMessage: 'Heroína excluída com sucesso!' });

    await pressDelete(buttons);

    expect(alert).toHaveBeenCalledWith('success', 'Heroína excluída com sucesso!');
  });

  it('stays silent when the screen asked for no success message', async () => {
    const { buttons } = await openDialog({ successKey: undefined });

    await pressDelete(buttons);

    expect(alert).toHaveBeenCalledTimes(1);
  });

  it('reports a resolved failure message when one is given', async () => {
    const { buttons } = await openDialog({
      failureMessage: 'Falha ao excluir Heroína.',
      onConfirm: jest.fn(async () => {
        throw new Error('sem permissão');
      }),
    });

    await pressDelete(buttons);

    expect(alert).toHaveBeenCalledWith('error', 'Falha ao excluir Heroína.');
  });

  it('reports a failure with the key the screen chose', async () => {
    const { buttons } = await openDialog({
      onConfirm: jest.fn(async () => {
        throw new Error('sem permissão');
      }),
    });

    await pressDelete(buttons);

    expect(alert).toHaveBeenCalledWith('error', 'failed_to_delete_tag');
  });

  it('does not claim success when the delete failed', async () => {
    const { buttons } = await openDialog({
      onConfirm: jest.fn(async () => {
        throw new Error('sem permissão');
      }),
    });

    await pressDelete(buttons);

    expect(alert).not.toHaveBeenCalledWith('success', 'tag_deleted');
  });
});

describe('the loading signal', () => {
  it('raises and lowers around a successful delete', async () => {
    const onLoadingChange = jest.fn();
    const { buttons } = await openDialog({ onLoadingChange });

    await pressDelete(buttons);

    expect(onLoadingChange.mock.calls).toEqual([[true], [false]]);
  });

  /** A stuck spinner is what the user sees if the `finally` disappears from here. */
  it('lowers even when the delete fails', async () => {
    const onLoadingChange = jest.fn();
    const { buttons } = await openDialog({
      onLoadingChange,
      onConfirm: jest.fn(async () => {
        throw new Error('sem permissão');
      }),
    });

    await pressDelete(buttons);

    expect(onLoadingChange).toHaveBeenLastCalledWith(false);
  });

  it('is optional', async () => {
    const { buttons } = await openDialog({ onLoadingChange: undefined });

    await expect(pressDelete(buttons)).resolves.toBeUndefined();
  });
});
