import type { ServerSelect } from '../db/schemas/servers';
import apiClient, { apiUrl, createKeresAxiosInstance } from './apiClient';
import { authTokenManager } from './AuthTokenManager';

/** One section of a server's legal documents, as `keres-tos` and `keres-privacy` serve them. */
export interface ServerTermsSection {
  heading: string;
  paragraphs: string[];
}

export interface ServerTerms {
  version: number;
  updatedAt: string;
  sections: ServerTermsSection[];
  /** The whole text, headings included, as stored with the server row. */
  text: string;
}

/** The privacy policy reads exactly like the terms: sections plus the stored text. */
export type ServerPrivacy = ServerTerms;

export interface LegalDocumentStatus {
  accepted: number | null;
  current: number;
}

export interface LegalStatus {
  tos: LegalDocumentStatus;
  privacy: LegalDocumentStatus;
}

const PING_TIMEOUT_MS = 5000;

function renderText(sections: ServerTermsSection[]): string {
  return sections
    .map((section) => `${section.heading}\n${section.paragraphs.join('\n')}`)
    .join('\n\n');
}

async function fetchLegalDocument(
  serverUrl: string,
  path: '/keres-tos' | '/keres-privacy',
  language: string,
): Promise<ServerTerms | null> {
  try {
    const response = await apiClient.get(apiUrl(serverUrl, path), {
      timeout: PING_TIMEOUT_MS,
      validateStatus: () => true,
    });
    const data = response.data as {
      version?: unknown;
      updatedAt?: unknown;
      en?: ServerTermsSection[];
      pt?: ServerTermsSection[];
    } | null;
    if (response.status !== 200 || !data || typeof data.version !== 'number') return null;
    const sections = (language.split('-')[0] === 'pt' ? data.pt : data.en) ?? data.en ?? [];
    if (sections.length === 0) return null;
    return {
      version: data.version,
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
      sections,
      text: renderText(sections),
    };
  } catch {
    return null;
  }
}

/**
 * Reads a server's terms of service: `GET /api/keres-tos`, public because it is read before
 * any account exists. Answers `null` when the server predates the route or cannot be reached -
 * such a server simply has no terms to agree to, and registration goes on without them.
 */
export async function fetchServerTerms(
  serverUrl: string,
  language: string,
): Promise<ServerTerms | null> {
  return fetchLegalDocument(serverUrl, '/keres-tos', language);
}

/**
 * Reads a server's privacy policy: `GET /api/keres-privacy`, public for the same reason.
 * Answers `null` when the server predates the route or cannot be reached.
 */
export async function fetchServerPrivacy(
  serverUrl: string,
  language: string,
): Promise<ServerPrivacy | null> {
  return fetchLegalDocument(serverUrl, '/keres-privacy', language);
}

function clientFor(server: ServerSelect) {
  const client = createKeresAxiosInstance({ baseURL: server.url });
  client.setTokenProvider(authTokenManager);
  client.setActiveServer(server);
  return client;
}

/**
 * What the account accepted against what applies now (`GET /api/auth/terms-status`).
 * Answers `null` offline or on servers predating the route - no status, no re-gate.
 */
export async function fetchLegalStatus(server: ServerSelect): Promise<LegalStatus | null> {
  try {
    const response = await clientFor(server).get('/auth/terms-status', {
      timeout: PING_TIMEOUT_MS,
      validateStatus: () => true,
    });
    if (response.status !== 200) return null;
    const data = response.data as LegalStatus | null;
    if (!data || typeof data.tos?.current !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

/** Records acceptance of the current text (`POST /api/auth/terms-accept`). */
export async function acceptLegal(
  server: ServerSelect,
  kind: 'tos' | 'privacy',
): Promise<LegalStatus | null> {
  try {
    const response = await clientFor(server).post(
      '/auth/terms-accept',
      { kind },
      { timeout: PING_TIMEOUT_MS, validateStatus: () => true },
    );
    if (response.status !== 200) return null;
    return response.data as LegalStatus;
  } catch {
    return null;
  }
}
