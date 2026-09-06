import { isSupportedMediaMimeType } from '@keres/shared';
import { Elysia, t } from 'elysia';
import { env } from '../../config/env';
import type { JWTPayload } from '../../index';
import { mediaStorageService } from '../../services/MediaStorageService';
import { storyPermissionService } from '../../services/StoryPermissionService';
import {
  TierLimitExceededError,
  tierEnforcementService,
} from '../../services/TierEnforcementService';

const HASH_PATTERN = /^[a-f0-9]{32}$/;

/**
 * The gallery's binary channel.
 *
 * A media file's *metadata* (name, type, notes, links) travels through the operation log like any
 * other entity. Only the bytes go through here, addressed by the content's hash, because packing a
 * video inside a JSON synchronization payload would be unworkable.
 *
 * The client's flow is: synchronize the metadata as usual, ask `/blobs/status` which hashes the
 * server does not have yet, upload those, and download the ones that appeared in the pull but are
 * missing on the device.
 */
export const mediaRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null)

  /**
   * Read authorization: beyond permission on the story, the hash has to be referenced by some media
   * file of *that* story. Without that second check, storage being globally deduplicated would let a
   * user read someone else's blob just by knowing the hash.
   */
  .derive(({ user, set }) => ({
    requirePermission: async (storyId: string, level: 'reader' | 'writer') => {
      if (!user?.userId) {
        set.status = 401;
        throw new Error('Unauthorized: User not authenticated.');
      }
      const allowed = await storyPermissionService.hasPermission(user.userId, storyId, level);
      if (!allowed) {
        // 404 rather than 403, so as not to confirm the existence of somebody else's story.
        set.status = 404;
        throw new Error('Story not found or not authorized.');
      }
    },
  }))

  .post(
    '/:storyId/blobs/status',
    async ({ params, body, set, requirePermission }) => {
      await requirePermission(params.storyId, 'reader');

      const invalid = body.hashes.filter((hash) => !HASH_PATTERN.test(hash));
      if (invalid.length > 0) {
        set.status = 400;
        throw new Error(`Invalid media hash(es): ${invalid.join(', ')}`);
      }

      return mediaStorageService.filterPresent(body.hashes);
    },
    {
      params: t.Object({ storyId: t.String() }),
      body: t.Object({
        hashes: t.Array(t.String(), { maxItems: 500 }),
      }),
      response: t.Object({
        present: t.Array(t.String()),
        missing: t.Array(t.String()),
      }),
      detail: {
        summary: 'Check which media blobs the server already has',
        description:
          'Given a list of content hashes, reports which are already stored and which still need uploading.',
        tags: ['Media'],
      },
    },
  )

  .post(
    '/:storyId/blobs/:hash',
    async ({ params, body, set, requirePermission, user }) => {
      await requirePermission(params.storyId, 'writer');

      if (!HASH_PATTERN.test(params.hash)) {
        set.status = 400;
        throw new Error('Invalid media hash.');
      }

      const file = body.file;
      const mimeType = (body.mimeType || file.type || '').toLowerCase();

      if (!isSupportedMediaMimeType(mimeType)) {
        set.status = 415;
        throw new Error(`Unsupported media type "${mimeType}".`);
      }

      if (file.size > env.MEDIA_MAX_BYTES) {
        set.status = 413;
        throw new Error(`Media exceeds the maximum size of ${env.MEDIA_MAX_BYTES} bytes.`);
      }

      try {
        await tierEnforcementService.assertCanUploadMedia(user!.userId, params.storyId, file.size);
      } catch (error) {
        if (error instanceof TierLimitExceededError) {
          set.status = 403;
          throw new Error(error.message);
        }
        throw error;
      }

      try {
        const stored = await mediaStorageService.store(
          params.hash,
          mimeType,
          await file.arrayBuffer(),
        );
        return { hash: stored.hash, sizeBytes: stored.sizeBytes, mimeType };
      } catch (error: unknown) {
        // A hash mismatch is invalid client data, not a server failure.
        set.status = 400;
        throw new Error(error instanceof Error ? error.message : 'Failed to store media.');
      }
    },
    {
      params: t.Object({ storyId: t.String(), hash: t.String() }),
      body: t.Object({
        file: t.File(),
        mimeType: t.Optional(t.String()),
      }),
      type: 'multipart/form-data',
      response: {
        200: t.Object({ hash: t.String(), sizeBytes: t.Number(), mimeType: t.String() }),
        400: t.Object({ message: t.String() }),
        403: t.Object({ message: t.String() }),
        404: t.Object({ message: t.String() }),
        413: t.Object({ message: t.String() }),
        415: t.Object({ message: t.String() }),
      },
      detail: {
        summary: 'Upload a media blob',
        description:
          'Stores the bytes of a media file under its content hash. The server recomputes the hash and rejects the upload if it does not match.',
        tags: ['Media'],
      },
    },
  )

  .get(
    '/:storyId/blobs/:hash',
    async ({ params, set, requirePermission }) => {
      await requirePermission(params.storyId, 'reader');

      if (!HASH_PATTERN.test(params.hash)) {
        set.status = 400;
        throw new Error('Invalid media hash.');
      }

      if (!(await mediaStorageService.isReferencedInStory(params.storyId, params.hash))) {
        set.status = 404;
        throw new Error('Media not found in this story.');
      }

      const blob = await mediaStorageService.read(params.hash);
      if (!blob) {
        set.status = 404;
        throw new Error('Media content not available on this server.');
      }

      set.headers['content-type'] = blob.mimeType;
      // A hash's content never changes, so it can be cached indefinitely.
      set.headers['cache-control'] = 'private, max-age=31536000, immutable';
      return blob.body;
    },
    {
      params: t.Object({ storyId: t.String(), hash: t.String() }),
      detail: {
        summary: 'Download a media blob',
        description:
          'Streams the bytes of a media file, provided the story references that hash and the user can read the story.',
        tags: ['Media'],
      },
    },
  );
