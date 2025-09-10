import type { Suggestion } from '@domain/entities/Suggestion'
import type { ISuggestionRepository } from '@domain/repositories/ISuggestionRepository'
import type { ListQueryParams, PaginatedResponse } from '@keres/shared'

import { db, suggestions } from '@infrastructure/db' // Import db and suggestions table
import { and, asc, desc, eq, isNull, like, or, sql } from 'drizzle-orm' // Import sql

export class SuggestionRepository implements ISuggestionRepository {
  async findById(id: string): Promise<Suggestion | null> {
    try {
      const result = await db.select().from(suggestions).where(eq(suggestions.id, id)).limit(1)
      return result.length > 0 ? this.toDomain(result[0]) : null
    } catch (error) {
      console.error('Error in SuggestionRepository.findById:', error)
      throw error
    }
  }

  async findByUserId(userId: string, query?: ListQueryParams): Promise<PaginatedResponse<Suggestion>> {
    try {
      let baseQuery = db.select().from(suggestions).where(eq(suggestions.userId, userId));

      // Define allowed filterable fields and their Drizzle column mappings
      const filterableFields = {
        type: suggestions.type,
        value: suggestions.value,
        isDefault: suggestions.isDefault,
        scope: suggestions.scope,
        storyId: suggestions.storyId,
        // Add other filterable fields here
      }

      // Generic filtering (Revised)
      if (query?.filter) {
        for (const key in query.filter) {
          if (Object.hasOwn(query.filter, key)) {
            const value = query.filter[key];
            const column = filterableFields[key as keyof typeof filterableFields];
            if (column) {
              baseQuery = baseQuery.where(
                and(eq(suggestions.userId, userId), eq(column, value)),
              );
            }
          }
        }
      }

      // Build the count query based on the same filters
      let countQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(suggestions)
        .where(eq(suggestions.userId, userId)); // Start with the base where clause

      if (query?.filter) {
        for (const key in query.filter) {
          if (Object.hasOwn(query.filter, key)) {
            const value = query.filter[key];
            const column = filterableFields[key as keyof typeof filterableFields];
            if (column) {
              countQuery = countQuery.where(
                and(eq(suggestions.userId, userId), eq(column, value)),
              );
            }
          }
        }
      }

      const totalItemsResult = await countQuery;
      const totalItems = totalItemsResult[0].count;

      // Now apply sorting and pagination to the main query
      let finalQuery = baseQuery;

      // Define allowed sortable fields and their Drizzle column mappings
      const sortableFields = {
        type: suggestions.type,
        value: suggestions.value,
        createdAt: suggestions.createdAt,
        updatedAt: suggestions.updatedAt,
        // Add other sortable fields here
      }
      // Sorting (Revised)
      if (query?.sort_by) {
        const sortColumn = sortableFields[query.sort_by as keyof typeof sortableFields];
        if (sortColumn) {
          if (query.order === 'desc') {
            finalQuery = finalQuery.orderBy(desc(sortColumn));
          } else {
            finalQuery = finalQuery.orderBy(asc(sortColumn));
          }
        }
      }

      // Pagination
      if (query?.limit) {
        finalQuery = finalQuery.limit(query.limit);
        if (query.page) {
          const offset = (query.page - 1) * query.limit;
          finalQuery = finalQuery.offset(offset);
        }
      }

      const results = await finalQuery;
      const items = results.map(this.toDomain);

      return { items, totalItems };
    } catch (error) {
      console.error('Error in SuggestionRepository.findByUserId:', error);
      throw error;
    }
  }

