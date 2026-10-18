'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MIN_PASSWORD_LENGTH } from '../domain';
import { authErrorMessage, useSignUp } from './use-auth';

/**
 * Форма регистрации.
 *
 * После успешной регистрации вход не выполняется: auth-service требует
 * подтверждения почты, поэтому пользователь уходит на страницу входа
 * с подсказкой про письмо.
 */

const RegisterSchema = z.object({
  name: z.string().min(2, 'Имя не короче 2 символов'),
  email: z.email('Почта выглядит некорректно'),
  password: z.string().min(MIN_PASSWORD_LENGTH, `Пароль не короче ${MIN_PASSWORD_LENGTH} символов`),
});

type RegisterFields = z.infer<typeof RegisterSchema>;

export function RegisterForm() {
  const signUp = useSignUp();
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFields>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await signUp.mutateAsync(values);
      setSentTo(values.email);
    } catch {
      // Сообщение об ошибке отображается ниже из состояния мутации.
    }
  });

  if (sentTo !== null) {
    return (
      <div role="status" className="space-y-3 text-sm">
        <p className="font-medium">Почти готово</p>
        <p className="text-neutral-600">
          Мы отправили ссылку для подтверждения на {sentTo}. Откройте её, затем войдите.
        </p>
        <p>
          <a className="underline" href="/login">
            Перейти ко входу
          </a>
        </p>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
      <label className="flex flex-col gap-1 text-sm">
        <span>Имя</span>
        <input
          {...register('name')}
          type="text"
          autoComplete="name"
          aria-invalid={errors.name !== undefined}
          className="rounded border border-neutral-300 px-3 py-2"
        />
        {errors.name !== undefined ? (
          <span role="alert" className="text-xs text-red-600">
            {errors.name.message}
          </span>
        ) : null}
      </label>

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
          autoComplete="new-password"
          aria-invalid={errors.password !== undefined}
          className="rounded border border-neutral-300 px-3 py-2"
        />
        {errors.password !== undefined ? (
          <span role="alert" className="text-xs text-red-600">
            {errors.password.message}
          </span>
        ) : null}
      </label>

      {signUp.error !== null ? (
        <p role="alert" className="text-sm text-red-600">
          {authErrorMessage(signUp.error)}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={signUp.isPending}
        className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-60"
      >
        {signUp.isPending ? 'Создаём…' : 'Создать аккаунт'}
      </button>

      <p className="text-xs text-neutral-500">
        Уже есть аккаунт?{' '}
        <a className="underline" href="/login">
          Войти
        </a>
      </p>
    </form>
  );
}
