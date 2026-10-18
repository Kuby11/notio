import type { AuthGateway } from './ports';

/**
 * Вход через внешнего провайдера (Google, GitHub).
 *
 * Нормализация данных не нужна: провайдер сам отдаёт профиль, а проверка
 * прав происходит на сервере после возврата.
 */
export class SignInWithProvider {
  constructor(private readonly auth: AuthGateway) {}

  execute(provider: 'google' | 'github', callbackUrl = '/'): Promise<void> {
    return this.auth.signInWithProvider(provider, callbackUrl);
  }
}
