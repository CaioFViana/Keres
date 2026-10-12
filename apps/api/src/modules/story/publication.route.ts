import { Elysia, t } from 'elysia';
import {
  ManuscriptFormatSchema,
  PAGE_FORMATS,
  PAGE_LAYOUTS,
  SONG_LANGUAGES,
  SONG_PLACEMENTS,
  SONG_REPEATS,
  type ManuscriptOptionsInput,
  type PublicationLabelMode,
  type ReaderOptionsInput,
  type ShowcaseVisibility,
} from '@keres/shared';
import { z } from 'zod';
import type { JWTPayload } from '../../index';
import {
  type PublishUploadedArtifacts,
  type PublishUploadedFile,
  storyPublicationService,
} from '../../services/StoryPublicationService';
import { AppError } from '../../utils/errors';

/** A `story_publications` row as its owner sees it. */
const PublicationResponseSchema = t.Object({
  id: t.String(),
  storyId: t.String(),
  arcId: t.Nullable(t.String()),
  ownerUserId: t.String(),
  label: t.String(),
  operationVersion: t.Number(),
  formatVersion: t.Number(),
  byteSize: t.Number(),
  mediaIncluded: t.Number(),
  mediaTotal: t.Number(),
  manuscriptFormat: t.Nullable(t.String()),
  manuscriptByteSize: t.Nullable(t.Number()),
  readerByteSize: t.Nullable(t.Number()),
  packageIncluded: t.Boolean(),
  createdAt: t.Date(),
});

/**
 * What shapes a manuscript, shared by the manuscript rendition and the online reader (which is made
 * from the same choices). Mirrors shared `ManuscriptOptionsSchema`, minus the file format.
 */
/** One of a closed list of words, as the request schema wants it. */
const oneOf = <T extends readonly string[]>(values: T) =>
  t.Union(values.map((value) => t.Literal(value)) as never);

const manuscriptShape = {
  includeLooseScenes: t.Optional(t.Boolean()),
  includeSceneNames: t.Optional(t.Boolean()),
  includeToc: t.Optional(t.Boolean()),
  resetSceneNumbers: t.Optional(t.Boolean()),
  /** The frame a page's picture is shown in (a comic or a storyboard). */
  pageFormat: t.Optional(oneOf(PAGE_FORMATS)),
  /** Puts the cover of the story or the work first, when it has one (default: yes). */
  includeCover: t.Optional(t.Boolean()),
  /** How the pages are laid out: a flow, a planning sheet or spreads (a comic or a storyboard). */
  pageLayout: t.Optional(oneOf(PAGE_LAYOUTS)),
  /** Pages are captioned "Page 3", or "Frame 3" in a storyboard. */
  pageNoun: t.Optional(t.Union([t.Literal('page'), t.Literal('frame')])),
  /** Writes the songs the scenes sing: the words only, never a Gallery reference. */
  includeSongs: t.Optional(t.Boolean()),
  songsPlacement: t.Optional(oneOf(SONG_PLACEMENTS)),
  songLanguage: t.Optional(oneOf(SONG_LANGUAGES)),
  songRepeat: t.Optional(oneOf(SONG_REPEATS)),
  songChords: t.Optional(t.Boolean()),
  /** Typography and presentation; its fields are validated by the shared `ManuscriptStyleSchema`. */
  style: t.Optional(t.Record(t.String(), t.Unknown())),
  /** Branching stories: how the gamebook numbers its scenes. */
  sceneOrder: t.Optional(t.Union([t.Literal('discovery'), t.Literal('shuffled')])),
  /** Seed of the shuffled order; the same seed prints the same book. */
  shuffleSeed: t.Optional(t.String({ maxLength: 64 })),
  /** Branching stories, paged formats: every scene opens a page of its own. */
  scenePerPage: t.Optional(t.Boolean()),
  /** Keeps only this arc's containers and scenes; must belong to the story. */
  arcId: t.Optional(t.String()),
  labels: t.Optional(
    t.Object({
      goToPage: t.Optional(t.String({ maxLength: 80 })),
      goToScene: t.Optional(t.String({ maxLength: 80 })),
      sceneWord: t.Optional(t.String({ maxLength: 80 })),
      looseHeading: t.Optional(t.String({ maxLength: 80 })),
      tocHeading: t.Optional(t.String({ maxLength: 80 })),
      endOfExcerpt: t.Optional(t.String({ maxLength: 80 })),
      chooseStart: t.Optional(t.String({ maxLength: 80 })),
      beginAt: t.Optional(t.String({ maxLength: 80 })),
      pageLabel: t.Optional(t.String({ maxLength: 80 })),
      frameLabel: t.Optional(t.String({ maxLength: 80 })),
      mediaRemoved: t.Optional(t.String({ maxLength: 80 })),
      songsHeading: t.Optional(t.String({ maxLength: 80 })),
    }),
  ),
  /** Only for the `fountain` and `screenplay-pdf` formats: paper, numbering, headings, title page. */
  screenplay: t.Optional(
    t.Object({
      paper: t.Optional(t.Union([t.Literal('letter'), t.Literal('a4')])),
      numberScenes: t.Optional(t.Boolean()),
      generateHeadings: t.Optional(t.Boolean()),
      includeSynopses: t.Optional(t.Boolean()),
      includeSections: t.Optional(t.Boolean()),
      credit: t.Optional(t.String({ maxLength: 120 })),
      source: t.Optional(t.String({ maxLength: 200 })),
      draftDate: t.Optional(t.String({ maxLength: 60 })),
      contact: t.Optional(t.String({ maxLength: 400 })),
    }),
  ),
  /** Book metadata (EPUB). */
  author: t.Optional(t.Nullable(t.String({ maxLength: 200 }))),
  identifier: t.Optional(t.String({ maxLength: 200 })),
  language: t.Optional(t.String({ maxLength: 35 })),
};

