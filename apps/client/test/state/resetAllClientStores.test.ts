/**
 * @jest-environment node
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { useChapterStore } from '../../src/state/chapterStore';
import { useCharacterStore } from '../../src/state/characterStore';
import { useConnectivityStore } from '../../src/state/connectivityStore';
import { useNotificationStore } from '../../src/state/notificationStore';
import { useSyncConflictStore } from '../../src/state/syncConflictStore';
import { useTagStore } from '../../src/state/tagStore';
import { resetAllClientStores } from '../../src/state/resetAllClientStores';

/**
 * Chamado quando o banco local é recriado (troca de conta, reset do app). Qualquer store que
 * fique com dado da base antiga passa a mostrar entidades de uma história que não existe mais,
 * ou pior, tenta escrever nelas através de um handle de banco já fechado.
 */
describe('resetAllClientStores', () => {
  it('runs without a database configured', () => {
    expect(() => resetAllClientStores()).not.toThrow();
  });

  it('drops the db handle and rows of an entity store', () => {
    useCharacterStore.getState().setDbAndStoryId({} as never, 'story-1');
    useCharacterStore.setState({ characters: [{ id: 'char-1' }] } as never);

    resetAllClientStores();

    expect(useCharacterStore.getState()).toMatchObject({ db: null, storyId: null, service: null });
    expect(useCharacterStore.getState().characters).toEqual([]);
  });

  it.each([
    ['chapters', useChapterStore],
    ['tags', useTagStore],
  ])('resets the %s store too', (_label, store) => {
    store.getState().setDbAndStoryId({} as never, 'story-1');

    resetAllClientStores();

    expect(store.getState()).toMatchObject({ db: null, storyId: null });
  });

  it('clears the notifications, so nothing from the old session lingers', () => {
    useNotificationStore.getState().showNotification('Da sessão antiga');

    resetAllClientStores();

    expect(useNotificationStore.getState().currentNotifications).toEqual([null, null, null]);
  });

  it('forgets the connectivity of every server', () => {
    useConnectivityStore.getState().reportUnreachable('server-1');

    resetAllClientStores();

    expect(useConnectivityStore.getState().isOffline('server-1')).toBe(false);
  });

  it('clears the pending conflicts and what had been postponed', () => {
    useSyncConflictStore.setState({
      conflicts: [{ id: 'c1' }],
      postponedConflictIds: ['c1'],
    } as never);

    resetAllClientStores();

    expect(useSyncConflictStore.getState()).toMatchObject({
      conflicts: [],
      postponedConflictIds: [],
    });
  });

  it('is safe to call twice', () => {
    resetAllClientStores();

    expect(() => resetAllClientStores()).not.toThrow();
  });
});
