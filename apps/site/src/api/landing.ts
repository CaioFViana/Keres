/**
 * The landing build's two server calls, against the API that serves the page itself - relative
 * URLs on purpose, so the static bundle adapts to whichever server hosts it.
 *
 * These types mirror `PublicTiersResponseSchema` / `ContactCreateSchema` in `@keres/shared`
 * (this package has no dependency on it); the API integration tests assert the payloads parse
 * against those schemas.
 */

export interface LandingTier {
  id: string;
  name: string;
  isDefault: boolean;
  priceMonthlyCents: number | null;
  priceYearlyCents: number | null;
  maxStories: number | null;
  maxEntitiesPerStory: number | null;
  maxEntitiesTotal: number | null;
  maxStorageBytesPerStory: number | null;
  maxStorageBytesTotal: number | null;
  maxPublicationsPerDay: number | null;
  /** Absent from servers that predate it; null is unlimited. */
  maxPublishedArcs?: number | null;
  /** Absent from servers that predate it; null is unlimited, zero allows no comment. */
  maxCommentsPerStory?: number | null;
  /** Absent from servers that predate it; null is unlimited, zero allows no collaborator. */
  maxContributorsPerStory?: number | null;
}

export interface LandingTiersResponse {
  currency: string;
  tiers: LandingTier[];
}

export class LandingApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'LandingApiError';
    this.status = status;
  }
}

async function readError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { message?: unknown };
    if (typeof data.message === 'string' && data.message.length > 0) {
      return data.message;
    }
  } catch {
    // Not JSON - fall through to the status-based message.
  }
  return `Request failed with status ${response.status}`;
}

export interface LegalDocumentSection {
  heading: string;
  paragraphs: string[];
}

export interface LegalDocument {
  version: number;
  updatedAt: string;
  sections: LegalDocumentSection[];
}

/**
 * The server's own legal texts (`GET /api/keres-tos`, `GET /api/keres-privacy`),
 * public so they can be read before any account exists. Picks the visitor's
 * language the way the client does; answers `null` on servers predating either
 * route, which simply have no public text to show.
 */
export async function fetchLegalDocument(
  path: '/api/keres-tos' | '/api/keres-privacy',
  language: string,
): Promise<LegalDocument | null> {
  const response = await fetch(path, { headers: { accept: 'application/json' } });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new LandingApiError(response.status, await readError(response));
  }
  const data = (await response.json()) as {
    version?: unknown;
    updatedAt?: unknown;
    en?: LegalDocumentSection[];
    pt?: LegalDocumentSection[];
  };
  if (typeof data.version !== 'number') return null;
  const sections = (language.split('-')[0] === 'pt' ? data.pt : data.en) ?? data.en ?? [];
  if (sections.length === 0) return null;
  return {
    version: data.version,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
    sections,
  };
}

export async function fetchLandingTiers(): Promise<LandingTiersResponse> {
  const response = await fetch('/api/public/tiers', { headers: { accept: 'application/json' } });
  if (!response.ok) {
    throw new LandingApiError(response.status, await readError(response));
  }
  return (await response.json()) as LandingTiersResponse;
}

export async function sendContactMessage(input: {
  subject: string;
  body: string;
  contactEmail: string;
}): Promise<{ id: string }> {
  const response = await fetch('/api/public/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new LandingApiError(response.status, await readError(response));
  }
  return (await response.json()) as { id: string };
}
