import { STORY_ID, type SyncDevice, USER_ID } from './syncDevices';
import { attemptFor, type FuzzContext, live, short } from './syncFuzzSupport';

/**
 * The convergence fuzz's collaboration edits: what several people do around the story rather
 * than to it - favourites (one row per user and entity, so two devices of one user make the same
 * one offline), comments, the stretches a chapter spans on the timeline, and, in a branching
 * story, routes and the path each one walks (replaced whole, so two devices replacing one path
 * offline write the same positions).
 *
 * A write the app itself refuses before anything is recorded (an open stretch beside another, a
 * path through a scene deleted meanwhile) is logged and skipped, as a user would see a message.
 */

const anchorIdFor = (index: number) => `01J0000000000000000ANC${String(index).padStart(4, '0')}`;

export function createCollaborationEdits(context: FuzzContext) {
  const { random, pick, log, storyType, chapterIds, next } = context;
  let nextAnchor = 0;

  const attempt = attemptFor(log);

  const favoriteEdit = async (device: SyncDevice) => {
    const targets = [
      ...(await live(device, 'Character')).map((row) => ['Character', row.id] as const),
      ...(await live(device, 'Scene')).map((row) => ['Scene', row.id] as const),
    ];
    if (targets.length === 0) return;
    const [entityType, entityId] = pick(targets);
    const value = random() < 0.6;
    await attempt(device, `favorites ${entityType} ${short(entityId)}=${value}`, () =>
      device.favorites.setFavorite(STORY_ID, entityId, entityType, USER_ID, value),
    );
  };

  const commentEdit = async (device: SyncDevice) => {
    const comments = await live(device, 'Comment');
    const roll = random();
    if (comments.length === 0 || roll < 0.4) {
      const characters = await live(device, 'Character');
      if (characters.length === 0) return;
      const character = pick(characters);
      await attempt(device, `comments on ${short(character.id)}`, () =>
        device.comments.createComment(
          USER_ID,
          STORY_ID,
          'Character',
          character.id,
          { fieldKey: 'description' },
          {
            contentSnapshot: null,
            excerptText: null,
            commentText: `${device.name}-comment-${next()}`,
            criticality: 1,
          },
        ),
      );
      return;
    }
    const comment = pick(comments);
    if (roll < 0.75) {
      const commentText = `${device.name}-reply-${next()}`;
      await attempt(device, `edits comment ${short(comment.id)}=${commentText}`, () =>
        device.comments.updateComment(USER_ID, comment.id, { commentText }),
      );
      return;
    }
    await attempt(device, `deletes comment ${short(comment.id)}`, () =>
      device.comments.deleteComment(USER_ID, comment.id, true),
    );
  };

  const anchorEdit = async (device: SyncDevice) => {
    const scenes = await live(device, 'Scene');
    if (scenes.length === 0) return;
    const anchors = await live(device, 'ChapterAnchor');
    const roll = random();
    if (anchors.length === 0 || roll < 0.4) {
      const chapterId = pick(chapterIds);
      const start = pick(scenes);
      // Mostly closed stretches: an open one stands alone on its chapter.
      const end = random() < 0.8 ? pick(scenes) : null;
      const id = anchorIdFor(nextAnchor++);
      await attempt(
        device,
        `anchors ${short(chapterId)} ${id} ${short(start.id)}..${end ? short(end.id) : 'open'}`,
        async () =>
          device.anchors.createAnchor(USER_ID, {
            id,
            storyId: STORY_ID,
            chapterId,
            order: await device.anchors.nextOrderFor(STORY_ID, chapterId),
            startSceneId: start.id,
            startPosition: 'start',
            startOffset: null,
            startOffsetUnit: null,
            endSceneId: end?.id ?? null,
            endPosition: end ? 'end' : null,
            endOffset: null,
            endOffsetUnit: null,
          } as never),
      );
      return;
    }
    const anchor = pick(anchors);
    if (roll < 0.8) {
      const start = pick(scenes);
      const startPosition = pick(['start', 'middle', 'end'] as const);
      await attempt(
        device,
        `moves anchor ${anchor.id} to ${short(start.id)}@${startPosition}`,
        () =>
          device.anchors.updateAnchor(USER_ID, anchor.id, {
            startSceneId: start.id,
            startPosition,
          }),
      );
      return;
    }
    await attempt(device, `deletes anchor ${anchor.id}`, () =>
      device.anchors.deleteAnchor(USER_ID, anchor.id),
    );
  };

  const routeEdit = async (device: SyncDevice) => {
    const routes = await live(device, 'Route');
    const roll = random();
    if (routes.length === 0 || roll < 0.2) {
      const name = `${device.name}-route-${next()}`;
      await attempt(device, `creates route ${name}`, () =>
        device.routes.save(USER_ID, { storyId: STORY_ID, name, details: null }),
      );
      return;
    }
    const route = pick(routes);
    if (roll < 0.35) {
      const name = `${device.name}-route-${next()}`;
      await attempt(device, `renames route ${short(route.id)}=${name}`, () =>
        device.routes.save(USER_ID, { id: route.id, storyId: STORY_ID, name, details: null }),
      );
      return;
    }
    if (roll < 0.9) {
      const scenes = await live(device, 'Scene');
      if (scenes.length === 0) return;
      const scene = pick(scenes);
      await attempt(device, `walks route ${short(route.id)} through ${short(scene.id)}`, () =>
        device.routes.replaceSteps(USER_ID, route.id, [
          { sceneId: scene.id, selectedChoiceId: null },
        ]),
      );
      return;
    }
    await attempt(device, `deletes route ${short(route.id)}`, () =>
      device.routes.delete(USER_ID, route.id),
    );
  };

  return async (device: SyncDevice) => {
    const roll = random();
    if (roll < 0.3) await favoriteEdit(device);
    else if (roll < 0.55) await commentEdit(device);
    else if (roll < 0.7 || storyType !== 'branching') await anchorEdit(device);
    else await routeEdit(device);
  };
}