  async findByStoryId(storyId: string, query?: ListQueryParams): Promise<PaginatedResponse<Suggestion>> {
    try {
      let baseQuery = db.select().from(suggestions).where(eq(suggestions.storyId, storyId));

      // Define allowed filterable fields and their Drizzle column mappings
      const filterableFields = {
        type: suggestions.type,
        value: suggestions.value,
        isDefault: suggestions.isDefault,
        scope: suggestions.scope,
        userId: suggestions.userId,
        // Add other filterable fields here
      }

      // Generic filtering (Revised)
      if (query?.filter) {
        for (const key in query.filter) {
          if (Object.hasOwn(query.filter, key)) {
            const value = query.filter[key];
            const column = filterableFields[key as keyof typeof filterableFields];
            if (column) {
              baseQuery = baseQuery.where(and(eq(suggestions.storyId, storyId), eq(column, value)));
            }
          }
        }
      }

      // Build the count query based on the same filters
      let countQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(suggestions)
        .where(eq(suggestions.storyId, storyId)); // Start with the base where clause

      if (query?.filter) {
        for (const key in query.filter) {
          if (Object.hasOwn(query.filter, key)) {
            const value = query.filter[key];
            const column = filterableFields[key as keyof typeof filterableFields];
            if (column) {
              countQuery = countQuery.where(and(eq(suggestions.storyId, storyId), eq(column, value)));
            }
          }
        }
      }

      const totalItemsResult = await countQuery;
      const totalItems = totalItemsResult[0].count;

      // Now apply sorting and pagination to the main query
      let finalQuery = baseQuery;

      // Define allowed sortable fields and their Drizzle column mappings
      const sortableFields = {
        type: suggestions.type,
        value: suggestions.value,
        createdAt: suggestions.createdAt,
        updatedAt: suggestions.updatedAt,
        // Add other sortable fields here
      }
      // Sorting (Revised)
      if (query?.sort_by) {
        const sortColumn = sortableFields[query.sort_by as keyof typeof sortableFields];
        if (sortColumn) {
          if (query.order === 'desc') {
            finalQuery = finalQuery.orderBy(desc(sortColumn));
          } else {
            finalQuery = finalQuery.orderBy(asc(sortColumn));
          }
        }
      }

      // Pagination
      if (query?.limit) {
        finalQuery = finalQuery.limit(query.limit);
        if (query.page) {
          const offset = (query.page - 1) * query.limit;
          finalQuery = finalQuery.offset(offset);
        }
      }

      const results = await finalQuery;
      const items = results.map(this.toDomain);

      return { items, totalItems };
    } catch (error) {
      console.error('Error in SuggestionRepository.findByStoryId:', error);
      throw error;
    }
  }

  async findByType(type: string, userId: string, storyId: string | null, query?: ListQueryParams): Promise<PaginatedResponse<Suggestion>> {
    try {
      let baseQuery = db.select().from(suggestions);
      let countQuery = db.select({ count: sql<number>`count(*)` }).from(suggestions);

      const conditions = [eq(suggestions.type, type)];

      // Add user-specific filtering for global suggestions
      // If storyId is null, it means we are looking for global suggestions
      if (storyId === null) {
        conditions.push(eq(suggestions.userId, userId));
        conditions.push(isNull(suggestions.storyId)); // Ensure it's a global suggestion
      } else {
        // If storyId is provided, it means we are looking for story-specific suggestions
        conditions.push(eq(suggestions.storyId, storyId));
      }

      // Apply generic filtering from query params
      const filterableFields = {
        value: suggestions.value,
        isDefault: suggestions.isDefault,
        scope: suggestions.scope,
        // userId and storyId are handled by the main conditions
      };

      if (query?.filter) {
        for (const key in query.filter) {
          if (Object.hasOwn(query.filter, key)) {
            const value = query.filter[key];
            const column = filterableFields[key as keyof typeof filterableFields];
            if (column) {
              conditions.push(eq(column, value));
            }
          }
        }
      }

      // Apply all conditions to both baseQuery and countQuery
      baseQuery = baseQuery.where(and(...conditions));
      countQuery = countQuery.where(and(...conditions));

      const totalItemsResult = await countQuery;
      const totalItems = totalItemsResult[0].count;

      // Now apply sorting and pagination to the main query
      let finalQuery = baseQuery;

      const sortableFields = {
        value: suggestions.value,
        createdAt: suggestions.createdAt,
        updatedAt: suggestions.updatedAt,
      };

      if (query?.sort_by) {
        const sortColumn = sortableFields[query.sort_by as keyof typeof sortableFields];
        if (sortColumn) {
          if (query.order === 'desc') {
            finalQuery = finalQuery.orderBy(desc(sortColumn));
          } else {
            finalQuery = finalQuery.orderBy(asc(sortColumn));
          }
        }
      }

      if (query?.limit) {
        finalQuery = finalQuery.limit(query.limit);
        if (query.page) {
          const offset = (query.page - 1) * query.limit;
          finalQuery = finalQuery.offset(offset);
        }
      }

      const results = await finalQuery;
      const items = results.map(this.toDomain);

      return { items, totalItems };
    } catch (error) {
      console.error('Error in SuggestionRepository.findByType:', error);
      throw error;
    }
  }

