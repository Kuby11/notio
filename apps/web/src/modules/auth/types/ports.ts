import type { Credentials, SignUpInput } from '../utils/credentials';

/**
 * Authentication port.
 *
 * The implementation is an adapter over Better Auth; facade hooks know only
 * this interface, so tests substitute an in-memory version without network.
 */

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  /** URL of the avatar (a media file) or null. */
  image?: string | null;
}

export interface AuthSession {
  user: SessionUser;
  expiresAt: string;
}

export interface AuthGateway {
  /** Registration. No session is created: email confirmation comes first. */
  signUp(input: SignUpInput): Promise<void>;
  /** Password sign-in. Throws an AuthError with code EMAIL_NOT_VERIFIED when the email is unconfirmed. */
  signIn(credentials: Credentials): Promise<void>;
  /**
   * Sign-in through an external provider (Google, GitHub).
   *
   * The browser redirects to the provider's page; on return the session is
   * established automatically and the user ends up on callbackURL. No token is
   * stored in the client.
   */
  signInWithProvider(provider: 'google' | 'github', callbackUrl?: string): Promise<void>;
  /** Sign-out: the server revokes the session, the client loses the cookie. */
  signOut(): Promise<void>;
  /** The current session, or null when nobody is signed in. */
  currentSession(): Promise<AuthSession | null>;
  /**
   * Short-lived JWT for calls to the closed API.
   * The token exists only in memory for the duration of the call and is never
   * written to browser storage.
   */
  accessToken(): Promise<string | null>;
  /**
   * Profile update: name and avatar (URL of a media file or null).
   *
   * Returns the user as the server persisted it: the update endpoint answers
   * with a bare status, so the state is read back instead of guessed.
   */
  updateUser(input: { name?: string; image?: string | null }): Promise<SessionUser>;
  /**
   * Email change request. The address changes only after the confirmation
   * link sent to the new inbox is opened.
   */
  changeEmail(newEmail: string): Promise<void>;
  /** Password change for accounts that have one (email sign-up, not OAuth). */
  changePassword(input: { currentPassword: string; newPassword: string }): Promise<void>;
  /** Irreversible account deletion: the session and the user row go away. */
  deleteAccount(): Promise<void>;
}

export type { Credentials, SignUpInput };
