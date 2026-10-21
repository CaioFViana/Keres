import { cleanLinkDrafts, withScheme } from '@/src/utils/format/profileLinks';
import { buildAuthorPublicUrl } from '@/src/utils/format/showcaseUrls';

describe('withScheme', () => {
  it('completes an address typed without one, and leaves any scheme for the check to judge', () => {
    expect(withScheme('example.com/me')).toBe('https://example.com/me');
    expect(withScheme('  //example.com ')).toBe('https://example.com');
    expect(withScheme('http://example.com')).toBe('http://example.com');
    expect(withScheme('javascript:alert(1)')).toBe('javascript:alert(1)');
    expect(withScheme('   ')).toBe('');
  });
});

describe('cleanLinkDrafts', () => {
  it('drops the rows left empty and trims the others', () => {
    expect(
      cleanLinkDrafts([
        { label: '', url: '  ' },
        { label: ' Site ', url: ' example.com ' },
      ]),
    ).toEqual({ links: [{ label: 'Site', url: 'https://example.com' }], problem: null });
  });

  it('names the first row and field that is wrong, and keeps what came before it', () => {
    expect(
      cleanLinkDrafts([
        { label: 'A', url: 'a.example.com' },
        { label: '', url: 'b.example.com' },
        { label: 'C', url: 'not a link' },
      ]),
    ).toEqual({
      links: [{ label: 'A', url: 'https://a.example.com' }],
      problem: { index: 1, field: 'label' },
    });
    expect(cleanLinkDrafts([{ label: 'C', url: 'javascript:alert(1)' }]).problem).toEqual({
      index: 0,
      field: 'url',
    });
    expect(cleanLinkDrafts([{ label: 'C', url: '' }]).problem).toEqual({ index: 0, field: 'url' });
  });
});

describe('buildAuthorPublicUrl', () => {
  it("is the author's page under the server's own address", () => {
    expect(buildAuthorPublicUrl('https://keres.example.com/', 'ana maria')).toBe(
      'https://keres.example.com/showcase/author/ana%20maria',
    );
  });
});
