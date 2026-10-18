import { RegisterForm } from '../../../features/auth/ui/register-form';

export const metadata = { title: 'Регистрация — notio' };

/** Страница регистрации: только композиция, логика — в фиче auth. */
export default function RegisterPage() {
  return <RegisterForm />;
}
