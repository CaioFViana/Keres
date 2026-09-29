import JSZip from 'jszip';
import {
  sceneHeadingLabel,
  manuscriptTocEntries,
  type CompiledBlock,
  type CompiledManuscript,
  type ManuscriptRenderOptions,
  type ManuscriptTocEntry,
} from './manuscriptCompiler';
import { escapeHtml, spansToHtml, typographyCss } from './manuscriptHtml';

/**
 * The compiled manuscript as an EPUB 3 package, assembled by hand over JSZip: the content is simple
 * XHTML and owning the package keeps a dependency out (see `parseManuscriptMarkdown.ts` on Hermes).
 *
 * - `mimetype` first and stored uncompressed, holding exactly `application/epub+zip`; everything
 *   else deflated (EPUB 3.3, OCF);
 * - one XHTML per chapter (and the appendix), so readers start each on a fresh screen; anything
 *   before the first chapter lives in the opening file with the title;
 * - choices link across files to their target scene's anchor, by name (reflowable: no pages);
 * - the navigation document is the index (`manuscriptTocEntries`), whether or not an in-book
 *   index is also asked for.
 */

export type ManuscriptEpubLabels = {
  /** Name-based cross-reference, e.g. "See". */
  goToScene: string;
  /** Index heading, e.g. "Contents". */
  tocHeading: string;
};

/** What the package says about the book, beyond its title. */
export type ManuscriptEpubMetadata = {
  /** Unique identifier; derived from the title when absent. */
  identifier?: string;
  author?: string | null;
  /** BCP 47 language of the text, e.g. `pt-BR`. Defaults to `en`. */
  language?: string;
  /** Last modification, `dcterms:modified`; the caller's clock (bytes stay stable in tests). */
  modified?: Date;
};

const CONTAINER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`;

const STYLESHEET = `body { font-family: Georgia, 'Times New Roman', serif; line-height: 1.5; margin: 0 5%; }
.title { text-align: center; font-size: 2em; margin: 3em 0 0.5em; }
.subtitle { text-align: center; font-style: italic; margin: 0 0 2em; }
.chapter { font-size: 1.5em; margin: 2em 0 1em; }
.scene { font-size: 1.15em; margin: 1.8em 0 0.7em; }
p { text-indent: 1.5em; margin: 0 0 0.4em; }
p.choice, p.choice-detail, p.subtitle { text-indent: 0; }
.choice { margin-left: 1em; }
.choice-detail { margin-left: 2.5em; }
nav ol { list-style: none; padding-left: 0; }
nav ol ol { padding-left: 1.5em; }
`;

/** A URN-safe slug of the title, so the default identifier is stable for the same book. */
function slugOf(text: string): string {
  const slug = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'manuscript';
}

/** `dcterms:modified` wants whole seconds in UTC: `2026-09-27T12:00:00Z`. */
function modifiedStamp(date: Date): string {
  return `${date.toISOString().slice(0, 19)}Z`;
}

function xhtmlDocument(title: string, language: string, body: string, epubNs = false): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml"${epubNs ? ' xmlns:epub="http://www.idpf.org/2007/ops"' : ''} xml:lang="${escapeHtml(language)}" lang="${escapeHtml(language)}">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body>
${body}
</body>
</html>
`;
}

type ContentFile = { name: string; title: string; blocks: CompiledBlock[] };

/** Splits the blocks into files: the opening one, then one per chapter or appendix. */
function contentFiles(manuscript: CompiledManuscript): ContentFile[] {
  const files: ContentFile[] = [{ name: 'text-000.xhtml', title: manuscript.title, blocks: [] }];
  for (const block of manuscript.blocks) {
    if (block.kind === 'chapter' || block.kind === 'loose-heading') {
      const title =
        block.kind === 'chapter'
          ? block.number === null
            ? block.name
            : `${block.number}. ${block.name}`
          : block.label;
      files.push({
        name: `text-${String(files.length).padStart(3, '0')}.xhtml`,
        title,
        blocks: [],
      });
    }
    files[files.length - 1]!.blocks.push(block);
  }
  return files;
}

/** The index as nested lists: scenes under the chapter before them. */
function tocList(entries: ManuscriptTocEntry[], href: (bookmarkId: string) => string): string {
  const top: { link: string; children: string[] }[] = [];
  for (const entry of entries) {
    const link = `<a href="${href(entry.bookmarkId)}">${escapeHtml(entry.text)}</a>`;
    if (entry.level === 0 || top.length === 0) top.push({ link, children: [] });
    else top[top.length - 1]!.children.push(link);
  }
  const items = top.map((item) =>
    item.children.length === 0
      ? `<li>${item.link}</li>`
      : `<li>${item.link}\n<ol>\n${item.children.map((child) => `<li>${child}</li>`).join('\n')}\n</ol></li>`,
  );
  return `<ol>\n${items.join('\n')}\n</ol>`;
}