  async findByUserAndType(
    userId: string,
    type: string,
    query?: ListQueryParams,
  ): Promise<PaginatedResponse<Suggestion>> {
    try {
      let baseQuery = db
        .select()
        .from(suggestions)
        .where(and(eq(suggestions.userId, userId), eq(suggestions.type, type)));

      // Define allowed filterable fields and their Drizzle column mappings
      const filterableFields = {
        value: suggestions.value,
        isDefault: suggestions.isDefault,
        scope: suggestions.scope,
        storyId: suggestions.storyId,
        // Add other filterable fields here
      }

      // Generic filtering (Revised)
      if (query?.filter) {
        for (const key in query.filter) {
          if (Object.hasOwn(query.filter, key)) {
            const value = query.filter[key];
            const column = filterableFields[key as keyof typeof filterableFields];
            if (column) {
              baseQuery = baseQuery.where(
                and(eq(suggestions.userId, userId), eq(suggestions.type, type), eq(column, value)),
              );
            }
          }
        }
      }

      // Build the count query based on the same filters
      let countQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(suggestions)
        .where(and(eq(suggestions.userId, userId), eq(suggestions.type, type))); // Start with the base where clause

      if (query?.filter) {
        for (const key in query.filter) {
          if (Object.hasOwn(query.filter, key)) {
            const value = query.filter[key];
            const column = filterableFields[key as keyof typeof filterableFields];
            if (column) {
              countQuery = countQuery.where(
                and(eq(suggestions.userId, userId), eq(suggestions.type, type), eq(column, value)),
              );
            }
          }
        }
      }

      const totalItemsResult = await countQuery;
      const totalItems = totalItemsResult[0].count;

      // Now apply sorting and pagination to the main query
      let finalQuery = baseQuery;

      // Define allowed sortable fields and their Drizzle column mappings
      const sortableFields = {
        value: suggestions.value,
        createdAt: suggestions.createdAt,
        updatedAt: suggestions.updatedAt,
        // Add other sortable fields here
      }
      // Sorting (Revised)
      if (query?.sort_by) {
        const sortColumn = sortableFields[query.sort_by as keyof typeof sortableFields];
        if (sortColumn) {
          if (query.order === 'desc') {
            finalQuery = finalQuery.orderBy(desc(sortColumn));
          } else {
            finalQuery = finalQuery.orderBy(asc(sortColumn));
          }
        }
      }

      // Pagination
      if (query?.limit) {
        finalQuery = finalQuery.limit(query.limit);
        if (query.page) {
          const offset = (query.page - 1) * query.limit;
          finalQuery = finalQuery.offset(offset);
        }
      }

      const results = await finalQuery;
      const items = results.map(this.toDomain);

      return { items, totalItems };
    } catch (error) {
      console.error('Error in SuggestionRepository.findByUserAndType:', error);
      throw error;
    }
  }

  async findByStoryAndType(
    storyId: string,
    type: string,
    query?: ListQueryParams,
  ): Promise<PaginatedResponse<Suggestion>> {
    try {
      let baseQuery = db
        .select()
        .from(suggestions)
        .where(and(eq(suggestions.storyId, storyId), eq(suggestions.type, type)));

      // Define allowed filterable fields and their Drizzle column mappings
      const filterableFields = {
        value: suggestions.value,
        isDefault: suggestions.isDefault,
        scope: suggestions.scope,
        userId: suggestions.userId,
        // Add other filterable fields here
      }

      // Generic filtering (Revised)
      if (query?.filter) {
        for (const key in query.filter) {
          if (Object.hasOwn(query.filter, key)) {
            const value = query.filter[key];
            const column = filterableFields[key as keyof typeof filterableFields];
            if (column) {
              baseQuery = baseQuery.where(
                and(
                  eq(suggestions.storyId, storyId),
                  eq(suggestions.type, type),
                  eq(column, value),
                ),
              );
            }
          }
        }
      }

      // Build the count query based on the same filters
      let countQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(suggestions)
        .where(and(eq(suggestions.storyId, storyId), eq(suggestions.type, type))); // Start with the base where clause

      if (query?.filter) {
        for (const key in query.filter) {
          if (Object.hasOwn(query.filter, key)) {
            const value = query.filter[key];
            const column = filterableFields[key as keyof typeof filterableFields];
            if (column) {
              countQuery = countQuery.where(
                and(
                  eq(suggestions.storyId, storyId),
                  eq(suggestions.type, type),
                  eq(column, value),
                ),
              );
            }
          }
        }
      }

      const totalItemsResult = await countQuery;
      const totalItems = totalItemsResult[0].count;

      // Now apply sorting and pagination to the main query
      let finalQuery = baseQuery;

      // Define allowed sortable fields and their Drizzle column mappings
      const sortableFields = {
        value: suggestions.value,
        createdAt: suggestions.createdAt,
        updatedAt: suggestions.updatedAt,
        // Add other sortable fields here
      }
      // Sorting (Revised)
      if (query?.sort_by) {
        const sortColumn = sortableFields[query.sort_by as keyof typeof sortableFields];
        if (sortColumn) {
          if (query.order === 'desc') {
            finalQuery = finalQuery.orderBy(desc(sortColumn));
          } else {
            finalQuery = finalQuery.orderBy(asc(sortColumn));
          }
        }
      }

      // Pagination
      if (query?.limit) {
        finalQuery = finalQuery.limit(query.limit);
        if (query.page) {
          const offset = (query.page - 1) * query.limit;
          finalQuery = finalQuery.offset(offset);
        }
      }

      const results = await finalQuery;
      const items = results.map(this.toDomain);

      return { items, totalItems };
    } catch (error) {
      console.error('Error in SuggestionRepository.findByStoryAndType:', error);
      throw error;
    }
  }

