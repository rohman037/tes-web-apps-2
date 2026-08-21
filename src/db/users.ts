import { db } from './index';
import { users } from './schema';
import { eq } from 'drizzle-orm';

export async function getOrCreateUser(uid: string, email: string, name?: string) {
  try {
    const result = await db.insert(users)
      .values({
        uid,
        email,
        name: name || null,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          ...(name ? { name } : {}),
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error("Database user operation failed:", error);
    return {
      id: 0,
      uid,
      email,
      name: name || null,
      role: 'user',
      accessCode: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

export async function getUserById(uid: string) {
  try {
    const res = await db.select().from(users).where(eq(users.uid, uid));
    return res[0] || null;
  } catch (error) {
    console.error("Failed to fetch user by id:", error);
    return null;
  }
}

export async function updateUserRole(uid: string, role: string) {
  try {
    await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.uid, uid));
  } catch (error) {
    console.error("Failed to update user role:", error);
  }
}