/** Manuscript rendition to publish alongside the package. */
const ManuscriptRequestSchema = t.Object({
  // The shared format enum, not a route-local copy: a ninth format updates one place.
  format: oneOf(ManuscriptFormatSchema.options),
  ...manuscriptShape,
});

/** The online reader to publish alongside the package: the manuscript's choices plus the reader's own words. */
const ReaderRequestSchema = t.Object({
  ...manuscriptShape,
  /** The reader's interface words; validated by the shared `ReaderLabelsSchema`. */
  readerLabels: t.Optional(t.Record(t.String(), t.String({ maxLength: 120 }))),
});

/** The long-standing JSON publication body. */
const PublishJsonBody = t.Object({
  operationVersion: t.Integer({ minimum: 0 }),
  labelMode: t.Optional(
    t.Union([t.Literal('version'), t.Literal('date'), t.Literal('both')]),
  ),
  /**
   * Sent on every publication, not only when it changes: it is the choice the person made for this
   * publication. Omitting it is equivalent to `public`, so publishing without asking for a password
   * really does make the story public, even if an earlier publication had one.
   */
  visibility: t.Optional(t.Union([t.Literal('public'), t.Literal('password')])),
  password: t.Optional(t.String({ minLength: 4, maxLength: 200 })),
  /** When present, a readable manuscript is compiled and published alongside the package. */
  manuscript: t.Optional(ManuscriptRequestSchema),
  /** When present, an online reader page is compiled and published alongside the package. */
  reader: t.Optional(ReaderRequestSchema),
  /** Off only together with a manuscript and/or a reader; the server refuses a version with nothing in it. */
  includePackage: t.Optional(t.Boolean()),
  /** Releases this one work (arc) of the story: manuscript and/or reader only, never the package. */
  arcId: t.Optional(t.String()),
});

/**
 * The multipart publication: the exact JSON body above as the `data` part, plus the client-compiled
 * bytes. A file part's presence selects the pre-compiled path for that artifact; the other
 * artifact, when asked for, still compiles on the server. `data` arrives parsed (a form field
 * holding an object is JSON-decoded by the body parser), as a string, or as a file, and the handler
 * takes all three. It must be a real value, never absent: `t.Any()` would also match `undefined`,
 * and then schema-invalid JSON would decode into this shape (with its own keys stripped) instead of
 * failing validation with a 422 as it always did.
 */
