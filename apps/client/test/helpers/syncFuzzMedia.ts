import {
  emptySketchContent,
  generateSketchLocalId,
  SCENE_MUSIC_ROLES,
  SCENE_PAGE_FITS,
} from '@keres/shared';
import { createSceneMusicService } from '@/src/services/storymanagement/media-music/SceneMusicService';
import { createScenePageService } from '@/src/services/storymanagement/scenes-chapters/ScenePageService';
import { createSketchService } from '@/src/services/storymanagement/media-music/SketchService';
import { createSongService } from '@/src/services/storymanagement/media-music/SongService';
import { STORY_ID, type SyncDevice, USER_ID } from './syncDevices';
import { type FuzzContext, live, type RowSpec, rowEditsFor, short } from './syncFuzzSupport';

/**
 * The convergence fuzz's pictures and music: songs and sketches (made, edited field by field and
 * deleted), and the pages and the music a scene keeps - each ordered by its own `rank`, pointing
 * at a sketch or a gallery medium, at a song or a gallery medium, with a link that may outlive its
 * target.
 */

const db = (device: SyncDevice) => device.database.db;

export function createMediaEdits(context: FuzzContext) {
  const { random, pick, next } = context;
  const label = (device: SyncDevice, what: string) => `${device.name}-${what}-${next()}`;

  /**
   * A page or a piece of music goes to one of the story's scenes, or to nothing when it has none.
   * Most of the time to a scene that already has some of its kind: a rank is only tested among
   * neighbours.
   */
  const sceneOf = async (device: SyncDevice, crowdedWith?: 'ScenePage' | 'SceneMusic') => {
    const scenes = await live(device, 'Scene');
    if (scenes.length === 0) return null;
    if (crowdedWith && random() < 0.7) {
      const sceneIds = new Set((await live(device, crowdedWith)).map((row) => row.sceneId));
      const crowded = scenes.filter((scene) => sceneIds.has(scene.id));
      if (crowded.length > 0) return pick(crowded);
    }
    return pick(scenes);
  };

  /** What a page can show: a sketch or a gallery medium of the story. */
  const pageMedia = async (device: SyncDevice) => {
    const [sketches, media] = [await live(device, 'Sketch'), await live(device, 'Gallery')];
    const options = [
      ...sketches.map((row) => ({ sketchId: row.id as string })),
      ...media.map((row) => ({ galleryId: row.id as string })),
    ];
    return options.length === 0 ? null : pick(options);
  };

  /** What a piece of music can be: a song or a gallery medium of the story. */
  const musicTarget = async (device: SyncDevice) => {
    const [songs, media] = [await live(device, 'Song'), await live(device, 'Gallery')];
    const options = [
      ...songs.map((row) => ({ songId: row.id as string })),
      ...media.map((row) => ({ galleryId: row.id as string })),
    ];
    return options.length === 0 ? null : pick(options);
  };

  const THINGS: RowSpec[] = [
    {
      entityType: 'Song',
      create: async (device) => {
        const title = label(device, 'song');
        return [
          `writes song ${title}`,
          () => createSongService(db(device)).createSong(USER_ID, { storyId: STORY_ID, title }),
        ];
      },
      // Two fields of one song, so two devices often edit different ones at once.
      change: (device, row) => {
        if (random() < 0.5) {
          const title = label(device, 'song');
          return [
            `retitles song ${short(row.id)}=${title}`,
            () => createSongService(db(device)).updateSong(USER_ID, row.id, { title }),
          ];
        }
        const lyrics = `${label(device, 'verse')}\nand a line`;
        return [
          `rewrites lyrics of song ${short(row.id)}`,
          () => createSongService(db(device)).updateSong(USER_ID, row.id, { lyrics }),
        ];
      },
      remove: (device, row) => [
        `deletes song ${short(row.id)}`,
        () => createSongService(db(device)).deleteSong(USER_ID, row.id),
      ],
    },
    {
      entityType: 'Sketch',
      create: async (device) => {
        const name = label(device, 'sketch');
        return [
          `draws sketch ${name}`,
          () =>
            createSketchService(db(device)).createSketch(USER_ID, {
              storyId: STORY_ID,
              name,
              content: emptySketchContent(generateSketchLocalId(new Set()), 'Layer 1'),
            }),
        ];
      },
      // The name and the drawing travel as separate fields: a rename and a stroke merge.
      change: (device, row) => {
        if (random() < 0.5) {
          const name = label(device, 'sketch');
          return [
            `renames sketch ${short(row.id)}=${name}`,
            () => createSketchService(db(device)).updateSketch(USER_ID, row.id, { name }),
          ];
        }
        const layerName = label(device, 'layer');
        return [
          `redraws sketch ${short(row.id)} (${layerName})`,
          () =>
            createSketchService(db(device)).updateSketch(USER_ID, row.id, {
              content: emptySketchContent(generateSketchLocalId(new Set()), layerName),
            }),
        ];
      },
      remove: (device, row) => [
        `deletes sketch ${short(row.id)}`,
        () => createSketchService(db(device)).deleteSketch(USER_ID, row.id),
      ],
    },
  ];

  const LINKS: RowSpec[] = [
    {
      entityType: 'ScenePage',
      create: async (device) => {
        const scene = await sceneOf(device, 'ScenePage');
        const media = await pageMedia(device);
        if (!scene || !media) return null;
        // At the end, or at a place among the scene's pages: both ways pick a rank.
        const position = random() < 0.5 ? undefined : Math.floor(random() * 3);
        return [
          `adds a page to scene ${short(scene.id)} (${Object.keys(media)[0]}${
            position === undefined ? '' : ` at ${position}`
          })`,
          () =>
            createScenePageService(db(device)).createPage(USER_ID, {
              storyId: STORY_ID,
              sceneId: scene.id,
              media,
              text: label(device, 'text'),
              position,
            }),
        ];
      },
      change: (device, row) => {
        const pages = createScenePageService(db(device));
        const roll = random();
        if (roll < 0.15) {
          const text = label(device, 'text');
          return [
            `rewrites page ${short(row.id)}`,
            () => pages.updatePage(USER_ID, row.id, { text }),
          ];
        }
        if (roll < 0.25) {
          const fit = pick(SCENE_PAGE_FITS);
          return [
            `fits page ${short(row.id)} as ${fit}`,
            () => pages.updatePage(USER_ID, row.id, { fit }),
          ];
        }
        if (roll < 0.35) {
          const spread = random() < 0.5;
          return [
            `${spread ? 'spreads' : 'unspreads'} page ${short(row.id)}`,
            () => pages.updatePage(USER_ID, row.id, { spread }),
          ];
        }
        if (roll < 0.75) {
          const position = Math.floor(random() * 3);
          return [
            `moves page ${short(row.id)} to ${position}`,
            () => pages.movePage(USER_ID, row.id, position),
          ];
        }
        return [
          `puts another image in page ${short(row.id)}`,
          async () => {
            const media = await pageMedia(device);
            if (media) await pages.replaceMedia(USER_ID, row.id, media);
          },
        ];
      },
      remove: (device, row) => [
        `deletes page ${short(row.id)}`,
        () => createScenePageService(db(device)).deletePage(USER_ID, row.id),
      ],
    },
    {
      entityType: 'SceneMusic',
      create: async (device) => {
        const scene = await sceneOf(device, 'SceneMusic');
        const target = await musicTarget(device);
        if (!scene || !target) return null;
        const position = random() < 0.5 ? undefined : Math.floor(random() * 3);
        return [
          `adds music to scene ${short(scene.id)} (${Object.keys(target)[0]}${
            position === undefined ? '' : ` at ${position}`
          })`,
          () =>
            createSceneMusicService(db(device)).addMusic(USER_ID, {
              storyId: STORY_ID,
              sceneId: scene.id,
              target,
              cue: label(device, 'cue'),
              position,
            }),
        ];
      },
      change: (device, row) => {
        const music = createSceneMusicService(db(device));
        const roll = random();
        if (roll < 0.15) {
          const cue = label(device, 'cue');
          return [
            `re-cues music ${short(row.id)}`,
            () => music.updateMusic(USER_ID, row.id, { cue }),
          ];
        }
        if (roll < 0.3) {
          const role = pick(SCENE_MUSIC_ROLES);
          return [
            `gives music ${short(row.id)} the role ${role}`,
            () => music.updateMusic(USER_ID, row.id, { role }),
          ];
        }
        if (roll < 0.75) {
          const position = Math.floor(random() * 3);
          return [
            `moves music ${short(row.id)} to ${position}`,
            () => music.moveMusic(USER_ID, row.id, position),
          ];
        }
        return [
          `points music ${short(row.id)} at something else`,
          async () => {
            const target = await musicTarget(device);
            if (target) await music.retarget(USER_ID, row.id, target);
          },
        ];
      },
      remove: (device, row) => [
        `deletes music ${short(row.id)}`,
        () => createSceneMusicService(db(device)).deleteMusic(USER_ID, row.id),
      ],
    },
  ];

  const thingEdit = rowEditsFor(context, THINGS);
  const linkEdit = rowEditsFor(context, LINKS);
  const edit = async (device: SyncDevice) => {
    if (random() < 0.35) await thingEdit(device);
    else await linkEdit(device);
  };

  /**
   * One song and one sketch, so pages and music have something to point at from the start - and a
   * page and a piece of music on a scene, so there is something to edit, move and delete.
   */
  const prime = async (device: SyncDevice) => {
    const song = await createSongService(db(device)).createSong(USER_ID, {
      storyId: STORY_ID,
      title: 'Song-seed',
    });
    const sketch = await createSketchService(db(device)).createSketch(USER_ID, {
      storyId: STORY_ID,
      name: 'Sketch-seed',
    } as never);
    const scene = await sceneOf(device);
    if (!scene) return;
    await createScenePageService(db(device)).createPage(USER_ID, {
      storyId: STORY_ID,
      sceneId: scene.id,
      media: { sketchId: sketch.id },
      text: 'Page-seed',
    });
    await createSceneMusicService(db(device)).addMusic(USER_ID, {
      storyId: STORY_ID,
      sceneId: scene.id,
      target: { songId: song.id },
      cue: 'Cue-seed',
    });
  };

  return Object.assign(edit, { prime });
}
