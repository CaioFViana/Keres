import type { AuditCategory, AuditOutcome } from '@keres/shared';

/**
 * What is worth putting in the activity record, by request: each rule names a route (method and path,
 * without the `/api` prefix) and the event it stands for. The record is made from the requests rather
 * than from calls scattered through the services, so a new route is one line here and nothing in the
 * code that serves it has to remember to say what it did.
 *
 * The groups of the pattern (`(?<targetUserId>...)`) name what the event is about.
 */
export interface AuditRule {
  method: string;
  pattern: RegExp;
  category: AuditCategory;
  action: string;
  /** What kind of thing the main group of the path is (`story`, `user`...). */
  targetType?: string;
  /** The group of the pattern that is the target's id. */
  targetGroup?: string;
  /** The group that is a user the action was done to. */
  subjectGroup?: string;
  /** The body carries the name that was tried or created: it stands for the actor, with no token to say. */
  usernameFromBody?: boolean;
  /** Only the failures are worth a line (a token that could not be refreshed, a wrong unlock password). */
  onlyFailures?: boolean;
  /** A 429 here is a plan limit being met, not rate limiting. */
  limitRoute?: boolean;
}

const id = '(?<id>[^/]+)';

const user = (method: string, path: string, action: string): AuditRule => ({
  method,
  pattern: new RegExp(`^/user/${path}$`),
  category: 'account',
  action,
});

const friend = (method: string, path: string, action: string): AuditRule => ({
  method,
  pattern: new RegExp(`^/friend/${path}/(?<targetUserId>[^/]+)$`),
  category: 'friendship',
  action,
  targetType: 'user',
  targetGroup: 'targetUserId',
  subjectGroup: 'targetUserId',
});

const admin = (
  method: string,
  path: string,
  action: string,
  extra: Partial<AuditRule> = {},
): AuditRule => ({
  method,
  pattern: new RegExp(`^/admin/${path}$`),
  category: 'admin',
  action,
  ...extra,
});

