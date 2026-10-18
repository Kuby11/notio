import { AuthError, normalizeEmail, validateCredentials } from '../domain';
import type { Credentials } from '../domain';
import type { AuthGateway, SignUpInput } from './ports';

const MIN_NAME_LENGTH = 2;

/**
 * Регистрация нового пользователя.
 *
 * Проверяет данные по доменным правилам до сети: дешёвая проверка здесь
 * экономит round-trip и даёт пользователю точный текст ошибки.
 */
export class SignUp {
  constructor(private readonly auth: AuthGateway) {}

  async execute(input: SignUpInput): Promise<void> {
    const credentials: Credentials = {
      email: normalizeEmail(input.email),
      password: input.password,
    };
    const name = input.name.trim();

    if (name.length < MIN_NAME_LENGTH) {
      throw new AuthError('UNKNOWN', `Имя не короче ${MIN_NAME_LENGTH} символов`);
    }

    const problems = validateCredentials(credentials);

    if (problems.length > 0) {
      throw new AuthError('UNKNOWN', problems[0]?.message ?? 'Проверьте данные');
    }

    await this.auth.signUp({ ...credentials, name });
  }
}
