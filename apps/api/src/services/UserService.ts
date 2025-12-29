import { eq } from 'drizzle-orm';
import { db } from '../db'; // Assuming 'db' is exported from '../db/index.ts'
import { users } from '../db/schema/tables/users'; // Import the users schema

export class UserService {
  async getUserById(userId: string): Promise<{ id: string; username: string } | undefined> {
    const user = await db.query.users.findFirst({
      columns: {
        id: true,
        username: true,
      },
      where: eq(users.id, userId),
    });
    return user;
  }
}

export const userService = new UserService();
