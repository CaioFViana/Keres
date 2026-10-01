import { describe, expect, it } from 'vitest';
import {
  documentTextContent,
  parseMarkdownToDocument,
  serializeDocumentToMarkdown,
  type ManuscriptBlock,
  type ManuscriptMark,
} from '../../manuscript/ManuscriptDocument';
import { documentToEnrichedHtml, enrichedHtmlToDocument } from '../../manuscript/enrichedHtml';

function paragraph(text: string, marks: ManuscriptMark[] = []): ManuscriptBlock {
  return { kind: 'paragraph', spans: [{ text, marks }] };
}

describe('documentToEnrichedHtml', () => {
  it('emits an empty string for an empty document', () => {
    expect(documentToEnrichedHtml({ blocks: [] })).toBe('');
  });

  it('wraps plain blocks in paragraphs', () => {
    expect(documentToEnrichedHtml({ blocks: [paragraph('a'), paragraph('b')] })).toBe(
      '<html><p>a</p><p>b</p></html>',
    );
  });

  it('nests marks canonically and escapes text', () => {
    expect(
      documentToEnrichedHtml({
        blocks: [{ kind: 'paragraph', spans: [{ text: 'a&<b>', marks: ['bold', 'italic'] }] }],
      }),
    ).toBe('<html><p><b><i>a&amp;&lt;b&gt;</i></b></p></html>');
  });

  it('promotes soft lines to paragraphs and never emits <br>', () => {
    expect(documentToEnrichedHtml({ blocks: [paragraph('a\nb')] })).toBe(
      '<html><p>a</p><p>b</p></html>',
    );
  });

  it('emits empty blocks as empty paragraphs', () => {
    expect(
      documentToEnrichedHtml({
        blocks: [paragraph('a'), { kind: 'paragraph', spans: [] }, paragraph('b')],
      }),
    ).toBe('<html><p>a</p><p></p><p>b</p></html>');
  });
});

describe('enrichedHtmlToDocument', () => {
  it('parses paragraphs and marks', () => {
    const doc = enrichedHtmlToDocument('<html><p>plain</p><p><b>bold</b> and <i>it</i></p></html>');

    expect(doc.blocks).toHaveLength(2);
    expect(doc.blocks[0]).toEqual(paragraph('plain'));
    expect(documentTextContent(doc)).toBe('plain\n\nbold and it');
    expect(doc.blocks[1].spans).toEqual([
      { text: 'bold', marks: ['bold'] },
      { text: ' and ', marks: [] },
      { text: 'it', marks: ['italic'] },
    ]);
  });

  it('keeps soft breaks after text and reads bare breaks as blank lines', () => {
    const doc = enrichedHtmlToDocument('<html><p>a<br>b</p><br><p>c</p></html>');

    expect(doc.blocks).toEqual([
      paragraph('a\nb'),
      { kind: 'paragraph', spans: [] },
      paragraph('c'),
    ]);
  });

  it('reads empty paragraphs and stacked bare breaks as blank lines', () => {
    expect(enrichedHtmlToDocument('<html><p>a</p><p></p><p>b</p></html>').blocks).toEqual([
      paragraph('a'),
      { kind: 'paragraph', spans: [] },
      paragraph('b'),
    ]);
    expect(enrichedHtmlToDocument('<html><p>a</p><br><br><p>b</p></html>').blocks).toEqual([
      paragraph('a'),
      { kind: 'paragraph', spans: [] },
      { kind: 'paragraph', spans: [] },
      paragraph('b'),
    ]);
    expect(enrichedHtmlToDocument('<html><p><br></p></html>').blocks).toEqual([
      { kind: 'paragraph', spans: [] },
    ]);
  });

  it('emits nested empty paragraphs exactly once', () => {
    expect(enrichedHtmlToDocument('<html><div><p></p></div></html>').blocks).toEqual([
      { kind: 'paragraph', spans: [] },
    ]);
  });

  it('splits blocks on blank-line runs like markdown chunks', () => {
    const doc = enrichedHtmlToDocument('<html><p>a<br><br>b</p></html>');

    expect(doc.blocks).toEqual([paragraph('a'), paragraph('b')]);
  });

  it('decodes entities and ignores pretty-printing whitespace', () => {
    const doc = enrichedHtmlToDocument(
      '<html>\n  <p>\n    fish &amp; chips\n  </p>\n  <p>C#</p>\n</html>',
    );

    expect(doc.blocks).toEqual([paragraph('fish & chips'), paragraph('C#')]);
  });

  it('degrades foreign structure to paragraphs without losing prose', () => {
    const doc = enrichedHtmlToDocument(
      '<html><h1>Title</h1><ul><li>one</li><li>two</li></ul>' +
        '<p>see <a href="https://x">link</a> and <code>code</code><img src="x"></p>' +
        '<blockquote><p>quoted</p></blockquote></html>',
    );

    expect(documentTextContent(doc)).toBe('Title\n\none\n\ntwo\n\nsee link and code\n\nquoted');
  });

  it('drops scripts, styles, heads and comments', () => {
    const doc = enrichedHtmlToDocument(
      '<html><head><title>t</title><style>p{}</style></head>' +
        '<!-- note --><p>kept</p><script>alert(1)</script></html>',
    );

    expect(doc.blocks).toEqual([paragraph('kept')]);
  });

  it('accepts mark synonyms and tolerates mismatched nesting', () => {
    const doc = enrichedHtmlToDocument('<p><strong><em>x</strong></em></p><p><del>gone</del></p>');

    expect(doc.blocks[0].spans).toEqual([{ text: 'x', marks: ['bold', 'italic'] }]);
    expect(doc.blocks[1].spans).toEqual([{ text: 'gone', marks: ['strikethrough'] }]);
  });

  it('round-trips documents through HTML without changing markdown', () => {
    const markdown =
      'First *line*.\n\nSecond **bold** line with __ul__ and ~~s~~.\n\nFish & chips 2 < 3.';
    const back = enrichedHtmlToDocument(documentToEnrichedHtml(parseMarkdownToDocument(markdown)));

    expect(serializeDocumentToMarkdown(back)).toBe(markdown);
  });

  it('round-trips blank lines through HTML byte-identically', () => {
    const markdown = 'First.\n\n\n\nSecond.\n\n\n\n\n\nThird.';
    const back = enrichedHtmlToDocument(documentToEnrichedHtml(parseMarkdownToDocument(markdown)));

    expect(serializeDocumentToMarkdown(back)).toBe(markdown);
  });

  it('canonicalizes soft breaks to paragraphs through the HTML boundary', () => {
    const back = enrichedHtmlToDocument(documentToEnrichedHtml(parseMarkdownToDocument('a\nb')));

    expect(serializeDocumentToMarkdown(back)).toBe('a\n\nb');
  });
});
