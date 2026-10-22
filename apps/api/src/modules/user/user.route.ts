import {
  AccountPlanSchema,
  RegenerateRecoveryCodesSchema,
  OwnPublicProfileSchema,
  UpdateOwnPublicProfileSchema,
  UpdateUserPasswordSchema,
  UpdateUserPreferencesSchema,
  UpdateUserProfileSchema,
  UpdateUserTagSchema,
  UserPreferencesSchema,
  UserReportRequestSchema,
} from '@keres/shared';
import { Elysia, t } from 'elysia';
import type { JWTPayload } from '@/index';
import {
  AdultVerificationRequiredError,
  InvalidCurrentPasswordError,
  TagAlreadyTakenError,
  userService,
} from '@/services/accounts/UserService';
import { friendshipService } from '@/services/accounts/FriendshipService';
import { messageService } from '@/services/messages/MessageService';
import { storyNsfwService } from '@/services/stories/StoryNsfwService';
import { tierEnforcementService } from '@/services/tiers/TierEnforcementService';
import { userDataService } from '@/services/accounts/UserDataService';
import { AppError, isUniqueViolation } from '@/utils/errors';

const userResponseSchema = t.Object({
  id: t.String(),
  username: t.String(),
  tag: t.String(),
  avatarColor: t.Nullable(t.String()),
  avatarIcon: t.Nullable(t.String()),
  bio: t.Nullable(t.String()),
  isAdultVerified: t.Boolean(),
});

/** The author page's texts as a TypeBox shape, for the places that nest it inside another TypeBox object. */
const publicProfileResponseSchema = t.Object({
  biography: t.Nullable(t.String()),
  links: t.Array(t.Object({ label: t.String(), url: t.String() })),
  theme: t.Nullable(t.String()),
});

