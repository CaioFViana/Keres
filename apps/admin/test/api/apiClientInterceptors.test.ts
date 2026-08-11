import type { AxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient, clearToken, getToken, setToken } from '../../src/api/apiClient';

/**
 * Os interceptors são a única coisa entre o painel e a API: o de requisição é o que autentica
 * toda chamada, e o de resposta é o que derruba a sessão num 401 e transforma o erro do axios
 * numa mensagem que a tela pode mostrar. Exercitados através de um adapter falso, para o
 * comportamento real do axios (ordem, encadeamento) fazer parte do teste.
 */
const seen: AxiosRequestConfig[] = [];

function respondWith(response: { status: number; data?: unknown }) {
  apiClient.defaults.adapter = async (config) => {
    seen.push(config);
    if (response.status >= 400) {
      return Promise.reject(
        Object.assign(new Error(`Request failed with status code ${response.status}`), {
          isAxiosError: true,
          config,
          response: { ...response, config, headers: {}, statusText: '' },
        }),
      );
    }
    return { data: response.data, status: response.status, statusText: 'OK', headers: {}, config } as any;
  };
}

/** Falha de rede: o axios rejeita sem `response` nenhuma. */
function respondWithNetworkFailure(message: string) {
  apiClient.defaults.adapter = async (config) => {
    seen.push(config);
    return Promise.reject(Object.assign(new Error(message), { isAxiosError: true, config }));
  };
}

const originalAdapter = apiClient.defaults.adapter;

beforeEach(() => {
  seen.length = 0;
  clearToken();
});

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  clearToken();
  vi.restoreAllMocks();
});

describe('request interceptor', () => {
  it('attaches the stored token as a bearer credential', async () => {
    setToken('admin-token');
    respondWith({ status: 200, data: [] });

    await apiClient.get('/admin/api/users');

    expect(seen[0].headers?.Authorization).toBe('Bearer admin-token');
  });

  it('sends no Authorization header when there is no token', async () => {
    respondWith({ status: 200, data: [] });

    await apiClient.get('/admin/api/users');

    expect(seen[0].headers?.Authorization).toBeUndefined();
  });

  it('picks up a token stored after the client was created', async () => {
    respondWith({ status: 200, data: [] });

    await apiClient.get('/admin/api/users');
    setToken('later-token');
    await apiClient.get('/admin/api/users');

    expect(seen[0].headers?.Authorization).toBeUndefined();
    expect(seen[1].headers?.Authorization).toBe('Bearer later-token');
  });
});

describe('response interceptor', () => {
  it('passes a successful response straight through', async () => {
    respondWith({ status: 200, data: { items: [] } });

    await expect(apiClient.get('/admin/api/users')).resolves.toMatchObject({ data: { items: [] } });
  });

  it('drops the session on a 401, so the app falls back to the login screen', async () => {
    setToken('expired-token');
    respondWith({ status: 401, data: { message: 'Token expired.' } });

    await expect(apiClient.get('/admin/api/users')).rejects.toThrow('Token expired.');
    expect(getToken()).toBeNull();
  });

  it.each([403, 404, 409, 500])('keeps the session on a %d', async (status) => {
    setToken('valid-token');
    respondWith({ status, data: { message: 'Nope.' } });

    await expect(apiClient.get('/admin/api/users')).rejects.toThrow('Nope.');
    expect(getToken()).toBe('valid-token');
  });

  it('surfaces the message the API chose', async () => {
    respondWith({ status: 409, data: { message: 'Username already taken.' } });

    await expect(apiClient.post('/admin/api/users', {})).rejects.toThrow('Username already taken.');
  });

  it('falls back to the axios message when the API sent no message', async () => {
    respondWith({ status: 500, data: {} });

    await expect(apiClient.get('/admin/api/users')).rejects.toThrow('Request failed with status code 500');
  });

  it('reports a network failure instead of an empty error', async () => {
    respondWithNetworkFailure('Network Error');

    await expect(apiClient.get('/admin/api/users')).rejects.toThrow('Network Error');
  });

  it('always rejects with a real Error, never the raw axios object', async () => {
    respondWith({ status: 500, data: { message: 'Boom.' } });

    await expect(apiClient.get('/admin/api/users')).rejects.toBeInstanceOf(Error);
  });
});
