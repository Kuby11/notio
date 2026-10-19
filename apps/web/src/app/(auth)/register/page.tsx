import { RegisterForm } from '@/modules/auth';

export const metadata = { title: 'Регистрация — notio' };

/** Страница регистрации: только композиция, логика — в фиче auth. */
export default function RegisterPage() {
  return <RegisterForm />;
}