export const userRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null)
  .get(
    '/details/:userId',
    async ({ params, user }) => {
      // Ensure the request is authenticated
      if (!user) {
        throw new AppError(401, 'Unauthorized');
      }

      const { userId } = params;

      // Basic validation for userId format (assuming ULID)
      if (!userId || typeof userId !== 'string' || userId.length !== 26) {
        // ULID length is 26
        throw new AppError(400, 'Invalid userId format');
      }

      const foundUser = await userService.getUserById(userId);

      // Another person's account is found only while it is active: a pending one answers as a missing one.
      if (!foundUser || (userId !== user.userId && !(await userService.isActiveUser(userId)))) {
        throw new AppError(404, 'User not found');
      }

      return foundUser;
    },
    {
      params: t.Object({
        userId: t.String({
          minLength: 26, // Assuming ULID
          maxLength: 26,
        }),
      }),
      response: {
        200: userResponseSchema,
        400: t.Object({ message: t.String() }),
        401: t.Object({ message: t.String() }),
        404: t.Object({ message: t.String() }),
      },
      detail: {
        summary: 'Get User Details by ID',
        description: 'Retrieves the ID, username and tag of a user by their unique ID.',
        tags: ['User'],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .get(
    '/plan',
    async ({ user }) => {
      if (!user) {
        throw new AppError(401, 'Unauthorized');
      }
      return tierEnforcementService.getAccountPlan(user.userId);
    },
    {
      response: {
        200: AccountPlanSchema,
        401: t.Object({ message: t.String() }),
      },
      detail: {
        summary: "The authenticated user's plan",
        description:
          'The plan that counts for the user - paid for, given by an administrator or the signup default - with its ceilings (null is unlimited) and how much of them is used, so the client can say what the plan comes with.',
        tags: ['User'],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .get(
    '/preferences',
    async ({ user }) => {
      if (!user) {
        throw new AppError(401, 'Unauthorized');
      }
      const preferences = await userService.getPreferences(user.userId);
      if (!preferences) {
        throw new AppError(401, 'Unauthorized');
      }
      return preferences;
    },
    {
      response: {
        200: UserPreferencesSchema,
        401: t.Object({ message: t.String() }),
      },
      detail: {
        summary: 'Your private preferences',
        description:
          'The owner-only preferences: whether to show adults-only (+18) stories in the public showcase and reader, and whether the account is age-verified (the choice has no effect until it is). Not part of the public profile.',
        tags: ['User'],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .get(
    '/data',
    async ({ user }) => {
      if (!user) {
        throw new AppError(401, 'Unauthorized');
      }
      return userDataService.exportForUser(user.userId);
    },
    {
      response: {
        200: t.Object({
          exportedAt: t.String(),
          profile: t.Nullable(userResponseSchema),
          legalAcceptances: t.Array(t.Any()),
          friendships: t.Array(t.Any()),
          conversations: t.Array(t.Any()),
          publications: t.Array(t.Any()),
          payments: t.Any(),
          activity: t.Any(),
          accessRecords: t.Any(),
          ageVerification: t.Array(t.Any()),
          preferences: t.Nullable(t.Object({ showNsfw: t.Boolean() })),
          publicProfile: t.Nullable(publicProfileResponseSchema),
        }),
        401: t.Object({ message: t.String() }),
      },
      detail: {
        summary: 'Export your data',
        description:
          'Everything the server holds about the authenticated account - profile, legal acceptances, friendships, conversations, publications, payments and activity lines - for the access and portability right. Story content itself lives on the device and exports from the app.',
        tags: ['User'],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .get(
    '/by-tag/:tag',
    async ({ params, user }) => {
      if (!user) {
        throw new AppError(401, 'Unauthorized');
      }

      const foundUser = await userService.getUserByTag(params.tag);

      if (!foundUser) {
        throw new AppError(404, 'User not found');
      }

      return foundUser;
    },
    {
      params: t.Object({
        // Looser than a stored tag on purpose: it is typed by hand ("@Caio Viana"), and read the way a
        // tag is stored before it is compared. A tag nobody holds is just a 404.
        tag: t.String({ minLength: 1, maxLength: 64 }),
      }),
      response: {
        200: userResponseSchema,
        401: t.Object({ message: t.String() }),
        404: t.Object({ message: t.String() }),
      },
      detail: {
        summary: 'Resolve a user by their @tag',
        description:
          'Looks up a user by their friend-discovery tag, for adding friends without sharing a raw ID. Case, accents, a leading "@" and spaces do not matter: "@Caio Viana" finds `caio_viana`.',
        tags: ['User'],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .post(
    '/:userId/report',
    async ({ params, body, user, set }) => {
      if (!user) {
        throw new AppError(401, 'Unauthorized');
      }
      if (!params.userId || params.userId.length !== 26) {
        throw new AppError(400, 'Invalid userId format');
      }
      const parsed = UserReportRequestSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError(400, parsed.error.issues[0]?.message || 'Invalid report');
      }
      await messageService.reportUser(
        user.userId,
        params.userId,
        parsed.data.reason,
        parsed.data.type,
      );
      set.status = 201;
      return { ok: true };
    },
    {
      params: t.Object({
        userId: t.String({
          minLength: 26,
          maxLength: 26,
        }),
      }),
      body: t.Object({
        reason: t.String(),
        type: t.Optional(
          t.Union([
            t.Literal('intimate'),
            t.Literal('copyright'),
            t.Literal('spam_abuse'),
            t.Literal('illegal'),
            t.Literal('other'),
          ]),
        ),
      }),
      response: {
        201: t.Object({ ok: t.Boolean() }),
        400: t.Object({ message: t.String() }),
        401: t.Object({ message: t.String() }),
        403: t.Object({ message: t.String() }),
        404: t.Object({ message: t.String() }),
      },
      detail: {
        summary: 'Report a user to the administrators',
        description:
          'Sends the type and reason to the administrators as a message carrying this user id. Never your own account.',
        tags: ['User'],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .put(
    '/tag',
    async ({ body, user }) => {
      if (!user) {
        throw new AppError(401, 'Unauthorized');
      }

      const parsed = UpdateUserTagSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError(400, parsed.error.issues[0]?.message || 'Invalid tag');
      }

      try {
        const updated = await userService.updateUserTag(user.userId, parsed.data.tag);
        await friendshipService.notifyProfileChanged(user.userId);
        return updated;
      } catch (error) {
        // TagAlreadyTakenError covers the common case; a unique-violation can still slip
        // through under a concurrent race, so treat both the same way.
        if (error instanceof TagAlreadyTakenError || isUniqueViolation(error)) {
          throw new AppError(409, 'Tag is already taken.');
        }
        throw error;
      }
    },
    {
      body: t.Object({
        tag: t.String(),
      }),
      response: {
        200: userResponseSchema,
        400: t.Object({ message: t.String() }),
        401: t.Object({ message: t.String() }),
        409: t.Object({ message: t.String() }),
      },
      detail: {
        summary: 'Change your own @tag',
        description:
          'Updates the current user\'s friend-discovery tag. Can be changed at any time. It is stored as a slug - lowercase letters, digits and underscores, 3 to 20 - so "Caio Viana" becomes `caio_viana`; the response carries the tag as stored.',
        tags: ['User'],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .put(
    '/profile',
    async ({ body, user }) => {
      if (!user) {
        throw new AppError(401, 'Unauthorized');
      }

      const parsed = UpdateUserProfileSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError(400, parsed.error.issues[0]?.message || 'Invalid profile data');
      }

      const updated = await userService.updateUserProfile(user.userId, parsed.data);
      await friendshipService.notifyProfileChanged(user.userId);
      return updated;
    },
    {
      body: t.Object({
        avatarColor: t.Optional(t.Nullable(t.String())),
        avatarIcon: t.Optional(t.Nullable(t.String())),
        bio: t.Optional(t.Nullable(t.String())),
      }),
      response: {
        200: userResponseSchema,
        400: t.Object({ message: t.String() }),
        401: t.Object({ message: t.String() }),
      },
      detail: {
        summary: 'Update your own avatar/bio',
        description:
          "Updates the current user's avatar color, avatar icon, and/or bio. Omitted fields are left unchanged; explicit `null` clears a field.",
        tags: ['User'],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .get(
    '/public-profile',
    async ({ user }) => {
      if (!user) {
        throw new AppError(401, 'Unauthorized');
      }
      const profile = await userService.getPublicProfile(user.userId);
      if (!profile) {
        throw new AppError(401, 'Unauthorized');
      }
      return profile;
    },
    {
      response: {
        200: OwnPublicProfileSchema,
        401: t.Object({ message: t.String() }),
      },
      detail: {
        summary: 'Your author page',
        description:
          "The biography, links and theme of the current user's page on the public showcase. Apart from the short bio friends see.",
        tags: ['User'],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .put(
    '/public-profile',
    async ({ body, user }) => {
      if (!user) {
        throw new AppError(401, 'Unauthorized');
      }

      const parsed = UpdateOwnPublicProfileSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError(400, parsed.error.issues[0]?.message || 'Invalid profile data');
      }

      return userService.updatePublicProfile(user.userId, parsed.data);
    },
    {
      // Shape only: the limits, the addresses and the theme are the shared schema's (a clear message beats a
      // generic schema failure).
      body: t.Object({
        biography: t.Optional(t.Nullable(t.String())),
        links: t.Optional(t.Array(t.Object({ label: t.String(), url: t.String() }))),
        theme: t.Optional(t.Nullable(t.String())),
      }),
      response: {
        200: OwnPublicProfileSchema,
        400: t.Object({ message: t.String() }),
        401: t.Object({ message: t.String() }),
      },
      detail: {
        summary: 'Update your author page',
        description:
          "Updates the biography, links and/or theme of the current user's page on the public showcase. Omitted fields are left unchanged; `null` clears the biography and the theme, an empty list the links.",
        tags: ['User'],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .put(
    '/preferences',
    async ({ body, user }) => {
      if (!user) {
        throw new AppError(401, 'Unauthorized');
      }

      const parsed = UpdateUserPreferencesSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError(400, parsed.error.issues[0]?.message || 'Invalid preferences');
      }

      try {
        return await userService.updatePreferences(user.userId, parsed.data);
      } catch (error) {
        if (error instanceof AdultVerificationRequiredError) {
          throw new AppError(403, error.message);
        }
        throw error;
      }
    },
    {
      body: t.Object({
        showNsfw: t.Boolean(),
      }),
      response: {
        200: UserPreferencesSchema,
        400: t.Object({ message: t.String() }),
        401: t.Object({ message: t.String() }),
        403: t.Object({ message: t.String() }),
      },
      detail: {
        summary: 'Change your private preferences',
        description:
          'Sets whether to show adults-only (+18) stories in the public showcase and reader. Turning it on is refused with 403 unless the account is age-verified; turning it off is always allowed. Only the flag is read from the body.',
        tags: ['User'],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .put(
    '/password',
    async ({ body, user }) => {
      if (!user) {
        throw new AppError(401, 'Unauthorized');
      }

      const parsed = UpdateUserPasswordSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError(400, parsed.error.issues[0]?.message || 'Invalid password data');
      }

      try {
        await userService.changeOwnPassword(
          user.userId,
          parsed.data.currentPassword,
          parsed.data.newPassword,
        );
        return { message: 'Password updated successfully.' };
      } catch (error) {
        if (error instanceof InvalidCurrentPasswordError) {
          throw new AppError(401, error.message);
        }
        throw error;
      }
    },
    {
      body: t.Object({
        currentPassword: t.String(),
        newPassword: t.String(),
      }),
      response: {
        200: t.Object({ message: t.String() }),
        400: t.Object({ message: t.String() }),
        401: t.Object({ message: t.String() }),
      },
      detail: {
        summary: 'Change your own password',
        description:
          "Requires the current password. Self-service - distinct from the admin panel's password reset, which does not require it.",
        tags: ['User'],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .put(
    '/recovery-codes',
    async ({ body, user }) => {
      if (!user) {
        throw new AppError(401, 'Unauthorized');
      }

      const parsed = RegenerateRecoveryCodesSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError(400, parsed.error.issues[0]?.message || 'Invalid request');
      }

      try {
        const recoveryCodes = await userService.regenerateRecoveryCodes(
          user.userId,
          parsed.data.currentPassword,
        );
        return { recoveryCodes };
      } catch (error) {
        if (error instanceof InvalidCurrentPasswordError) {
          throw new AppError(401, error.message);
        }
        throw error;
      }
    },
    {
      // Loose on purpose: RegenerateRecoveryCodesSchema stays the real gate, answering 400.
      body: t.Object({
        currentPassword: t.Optional(t.String()),
      }),
      response: {
        200: t.Object({ recoveryCodes: t.Array(t.String()) }),
        400: t.Object({ message: t.String() }),
        401: t.Object({ message: t.String() }),
      },
      detail: {
        summary: 'Regenerate your recovery codes',
        description:
          'Requires the current password. Invalidates all previous recovery codes and returns a fresh batch - shown only in this response, store them.',
        tags: ['User'],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .delete(
    '/account',
    async ({ body, user }) => {
      if (!user) {
        throw new AppError(401, 'Unauthorized');
      }

      try {
        await userService.deleteOwnAccount(user.userId, body.currentPassword);
        // A deleted account must not linger in adults-only stories: same cleanup as a revocation.
        await storyNsfwService.removeUserFromNsfwStories(user.userId, 'account-deactivated');
        return { message: 'Account deleted.' };
      } catch (error) {
        if (error instanceof InvalidCurrentPasswordError) {
          throw new AppError(401, error.message);
        }
        throw error;
      }
    },
    {
      body: t.Object({
        currentPassword: t.String(),
      }),
      response: {
        200: t.Object({ message: t.String() }),
        401: t.Object({ message: t.String() }),
      },
      detail: {
        summary: 'Delete your own account',
        description:
          'Requires the current password. Deactivates the account at once (login stops working) and personal data is erased within 30 days; contributions to stories owned by others remain, attributed to a removed account.',
        tags: ['User'],
        security: [{ bearerAuth: [] }],
      },
    },
  );
