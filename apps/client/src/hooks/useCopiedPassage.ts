import { stripMarkdownText } from '@keres/shared';
import * as Clipboard from 'expo-clipboard';

const MAX_PASSAGE = 2000;
const squash = (text: string) => text.replace(/\s+/g, ' ').trim();

/**
 * The passage of `body` the reader just copied, or null.
 *
 * Native `Text` exposes no selection (the web reads the DOM's), so the way to quote a passage on a
 * phone is the system's own: select it, tap Copy, then comment. Whatever is on the clipboard counts
 * only if it is really a stretch of this scene's text - a copied link or an old note must never
 * turn into an excerpt.
 */
export async function readCopiedPassage(body: string | null | undefined): Promise<string | null> {
  if (!body) return null;
  try {
    const copied = squash(await Clipboard.getStringAsync());
    if (!copied || copied.length > MAX_PASSAGE) return null;
    return squash(stripMarkdownText(body)).includes(copied) ? copied : null;
  } catch {
    // No clipboard access (denied, or not available): the thread opens without a quote.
    return null;
  }
}