const PublishMultipartBody = t.Object({
  data: t.Union([t.String(), t.Record(t.String(), t.Unknown()), t.File()]),
  manuscript: t.Optional(t.Any()),
  reader: t.Optional(t.Any()),
});

/**
 * The `data` part of a multipart publication: exactly the JSON publication body. The
 * manuscript/reader option objects ride along unchecked here - the service parses them against the
 * story, like the JSON path.
 */
const MultipartPublishDataSchema = z.object({
  operationVersion: z.number().int().nonnegative(),
  labelMode: z.enum(['version', 'date', 'both']).optional(),
  visibility: z.enum(['public', 'password']).optional(),
  password: z.string().min(4).max(200).optional(),
  manuscript: z.unknown().optional(),
  reader: z.unknown().optional(),
  includePackage: z.boolean().optional(),
  arcId: z.string().optional(),
});

/** A multipart file part, whatever runtime produced it: only the shape matters, never the class. */
function isFilePart(part: unknown): part is {
  arrayBuffer(): Promise<ArrayBuffer>;
  name?: unknown;
  type?: unknown;
} {
  return (
    typeof part === 'object' &&
    part !== null &&
    typeof (part as { arrayBuffer?: unknown }).arrayBuffer === 'function'
  );
}

async function uploadedFileOf(part: unknown, name: string): Promise<PublishUploadedFile | undefined> {
  if (part === undefined) return undefined;
  if (!isFilePart(part)) {
    throw new AppError(400, `The multipart publication ${name} must be a file.`);
  }
  const filename = typeof part.name === 'string' ? part.name : undefined;
  const mimeType = typeof part.type === 'string' && part.type !== '' ? part.type : undefined;
  return {
    bytes: new Uint8Array(await part.arrayBuffer()),
    ...(filename ? { filename } : {}),
    ...(mimeType ? { mimeType } : {}),
  };
}

