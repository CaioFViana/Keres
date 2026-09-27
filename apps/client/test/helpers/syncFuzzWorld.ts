import { EMPTY_BOARD_CONTENT, EMPTY_LOCATION_MAP_CONTENT } from '@keres/shared';
import { createBoardService } from '../../src/services/storymanagement/BoardService';
import { createGalleryRelationService } from '../../src/services/storymanagement/GalleryRelationService';
import { createGalleryService } from '../../src/services/storymanagement/GalleryService';
import { createItemService } from '../../src/services/storymanagement/ItemService';
import { createLocationMapService } from '../../src/services/storymanagement/LocationMapService';
import { createLocationRelationService } from '../../src/services/storymanagement/LocationRelationService';
import { createLocationService } from '../../src/services/storymanagement/LocationService';
import { createNoteRelationService } from '../../src/services/storymanagement/NoteRelationService';
import { createNoteService } from '../../src/services/storymanagement/NoteService';
import { createPlotService } from '../../src/services/storymanagement/PlotService';
import { createSeeAlsoRelationService } from '../../src/services/storymanagement/SeeAlsoRelationService';
import { createStoryArcService } from '../../src/services/storymanagement/StoryArcService';
import { createStoryCalendarService } from '../../src/services/storymanagement/StoryCalendarService';
import { createSuggestionService } from '../../src/services/storymanagement/SuggestionService';
import { createWorldRuleService } from '../../src/services/storymanagement/WorldRuleService';
import { STORY_ID, type SyncDevice, USER_ID } from './syncDevices';
import { type FuzzContext, live, type RowSpec, rowEditsFor, short } from './syncFuzzSupport';

/**
 * The convergence fuzz's world edits: the named things a story keeps beside its narrative
 * (locations, items, notes, world rules, maps, boards, plots, arcs, calendars) - created,
 * renamed and deleted - gallery media, and the links between them (a location's parent and
 * connections, notes and media attached to characters, see-also links, suggestion values two
 * devices easily store twice).
 */

const db = (device: SyncDevice) => device.database.db;

/** A named thing: made, renamed and deleted through its own service. */
function named(
  entityType: string,
  field: 'name' | 'title',
  next: () => number,
  create: (device: SyncDevice, value: string) => Promise<unknown>,
  rename: (device: SyncDevice, id: string, value: string) => Promise<unknown>,
  remove: (device: SyncDevice, id: string) => Promise<unknown>,
): RowSpec & { seed: (device: SyncDevice, value: string) => Promise<unknown> } {
  const value = (device: SyncDevice) => `${device.name}-${entityType}-${next()}`;
  return {
    entityType,
    seed: create,
    create: async (device) => {
      const made = value(device);
      return [`creates ${entityType} ${made}`, () => create(device, made)];
    },
    change: (device, row) => {
      const renamed = value(device);
      return [
        `renames ${entityType} ${short(row.id)} ${field}=${renamed}`,
        () => rename(device, row.id, renamed),
      ];
    },
    remove: (device, row) => [
      `deletes ${entityType} ${short(row.id)}`,
      () => remove(device, row.id),
    ],
  };
}

/** Few values, so two devices often store the same suggestion offline. */
const SUGGESTED_NAMES = ['Nyx', 'Eos', 'Hera'] as const;