function blockXhtml(
  block: CompiledBlock,
  labels: ManuscriptEpubLabels,
  href: (bookmarkId: string) => string,
): string {
  switch (block.kind) {
    case 'title':
      return `<h1 class="title">${escapeHtml(block.text)}</h1>`;
    case 'subtitle':
      return `<p class="subtitle">${escapeHtml(block.text)}</p>`;
    case 'chapter':
      return `<h2 class="chapter" id="${block.bookmarkId}">${escapeHtml(block.number === null ? block.name : `${block.number}. ${block.name}`)}</h2>`;
    case 'loose-heading':
      return `<h2 class="chapter" id="${block.bookmarkId}">${escapeHtml(block.label)}</h2>`;
    case 'scene-heading': {
      const id = block.bookmarkId ? ` id="${block.bookmarkId}"` : '';
      return `<h3 class="scene"${id}>${escapeHtml(sceneHeadingLabel(block))}</h3>`;
    }
    case 'paragraph':
      return `<p>${spansToHtml(block.spans)}</p>`;
    case 'scene-break':
      return `<p class="scene-break">${escapeHtml(block.text)}</p>`;
    case 'choice': {
      const lead = `• ${escapeHtml(block.text)}`;
      const lines = [
        block.targetBookmarkId && block.targetSceneName
          ? `<p class="choice">${lead} — ${escapeHtml(labels.goToScene)} <a href="${href(block.targetBookmarkId)}">${escapeHtml(block.targetSceneName)}</a></p>`
          : block.targetSceneName
            ? `<p class="choice">${lead} — ${escapeHtml(block.targetSceneName)}</p>`
            : `<p class="choice">${lead}</p>`,
      ];
      for (const line of [...(block.requirements ?? []), ...(block.effects ?? [])]) {
        lines.push(`<p class="choice-detail">${escapeHtml(line)}</p>`);
      }
      return lines.join('\n');
    }
  }
}

/** The whole package, before zipping: path → text. Exposed for tests. */
export function buildManuscriptEpubEntries(
  manuscript: CompiledManuscript,
  labels: ManuscriptEpubLabels,
  options: ManuscriptRenderOptions = {},
  metadata: ManuscriptEpubMetadata = {},
): [path: string, content: string][] {
  const language = metadata.language ?? 'en';
  const identifier = metadata.identifier ?? `urn:keres:${slugOf(manuscript.title)}`;
  const files = contentFiles(manuscript);
  const fileOf = new Map<string, string>();
  for (const file of files) {
    for (const block of file.blocks) {
      if ((block.kind === 'chapter' || block.kind === 'loose-heading') && block.bookmarkId) {
        fileOf.set(block.bookmarkId, file.name);
      } else if (block.kind === 'scene-heading' && block.bookmarkId) {
        fileOf.set(block.bookmarkId, file.name);
      }
    }
  }
  const href = (bookmarkId: string) => `${fileOf.get(bookmarkId) ?? files[0]!.name}#${bookmarkId}`;
  const entries = manuscriptTocEntries(manuscript.blocks);
  const extraCss = typographyCss(
    options,
    manuscript.blocks.some((block) => block.kind === 'scene-break'),
  );
  const stylesheet = extraCss ? `${STYLESHEET}${extraCss}\n` : STYLESHEET;

  const texts = files
    .filter((file) => file.blocks.length > 0 || file === files[0])
    .map((file, index) => {
      const parts = file.blocks.map((block) => blockXhtml(block, labels, href));
      // The in-book index, when asked for, follows the title block like in every other format.
      if (index === 0 && options.includeToc && entries.length > 0) {
        parts.push(
          `<nav class="toc"><h2>${escapeHtml(labels.tocHeading)}</h2>\n${tocList(entries, href)}\n</nav>`,
        );
      }
      return {
        name: file.name,
        content: xhtmlDocument(file.title, language, parts.join('\n')),
      };
    });

  const navEntries =
    entries.length > 0
      ? tocList(entries, href)
      : `<ol>\n<li><a href="${texts[0]!.name}">${escapeHtml(manuscript.title)}</a></li>\n</ol>`;
  const nav = xhtmlDocument(
    labels.tocHeading,
    language,
    `<nav epub:type="toc" id="toc"><h1>${escapeHtml(labels.tocHeading)}</h1>\n${navEntries}\n</nav>`,
    true,
  );

  const manifest = [
    '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    '<item id="style" href="style.css" media-type="text/css"/>',
    ...texts.map(
      (text, index) =>
        `<item id="text${index}" href="${text.name}" media-type="application/xhtml+xml"/>`,
    ),
  ];
  const spine = texts.map((_, index) => `<itemref idref="text${index}"/>`);
  const creator = metadata.author?.trim()
    ? `\n    <dc:creator>${escapeHtml(metadata.author.trim())}</dc:creator>`
    : '';
  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${escapeHtml(language)}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${escapeHtml(identifier)}</dc:identifier>
    <dc:title>${escapeHtml(manuscript.title)}</dc:title>
    <dc:language>${escapeHtml(language)}</dc:language>${creator}
    <meta property="dcterms:modified">${modifiedStamp(metadata.modified ?? new Date(0))}</meta>
  </metadata>
  <manifest>
    ${manifest.join('\n    ')}
  </manifest>
  <spine>
    ${spine.join('\n    ')}
  </spine>
</package>
`;

  return [
    ['mimetype', 'application/epub+zip'],
    ['META-INF/container.xml', CONTAINER_XML],
    ['OEBPS/content.opf', opf],
    ['OEBPS/nav.xhtml', nav],
    ['OEBPS/style.css', stylesheet],
    ...texts.map((text): [string, string] => [`OEBPS/${text.name}`, text.content]),
  ];
}

/** The EPUB file's bytes. */
export async function buildManuscriptEpubBytes(
  manuscript: CompiledManuscript,
  labels: ManuscriptEpubLabels,
  options: ManuscriptRenderOptions = {},
  metadata: ManuscriptEpubMetadata = {},
): Promise<Uint8Array> {
  const zip = new JSZip();
  // A fixed date keeps the archive bytes stable for the same book.
  const date = metadata.modified ?? new Date(0);
  for (const [path, content] of buildManuscriptEpubEntries(manuscript, labels, options, metadata)) {
    zip.file(path, content, {
      date,
      compression: path === 'mimetype' ? 'STORE' : 'DEFLATE',
    });
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
