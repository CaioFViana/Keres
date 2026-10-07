import { sceneMusicWord, sceneMusicWordKey } from '../../src/utils/sceneMusicWords';

describe('sceneMusicWord', () => {
  it('calls it music in a novel and in a work with no medium yet', () => {
    expect(sceneMusicWord('generic')).toBe('music');
    expect(sceneMusicWord(null)).toBe('music');
    expect(sceneMusicWord(undefined)).toBe('music');
    expect(sceneMusicWord('something-new')).toBe('music');
  });

  it('calls it cues in a screenplay, table music in a campaign, a soundtrack in the visual works', () => {
    expect(sceneMusicWord('screenplay')).toBe('cues');
    expect(sceneMusicWord('campaign')).toBe('table');
    expect(sceneMusicWord('comic')).toBe('soundtrack');
    expect(sceneMusicWord('storyboard')).toBe('soundtrack');
  });

  it('names the translation key of the word', () => {
    expect(sceneMusicWordKey('screenplay')).toBe('scene_music_word_cues');
    expect(sceneMusicWordKey(null)).toBe('scene_music_word_music');
  });
});
