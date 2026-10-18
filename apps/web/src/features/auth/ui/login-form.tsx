'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MIN_PASSWORD_LENGTH } from '../domain';
import { authErrorMessage, useSignIn } from './use-auth';

/**
 * Форма входа.
 *
 * Клиентская валидация — это UX: настоящая проверка пароля происходит
 * на сервере, поэтому форма показывает текст ошибки оттуда, а не своими словами.
 */

const LoginSchema = z.object({
  email: z.email('Почта выглядит некорректно'),
  password: z.string().min(1, 'Укажите пароль'),
});

type LoginFields = z.infer<typeof LoginSchema>;

export function LoginForm() {
  const router = useRouter();
  const signIn = useSignIn();
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
      await signIn.mutateAsync(values);
      router.push('/');
    } catch {
      // Текст ошибки берётся из мутации: после редиректа он не нужен.
    }
  });

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
      <label className="flex flex-col gap-1 text-sm">
        <span>Почта</span>
        <input
          {...register('email')}
          type="email"
          autoComplete="email"
          aria-invalid={errors.email !== undefined}
          className="rounded border border-neutral-300 px-3 py-2"
        />
        {errors.email !== undefined ? (
          <span role="alert" className="text-xs text-red-600">
            {errors.email.message}
          </span>
        ) : null}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>Пароль</span>
        <input
          {...register('password')}
          type="password"
          autoComplete="current-password"
          aria-invalid={errors.password !== undefined}
          className="rounded border border-neutral-300 px-3 py-2"
        />
        {errors.password !== undefined ? (
          <span role="alert" className="text-xs text-red-600">
            {errors.password.message}
          </span>
        ) : null}
      </label>

      {signIn.error !== null ? (
        <p role="alert" className="text-sm text-red-600">
          {authErrorMessage(signIn.error)}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={signIn.isPending}
        className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-60"
      >
        {signIn.isPending ? 'Входим…' : 'Войти'}
      </button>

      <p className="text-xs text-neutral-500">
        Пароль не короче {MIN_PASSWORD_LENGTH} символов. Регистрация —{' '}
        <a className="underline" href="/register">
          по ссылке
        </a>
        .
      </p>
    </form>
  );
}
