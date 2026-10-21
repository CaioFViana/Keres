import {
  buildAuthorPublicUrl,
  buildPackPublicUrl,
  buildShowcaseUrl,
  buildStoryPublicUrl,
  buildStoryReaderUrl,
} from '@/src/utils/format/showcaseUrls';
import { formatBytes } from '@/src/utils/format/formatBytes';
import { groupShowcaseVersions } from '@/src/utils/format/showcaseVersions';

describe('showcase addresses', () => {
  it('are built under /showcase of the server, whatever the slashes of the stored address', () => {
    for (const server of [
      'https://keres.example',
      'https://keres.example/',
      'https://keres.example///',
    ]) {
      expect(buildShowcaseUrl(server)).toBe('https://keres.example/showcase');
      expect(buildStoryPublicUrl(server, 'S1')).toBe('https://keres.example/showcase/story/S1');
      expect(buildStoryReaderUrl(server, 'S1', 'P1')).toBe(
        'https://keres.example/showcase/story/S1/read/P1',
      );
      expect(buildPackPublicUrl(server, 'K1')).toBe('https://keres.example/showcase/pack/K1');
    }
  });

  it("encode an author's name", () => {
    expect(buildAuthorPublicUrl('https://keres.example', 'júlia d')).toBe(
      'https://keres.example/showcase/author/j%C3%BAlia%20d',
    );
  });
});

describe('formatBytes', () => {
  it('speaks in bytes, kilobytes and megabytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1023)).toBe('1023 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('groupShowcaseVersions', () => {
  const version = (id: string, arcId?: string) =>
    ({
      id,
      arc: arcId
        ? { id: arcId, title: arcId, description: null, author: null, medium: 'generic' }
        : null,
    }) as never;

  it('puts the whole universe first, then each work in the order it appears', () => {
    const groups = groupShowcaseVersions([
      version('w2-new', 'w2'),
      version('u-new'),
      version('w1-new', 'w1'),
      version('w2-old', 'w2'),
      version('u-old'),
    ]);

    expect(groups.map((group) => group.key)).toEqual(['', 'w2', 'w1']);
    expect(groups[0]!.arc).toBeNull();
    expect(groups[1]!.arc?.id).toBe('w2');
    expect(groups.map((group) => group.versions.map((v) => v.id))).toEqual([
      ['u-new', 'u-old'],
      ['w2-new', 'w2-old'],
      ['w1-new'],
    ]);
  });

  it('reads a version that carries no arc field as one of the universe, and an empty list as none', () => {
    expect(groupShowcaseVersions([{ id: 'a' } as never])[0]!.arc).toBeNull();
    expect(groupShowcaseVersions([])).toEqual([]);
  });
});
