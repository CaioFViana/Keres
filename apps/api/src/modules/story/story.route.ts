import { Elysia, t } from 'elysia';
import { db } from '../../db';
import { stories, storyTypeEnum } from '../../db/schema';
import { ulid } from 'ulid';
import { JWTPayload } from '../../index'; // Import JWTPayload

// Convert the enumValues array to an object for t.Enum()
const storyTypeEnumObject = storyTypeEnum.enumValues.reduce((acc, val) => {
  acc[val] = val;
  return acc;
}, {} as Record<string, (typeof storyTypeEnum.enumValues)[number]>);

export const storyRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null) // Explicitly decorate 'user' property
  .post('/', async ({ body, user, set }) => {
    if (!user || !user.userId) {
      set.status = 401;
      throw new Error('Unauthorized: User not authenticated.');
    }

    const { title, type } = body;

    const [newStory] = await db
      .insert(stories)
      .values({
        id: ulid(),
        userId: user.userId,
        title,
        type,
      })
      .returning();

    if (!newStory) {
      set.status = 500;
      throw new Error('Failed to create story.');
    }

    return newStory;
  }, {
    body: t.Object({
      title: t.String(),
      type: t.Enum(storyTypeEnumObject), // Use the converted object here
    }),
    detail: {
      summary: 'Create a new story',
      description: 'Creates a new story associated with the authenticated user.',
      tags: ['Story'],
    },
  });
