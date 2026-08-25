/**
 * @jest-environment node
 */
import { buildStoryPublicUrl } from '../../src/screens/enterstack/PublishStoryScreen';

describe('buildStoryPublicUrl', () => {
  it('points at the story page of the same server the story syncs with', () => {
    expect(buildStoryPublicUrl('https://keres.example', 'story-1')).toBe(
      'https://keres.example/story/story-1',
    );
  });

  // Servers are registered by hand; a trailing slash is common and must not become a `//`.
  it('tolerates a trailing slash in the server address', () => {
    expect(buildStoryPublicUrl('https://keres.example/', 'story-1')).toBe(
      'https://keres.example/story/story-1',
    );
    expect(buildStoryPublicUrl('https://keres.example///', 'story-1')).toBe(
      'https://keres.example/story/story-1',
    );
  });

  it('keeps a port and a custom scheme', () => {
    expect(buildStoryPublicUrl('http://localhost:3000', 'story-1')).toBe(
      'http://localhost:3000/story/story-1',
    );
  });
});
