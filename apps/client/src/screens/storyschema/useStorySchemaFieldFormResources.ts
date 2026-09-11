import { useRef } from 'react';
import { useDrizzle } from '../../db';
import {
  createStorySchemaFieldService,
  type StorySchemaFieldService,
} from '../../services/storymanagement/StorySchemaFieldService';

/** Owns the story-schema field service used by the form. */
export function useStorySchemaFieldFormResources() {
  const drizzleDb = useDrizzle();
  const storySchemaFieldServiceRef = useRef<StorySchemaFieldService | null>(null);
  storySchemaFieldServiceRef.current ??= createStorySchemaFieldService(drizzleDb);

  return {
    drizzleDb,
    storySchemaFieldServiceRef,
  };
}
