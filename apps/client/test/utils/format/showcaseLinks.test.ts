import { parseShowcaseLink, resolveShowcaseLink } from '@/src/utils/format/showcaseLinks';

describe('parseShowcaseLink', () => {
  const ok = (text: string) => {
    const parsed = parseShowcaseLink(text);
    if (!parsed.ok) throw new Error(`${text}: ${parsed.problem}`);
    return parsed;
  };

  it('reads each page of a showcase', () => {
    const base = 'https://keres.example';
    expect(ok(`${base}/showcase/story/S1`).target).toEqual({ kind: 'story', storyId: 'S1' });
    expect(ok(`${base}/showcase/story/S1/read/P1`).target).toEqual({
      kind: 'read',
      storyId: 'S1',
      publicationId: 'P1',
    });
    expect(ok(`${base}/showcase/author/ana`).target).toEqual({ kind: 'author', username: 'ana' });
    expect(ok(`${base}/showcase/pack/K1`).target).toEqual({ kind: 'pack', packId: 'K1' });
    expect(ok(`${base}/showcase`).target).toEqual({ kind: 'stories' });
    expect(ok(`${base}/showcase/`).target).toEqual({ kind: 'stories' });
    expect(ok(`${base}/showcase/authors`).target).toEqual({ kind: 'authors' });
    expect(ok(`${base}/showcase/packs`).target).toEqual({ kind: 'packs' });
    expect(ok(`${base}/showcase/about`).target).toEqual({ kind: 'server' });
  });

  it('takes the bare address of a server, and of its hosted client, as the server', () => {
    expect(ok('https://keres.example').target).toEqual({ kind: 'server' });
    expect(ok('https://keres.example/').target).toEqual({ kind: 'server' });
    expect(ok('https://keres.example/client/').target).toEqual({ kind: 'server' });
  });

  it('ignores the query and the hash, and decodes the author name', () => {
    const parsed = ok('https://keres.example/showcase/author/j%C3%BAlia?x=1#top');
    expect(parsed.target).toEqual({ kind: 'author', username: 'júlia' });
  });

  it('gives the origin the form servers are compared by', () => {
    expect(ok('HTTPS://Keres.Example:443/showcase/story/S1').origin).toBe('https://keres.example');
    expect(ok('http://localhost:3187/showcase/story/S1').origin).toBe('http://localhost:3187');
  });

  it('forgives a sentence, quotes and brackets around the address', () => {
    expect(ok('  look at this: https://keres.example/showcase/story/S1 !! ').target).toEqual({
      kind: 'story',
      storyId: 'S1',
    });
    expect(ok('<https://keres.example/showcase/story/S1>').target.kind).toBe('story');
    expect(ok('"https://keres.example/showcase/story/S1".').target.kind).toBe('story');
  });

  it('assumes https for an address without a scheme, and http only for a local one', () => {
    expect(ok('keres.example/showcase/story/S1').url).toBe(
      'https://keres.example/showcase/story/S1',
    );
    expect(ok('localhost:3187/showcase/story/S1').url).toBe(
      'http://localhost:3187/showcase/story/S1',
    );
    expect(ok('192.168.0.5:3000').origin).toBe('http://192.168.0.5:3000');
    expect(ok('[::1]:3000/showcase').origin).toBe('http://[::1]:3000');
  });

  it('refuses what is not an address', () => {
    expect(parseShowcaseLink('')).toEqual({ ok: false, problem: 'empty' });
    expect(parseShowcaseLink('   ')).toEqual({ ok: false, problem: 'empty' });
    for (const text of ['hello', 'hello world', 'just a sentence.', 'https://', 'mailto:a@b.com']) {
      expect(parseShowcaseLink(text)).toEqual({ ok: false, problem: 'not_a_url' });
    }
    expect(parseShowcaseLink('https://user:pass@keres.example/showcase')).toEqual({
      ok: false,
      problem: 'not_a_url',
    });
    expect(parseShowcaseLink('https://singlelabel/showcase')).toEqual({
      ok: false,
      problem: 'not_a_url',
    });
  });

  it('refuses a scheme that is not the web', () => {
    for (const text of [
      'ftp://keres.example/showcase',
      'file:///etc/passwd',
      'ws://keres.example',
    ]) {
      expect(parseShowcaseLink(text)).toEqual({ ok: false, problem: 'unsupported_scheme' });
    }
  });

  it('refuses plain http outside this device and the local network, but hands the address back', () => {
    expect(parseShowcaseLink('http://keres.example/showcase/story/S1')).toEqual({
      ok: false,
      problem: 'insecure_http',
      url: 'http://keres.example/showcase/story/S1',
    });
  });

  it('says when the address is valid but not a page of a showcase', () => {
    for (const path of [
      '/pricing',
      '/showcase/story',
      '/showcase/story/S1/edit',
      '/showcase/nope/x',
    ]) {
      expect(parseShowcaseLink(`https://keres.example${path}`)).toEqual({
        ok: false,
        problem: 'not_showcase',
        url: `https://keres.example${path}`,
      });
    }
  });

  it('is not fooled by a path that does not decode', () => {
    expect(parseShowcaseLink('https://keres.example/showcase/author/%E0%A4%A')).toMatchObject({
      ok: false,
      problem: 'not_showcase',
    });
  });
});

describe('resolveShowcaseLink', () => {
  const servers = [
    { id: 'a', url: 'https://keres.example' },
    { id: 'b', url: 'http://localhost:3187/' },
  ];

  it("recognizes a registered server's link however its address is written", () => {
    for (const text of [
      'https://keres.example/showcase/story/S1',
      'https://KERES.example:443/showcase/story/S1',
      'keres.example/showcase/story/S1',
    ]) {
      expect(resolveShowcaseLink(text, servers)).toMatchObject({
        kind: 'registered',
        server: servers[0],
        target: { kind: 'story', storyId: 'S1' },
      });
    }
    expect(resolveShowcaseLink('localhost:3187/showcase', servers)).toMatchObject({
      kind: 'registered',
      server: servers[1],
    });
  });

  it('takes the link of any other server as a guest', () => {
    expect(resolveShowcaseLink('https://other.example/showcase/pack/K1', servers)).toEqual({
      kind: 'guest',
      origin: 'https://other.example',
      target: { kind: 'pack', packId: 'K1' },
      url: 'https://other.example/showcase/pack/K1',
    });
    // The same machine under another name is another address, as far as the app can tell.
    expect(resolveShowcaseLink('http://127.0.0.1:3187/showcase', servers).kind).toBe('guest');
  });

  it('passes the problem on', () => {
    expect(resolveShowcaseLink('nonsense', servers)).toEqual({
      kind: 'invalid',
      problem: 'not_a_url',
      url: undefined,
    });
    expect(resolveShowcaseLink('https://other.example/pricing', servers)).toMatchObject({
      kind: 'invalid',
      problem: 'not_showcase',
      url: 'https://other.example/pricing',
    });
  });
});
