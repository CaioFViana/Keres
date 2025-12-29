import { Elysia, t } from 'elysia';
import { JWTPayload } from '../../index';
import { userService } from '../../services/UserService';

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

    return { id: foundUser.id, username: foundUser.username };
  }, {
    params: t.Object({
      userId: t.String({
        minLength: 26, // Assuming ULID
        maxLength: 26,
      }),
    }),
    response: {
      200: t.Object({
        id: t.String(),
        username: t.String(),
      }),
      400: t.Object({ message: t.String() }),
      401: t.Object({ message: t.String() }),
      404: t.Object({ message: t.String() }),
    },
    detail: {
      summary: 'Get User Details by ID',
      description: 'Retrieves the ID and username of a user by their unique ID.',
      tags: ['User'],
      security: [{ bearerAuth: [] }],
    },
  });
