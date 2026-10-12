import apiClient, { apiUrl } from './apiClient';

/** One section of a server's terms, as `GET /api/keres-tos` serves them. */
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

const PING_TIMEOUT_MS = 5000;

function renderText(sections: ServerTermsSection[]): string {
  return sections
    .map((section) => `${section.heading}\n${section.paragraphs.join('\n')}`)
    .join('\n\n');
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
  try {
    const response = await apiClient.get(apiUrl(serverUrl, '/keres-tos'), {
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
    const sections =
      (language.split('-')[0] === 'pt' ? data.pt : data.en) ?? data.en ?? [];
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
