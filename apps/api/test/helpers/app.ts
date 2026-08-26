import { ulid } from 'ulid';
import { createApp } from '../../src/index';

/** Every programmatic endpoint is mounted below this prefix; test call sites stay route-relative. */
const API_PREFIX = '/api';

/**
 * The real application, mounted once per test file and exercised in memory through
 * `app.handle(new Request(...))` - the same path `test/health/kerescheck.test.ts` already uses. No
 * open port: what is tested is the application, not the runtime's HTTP server.
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
  /** A plain object becomes JSON; a `FormData` is sent as multipart, with no manual header. */
  body?: unknown;
  /** Sent as `Authorization: Bearer`. Omit it to exercise the unauthenticated path. */
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
  let body: string | FormData | undefined;
  if (options.body instanceof FormData) {
    // No manual `content-type`: only the `Request` itself knows how to generate the multipart boundary.
    body = options.body;
  } else if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  if (options.token) {
    headers['authorization'] = `Bearer ${options.token}`;
  }

  // Admin tests historically describe routes as `/admin/api/*`; retain that compact notation
  // at call sites while exercising its canonical public address, `/api/admin/*`.
  const relativePath =
    path === '/admin/api' || path.startsWith('/admin/api/')
      ? `/admin${path.slice('/admin/api'.length)}`
      : path;
  const canonicalPath =
    relativePath === API_PREFIX || relativePath.startsWith(`${API_PREFIX}/`)
      ? relativePath
      : `${API_PREFIX}${relativePath.startsWith('/') ? relativePath : `/${relativePath}`}`;
  const url = new URL(canonicalPath, 'http://localhost');
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
 * Creates a user through the real registration route and returns usable credentials.
 *
 * Going through the route (instead of inserting into the table) is deliberate: that way the user is
 * born with the same default tier, the same `tag` and the same hashed password as a real user, and a
 * test never passes by depending on state the application would not produce.
 */
export async function registerUser(
  username = `user_${ulid().slice(-10).toLowerCase()}`,
): Promise<TestUser> {
  const password = 'senha-de-teste-123';
  const { status, data } = await request('POST', '/auth/register', {
    body: { username, password },
  });

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
