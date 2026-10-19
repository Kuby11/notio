'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { MIN_PASSWORD_LENGTH } from '../../utils/credentials';
import { authErrorMessage, useSignUp, useSignInWithProvider } from '../../hooks/use-auth';
import { OAuthButtons } from '../private/oauth-buttons';

const RegisterSchema = z.object({
  name: z.string().min(2, 'Имя не короче 2 символов'),
  email: z.email('Почта выглядит некорректно'),
  password: z.string().min(MIN_PASSWORD_LENGTH, `Пароль не короче ${MIN_PASSWORD_LENGTH} символов`),
});

type RegisterFields = z.infer<typeof RegisterSchema>;

export function RegisterForm() {
  const signUp = useSignUp();
  const oauth = useSignInWithProvider();
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
      await signUp.mutateAsync({
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        password: values.password,
      });
      setSentTo(values.email.trim().toLowerCase());
    } catch {
      // Текст ошибки берётся из мутации.
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
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Имя</Label>
        <Input
          id="name"
          type="text"
          autoComplete="name"
          aria-invalid={errors.name !== undefined}
          {...register('name')}
        />
        {errors.name !== undefined ? (
          <p role="alert" className="text-xs text-red-600">
            {errors.name.message}
          </p>
        ) : null}
      </div>

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
          autoComplete="new-password"
          aria-invalid={errors.password !== undefined}
          {...register('password')}
        />
        {errors.password !== undefined ? (
          <p role="alert" className="text-xs text-red-600">
            {errors.password.message}
          </p>
        ) : null}
      </div>

      {signUp.error !== null ? (
        <p role="alert" className="text-sm text-red-600">
          {authErrorMessage(signUp.error)}
        </p>
      ) : null}

      <Button type="submit" disabled={signUp.isPending} className="w-full">
        {signUp.isPending ? 'Создаём…' : 'Создать аккаунт'}
      </Button>

      <OAuthButtons
        mode="sign-up"
        pending={oauth.isPending}
        onSelect={(provider) => oauth.mutate(provider)}
      />

      {oauth.error !== null ? (
        <p role="alert" className="text-sm text-red-600">
          {authErrorMessage(oauth.error)}
        </p>
      ) : null}

      <p className="text-xs text-neutral-500">
        Уже есть аккаунт?{' '}
        <a className="underline" href="/login">
          Войти
        </a>
        . Пароль не короче {MIN_PASSWORD_LENGTH} символов.
      </p>
    </form>
  );
}