async function publishWithClientBytes(
  userId: string,
  storyId: string,
  body: { data: unknown; manuscript?: unknown; reader?: unknown },
) {
  const dataRaw =
    typeof body.data === 'string'
      ? body.data
      : isFilePart(body.data)
        ? new TextDecoder().decode(await body.data.arrayBuffer())
        : body.data;
  let data: unknown = dataRaw;
  if (typeof dataRaw === 'string') {
    try {
      data = JSON.parse(dataRaw);
    } catch {
      throw new AppError(400, 'The multipart publication data is not valid JSON.');
    }
  }
  const parsed = MultipartPublishDataSchema.safeParse(data);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'data'}: ${issue.message}`)
      .join('; ');
    throw new AppError(400, `Invalid publication data: ${details}.`);
  }
  const options = parsed.data;
  const uploaded: PublishUploadedArtifacts = {};
  const manuscript = await uploadedFileOf(body.manuscript, 'manuscript');
  if (manuscript) uploaded.manuscript = manuscript;
  const reader = await uploadedFileOf(body.reader, 'reader');
  if (reader) uploaded.reader = reader;
  return storyPublicationService.publish(
    userId,
    storyId,
    options.operationVersion,
    (options.labelMode ?? 'both') as PublicationLabelMode,
    (options.visibility ?? 'public') as ShowcaseVisibility,
    options.password,
    options.manuscript as ManuscriptOptionsInput | undefined,
    options.reader as ReaderOptionsInput | undefined,
    // A release of one work never carries the package, so asking for none is implied.
    options.includePackage ?? options.arcId === undefined,
    options.arcId,
    manuscript || reader ? uploaded : undefined,
  );
}

/** Multipart (`data` part) carries client-compiled bytes; anything else is the JSON publication. */
function isMultipartPublishBody(body: unknown): body is { data: unknown } & Record<string, unknown> {
  return (
    typeof body === 'object' &&
    body !== null &&
    'data' in body &&
    !('operationVersion' in body)
  );
}

/**
 * The owner-side publication routes. Mounted inside `/stories` (see `story.route.ts`), split into a
 * file of their own because they have nothing to do with the create/export/import that already lived
 * there - they only share the prefix.
 */
export const publicationRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null)
  // Same case as `friend.route.ts`: every route here requires exactly the same thing, an authenticated
  // user. Story ownership is checked in the service, which is what knows how to read `stories.userId`.
  .derive(({ user }) => {
    if (!user?.userId) {
      throw new AppError(401, 'Unauthorized: User not authenticated.');
    }
    return { userId: user.userId };
  })
  .get('/publications/mine', async ({ userId }) => storyPublicationService.listVisibleTo(userId), {
    response: t.Array(PublicationResponseSchema),
    detail: {
      summary: 'List every publication the user can see',
      description:
        'Publications for stories the user owns or holds a permission on. The client diffs this against its local mirror to notify about versions published while it was offline.',
      tags: ['Showcase'],
    },
  })
  .post(
    '/:storyId/publications',
    async ({ params, body, userId }) => {
      // Multipart (`data` part) carries client-compiled bytes; the JSON publication is untouched.
      if (isMultipartPublishBody(body)) {
        return publishWithClientBytes(userId, params.storyId, body);
      }
      return storyPublicationService.publish(
        userId,
        params.storyId,
        body.operationVersion,
        (body.labelMode ?? 'both') as PublicationLabelMode,
        (body.visibility ?? 'public') as ShowcaseVisibility,
        body.password,
        body.manuscript,
        body.reader,
        // A release of one work never carries the package, so asking for none is implied.
        body.includePackage ?? body.arcId === undefined,
        body.arcId,
      );
    },
    {
      params: t.Object({ storyId: t.String() }),
      body: t.Union([PublishJsonBody, PublishMultipartBody]),
      detail: {
        summary: 'Publish a new public version of a story',
        description:
          'Owner only. Packages the story exactly like the client export does (story.json + media) and stores it as an immutable version, with an optional readable manuscript alongside it. As JSON, the body is the publication options; as multipart/form-data, a `data` part carries those options and `manuscript`/`reader` file parts carry client-compiled bytes. Rejects with 409 when the story is not in sync with the server. Only the newest 5 versions are kept.',
        tags: ['Showcase'],
      },
    },
  )
  .get(
    '/:storyId/publications',
    async ({ params, userId }) => storyPublicationService.listForStory(userId, params.storyId),
    {
      params: t.Object({ storyId: t.String() }),
      detail: {
        summary: 'List the published versions of a story',
        description: 'Owner only. Includes the current showcase visibility and label style.',
        tags: ['Showcase'],
      },
    },
  )
  .put(
    '/:storyId/showcase',
    async ({ params, body, userId }) =>
      storyPublicationService.setVisibility(
        userId,
        params.storyId,
        body.visibility as ShowcaseVisibility,
        body.password,
      ),
    {
      params: t.Object({ storyId: t.String() }),
      body: t.Object({
        visibility: t.Union([t.Literal('public'), t.Literal('password')]),
        password: t.Optional(t.String({ minLength: 4, maxLength: 200 })),
      }),
      detail: {
        summary: 'Change a published story visibility',
        description:
          'Owner only. Switches between listed-and-public and unlisted-behind-a-password, or rotates the password.',
        tags: ['Showcase'],
      },
    },
  )
  .delete(
    '/:storyId/publications/:publicationId',
    async ({ params, userId }) => {
      await storyPublicationService.deletePublication(userId, params.storyId, params.publicationId);
      return { deleted: true };
    },
    {
      params: t.Object({ storyId: t.String(), publicationId: t.String() }),
      response: t.Object({ deleted: t.Boolean() }),
      detail: {
        summary: 'Delete one published version',
        description:
          'Owner only. Removing the last version also unlists the story - there would be nothing left to show.',
        tags: ['Showcase'],
      },
    },
  )
  .delete(
    '/:storyId/publications',
    async ({ params, userId }) => {
      await storyPublicationService.unpublish(userId, params.storyId);
      return { deleted: true };
    },
    {
      params: t.Object({ storyId: t.String() }),
      response: t.Object({ deleted: t.Boolean() }),
      detail: {
        summary: 'Unpublish a story',
        description: 'Owner only. Removes the story from the showcase along with every version.',
        tags: ['Showcase'],
      },
    },
  );