  async save(suggestionData: Suggestion): Promise<void> {
    try {
      await db.insert(suggestions).values(this.toPersistence(suggestionData))
    } catch (error) {
      console.error('Error in SuggestionRepository.save:', error)
      throw error
    }
  }

  async saveMany(suggestionsData: Suggestion[]): Promise<void> {
    try {
      if (suggestionsData.length === 0) {
        return
      }
      const persistenceData = suggestionsData.map(this.toPersistence)
      await db.insert(suggestions).values(persistenceData)
    } catch (error) {
      console.error('Error in SuggestionRepository.saveMany:', error)
      throw error
    }
  }

  async update(
    suggestionData: Suggestion,
    userId: string,
    scope: string,
    storyId: string | null,
  ): Promise<void> {
    try {
      const conditions = [eq(suggestions.id, suggestionData.id), eq(suggestions.userId, userId)]

      if (scope === 'story') {
        if (storyId) {
          conditions.push(eq(suggestions.storyId, storyId))
        } else {
          // This case should ideally be caught by the use case, but as a safeguard
          conditions.push(isNull(suggestions.storyId)) // Ensure it never matches
        }
      } else if (scope === 'global') {
        conditions.push(isNull(suggestions.storyId))
      }

      await db
        .update(suggestions)
        .set(this.toPersistence(suggestionData))
        .where(and(...conditions))
    } catch (error) {
      console.error('Error in SuggestionRepository.update:', error)
      throw error
    }
  }

  async updateMany(suggestionsData: Suggestion[]): Promise<void> {
    try {
      if (suggestionsData.length === 0) {
        return
      }
      await db.transaction(async (tx: any) => {
        for (const suggestionData of suggestionsData) {
          const conditions = [
            eq(suggestions.id, suggestionData.id),
            eq(suggestions.userId, suggestionData.userId),
          ]

          if (suggestionData.scope === 'story') {
            if (suggestionData.storyId) {
              conditions.push(eq(suggestions.storyId, suggestionData.storyId))
            } else {
              conditions.push(isNull(suggestions.storyId))
            }
          }
          else if (suggestionData.scope === 'global') {
            conditions.push(isNull(suggestions.storyId))
          }

          await tx
            .update(suggestions)
            .set(this.toPersistence(suggestionData))
            .where(and(...conditions))
        }
      })
    } catch (error) {
      console.error('Error in SuggestionRepository.updateMany:', error)
      throw error
    }
  }

  async delete(id: string, userId: string, scope: string, storyId: string | null): Promise<void> {
    try {
      const conditions = [eq(suggestions.id, id), eq(suggestions.userId, userId)]

      if (scope === 'story') {
        if (storyId) {
          conditions.push(eq(suggestions.storyId, storyId))
        } else {
          // This case should ideally be caught by the use case, but as a safeguard
          conditions.push(isNull(suggestions.storyId)) // Ensure it never matches
        }
      }
      else if (scope === 'global') {
        conditions.push(isNull(suggestions.storyId))
      }

      await db.delete(suggestions).where(and(...conditions))
    } catch (error) {
      console.error('Error in SuggestionRepository.delete:', error)
      throw error
    }
  }

  private toDomain(data: typeof suggestions.$inferSelect): Suggestion {
    return {
      id: data.id,
      userId: data.userId,
      scope: data.scope as 'global' | 'story', // Type assertion for enum
      storyId: data.storyId,
      type: data.type,
      value: data.value,
      isDefault: data.isDefault,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }
  }

  private toPersistence(suggestionData: Suggestion): typeof suggestions.$inferInsert {
    return {
      id: suggestionData.id,
      userId: suggestionData.userId,
      scope: suggestionData.scope,
      storyId: suggestionData.storyId,
      type: suggestionData.type,
      value: suggestionData.value,
      createdAt: suggestionData.createdAt,
      updatedAt: suggestionData.updatedAt,
    }
  }

  async search(query: string, userId: string): Promise<Suggestion[]> {
    try {
      const results = await db
        .select()
        .from(suggestions)
        .where(and(eq(suggestions.userId, userId), or(like(suggestions.value, `%${query}%`))))
      return results.map(this.toDomain)
    } catch (error) {
      console.error('Error in SuggestionRepository.search:', error)
      throw error
    }
  }
}
