import type { BoardContentType, LocationMapContentType } from '@keres/shared';
import { OperationLogEntityType } from '@keres/shared';
import { and, asc, count, desc, eq, getTableColumns, type SQL } from 'drizzle-orm';
import type { Column } from 'drizzle-orm/column';
import { db } from '../db';
import {
  boards,
  galleries,
  locationMaps,
  stories,
  storyInvitations,
  storyPermissions,
  users,
} from '../db/schema';
import type { ApplicationTable } from '../db/schema/columns';
import { insensitiveLike } from '../db/sqlOperators';
import { emitUserEvent } from '../modules/webSocket/webSocket.route';
import { AppError } from '../utils/errors';
import { API_ENTITY_TABLES } from './entity-solvers/ApiEntityTableRegistry';
import { mediaStorageService } from './MediaStorageService';
import { storyNsfwService } from './StoryNsfwService';

const HASH_PATTERN = /^[a-f0-9]{32}$/;

/** Fallback page size and hard ceiling for entity moderation reads. */
export const ADMIN_ENTITY_DEFAULT_PAGE_SIZE = 25;
const ADMIN_ENTITY_MAX_PAGE_SIZE = 100;

interface BrowsableEntityTable {
  entityType: string;
  table: ApplicationTable;
  /** Column binding the rows to the story: `storyId` everywhere, `id` on the story row itself. */
  storyColumn: Column;
  isDeletedColumn: Column | null;
  orderColumn: Column | null;
  idColumn: Column | null;
}

/**
 * Every synced entity table bound to a story, derived from the same registry the sync handlers
 * use - a new entity type becomes browsable without touching this service. Tables with no story
 * binding (users) stay out; the story row matches on its own id.
 */
function browsableEntityTables(): BrowsableEntityTable[] {
  const entries: BrowsableEntityTable[] = [];
  for (const [entityType, table] of Object.entries(API_ENTITY_TABLES)) {
    if (!table) continue;
    const columns = getTableColumns(table);
    const storyColumn =
      columns.storyId ?? (entityType === OperationLogEntityType.Story ? columns.id : undefined);
    if (!storyColumn) continue;
    entries.push({
      entityType,
      table,
      storyColumn,
      isDeletedColumn: columns.isDeleted ?? null,
      orderColumn: columns.updatedAt ?? columns.operationVersion ?? columns.createdAt ?? null,
      idColumn: columns.id ?? null,
    });
  }
  return entries;
}

const BROWSABLE_ENTITIES = browsableEntityTables();

/**
 * A board distilled to what moderation can judge without rendering the canvas: pin labels,
 * free-note texts and edge labels. The JSON may predate the current schema, so everything is
 * read defensively - an unknown shape yields empty lists, never a 500.
 */
function summarizeBoardContent(content: BoardContentType | null | undefined) {
  const nodes = Array.isArray((content as { nodes?: unknown } | null)?.nodes)
    ? (content as { nodes: Array<Record<string, unknown>> }).nodes
    : [];
  const edges = Array.isArray((content as { edges?: unknown } | null)?.edges)
    ? (content as { edges: Array<Record<string, unknown>> }).edges
    : [];
  const entityPins = [];
  const notes = [];
  for (const node of nodes) {
    if (node?.kind === 'entity') {
      entityPins.push({
        entityType: typeof node.entityType === 'string' ? node.entityType : 'unknown',
        entityId: typeof node.entityId === 'string' ? node.entityId : '',
        label: typeof node.labelAtPin === 'string' ? node.labelAtPin : '',
        note: typeof node.cardNote === 'string' ? node.cardNote : null,
      });
    } else if (node?.kind === 'note') {
      notes.push({
        title: typeof node.title === 'string' ? node.title : '',
        body: typeof node.body === 'string' ? node.body : null,
      });
    }
  }
  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    entityPins,
    notes,
    edgeLabels: edges
      .map((edge) => edge?.label)
      .filter((label): label is string => typeof label === 'string' && label.length > 0),
  };
}

