import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import {
  compileLinearManuscript,
  type ManuscriptChoice,
} from '../../../manuscript/compile/export/manuscriptCompiler';
import {
  buildManuscriptEpubBytes,
  buildManuscriptEpubEntries,
} from '../../../manuscript/compile/export/manuscriptEpub';
import type {
  ManuscriptChapter,
  ManuscriptScene,
} from '../../../manuscript/compile/manuscriptSections';

const labels = { goToScene: 'See', tocHeading: 'Contents' };
const MODIFIED = new Date('2026-09-27T12:34:56.789Z');

function makeChapter(overrides: Partial<ManuscriptChapter> = {}): ManuscriptChapter {
  return { id: 'ch-1', name: 'Arrival', index: 1, type: 'chapter', ...overrides };
}

function makeScene(overrides: Partial<ManuscriptScene> = {}): ManuscriptScene {
  return {
    id: 's-1',
    chapterId: 'ch-1',
    name: 'Opening',
    index: 1,
    body: 'First **bold** & <odd> "quoted" line.',
    isDeleted: false,
    ...overrides,
  };
}

function makeChoice(overrides: Partial<ManuscriptChoice> = {}): ManuscriptChoice {
  return { id: 'choice-1', sceneId: 's-1', nextSceneId: 's-3', text: 'Go on', ...overrides };
}

/** Two chapters and the appendix; the choice crosses from the first chapter to the second. */
const manuscript = compileLinearManuscript({
  title: 'Nyx & Eos',
  chapters: [makeChapter(), makeChapter({ id: 'ch-2', name: 'Departure', index: 2 })],
  scenes: [
    makeScene(),
    makeScene({ id: 's-2', name: 'Next', index: 2, body: 'After.' }),
    makeScene({ id: 's-3', chapterId: 'ch-2', name: 'Far', index: 1, body: 'Away.' }),
    makeScene({ id: 's-loose', chapterId: null, name: 'Note', index: 1, body: 'Aside.' }),
  ],
  choices: [makeChoice()],
  includeLooseScenes: true,
  looseHeadingLabel: 'Appendix',
});

/**
 * Well-formedness of the XML we write: balanced tags, and no `&` outside an entity. The renderer
 * emits plain markup (no CDATA, comments or unquoted attributes), which this reads exactly.
 */
function wellFormed(xml: string): string | null {
  const body = xml.replace(/^<\?xml[^>]*\?>\s*/, '').replace(/^<!DOCTYPE[^>]*>\s*/, '');
  if (/&(?!(amp|lt|gt|quot|apos|#\d+);)/.test(body)) return 'stray ampersand';
  const stack: string[] = [];
  for (const [tag] of body.matchAll(/<[^>]+>/g)) {
    if (tag.endsWith('/>')) continue;
    const closing = /^<\/([^\s>]+)>$/.exec(tag);
    if (closing) {
      if (stack.pop() !== closing[1]) return `unbalanced </${closing[1]}>`;
      continue;
    }
    stack.push(/^<([^\s>]+)/.exec(tag)![1]!);
  }
  return stack.length === 0 ? null : `unclosed <${stack.join('>, <')}>`;
}

describe('manuscript EPUB', () => {
  it('opens with the mimetype, stored, exactly the EPUB media type, with no extra field', async () => {
    const bytes = await buildManuscriptEpubBytes(manuscript, labels, {}, { modified: MODIFIED });
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    expect(view.getUint32(0, true)).toBe(0x04034b50); // local file header
    expect(view.getUint16(8, true)).toBe(0); // compression: stored
    const nameLength = view.getUint16(26, true);
    expect(view.getUint16(28, true)).toBe(0); // no extra field
    const text = new TextDecoder().decode(bytes.slice(30, 30 + nameLength + 20));
    expect(text).toBe('mimetypeapplication/epub+zip');
  });

  it('packs a container, a package, a nav and one file per chapter, every one declared', async () => {
    const zip = await JSZip.loadAsync(
      await buildManuscriptEpubBytes(manuscript, labels, {}, { modified: MODIFIED }),
    );
    const container = await zip.file('META-INF/container.xml')!.async('string');
    expect(container).toContain('full-path="OEBPS/content.opf"');
    const opf = await zip.file('OEBPS/content.opf')!.async('string');

    const manifest = Array.from(opf.matchAll(/<item id="([^"]+)" href="([^"]+)"/g), (match) => ({
      id: match[1]!,
      href: match[2]!,
    }));
    const spine = Array.from(opf.matchAll(/<itemref idref="([^"]+)"/g), (match) => match[1]!);
    // The opening file, both chapters and the appendix.
    expect(spine).toHaveLength(4);
    for (const idref of spine) expect(manifest.map((item) => item.id)).toContain(idref);
    for (const item of manifest) expect(zip.file(`OEBPS/${item.href}`)).not.toBeNull();
    expect(opf).toContain('properties="nav"');
    expect(opf).toContain('<meta property="dcterms:modified">2026-09-27T12:34:56Z</meta>');
  });

  it('writes well-formed XML everywhere, escaping the text', () => {
    for (const [path, content] of buildManuscriptEpubEntries(manuscript, labels, {
      includeToc: true,
    })) {
      if (!/\.(xhtml|opf|xml)$/.test(path)) continue;
      expect({ path, problem: wellFormed(content) }).toEqual({ path, problem: null });
    }
    const opening = buildManuscriptEpubEntries(manuscript, labels).find(
      ([path]) => path === 'OEBPS/text-001.xhtml',
    )![1];
    expect(opening).toContain('&amp; &lt;odd&gt; &quot;quoted&quot;');
  });

  it('navigates by the index and links a choice across files to its target', () => {
    const entries = new Map(buildManuscriptEpubEntries(manuscript, labels));
    const nav = entries.get('OEBPS/nav.xhtml')!;
    expect(nav).toContain('epub:type="toc"');
    expect(nav).toMatch(/href="text-001\.xhtml#chapter-ch1">1\. Arrival</);
    expect(nav).toMatch(/href="text-002\.xhtml#chapter-ch2">2\. Departure</);

    const first = entries.get('OEBPS/text-001.xhtml')!;
    const target = /<a href="([^"#]+)#([^"]+)">Far<\/a>/.exec(first);
    expect(target).not.toBeNull();
    // The link lands on the scene's anchor in the file that holds it.
    expect(entries.get(`OEBPS/${target![1]}`)).toContain(`id="${target![2]}"`);
  });

  it('carries its metadata, deriving an identifier when none is given', () => {
    const opf = (metadata: Parameters<typeof buildManuscriptEpubEntries>[3]) =>
      new Map(buildManuscriptEpubEntries(manuscript, labels, {}, metadata)).get(
        'OEBPS/content.opf',
      )!;

    const derived = opf({});
    expect(derived).toContain('<dc:identifier id="bookid">urn:keres:nyx-eos</dc:identifier>');
    expect(derived).toContain('<dc:title>Nyx &amp; Eos</dc:title>');
    expect(derived).toContain('<dc:language>en</dc:language>');
    expect(derived).not.toContain('dc:creator');

    const given = opf({ identifier: 'urn:isbn:123', author: 'Ana', language: 'pt-BR' });
    expect(given).toContain('>urn:isbn:123<');
    expect(given).toContain('<dc:creator>Ana</dc:creator>');
    expect(given).toContain('<dc:language>pt-BR</dc:language>');
  });

  it('is byte-stable for the same book and date', async () => {
    const build = () => buildManuscriptEpubBytes(manuscript, labels, {}, { modified: MODIFIED });
    expect(await build()).toEqual(await build());
  });
});