export function createWorldEdits(context: FuzzContext) {
  const { random, pick, next } = context;

  const NAMED = [
    named(
      'Location',
      'name',
      next,
      (device, name) =>
        createLocationService(db(device)).createLocation(USER_ID, {
          storyId: STORY_ID,
          name,
        } as never),
      (device, id, name) =>
        createLocationService(db(device)).updateLocation(USER_ID, id, { name } as never),
      (device, id) => createLocationService(db(device)).deleteLocation(USER_ID, id),
    ),
    named(
      'Item',
      'name',
      next,
      (device, name) =>
        createItemService(db(device)).createItem(USER_ID, { storyId: STORY_ID, name } as never),
      (device, id, name) =>
        createItemService(db(device)).updateItem(USER_ID, id, { name } as never),
      (device, id) => createItemService(db(device)).deleteItem(USER_ID, id),
    ),
    named(
      'Note',
      'title',
      next,
      (device, title) =>
        createNoteService(db(device)).createNote(USER_ID, { storyId: STORY_ID, title } as never),
      (device, id, title) =>
        createNoteService(db(device)).updateNote(USER_ID, id, { title } as never),
      (device, id) => createNoteService(db(device)).deleteNote(USER_ID, id),
    ),
    named(
      'WorldRule',
      'title',
      next,
      (device, title) =>
        createWorldRuleService(db(device)).createWorldRule(USER_ID, {
          storyId: STORY_ID,
          title,
        } as never),
      (device, id, title) =>
        createWorldRuleService(db(device)).updateWorldRule(USER_ID, id, { title } as never),
      (device, id) => createWorldRuleService(db(device)).deleteWorldRule(USER_ID, id),
    ),
    named(
      'LocationMap',
      'name',
      next,
      (device, name) =>
        createLocationMapService(db(device)).createMap(USER_ID, {
          storyId: STORY_ID,
          name,
          content: EMPTY_LOCATION_MAP_CONTENT,
        } as never),
      (device, id, name) => createLocationMapService(db(device)).updateMap(USER_ID, id, { name }),
      (device, id) => createLocationMapService(db(device)).deleteMap(USER_ID, id),
    ),
    named(
      'Board',
      'name',
      next,
      (device, name) =>
        createBoardService(db(device)).createBoard(USER_ID, {
          storyId: STORY_ID,
          name,
          content: EMPTY_BOARD_CONTENT,
        } as never),
      (device, id, name) => createBoardService(db(device)).updateBoard(USER_ID, id, { name }),
      (device, id) => createBoardService(db(device)).deleteBoard(USER_ID, id),
    ),
    named(
      'Plot',
      'name',
      next,
      (device, name) =>
        createPlotService(db(device)).save(USER_ID, { storyId: STORY_ID, name, details: null }),
      (device, id, name) =>
        createPlotService(db(device)).save(USER_ID, { id, storyId: STORY_ID, name, details: null }),
      (device, id) => createPlotService(db(device)).delete(USER_ID, id),
    ),
    named(
      'StoryArc',
      'title',
      next,
      (device, title) =>
        createStoryArcService(db(device)).createArc(USER_ID, {
          storyId: STORY_ID,
          title,
          sortOrder: 1,
          isDefault: false,
        } as never),
      (device, id, title) => createStoryArcService(db(device)).updateArc(USER_ID, id, { title }),
      (device, id) => createStoryArcService(db(device)).deleteArc(USER_ID, id),
    ),
    named(
      'StoryCalendar',
      'name',
      next,
      (device, name) =>
        createStoryCalendarService(db(device)).createCalendar(USER_ID, {
          storyId: STORY_ID,
          name,
          definition: { months: [{ name: 'Um', days: 30 }] },
        } as never),
      (device, id, name) =>
        createStoryCalendarService(db(device)).updateCalendar(USER_ID, id, { name }),
      (device, id) => createStoryCalendarService(db(device)).deleteCalendar(USER_ID, id),
    ),
  ];

  const LINKS: RowSpec[] = [
    {
      entityType: 'LocationRelation',
      create: async (device) => {
        const locations = await live(device, 'Location');
        if (locations.length < 2) return null;
        const [a, b] = [pick(locations), pick(locations)];
        if (a.id === b.id) return null;
        const relations = createLocationRelationService(db(device));
        return random() < 0.5
          ? [
              `puts location ${short(a.id)} inside ${short(b.id)}`,
              () => relations.setParent(USER_ID, STORY_ID, a.id, b.id),
            ]
          : [
              `connects locations ${short(a.id)}-${short(b.id)}`,
              () => relations.addConnection(USER_ID, STORY_ID, a.id, b.id),
            ];
      },
      remove: (device, row) => [
        `removes location link ${short(row.id)}`,
        () => createLocationRelationService(db(device)).removeRelation(USER_ID, row.id),
      ],
    },
    {
      entityType: 'NoteRelation',
      create: async (device) => {
        const [notes, characters] = [await live(device, 'Note'), await live(device, 'Character')];
        if (notes.length === 0 || characters.length === 0) return null;
        const [note, character] = [pick(notes), pick(characters)];
        return [
          `attaches note ${short(note.id)} to ${short(character.id)}`,
          () =>
            createNoteRelationService(db(device)).saveNoteRelation(USER_ID, {
              storyId: STORY_ID,
              noteId: note.id,
              relationId: character.id,
              relationType: 'Character',
            } as never),
        ];
      },
      remove: (device, row) => [
        `detaches note link ${short(row.id)}`,
        () => createNoteRelationService(db(device)).deleteNoteRelation(USER_ID, row.id),
      ],
    },
    {
      entityType: 'SeeAlsoRelation',
      create: async (device) => {
        const [characters, locations] = [
          await live(device, 'Character'),
          await live(device, 'Location'),
        ];
        if (characters.length === 0 || locations.length === 0) return null;
        const [character, location] = [pick(characters), pick(locations)];
        return [
          `sees ${short(character.id)} with ${short(location.id)}`,
          () =>
            createSeeAlsoRelationService(db(device)).addSeeAlsoLink(
              USER_ID,
              STORY_ID,
              { entityType: 'Character', entityId: character.id },
              { entityType: 'Location', entityId: location.id },
            ),
        ];
      },
      remove: (device, row) => [
        `unsees ${short(row.id)}`,
        () => createSeeAlsoRelationService(db(device)).removeSeeAlsoLink(USER_ID, row.id),
      ],
    },
    {
      entityType: 'Gallery',
      create: async (device) => {
        // Hex, as an md5 is; the shared counter keeps it unique across devices.
        const hash = String(next()).padStart(32, 'a');
        return [
          `adds media ${hash}`,
          () =>
            createGalleryService(db(device)).createGallery(USER_ID, {
              storyId: STORY_ID,
              mediaType: 'image',
              mimeType: 'image/png',
              fileName: `${hash}.png`,
              hash,
              sizeBytes: 16,
              localPath: null,
            } as never),
        ];
      },
      change: (device, row) => {
        const title = `${device.name}-media-${next()}`;
        return [
          `titles media ${short(row.id)}=${title}`,
          () => createGalleryService(db(device)).updateGallery(USER_ID, row.id, { title } as never),
        ];
      },
      remove: (device, row) => [
        `deletes media ${short(row.id)}`,
        () => createGalleryService(db(device)).deleteGallery(USER_ID, row.id),
      ],
    },
    {
      entityType: 'GalleryRelation',
      create: async (device) => {
        const [media, characters] = [
          await live(device, 'Gallery'),
          await live(device, 'Character'),
        ];
        if (media.length === 0 || characters.length === 0) return null;
        const [item, character] = [pick(media), pick(characters)];
        return [
          `shows media ${short(item.id)} on ${short(character.id)}`,
          () =>
            createGalleryRelationService(db(device)).linkGalleryToOwner(
              USER_ID,
              STORY_ID,
              item.id,
              {
                ownerId: character.id,
                ownerType: 'Character',
              },
            ),
        ];
      },
      remove: (device, row) => [
        `hides media ${short(row.galleryId)} from ${short(row.ownerId)}`,
        () =>
          createGalleryRelationService(db(device)).unlinkGalleryFromOwner(
            USER_ID,
            STORY_ID,
            row.galleryId,
            { ownerId: row.ownerId, ownerType: row.ownerType },
          ),
      ],
    },
    {
      entityType: 'Suggestion',
      create: async (device) => {
        const value = pick(SUGGESTED_NAMES);
        // As the screen does: a value this device already stores is not stored again.
        if ((await live(device, 'Suggestion')).some((row) => row.value === value)) return null;
        return [
          `suggests ${value}`,
          () =>
            createSuggestionService(db(device)).createSuggestion(
              USER_ID,
              'character-name',
              value,
              STORY_ID,
            ),
        ];
      },
      change: (device, row) => {
        const value = pick(SUGGESTED_NAMES);
        return [
          `changes suggestion ${short(row.id)}=${value}`,
          async () => {
            if ((await live(device, 'Suggestion')).some((other) => other.value === value)) return;
            await createSuggestionService(db(device)).updateSuggestion(USER_ID, row.id, value);
          },
        ];
      },
      remove: (device, row) => [
        `drops suggestion ${short(row.id)}`,
        () => createSuggestionService(db(device)).deleteSuggestion(USER_ID, row.id),
      ],
    },
  ];

  const namedEdit = rowEditsFor(context, NAMED);
  const linkEdit = rowEditsFor(context, LINKS);
  const edit = async (device: SyncDevice) => {
    if (random() < 0.4) await namedEdit(device);
    else await linkEdit(device);
  };

  /** One of each named thing, so the links between them have something to link from the start. */
  const prime = async (device: SyncDevice) => {
    for (const spec of NAMED) await spec.seed(device, `${spec.entityType}-seed`);
    await NAMED[0]!.seed(device, 'Location-seed-2');
  };

  return Object.assign(edit, { prime });
}
