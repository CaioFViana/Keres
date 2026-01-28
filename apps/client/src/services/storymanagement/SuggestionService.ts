import { and, eq, sql } from 'drizzle-orm';
import { AppDrizzleClient, characterRelations, characters, itemJourneys, items, suggestions } from '../../db';
import { createULID } from '../../utils/entityUtils'; // Changed ulid import
// Import other schemas as needed

// Define a flexible configuration for suggestion types
// This maps a suggestion 'type' to its Drizzle schema, the column to query for dynamic data,
// and optionally a column for filtering by storyId if not directly on the schema.
const suggestionConfig = {
  character_gender: {
    schema: characters,
    column: characters.gender,
  },
  character_race: {
    schema: characters,
    column: characters.race,
  },
  character_subrace: {
    schema: characters,
    column: characters.subrace,
  },
  characterRelation_type: {
    schema: characterRelations,
    column: characterRelations.relationType,
  },
  item_category: {
    schema: items,
    column: items.category,
  },
  item_initial_state: {
    schema: items,
    column: items.initialState,
  },
  item_state: {
    schema: itemJourneys,
    column: itemJourneys.newState,
  },
  // Add more configurations as the system evolves
};

export type SuggestionType = keyof typeof suggestionConfig;

export interface SuggestionServiceInterface {
  getSuggestions(type: SuggestionType, storyId: string): Promise<[string, number][]>;
  addSuggestion(type: SuggestionType, value: string, storyId: string): Promise<string | null>;
  removeSuggestion(id: string): Promise<boolean>;
}

export const createSuggestionService = (db: AppDrizzleClient): SuggestionServiceInterface => {
  return {
    /**
     * Retrieves a unique list of suggestions for a given type and story, along with their counts.
     * Suggestions are sourced from the 'suggestions' table and dynamic data from entity tables.
     * @param type The type of suggestion to retrieve (e.g., 'character_gender').
     * @param storyId The ID of the story to fetch suggestions for.
     * @returns A promise that resolves to an array of [suggestion string, count] tuples.
     */
    async getSuggestions(type: SuggestionType, storyId: string): Promise<[string, number][]> {
      if (!storyId) {
        console.error('getSuggestions: storyId is required.');
        return [];
      }

      const config = suggestionConfig[type];

      if (!config) {
        console.warn(`getSuggestions: No configuration found for suggestion type: ${type}`);
        return [];
      }

      const suggestionCounts = new Map<string, number>();

      try {
        // 1. Fetch suggestions from the 'suggestions' table
        const predefinedSuggestions = await db.select({ value: suggestions.value })
          .from(suggestions)
          .where(and(eq(suggestions.type, type), eq(suggestions.storyId, storyId), eq(suggestions.isDeleted, false)))
          .all();

        predefinedSuggestions.forEach(s => {
          if (s.value) {
            // Predefined suggestions don't have a direct count from entities,
            // but we add them to ensure they are always included.
            // Their count will be updated if they also appear in dynamic data.
            if (!suggestionCounts.has(s.value)) {
              suggestionCounts.set(s.value, 0); // Initialize count for user-added suggestions
            }
          }
        });

        // 2. Dynamically query unique values and their counts from the entity table
        const dynamicCounts = await db.select({
            value: config.column,
            count: sql<number>`count(*)`,
          })
          .from(config.schema)
          .where(and(eq(config.schema.storyId, storyId), eq(config.schema.isDeleted, false))) // Assuming isDeleted column exists and should be filtered
          .groupBy(config.column)
          .all();

        dynamicCounts.forEach(row => {
          const value = row.value;
          const count = row.count;
          if (value && typeof value === 'string') {
            suggestionCounts.set(value, (suggestionCounts.get(value) || 0) + count);
          }
        });

      } catch (error) {
        console.error(`Error fetching suggestions for type ${type} and story ${storyId}:`, error);
        return [];
      }

      return Array.from(suggestionCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    },

    /**
     * Adds a new suggestion to the 'suggestions' table.
     * @param type The type of suggestion.
     * @param value The suggestion value.
     * @param storyId The ID of the story this suggestion belongs to.
     * @returns The newly inserted suggestion.
     */
    async addSuggestion(type: SuggestionType, value: string, storyId: string): Promise<string | null> {
      if (!value || !type || !storyId) {
        console.error('addSuggestion: type, value, and storyId are required.');
        return null;
      }

      try {
        // Check if the suggestion already exists for this type and story
        const existing = await db.select()
          .from(suggestions)
          .where(and(
            eq(suggestions.type, type),
            eq(suggestions.value, value),
            eq(suggestions.storyId, storyId),
            eq(suggestions.isDeleted, false)
          ))
          .limit(1)
          .get(); // .get() for expo-sqlite

        if (existing) {
          // console.log(`Suggestion '${value}' of type '${type}' already exists for story '${storyId}'.`);
          return existing.value;
        }

        const newSuggestion = {
          id: createULID(),
          storyId,
          type,
          value,
          isDefault: false, // User-added suggestions are not defaults
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
          isDeleted: false,
          deletedAt: null,
        };

        await db.insert(suggestions).values(newSuggestion).run(); // .run() for expo-sqlite

        return newSuggestion.value;
      } catch (error) {
        console.error(`Error adding suggestion '${value}' for type ${type} and story ${storyId}:`, error);
        return null;
      }
    },

    /**
     * Removes a suggestion from the 'suggestions' table if it's not a default one.
     * @param id The ID of the suggestion to remove.
     * @returns True if the suggestion was removed, false otherwise.
     */
    async removeSuggestion(id: string): Promise<boolean> {
      if (!id) {
        console.error('removeSuggestion: id is required.');
        return false;
      }

      try {
        const existing = await db.select()
          .from(suggestions)
          .where(eq(suggestions.id, id))
          .limit(1)
          .get();

        if (!existing) {
          console.warn(`Suggestion with ID '${id}' not found.`);
          return false;
        }

        if (existing.isDefault) {
          console.warn(`Cannot remove default suggestion with ID '${id}'.`);
          return false;
        }

        await db.update(suggestions)
          .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date(), version: sql`${suggestions.version} + 1` })
          .where(eq(suggestions.id, id))
          .run();
        
        return true;
      } catch (error) {
        console.error(`Error removing suggestion with ID '${id}':`, error);
        return false;
      }
    },
  };
};
