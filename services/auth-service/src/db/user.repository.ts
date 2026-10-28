import { eq, inArray } from 'drizzle-orm';
import { createDb, type D1Binding } from '@notio/db';
import type { UserProfile } from '@notio/contracts';
import * as authSchema from './auth-schema.generated';

/**
 * Direct access to the users table.
 *
 * Used where Better Auth's answer does not suit us: it replies 200 to a
 * repeated registration of the same email even though no row is created.
 * Checking email availability before calling Better Auth makes the behaviour
 * predictable.
 */

/**
 * The generated module also has `relations` — not a table, and passing it to
 * Drizzle breaks client type inference. So the schema is assembled explicitly
 * from the tables.
 */
const tables = {
  user: authSchema.user,
  session: authSchema.session,
  account: authSchema.account,
  verification: authSchema.verification,
  jwks: authSchema.jwks,
};

export interface UserAccount {
  id: string;
  email: string;
  emailVerified: boolean;
}

export function createUserRepository(env: D1Binding) {
  const client = createDb(env, tables);

  return {
    /** Finds a user by email; the address is compared case-insensitively. */
    async findByEmail(email: string): Promise<UserAccount | null> {
      const [user] = await client
        .select({
          id: tables.user.id,
          email: tables.user.email,
          emailVerified: tables.user.emailVerified,
        })
        .from(tables.user)
        .where(eq(tables.user.email, email.trim().toLowerCase()))
        .limit(1);

      return user ?? null;
    },

    /** Public profiles by id: other services need them for member lists. */
    async findProfilesByIds(ids: string[]): Promise<UserProfile[]> {
      if (ids.length === 0) {
        return [];
      }

      const rows = await client
        .select({ id: tables.user.id, email: tables.user.email, name: tables.user.name })
        .from(tables.user)
        .where(inArray(tables.user.id, ids));

      return rows;
    },
  };
}

export type UserRepository = ReturnType<typeof createUserRepository>;
