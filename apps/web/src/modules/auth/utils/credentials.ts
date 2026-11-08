/**
 * Credential rules — a pure domain layer (no React, no Zod, no network).
 * Time and environment never enter here: the rules are deterministic.
 *
 * The `assert*` functions are input checks for hooks: they fail with a domain
 * error so the form can show an exact message and the network never receives
 * obvious garbage.
 */
import { AuthError } from '../types/errors';

/** Minimum password length. Matches the auth-service limit. */
export const MIN_PASSWORD_LENGTH = 12;

/** Maximum password length: very long values slow hashing down. */
export const MAX_PASSWORD_LENGTH = 128;

export const MIN_NAME_LENGTH = 2;

/**
 * A pragmatic minimum for the email format: char@host.tld. Form validation
 * does not replace the server check, but it stops obvious garbage from being sent.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export interface Credentials {
  email: string;
  password: string;
}

export interface SignUpInput extends Credentials {
  name: string;
}

export type CredentialsField = 'email' | 'password';

export type CredentialsProblemCode = 'REQUIRED' | 'INVALID_EMAIL' | 'TOO_SHORT' | 'TOO_LONG';

export interface CredentialsProblem {
  field: CredentialsField;
  code: CredentialsProblemCode;
  message: string;
}

/**
 * Brings the email to the shape the service stores it in.
 * A case-sensitive email comparison in the database would create duplicate accounts.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

/**
 * Checks credentials before going to the network.
 * Returns every problem at once so the form highlights all fields, not one at a time.
 */
export function validateCredentials(input: Credentials): CredentialsProblem[] {
  const problems: CredentialsProblem[] = [];
  const email = input.email.trim();
  const password = input.password;

  if (email.length === 0) {
    problems.push({ field: 'email', code: 'REQUIRED', message: 'Enter your email' });
  } else if (!isValidEmail(email)) {
    problems.push({
      field: 'email',
      code: 'INVALID_EMAIL',
      message: 'That email address looks invalid',
    });
  }

  if (password.length === 0) {
    problems.push({ field: 'password', code: 'REQUIRED', message: 'Enter your password' });
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    problems.push({
      field: 'password',
      code: 'TOO_SHORT',
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    });
  } else if (password.length > MAX_PASSWORD_LENGTH) {
    problems.push({
      field: 'password',
      code: 'TOO_LONG',
      message: `Password must be at most ${MAX_PASSWORD_LENGTH} characters`,
    });
  }

  return problems;
}

/**
 * Normalises data the same way registration does: otherwise a user whose email
 * differs only in case would type the right password and get rejected.
 */
export function normalizeCredentials(input: Credentials): Credentials {
  return { email: normalizeEmail(input.email), password: input.password };
}

/**
 * Normalises and checks sign-in data.
 *
 * A password shorter than the limit at sign-in is not a "weak password" but
 * "wrong credentials": the code must not hint at the length of someone else's password.
 */
export function assertSignInCredentials(input: Credentials): Credentials {
  const credentials = normalizeCredentials(input);
  const problem = validateCredentials(credentials)[0];

  if (problem !== undefined) {
    throw new AuthError(
      problem.code === 'INVALID_EMAIL' ? 'INVALID_EMAIL' : 'INVALID_CREDENTIALS',
      problem.message,
    );
  }

  return credentials;
}

export function assertSignUpInput(input: SignUpInput): SignUpInput {
  const name = input.name.trim();

  if (name.length < MIN_NAME_LENGTH) {
    throw new AuthError('UNKNOWN', `Name must be at least ${MIN_NAME_LENGTH} characters`);
  }

  const credentials = normalizeCredentials(input);
  const problem = validateCredentials(credentials)[0];

  if (problem !== undefined) {
    throw new AuthError('UNKNOWN', problem.message);
  }

  return { ...credentials, name };
}