/** First match wins: the narrower route goes before the wider one that would also match it. */
export const AUDIT_RULES: readonly AuditRule[] = [
  // --- sign in, sign up, recovery
  {
    method: 'POST',
    pattern: /^\/auth\/login$/,
    category: 'auth',
    action: 'auth.login',
    usernameFromBody: true,
  },
  {
    method: 'POST',
    pattern: /^\/auth\/register$/,
    category: 'auth',
    action: 'auth.register',
    usernameFromBody: true,
  },
  {
    method: 'POST',
    pattern: /^\/auth\/forgot-password$/,
    category: 'auth',
    action: 'auth.password_recovery',
    usernameFromBody: true,
  },
  {
    method: 'POST',
    pattern: /^\/auth\/refresh$/,
    category: 'auth',
    action: 'auth.token_refresh',
    onlyFailures: true,
  },

  // --- the user's own account
  user('PUT', 'tag', 'account.tag_changed'),
  user('PUT', 'profile', 'account.profile_updated'),
  user('PUT', 'password', 'account.password_changed'),
  user('PUT', 'recovery-codes', 'account.recovery_codes_regenerated'),

  // --- friendships
  friend('POST', 'request', 'friend.request_sent'),
  friend('PUT', 'accept', 'friend.request_accepted'),
  friend('DELETE', 'decline', 'friend.request_declined'),
  friend('DELETE', 'request', 'friend.request_cancelled'),
  friend('POST', 'blacklist', 'friend.blocked'),
  friend('DELETE', 'blacklist', 'friend.unblocked'),
  friend('DELETE', 'unfriend', 'friend.unfriended'),

  // --- collaboration on stories
  {
    method: 'POST',
    pattern: /^\/friend\/story-invitations\/?$/,
    category: 'story',
    action: 'story.invitation_sent',
  },
  {
    method: 'PUT',
    pattern: /^\/friend\/story-invitations\/(?<invitationId>[^/]+)\/accept$/,
    category: 'story',
    action: 'story.invitation_accepted',
    targetType: 'invitation',
    targetGroup: 'invitationId',
  },
  {
    method: 'DELETE',
    pattern: /^\/friend\/story-invitations\/(?<invitationId>[^/]+)$/,
    category: 'story',
    action: 'story.invitation_closed',
    targetType: 'invitation',
    targetGroup: 'invitationId',
  },
  {
    method: 'POST',
    pattern: /^\/story-permissions\/?$/,
    category: 'story',
    action: 'story.collaborator_added',
  },
  {
    method: 'DELETE',
    pattern: /^\/story-permissions\/story\/(?<storyId>[^/]+)\/user\/(?<targetUserId>[^/]+)$/,
    category: 'story',
    action: 'story.collaborator_removed',
    targetType: 'story',
    targetGroup: 'storyId',
    subjectGroup: 'targetUserId',
  },
  {
    method: 'DELETE',
    pattern: /^\/story-permissions\/story\/(?<storyId>[^/]+)\/me$/,
    category: 'story',
    action: 'story.collaboration_left',
    targetType: 'story',
    targetGroup: 'storyId',
  },

  // --- payments: the attempt to pay is the person's act; what the provider reports is noted by the service
  {
    method: 'POST',
    pattern: /^\/payments\/checkout$/,
    category: 'payment',
    action: 'payment.checkout_started',
  },
  {
    method: 'POST',
    pattern: /^\/payments\/webhook$/,
    category: 'payment',
    action: 'payment.webhook_rejected',
    onlyFailures: true,
  },

  // --- messages: that they were sent, never what they say
  {
    method: 'POST',
    pattern: /^\/messages\/user\/(?<targetUserId>[^/]+)$/,
    category: 'message',
    action: 'message.sent_direct',
    targetType: 'user',
    targetGroup: 'targetUserId',
    subjectGroup: 'targetUserId',
    limitRoute: true,
  },
  {
    method: 'POST',
    pattern: /^\/messages\/admin$/,
    category: 'message',
    action: 'message.sent_admin',
    limitRoute: true,
  },
  {
    method: 'DELETE',
    pattern: /^\/messages\/admin$/,
    category: 'message',
    action: 'message.conversation_cleared',
  },
  {
    method: 'DELETE',
    pattern: /^\/messages\/user\/(?<targetUserId>[^/]+)$/,
    category: 'message',
    action: 'message.conversation_cleared',
    targetType: 'user',
    targetGroup: 'targetUserId',
    subjectGroup: 'targetUserId',
  },
  {
    method: 'DELETE',
    pattern: /^\/messages\/(?<messageId>[^/]+)$/,
    category: 'message',
    action: 'message.deleted',
    targetType: 'message',
    targetGroup: 'messageId',
  },

  // --- stories, publications, packs
  {
    method: 'POST',
    pattern: /^\/stories\/import$/,
    category: 'story',
    action: 'story.imported',
  },
  {
    method: 'GET',
    pattern: /^\/stories\/(?<storyId>[^/]+)\/export$/,
    category: 'story',
    action: 'story.exported',
    targetType: 'story',
    targetGroup: 'storyId',
  },
  {
    method: 'POST',
    pattern: /^\/stories\/(?<storyId>[^/]+)\/publications$/,
    category: 'publication',
    action: 'publication.published',
    targetType: 'story',
    targetGroup: 'storyId',
    limitRoute: true,
  },
  {
    method: 'PUT',
    pattern: /^\/stories\/(?<storyId>[^/]+)\/showcase$/,
    category: 'publication',
    action: 'publication.showcase_updated',
    targetType: 'story',
    targetGroup: 'storyId',
  },
  {
    method: 'DELETE',
    pattern: /^\/stories\/(?<storyId>[^/]+)\/publications\/(?<publicationId>[^/]+)$/,
    category: 'publication',
    action: 'publication.version_removed',
    targetType: 'story',
    targetGroup: 'storyId',
  },
  {
    method: 'DELETE',
    pattern: /^\/stories\/(?<storyId>[^/]+)\/publications$/,
    category: 'publication',
    action: 'publication.unpublished',
    targetType: 'story',
    targetGroup: 'storyId',
  },
  { method: 'POST', pattern: /^\/packs\/?$/, category: 'story', action: 'pack.created' },
  {
    method: 'DELETE',
    pattern: /^\/packs\/(?<packId>[^/]+)$/,
    category: 'story',
    action: 'pack.deleted',
    targetType: 'pack',
    targetGroup: 'packId',
  },

  // --- the public site
  {
    method: 'POST',
    pattern: /^\/public\/contact$/,
    category: 'contact',
    action: 'contact.message_received',
  },
  {
    method: 'POST',
    pattern: /^\/public\/stories\/(?<storyId>[^/]+)\/unlock$/,
    category: 'security',
    action: 'security.showcase_unlock',
    targetType: 'story',
    targetGroup: 'storyId',
    onlyFailures: true,
  },

  // --- the administrators
  admin('POST', 'users', 'admin.user_created'),
  admin('PUT', `users/${id}`, 'admin.user_updated', {
    targetType: 'user',
    targetGroup: 'id',
    subjectGroup: 'id',
  }),
  admin('DELETE', `users/${id}`, 'admin.user_deleted', {
    targetType: 'user',
    targetGroup: 'id',
    subjectGroup: 'id',
  }),
  admin('POST', `users/${id}/restore`, 'admin.user_restored', {
    targetType: 'user',
    targetGroup: 'id',
    subjectGroup: 'id',
  }),
  admin('POST', `users/${id}/regenerate-recovery-codes`, 'admin.recovery_codes_regenerated', {
    targetType: 'user',
    targetGroup: 'id',
    subjectGroup: 'id',
  }),
  admin('POST', 'tiers', 'admin.tier_created'),
  admin('PUT', `tiers/${id}`, 'admin.tier_updated', { targetType: 'tier', targetGroup: 'id' }),
  admin('DELETE', `tiers/${id}`, 'admin.tier_deleted', { targetType: 'tier', targetGroup: 'id' }),
  admin('PUT', 'registration-settings', 'admin.registration_settings_updated'),
  admin('PUT', 'showcase-settings', 'admin.showcase_settings_updated'),
  admin('POST', 'showcase-settings/logo', 'admin.showcase_logo_changed'),
  admin('DELETE', 'showcase-settings/logo', 'admin.showcase_logo_removed'),
  admin('POST', 'recovery/(?<entityType>[^/]+)/(?<id>[^/]+)/restore', 'admin.entity_restored', {
    targetType: 'entity',
    targetGroup: 'id',
  }),
  {
    method: 'GET',
    pattern: /^\/admin\/messages\/(?<id>(?!unread-count$)[^/]+)$/,
    category: 'admin',
    action: 'admin.message_opened',
    targetType: 'message',
    targetGroup: 'id',
  },
  admin('PATCH', `messages/${id}`, 'admin.message_updated', {
    targetType: 'message',
    targetGroup: 'id',
  }),
  admin('POST', `messages/${id}/reply`, 'admin.message_replied', {
    targetType: 'message',
    targetGroup: 'id',
  }),
  admin('DELETE', `messages/${id}`, 'admin.message_deleted', {
    targetType: 'message',
    targetGroup: 'id',
  }),
  admin('GET', 'activity/export', 'admin.activity_exported'),
];

export interface ClassifiedRequest {
  rule: AuditRule | null;
  groups: Record<string, string>;
}

/** The rule a request falls under, with what its path named. */
export function classifyRequest(method: string, path: string): ClassifiedRequest {
  const bare = path.replace(/^\/api(?=\/)/, '');
  for (const rule of AUDIT_RULES) {
    if (rule.method !== method) continue;
    const match = rule.pattern.exec(bare);
    if (match) return { rule, groups: { ...(match.groups ?? {}) } };
  }
  return { rule: null, groups: {} };
}

/** Whether a path belongs to the administrators' API. */
export const isAdminApiPath = (path: string): boolean => /^\/api\/admin(\/|$)/.test(path);

/** How a request ended, from its status: refused for who asked or how often, or for what was asked. */
export function outcomeOf(status: number): AuditOutcome {
  if (status < 400) return 'success';
  return status === 403 || status === 429 ? 'denied' : 'failure';
}
