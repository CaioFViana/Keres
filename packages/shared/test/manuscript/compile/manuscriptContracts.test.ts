import { describe, expect, it } from 'vitest';
import { ShowcaseVersionSchema } from '../../../schemas/PublicationSchemas';
import {
  DEFAULT_MANUSCRIPT_LABELS,
  FORMAT_META,
  MAX_MANUSCRIPT_BYTES,
  ManuscriptFormatSchema,
  ManuscriptInfoSchema,
  ManuscriptOptionsSchema,
} from '../../../manuscript/compile/manuscriptContracts';

describe('ManuscriptFormatSchema', () => {
  it('accepts the four pipeline formats and rejects the client-only pdf', () => {
    for (const format of ['docx', 'md', 'txt', 'html']) {
      expect(ManuscriptFormatSchema.parse(format)).toBe(format);
    }
    expect(() => ManuscriptFormatSchema.parse('pdf')).toThrow();
  });
});

describe('MAX_MANUSCRIPT_BYTES', () => {
  it('is 15 MB', () => {
    expect(MAX_MANUSCRIPT_BYTES).toBe(15 * 1024 * 1024);
  });
});

describe('FORMAT_META', () => {
  it('maps every format to its delivery metadata', () => {
    expect(FORMAT_META).toEqual({
      docx: {
        extension: 'docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
      md: { extension: 'md', mimeType: 'text/markdown' },
      txt: { extension: 'txt', mimeType: 'text/plain' },
      html: { extension: 'html', mimeType: 'text/html' },
    });
  });
});

describe('DEFAULT_MANUSCRIPT_LABELS', () => {
  it('matches the English export_manuscript_* strings', () => {
    expect(DEFAULT_MANUSCRIPT_LABELS).toEqual({
      goToPage: 'Go to page',
      goToScene: 'See',
      looseHeading: 'Appendix',
      tocHeading: 'Contents',
    });
  });
});

describe('ManuscriptOptionsSchema', () => {
  it('defaults includeLooseScenes to true', () => {
    expect(ManuscriptOptionsSchema.parse({ format: 'md' })).toEqual({
      format: 'md',
      includeLooseScenes: true,
    });
  });

  it('accepts partial label overrides and caps each at 80 chars', () => {
    const parsed = ManuscriptOptionsSchema.parse({
      format: 'md',
      labels: { goToScene: 'Ver' },
    });
    expect(parsed.labels).toEqual({ goToScene: 'Ver' });
    expect(
      ManuscriptOptionsSchema.parse({ format: 'md', labels: { goToScene: 'x'.repeat(80) } }).labels,
    ).toEqual({ goToScene: 'x'.repeat(80) });
    expect(() =>
      ManuscriptOptionsSchema.parse({ format: 'md', labels: { goToScene: 'x'.repeat(81) } }),
    ).toThrow();
  });

  it('rejects unknown formats', () => {
    expect(() => ManuscriptOptionsSchema.parse({ format: 'pdf' })).toThrow();
  });
});

describe('ManuscriptInfoSchema', () => {
  it('parses format and byte size', () => {
    expect(ManuscriptInfoSchema.parse({ format: 'docx', byteSize: 12 })).toEqual({
      format: 'docx',
      byteSize: 12,
    });
  });
});

describe('ShowcaseVersionSchema manuscript', () => {
  const version = {
    id: 'v-1',
    label: 'v1',
    byteSize: 100,
    mediaIncluded: 0,
    mediaTotal: 0,
    createdAt: '2026-01-01',
  };

  it('accepts a null manuscript', () => {
    expect(ShowcaseVersionSchema.parse({ ...version, manuscript: null }).manuscript).toBeNull();
  });

  it('accepts a manuscript rendition', () => {
    expect(
      ShowcaseVersionSchema.parse({
        ...version,
        manuscript: { format: 'md', byteSize: 42 },
      }).manuscript,
    ).toEqual({ format: 'md', byteSize: 42 });
  });
});
