import * as Clipboard from 'expo-clipboard';
import { readCopiedPassage } from '../../src/hooks/useCopiedPassage';

const copied = (text: string) =>
  (Clipboard.getStringAsync as jest.Mock).mockResolvedValueOnce(text);

const BODY =
  'The road out of the valley wound between **old stones**.\n\nBy dusk the wind had turned.';

describe('readCopiedPassage', () => {
  it('offers what was copied when it is a stretch of the scene, whatever the markup or line breaks', async () => {
    copied('wound between old stones.');
    expect(await readCopiedPassage(BODY)).toBe('wound between old stones.');

    copied('stones. By dusk');
    expect(await readCopiedPassage(BODY)).toBe('stones. By dusk');
  });

  it('refuses anything that is not in the scene: a link, an old note, nothing at all', async () => {
    copied('https://example.com');
    expect(await readCopiedPassage(BODY)).toBeNull();
    copied('');
    expect(await readCopiedPassage(BODY)).toBeNull();
    copied('   ');
    expect(await readCopiedPassage(BODY)).toBeNull();
  });

  it('refuses a scene without a body, and a passage too long to be a quote', async () => {
    copied('anything');
    expect(await readCopiedPassage(null)).toBeNull();

    const long = 'word '.repeat(600).trim();
    copied(long);
    expect(await readCopiedPassage(long)).toBeNull();
  });

  it('opens without a quote when the clipboard cannot be read', async () => {
    (Clipboard.getStringAsync as jest.Mock).mockRejectedValueOnce(new Error('denied'));
    expect(await readCopiedPassage(BODY)).toBeNull();
  });
});
