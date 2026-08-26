import { aliceInWonderland } from './narratives/aliceInWonderland';
import { beautyAndTheBeast } from './narratives/beautyAndTheBeast';
import { cinderella } from './narratives/cinderella';
import { goldilocks } from './narratives/goldilocks';
import { littleMermaid } from './narratives/littleMermaid';
import { princessKaguya } from './narratives/princessKaguya';
import type { LocalizedNarrative } from './narratives/types';

export type { LocalizedNarrative, StoryNarrative } from './narratives/types';

/** Every story whose narrative has been authored, by slug. */
export const exampleStoryNarratives: Record<string, LocalizedNarrative> = {
  'alice-in-wonderland': aliceInWonderland,
  'beauty-and-the-beast': beautyAndTheBeast,
  cinderella,
  goldilocks,
  'little-mermaid': littleMermaid,
  'princess-kaguya': princessKaguya,
};
