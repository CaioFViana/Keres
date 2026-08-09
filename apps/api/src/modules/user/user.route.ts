import { UpdateUserPasswordSchema, UpdateUserProfileSchema, UpdateUserTagSchema } from '@keres/shared';
import { Elysia, t } from 'elysia';
import { JWTPayload } from '../../index';
import { InvalidCurrentPasswordError, TagAlreadyTakenError, userService } from '../../services/UserService';
import { friendshipService } from '../../services/FriendshipService';

const userResponseSchema = t.Object({
  id: t.String(),
  username: t.String(),
  tag: t.String(),
  avatarColor: t.Nullable(t.String()),
  avatarIcon: t.Nullable(t.String()),
  bio: t.Nullable(t.String()),
});

export const userRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null)
  .get('/details/:userId', async ({ params, set, user }) => {
    // Ensure the request is authenticated
    if (!user) {
      set.status = 401;
      return { message: 'Unauthorized' };
    }

    const { userId } = params;

    // Basic validation for userId format (assuming ULID)
    if (!userId || typeof userId !== 'string' || userId.length !== 26) { // ULID length is 26
      set.status = 400;
      return { message: 'Invalid userId format' };
    }

    const foundUser = await userService.getUserById(userId);

    if (!foundUser) {
      set.status = 404;
      return { message: 'User not found' };
    }

    return foundUser;
  }, {
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
  })
  .get('/by-tag/:tag', async ({ params, set, user }) => {
    if (!user) {
      set.status = 401;
      return { message: 'Unauthorized' };
    }

    const foundUser = await userService.getUserByTag(params.tag);

    if (!foundUser) {
      set.status = 404;
      return { message: 'User not found' };
    }

    return foundUser;
  }, {
    params: t.Object({
      tag: t.String({ minLength: 1, maxLength: 20 }),
    }),
    response: {
      200: userResponseSchema,
      401: t.Object({ message: t.String() }),
      404: t.Object({ message: t.String() }),
    },
    detail: {
      summary: 'Resolve a user by their @tag',
      description: 'Looks up a user by their friend-discovery tag (case-insensitive), for adding friends without sharing a raw ID.',
      tags: ['User'],
      security: [{ bearerAuth: [] }],
    },
  })
  .put('/tag', async ({ body, set, user }) => {
    if (!user) {
      set.status = 401;
      return { message: 'Unauthorized' };
    }

    const parsed = UpdateUserTagSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { message: parsed.error.issues[0]?.message || 'Invalid tag' };
    }

    try {
      const updated = await userService.updateUserTag(user.userId, parsed.data.tag);
      await friendshipService.notifyProfileChanged(user.userId);
      return updated;
    } catch (error) {
      // TagAlreadyTakenError covers the common case; a unique-violation can still slip
      // through under a concurrent race, so treat both the same way.
      if (error instanceof TagAlreadyTakenError || (error as { code?: string })?.code === '23505') {
        set.status = 409;
        return { message: 'Tag is already taken.' };
      }
      throw error;
    }
  }, {
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
      description: 'Updates the current user\'s friend-discovery tag. Can be changed at any time.',
      tags: ['User'],
      security: [{ bearerAuth: [] }],
    },
  })
  .put('/profile', async ({ body, set, user }) => {
    if (!user) {
      set.status = 401;
      return { message: 'Unauthorized' };
    }

    const parsed = UpdateUserProfileSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { message: parsed.error.issues[0]?.message || 'Invalid profile data' };
    }

    const updated = await userService.updateUserProfile(user.userId, parsed.data);
    await friendshipService.notifyProfileChanged(user.userId);
    return updated;
  }, {
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
      description: 'Updates the current user\'s avatar color, avatar icon, and/or bio. Omitted fields are left unchanged; explicit `null` clears a field.',
      tags: ['User'],
      security: [{ bearerAuth: [] }],
    },
  })
  .put('/password', async ({ body, set, user }) => {
    if (!user) {
      set.status = 401;
      return { message: 'Unauthorized' };
    }

    const parsed = UpdateUserPasswordSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { message: parsed.error.issues[0]?.message || 'Invalid password data' };
    }

    try {
      await userService.changeOwnPassword(user.userId, parsed.data.currentPassword, parsed.data.newPassword);
      return { message: 'Password updated successfully.' };
    } catch (error) {
      if (error instanceof InvalidCurrentPasswordError) {
        set.status = 401;
        return { message: error.message };
      }
      throw error;
    }
  }, {
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
      description: 'Requires the current password. Self-service - distinct from the admin panel\'s password reset, which does not require it.',
      tags: ['User'],
      security: [{ bearerAuth: [] }],
    },
  });
