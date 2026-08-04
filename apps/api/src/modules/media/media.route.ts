import { isSupportedMediaMimeType } from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { env } from '../../config/env';
import { db } from '../../db';
import { galleries } from '../../db/schema';
import { JWTPayload } from '../../index';
import { mediaStorageService } from '../../services/MediaStorageService';
import { storyPermissionService } from '../../services/StoryPermissionService';
import { TierLimitExceededError, tierEnforcementService } from '../../services/TierEnforcementService';

const HASH_PATTERN = /^[a-f0-9]{32}$/;

/**
 * Canal binário da galeria.
 *
 * Os *metadados* da mídia (nome, tipo, notas, vínculos) viajam pelo log de operações como
 * qualquer outra entidade. Só os bytes passam por aqui, endereçados pelo hash do conteúdo,
 * porque empacotar um vídeo dentro de um payload de sincronização JSON seria inviável.
 *
 * O fluxo do cliente é: sincroniza os metadados normalmente, pergunta em `/blobs/status`
 * quais hashes o servidor ainda não tem, sobe esses, e baixa os que apareceram no pull mas
 * faltam no aparelho.
 */
export const mediaRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null)

  /**
   * Autorização de leitura: além da permissão na história, o hash precisa ser referenciado
   * por alguma mídia *daquela* história. Sem essa segunda checagem, o armazenamento ser
   * deduplicado globalmente permitiria a um usuário ler o blob de outro conhecendo o hash.
   */
  .derive(({ user, set }) => ({
    requirePermission: async (storyId: string, level: 'reader' | 'writer') => {
      if (!user?.userId) {
        set.status = 401;
        throw new Error('Unauthorized: User not authenticated.');
      }
      const allowed = await storyPermissionService.hasPermission(user.userId, storyId, level);
      if (!allowed) {
        // 404 em vez de 403 para não confirmar a existência de uma história alheia.
        set.status = 404;
        throw new Error('Story not found or not authorized.');
      }
    },
  }))

  .post('/:storyId/blobs/status', async ({ params, body, set, requirePermission }) => {
    await requirePermission(params.storyId, 'reader');

    const invalid = body.hashes.filter((hash) => !HASH_PATTERN.test(hash));
    if (invalid.length > 0) {
      set.status = 400;
      throw new Error(`Invalid media hash(es): ${invalid.join(', ')}`);
    }

    return mediaStorageService.filterPresent(body.hashes);
  }, {
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
      description: 'Given a list of content hashes, reports which are already stored and which still need uploading.',
      tags: ['Media'],
    },
  })

  .post('/:storyId/blobs/:hash', async ({ params, body, set, requirePermission, user }) => {
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
      const stored = await mediaStorageService.store(params.hash, mimeType, await file.arrayBuffer());
      return { hash: stored.hash, sizeBytes: stored.sizeBytes, mimeType };
    } catch (error: any) {
      // Divergência de hash é dado inválido do cliente, não falha do servidor.
      set.status = 400;
      throw new Error(error?.message || 'Failed to store media.');
    }
  }, {
    params: t.Object({ storyId: t.String(), hash: t.String() }),
    body: t.Object({
      file: t.File(),
      mimeType: t.Optional(t.String()),
    }),
    type: 'multipart/form-data',
    detail: {
      summary: 'Upload a media blob',
      description: 'Stores the bytes of a media file under its content hash. The server recomputes the hash and rejects the upload if it does not match.',
      tags: ['Media'],
    },
  })

  .get('/:storyId/blobs/:hash', async ({ params, set, requirePermission }) => {
    await requirePermission(params.storyId, 'reader');

    if (!HASH_PATTERN.test(params.hash)) {
      set.status = 400;
      throw new Error('Invalid media hash.');
    }

    const referenced = await db.query.galleries.findFirst({
      where: and(
        eq(galleries.storyId, params.storyId),
        eq(galleries.hash, params.hash),
        eq(galleries.isDeleted, false)
      ),
      columns: { id: true },
    });
    if (!referenced) {
      set.status = 404;
      throw new Error('Media not found in this story.');
    }

    const blob = await mediaStorageService.read(params.hash);
    if (!blob) {
      set.status = 404;
      throw new Error('Media content not available on this server.');
    }

    set.headers['content-type'] = blob.mimeType;
    // O conteúdo de um hash nunca muda, então pode ser guardado indefinidamente.
    set.headers['cache-control'] = 'private, max-age=31536000, immutable';
    return blob.file;
  }, {
    params: t.Object({ storyId: t.String(), hash: t.String() }),
    detail: {
      summary: 'Download a media blob',
      description: 'Streams the bytes of a media file, provided the story references that hash and the user can read the story.',
      tags: ['Media'],
    },
  });
