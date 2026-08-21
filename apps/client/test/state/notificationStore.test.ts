/**
 * @jest-environment node
 */
import { useNotificationStore } from '../../src/state/notificationStore';

const store = () => useNotificationStore.getState();
const lanes = () => store().currentNotifications;
const queue = () => store().queue;
const messages = () => lanes().map((notification) => notification?.message ?? null);

beforeEach(() => {
  store().clearAll();
});

/**
 * A sincronização roda em timer, então uma falha persistente reaparece a cada ciclo. As três
 * faixas com fila e a supressão de duplicatas existem para o usuário não ser soterrado pela
 * mesma mensagem - e para nenhuma mensagem se perder no caminho.
 */
describe('showNotification', () => {
  it('puts the first notification in the first free lane', () => {
    store().showNotification('Salvo', 'success');

    expect(messages()).toEqual(['Salvo', null, null]);
    expect(lanes()[0]).toMatchObject({ message: 'Salvo', type: 'success' });
  });

  it('defaults to the neutral type', () => {
    store().showNotification('Aviso');

    expect(lanes()[0]!.type).toBe('info');
  });

  it('gives every notification its own id', () => {
    store().showNotification('Primeira');
    store().showNotification('Segunda');

    expect(lanes()[0]!.id).not.toBe(lanes()[1]!.id);
  });

  it('fills the three lanes before queueing', () => {
    store().showNotification('Uma');
    store().showNotification('Duas');
    store().showNotification('Três');

    expect(messages()).toEqual(['Uma', 'Duas', 'Três']);
    expect(queue()).toEqual([]);
  });

  it('queues what does not fit on screen', () => {
    for (const message of ['Uma', 'Duas', 'Três', 'Quatro']) {
      store().showNotification(message);
    }

    expect(queue().map((notification) => notification.message)).toEqual(['Quatro']);
  });

  it('ignores a message already on screen', () => {
    store().showNotification('Servidor inalcançável', 'warning');
    store().showNotification('Servidor inalcançável', 'warning');

    expect(messages()).toEqual(['Servidor inalcançável', null, null]);
  });

  it('ignores a message already waiting in the queue', () => {
    for (const message of ['Uma', 'Duas', 'Três']) {
      store().showNotification(message);
    }
    store().showNotification('Quatro');
    store().showNotification('Quatro');

    expect(queue()).toHaveLength(1);
  });

  it('treats the same text with a different type as a different notification', () => {
    store().showNotification('Sincronizado', 'info');
    store().showNotification('Sincronizado', 'error');

    expect(lanes().filter(Boolean)).toHaveLength(2);
  });

  it('allows the same message again once it left the screen', () => {
    store().showNotification('Servidor inalcançável', 'warning');
    store().clearNotificationLane(0);

    store().showNotification('Servidor inalcançável', 'warning');

    expect(messages()[0]).toBe('Servidor inalcançável');
  });
});

describe('clearNotificationLane', () => {
  it('empties the lane when nothing is waiting', () => {
    store().showNotification('Uma');

    store().clearNotificationLane(0);

    expect(messages()).toEqual([null, null, null]);
  });

  it('pulls the next queued notification into the freed lane', () => {
    for (const message of ['Uma', 'Duas', 'Três', 'Quatro']) {
      store().showNotification(message);
    }

    store().clearNotificationLane(1);

    expect(messages()).toEqual(['Uma', 'Quatro', 'Três']);
    expect(queue()).toEqual([]);
  });

  it('drains the queue in the order it was filled', () => {
    for (const message of ['Uma', 'Duas', 'Três', 'Quatro', 'Cinco']) {
      store().showNotification(message);
    }

    store().clearNotificationLane(0);
    store().clearNotificationLane(0);

    expect(messages()).toEqual(['Cinco', 'Duas', 'Três']);
  });

  it('leaves the other lanes untouched', () => {
    store().showNotification('Uma');
    store().showNotification('Duas');

    store().clearNotificationLane(0);

    expect(messages()[1]).toBe('Duas');
  });

  it('is safe to clear a lane that is already empty', () => {
    expect(() => store().clearNotificationLane(2)).not.toThrow();
    expect(messages()).toEqual([null, null, null]);
  });
});

describe('clearAll', () => {
  it('empties both the lanes and the queue', () => {
    for (const message of ['Uma', 'Duas', 'Três', 'Quatro']) {
      store().showNotification(message);
    }

    store().clearAll();

    expect(messages()).toEqual([null, null, null]);
    expect(queue()).toEqual([]);
  });
});
