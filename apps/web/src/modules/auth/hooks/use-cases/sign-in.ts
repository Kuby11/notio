import { normalizeEmail, validateCredentials } from '../../utils/credentials';
import { AuthError } from '../../types/errors';
import type { Credentials } from '../../utils/credentials';
import type { AuthGateway } from '../../types/ports';

/**
 * Вход по паролю.
 *
 * Нормализует почту так же, как регистрация: иначе пользователь с другим
 * регистром вводил бы верный пароль и получал отказ.
 */
export class SignIn {
  constructor(private readonly auth: AuthGateway) {}

  async execute(input: Credentials): Promise<void> {
    const credentials: Credentials = {
      email: normalizeEmail(input.email),
      password: input.password,
    };
    const problems = validateCredentials(credentials);

    if (problems.length > 0) {
      throw new AuthError(
        problemToCode(problems[0]?.code),
        problems[0]?.message ?? 'Проверьте данные',
      );
    }

    await this.auth.signIn(credentials);
  }
}

/** Пароль короче лимита при входе — это не «слабый пароль», а «неверные данные». */
function problemToCode(
  code: 'REQUIRED' | 'INVALID_EMAIL' | 'TOO_SHORT' | 'TOO_LONG' | undefined,
): 'INVALID_CREDENTIALS' | 'INVALID_EMAIL' {
  return code === 'INVALID_EMAIL' ? 'INVALID_EMAIL' : 'INVALID_CREDENTIALS';
}
