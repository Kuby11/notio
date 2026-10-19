'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { MIN_PASSWORD_LENGTH } from '../../utils/credentials';
import { authErrorMessage, useSignIn, useSignInWithProvider } from '../../hooks/use-auth';
import { OAuthButtons } from '../private/oauth-buttons';

const LoginSchema = z.object({
  email: z.email('Почта выглядит некорректно'),
  password: z.string().min(1, 'Укажите пароль'),
});

type LoginFields = z.infer<typeof LoginSchema>;

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

      <OAuthButtons
        mode="sign-in"
        pending={oauth.isPending}
        onSelect={(provider) => oauth.mutate(provider)}
      />

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
