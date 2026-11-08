import { BASE_ERROR_CODES } from 'better-auth';
import { APIError, createAuthEndpoint, sensitiveSessionMiddleware } from 'better-auth/api';
import type { BetterAuthPlugin } from 'better-auth';
import { z } from 'zod';

/**
 * Password change without the current password — like Notion.
 *
 * The standard change-password endpoint requires the current password and
 * verifies it. Here knowledge of the old password is replaced by session
 * protection: sensitiveSessionMiddleware lets the request through only if the
 * session is "fresh" (recently confirmed), so the form field in settings is
 * not needed. The endpoint is private: without a session access is impossible.
 *
 * Error codes match Better Auth's so the client can map them with one table
 * (WEAK_PASSWORD, PASSWORD_NOT_SET, SESSION_EXPIRED).
 */
export function sessionPasswordPlugin(): BetterAuthPlugin {
  return {
    id: 'session-password',
    endpoints: {
      changePasswordWithSession: createAuthEndpoint(
        '/change-password/session',
        {
          method: 'POST',
          body: z.object({
            newPassword: z.string().min(1),
          }),
          use: [sensitiveSessionMiddleware],
        },
        async (ctx) => {
          const newPassword = ctx.body.newPassword;

          // Length bounds are the same as the standard change-password's.
          if (newPassword.length < ctx.context.password.config.minPasswordLength) {
            throw APIError.from('BAD_REQUEST', BASE_ERROR_CODES.PASSWORD_TOO_SHORT);
          }

          if (newPassword.length > ctx.context.password.config.maxPasswordLength) {
            throw APIError.from('BAD_REQUEST', BASE_ERROR_CODES.PASSWORD_TOO_LONG);
          }

          const session = ctx.context.session;
          const account = await ctx.context.internalAdapter.findCredentialAccount(session.user.id);

          // The account was created via OAuth and has no password: nothing to change.
          if (!account || !account.password) {
            throw APIError.from('BAD_REQUEST', BASE_ERROR_CODES.CREDENTIAL_ACCOUNT_NOT_FOUND);
          }

          const passwordHash = await ctx.context.password.hash(newPassword);

          await ctx.context.internalAdapter.updateAccount(account.id, { password: passwordHash });

          // Other sessions stay valid: a password change is not a global sign-out.
          return ctx.json({ status: true });
        },
      ),
    },
  };
}
