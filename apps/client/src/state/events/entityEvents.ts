import type { CommentEntityType, FavoriteEntityType } from '@keres/shared';

/**
 * Every event the global `entityEventEmitter` can carry, with the arguments each one is emitted with.
 * The emitter is typed by this map, so a misspelled event name or a wrong argument fails to compile
 * instead of silently never firing. To add an event: add it here, emit it, and subscribe to it.
 */

/**
 * `<entity>_changed`: the rows of one entity type changed in a story (a local write, a pulled change,
 * a conflict resolution). Lists and details of that entity reload on it. `entityId` is present when one
 * row is known, and absent when the change is a batch.
 */
export const ENTITY_CHANGE_EVENTS = [
  'attribute_value_changed',
  'board_changed',
  'chapter_anchor_changed',
  'chapter_changed',
  'character_changed',
  'character_relation_changed',
  'character_scene_changed',
  'choice_changed',
  'choice_check_changed',
  'choice_check_group_changed',
  'comment_changed',
  'effect_changed',
  'favorite_changed',
  'gallery_changed',
  'gallery_relation_changed',
  'item_changed',
  'item_journey_changed',
  'location_changed',
  'location_map_changed',
  'location_relation_changed',
  'mode_changed',
  'note_changed',
  'note_relation_changed',
  'plot_changed',
  'plot_scene_changed',
  'route_changed',
  'route_step_changed',
  'scene_changed',
  'scene_music_changed',
  'scene_page_changed',
  'see_also_relation_changed',
  'sketch_changed',
  'song_changed',
  'stat_changed',
  'stat_relation_changed',
  'stat_strength_changed',
  'story_arc_changed',
  'story_calendar_changed',
  'story_changed',
  'story_schema_field_changed',
  'suggestion_changed',
  'tag_changed',
  'tag_relation_changed',
  'worldrule_changed',
] as const;

export type EntityChangeEvent = (typeof ENTITY_CHANGE_EVENTS)[number];

/** What `story_data_changed` says about a batch of remote changes. */
export interface StoryDataChange {
  storyId: string;
  entityTypes?: string[];
  entityIds?: Record<string, string[]>;
  source?: string;
}

/** The events that are not `<entity>_changed`, with their arguments. */
export interface OtherEventPayloads {
  /** The signed-in friendships changed. */
  friendship_changed: [];
  /** A story's operation log changed (a conflict was decided, remote operations were applied). */
  operation_log_updated: [storyId: string];
  /** A story's sync conflicts were added, decided or discarded. */
  sync_conflicts_changed: [storyId: string];
  /** A server was added, edited, signed in again or removed. */
  server_connection_changed: [];
  /** A pull applied remote changes to a story: what and from where. */
  story_data_changed: [change: StoryDataChange];
  /** The signed-in user's role in a story changed. */
  story_role_changed: [storyId: string];
  /** Collaborators of a story changed, on the given server. */
  story_collaborators_changed: [storyId: string, serverId: string];
  /** The person lost access to a story, which was removed from this device. */
  story_access_lost: [storyId: string];
  /** The app is being reset: listeners finish their work before the database is wiped. */
  application_resetting: [];
  /** A story's published versions changed. */
  publications_changed: [];
  /** Messages of a server changed. */
  messages_changed: [serverId?: string];
  /** The payment state of a server changed. */
  payments_changed: [serverId: string];
  /** The saved payment history of a server changed. */
  payment_history_changed: [serverId: string];
  /** Story invitations were sent, answered or withdrawn. */
  story_invitations_changed: [];
  /** A server asked for the age verification to be finished. */
  verification_pending: [serverId: string];
}

export type EntityEventPayloads = {
  [E in Exclude<EntityChangeEvent, 'comment_changed' | 'favorite_changed'>]: [
    storyId: string,
    entityId?: string,
  ];
} & {
  /** A comment changed: on which entity, so that entity's comment thread reloads. */
  comment_changed: [storyId: string, entityType?: CommentEntityType, entityId?: string];
  /** A favourite was marked or cleared: on what, and by whom (absent when it is the signed-in user). */
  favorite_changed: [
    storyId: string,
    entityType: FavoriteEntityType,
    entityId: string,
    userId?: string,
  ];
} & OtherEventPayloads;

export type EntityEventName = keyof EntityEventPayloads;
