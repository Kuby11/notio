import { LoginForm } from '../../../features/auth/ui/login-form';

export const metadata = { title: 'Вход — notio' };

/**
 * Страница входа тонкая: только композиция. Форму и логику держит фича auth.
 */
export default function LoginPage() {
  return <LoginForm />;
}
