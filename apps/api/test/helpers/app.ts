import { ulid } from 'ulid';
import { createApp } from '../../src/index';

/**
 * A aplicação real, montada uma vez por arquivo de teste e exercitada em memória por
 * `app.handle(new Request(...))` - mesmo caminho que `test/health/kerescheck.test.ts` já usa.
 * Sem porta aberta: o que se testa é a aplicação, não o servidor HTTP do runtime.
 */
let appPromise: Promise<Awaited<ReturnType<typeof createApp>>> | null = null;

export function getApp() {
  appPromise ??= createApp();
  return appPromise;
}

export interface ApiResponse<T = any> {
  status: number;
  data: T;
  headers: Headers;
}

export interface RequestOptions {
  body?: unknown;
  /** Enviado como `Authorization: Bearer`. Omitir para exercitar o caminho não autenticado. */
  token?: string;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined>;
}

export async function request<T = any>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const app = await getApp();

  const headers: Record<string, string> = { ...options.headers };
  let body: string | undefined;
  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  if (options.token) {
    headers['authorization'] = `Bearer ${options.token}`;
  }

  const url = new URL(path, 'http://localhost');
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await app.handle(new Request(url.toString(), { method, headers, body }));

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  return { status: response.status, data: data as T, headers: response.headers };
}

export interface TestUser {
  userId: string;
  username: string;
  password: string;
  token: string;
  refreshToken: string;
}

/**
 * Cria um usuário pela rota real de registro e devolve credenciais utilizáveis.
 *
 * Passar pela rota (em vez de inserir na tabela) é deliberado: assim o usuário nasce com o
 * mesmo tier padrão, a mesma `tag` e a mesma senha hasheada que um usuário de verdade, e um
 * teste nunca passa por depender de um estado que a aplicação não produziria.
 */
export async function registerUser(username = `user_${ulid().slice(-10).toLowerCase()}`): Promise<TestUser> {
  const password = 'senha-de-teste-123';
  const { status, data } = await request('POST', '/auth/register', { body: { username, password } });

  if (status !== 200) {
    throw new Error(`Falha ao registrar o usuário de teste (${status}): ${JSON.stringify(data)}`);
  }

  return {
    userId: data.userId,
    username: data.username,
    password,
    token: data.accessToken,
    refreshToken: data.refreshToken,
  };
}

/** ULID novo, para os testes que precisam gerar ids de entidade do lado do cliente. */
export const newId = () => ulid();
