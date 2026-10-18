'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { MIN_PASSWORD_LENGTH } from '../../domain';
import { authErrorMessage, useSignIn, useSignInWithProvider } from '../hooks/use-auth';

const LoginSchema = z.object({
  email: z.email('Почта выглядит некорректно'),
  password: z.string().min(1, 'Укажите пароль'),
});

type LoginFields = z.infer<typeof LoginSchema>;

/** Логотип Google: официальный четырёхцветный значок. */
function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.19 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

/** Логотип GitHub: монохромный значок. */
function GitHubLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-.315 3.3-.315.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

export function LoginForm() {
  const router = useRouter();
  const signIn = useSignIn();
  const oauth = useSignInWithProvider();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFields>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await signIn.mutateAsync({
        email: values.email.trim().toLowerCase(),
        password: values.password,
      });
      router.push('/');
    } catch {
      // Текст ошибки берётся из мутации.
    }
  });

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Почта</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={errors.email !== undefined}
          {...register('email')}
        />
        {errors.email !== undefined ? (
          <p role="alert" className="text-xs text-red-600">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Пароль</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={errors.password !== undefined}
          {...register('password')}
        />
        {errors.password !== undefined ? (
          <p role="alert" className="text-xs text-red-600">
            {errors.password.message}
          </p>
        ) : null}
      </div>

      {signIn.error !== null ? (
        <p role="alert" className="text-sm text-red-600">
          {authErrorMessage(signIn.error)}
        </p>
      ) : null}

      <Button type="submit" disabled={signIn.isPending} className="w-full">
        {signIn.isPending ? 'Входим…' : 'Войти'}
      </Button>

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={oauth.isPending}
          onClick={() => oauth.mutate('google')}
          className="w-full"
        >
          <GoogleLogo />
          Войти через Google
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={oauth.isPending}
          onClick={() => oauth.mutate('github')}
          className="w-full"
        >
          <GitHubLogo />
          Войти через GitHub
        </Button>
      </div>

      {oauth.error !== null ? (
        <p role="alert" className="text-sm text-red-600">
          {authErrorMessage(oauth.error)}
        </p>
      ) : null}

      <p className="text-xs text-neutral-500">
        Нет аккаунта?{' '}
        <a className="underline" href="/register">
          Зарегистрироваться
        </a>
        . Пароль не короче {MIN_PASSWORD_LENGTH} символов.
      </p>
    </form>
  );
}