/** Same idea for a location map: base images, pinned locations and free-marker texts. */
function summarizeLocationMapContent(content: LocationMapContentType | null | undefined) {
  const record = (content ?? {}) as Record<string, unknown>;
  const images = Array.isArray(record.images) ? record.images : [];
  const nodes = Array.isArray(record.nodes) ? record.nodes : [];
  const markers = Array.isArray(record.markers) ? record.markers : [];
  const relationTexts = Array.isArray(record.relationTexts) ? record.relationTexts : [];
  return {
    imageCount: images.length,
    nodeCount: nodes.length,
    baseGalleryIds: images
      .map((image) => (image as Record<string, unknown>)?.galleryId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
    locationIds: nodes
      .map((node) => (node as Record<string, unknown>)?.locationId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
    markers: (markers as Array<Record<string, unknown>>).map((marker) => ({
      title: typeof marker?.title === 'string' ? marker.title : '',
      note: typeof marker?.note === 'string' ? marker.note : null,
    })),
    relationTexts: (relationTexts as Array<Record<string, unknown>>)
      .map((entry) => entry?.text)
      .filter((text): text is string => typeof text === 'string' && text.length > 0),
  };
}

export interface AdminStoryListQuery {
  search?: string;
  nsfw?: boolean;
  page: number;
  pageSize: number;
}

/**
 * Story-level moderation for the administrators: finding NSFW stories, toggling the flag,
 * removing a collaborator, and reading a story's media, boards and location maps for review.
 * Removing never requires the friendship the owner's own revocation does - the administrator
 * acts outside that relationship.
 */
export class AdminStoryService {
  async list(query: AdminStoryListQuery) {
    const conditions = [];
    if (query.nsfw !== undefined) {
      conditions.push(eq(stories.isNsfw, query.nsfw));
    }
    if (query.search) {
      const pattern = `%${query.search}%`;
      conditions.push(insensitiveLike(stories.title, pattern));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: stories.id,
          title: stories.title,
          isNsfw: stories.isNsfw,
          isDeleted: stories.isDeleted,
          updatedAt: stories.updatedAt,
          ownerUserId: stories.userId,
          ownerUsername: users.username,
          ownerTag: users.tag,
          ownerDeleted: users.isDeleted,
        })
        .from(stories)
        .innerJoin(users, eq(users.id, stories.userId))
        .where(where)
        .orderBy(desc(stories.updatedAt))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      db.select({ total: count() }).from(stories).where(where),
    ]);
    return { items: rows, total, page: query.page, pageSize: query.pageSize };
  }

  /** Toggles the adults-only flag. Turning it on expels whoever is not age-verified, at once. */
  async setNsfw(storyId: string, isNsfw: boolean) {
    const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
    if (!story || story.isDeleted) {
      throw new AppError(404, 'Story not found.');
    }
    const [updated] = await db
      .update(stories)
      .set({ isNsfw, updatedAt: new Date(), version: story.version + 1 })
      .where(eq(stories.id, storyId))
      .returning({ id: stories.id, title: stories.title, isNsfw: stories.isNsfw });
    if (isNsfw) {
      await storyNsfwService.revokeUnverifiedCollaborators(storyId);
    }
    return updated;
  }

  /** Who collaborates on a story right now (owner excluded - they cannot be removed). */
  async collaborators(storyId: string) {
    const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
    if (!story || story.isDeleted) {
      throw new AppError(404, 'Story not found.');
    }
    return db
      .select({
        permissionId: storyPermissions.id,
        userId: users.id,
        username: users.username,
        tag: users.tag,
        permissionType: storyPermissions.permissionType,
      })
      .from(storyPermissions)
      .innerJoin(users, eq(users.id, storyPermissions.userId))
      .where(
        and(
          eq(storyPermissions.storyId, storyId),
          eq(storyPermissions.isDeleted, false),
          eq(users.isDeleted, false),
        ),
      );
  }

  /**
   * Removes one collaborator (and their open invitations) from a story. The owner cannot be
   * removed - the story is theirs. Unlike the owner's revocation, no friendship is required.
   */
  async removeCollaborator(storyId: string, targetUserId: string) {
    const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
    if (!story || story.isDeleted) {
      throw new AppError(404, 'Story not found.');
    }
    if (story.userId === targetUserId) {
      throw new AppError(400, 'The owner cannot be removed from their own story.');
    }
    const permission = await db.query.storyPermissions.findFirst({
      where: and(
        eq(storyPermissions.storyId, storyId),
        eq(storyPermissions.userId, targetUserId),
        eq(storyPermissions.isDeleted, false),
      ),
    });
    if (!permission) {
      throw new AppError(404, 'This user does not collaborate on the story.');
    }
    await db
      .update(storyPermissions)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
        version: permission.version + 1,
      })
      .where(eq(storyPermissions.id, permission.id));
    await db
      .delete(storyInvitations)
      .where(
        and(eq(storyInvitations.storyId, storyId), eq(storyInvitations.inviteeId, targetUserId)),
      );
    emitUserEvent(targetUserId, {
      type: 'story.access-revoked',
      storyId,
      storyTitle: story.title,
      reason: 'removed-by-admin',
    });
    emitUserEvent(targetUserId, { type: 'stories.catalog-changed' });
    emitUserEvent(story.userId, { type: 'story.collaborators-changed', storyId });
    return { message: 'Collaborator removed.' };
  }

  private async requireStory(storyId: string) {
    const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
    if (!story || story.isDeleted) {
      throw new AppError(404, 'Story not found.');
    }
    return story;
  }

  /** Live (non-deleted) media metadata of a story. Bytes stay behind the blob endpoint. */
  async media(storyId: string) {
    await this.requireStory(storyId);
    return db
      .select({
        id: galleries.id,
        fileName: galleries.fileName,
        title: galleries.title,
        mediaType: galleries.mediaType,
        mimeType: galleries.mimeType,
        sizeBytes: galleries.sizeBytes,
        hash: galleries.hash,
        sourceUrl: galleries.sourceUrl,
        extraNotes: galleries.extraNotes,
        isFavorite: galleries.isFavorite,
        updatedAt: galleries.updatedAt,
      })
      .from(galleries)
      .where(and(eq(galleries.storyId, storyId), eq(galleries.isDeleted, false)))
      .orderBy(desc(galleries.updatedAt));
  }

  /** Boards with a moderation summary (pins, notes, edge labels) instead of the raw drawing. */
  async boards(storyId: string) {
    await this.requireStory(storyId);
    const rows = await db
      .select({
        id: boards.id,
        name: boards.name,
        description: boards.description,
        content: boards.content,
        updatedAt: boards.updatedAt,
      })
      .from(boards)
      .where(and(eq(boards.storyId, storyId), eq(boards.isDeleted, false)))
      .orderBy(desc(boards.updatedAt));
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      updatedAt: row.updatedAt,
      summary: summarizeBoardContent(row.content),
    }));
  }

  /** Location maps with a moderation summary (bases, pins, marker texts). */
  async locationMaps(storyId: string) {
    await this.requireStory(storyId);
    const rows = await db
      .select({
        id: locationMaps.id,
        name: locationMaps.name,
        description: locationMaps.description,
        content: locationMaps.content,
        updatedAt: locationMaps.updatedAt,
      })
      .from(locationMaps)
      .where(and(eq(locationMaps.storyId, storyId), eq(locationMaps.isDeleted, false)))
      .orderBy(desc(locationMaps.updatedAt));
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      updatedAt: row.updatedAt,
      summary: summarizeLocationMapContent(row.content),
    }));
  }

  /**
   * One media blob for moderation viewing. Same two gates as the user-facing download route:
   * the hash must be referenced by a live gallery row of this story, and the bytes must exist.
   * The admin check happens at the route - this service only proves the story/hash binding.
   */
  async blob(storyId: string, hash: string) {
    await this.requireStory(storyId);
    if (!HASH_PATTERN.test(hash)) {
      throw new AppError(400, 'Invalid media hash.');
    }
    if (!(await mediaStorageService.isReferencedInStory(storyId, hash))) {
      throw new AppError(404, 'Media not found in this story.');
    }
    const blob = await mediaStorageService.read(hash);
    if (!blob) {
      throw new AppError(404, 'Media content not available on this server.');
    }
    return blob;
  }

  private liveWhere(entry: BrowsableEntityTable, storyId: string) {
    const conditions = [eq(entry.storyColumn, storyId)];
    if (entry.isDeletedColumn) {
      conditions.push(eq(entry.isDeletedColumn, false));
    }
    return conditions.length > 1 ? and(...conditions) : conditions[0];
  }

  /** Every browsable entity type of a story with its live row count, in registry order. */
  async entityTypes(storyId: string) {
    await this.requireStory(storyId);
    const counts = await Promise.all(
      BROWSABLE_ENTITIES.map(async (entry) => {
        const [{ total }] = await db
          .select({ total: count() })
          .from(entry.table)
          .where(this.liveWhere(entry, storyId));
        return { entityType: entry.entityType, liveCount: total };
      }),
    );
    return counts;
  }

  /**
   * Raw rows of one entity type, every column as stored - moderation analysis, not a pretty
   * view. Live rows only (the operation log has no deletion flag, so it returns everything).
   */
  async entities(storyId: string, entityType: string, page: number, pageSize: number) {
    await this.requireStory(storyId);
    const entry = BROWSABLE_ENTITIES.find((candidate) => candidate.entityType === entityType);
    if (!entry) {
      throw new AppError(400, 'Unknown or non-story entity type.');
    }
    if (!Number.isInteger(page) || page < 1) {
      throw new AppError(400, 'Invalid page.');
    }
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > ADMIN_ENTITY_MAX_PAGE_SIZE) {
      throw new AppError(400, 'Invalid page size.');
    }
    const where = this.liveWhere(entry, storyId);
    const ordering: SQL[] = [];
    if (entry.orderColumn !== null) {
      ordering.push(desc(entry.orderColumn));
    }
    if (entry.idColumn !== null) {
      ordering.push(asc(entry.idColumn));
    }
    const base = db.select().from(entry.table).where(where);
    const rows = await (ordering.length > 0 ? base.orderBy(...ordering) : base)
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    const [{ total }] = await db.select({ total: count() }).from(entry.table).where(where);
    return { items: rows, total, page, pageSize };
  }
}

export const adminStoryService = new AdminStoryService();
