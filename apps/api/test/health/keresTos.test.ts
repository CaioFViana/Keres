import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/index';
import { SERVER_TERMS_VERSION } from '../../src/legal/serverTerms';

describe('GET /api/keres-tos', () => {
  it('serves the versioned terms with no session', async () => {
    const app = await createApp();

    const response = await app.handle(new Request('http://localhost/api/keres-tos'));

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      version: number;
      updatedAt: string;
      en: { heading: string; paragraphs: string[] }[];
      pt: { heading: string; paragraphs: string[] }[];
    };
    expect(body.version).toBe(SERVER_TERMS_VERSION);
    expect(typeof body.updatedAt).toBe('string');
    for (const language of [body.en, body.pt] as const) {
      expect(language.length).toBeGreaterThan(0);
      for (const section of language) {
        expect(section.heading.length).toBeGreaterThan(0);
        expect(section.paragraphs.length).toBeGreaterThan(0);
      }
    }
  });
});
