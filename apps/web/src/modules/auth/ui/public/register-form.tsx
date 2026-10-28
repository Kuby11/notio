'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { MIN_PASSWORD_LENGTH } from '../../utils/credentials';
import { authErrorCode } from '../../utils/error-mapper';
import { oauthErrorKey } from '../../utils/oauth-error';
import { useAuth } from '../../hooks/use-auth';
import { OAuthButtons } from '../private/oauth-buttons';

const RegisterSchema = z.object({
  name: z.string().min(2, 'short-name'),
  email: z.email('invalid-email'),
  password: z.string().min(MIN_PASSWORD_LENGTH, 'short-password'),
});

type RegisterFields = z.infer<typeof RegisterSchema>;

interface RegisterFormProps {
  /** Provider error code from `?error=` after a failed OAuth redirect. */
  providerError?: string | null;
}

export function RegisterForm({ providerError = null }: RegisterFormProps) {
  const t = useTranslations('auth');
  const { signUp, signInWithProvider } = useAuth();
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
    } catch {}
  });

  if (sentTo !== null) {
    return (
      <div role="status" className="space-y-3 text-sm">
        <p className="font-medium">{t('almostDone')}</p>
        <p className="text-neutral-600">{t('sentTo', { email: sentTo })}</p>
        <p>
          <a className="underline" href="/login">
            {t('goToSignIn')}
          </a>
        </p>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">{t('name')}</Label>
        <Input
          id="name"
          type="text"
          autoComplete="name"
          aria-invalid={errors.name !== undefined}
          {...register('name')}
        />
        {errors.name !== undefined ? (
          <p role="alert" className="text-xs text-red-600">
            {t('errors.nameShort')}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">{t('email')}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={errors.email !== undefined}
          {...register('email')}
        />
        {errors.email !== undefined ? (
          <p role="alert" className="text-xs text-red-600">
            {t('errors.emailInvalid')}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">{t('password')}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={errors.password !== undefined}
          {...register('password')}
        />
        {errors.password !== undefined ? (
          <p role="alert" className="text-xs text-red-600">
            {t('errors.passwordShort')}
          </p>
        ) : null}
      </div>

      {signUp.error !== null ? (
        <p role="alert" className="text-sm text-red-600">
          {t(`errors.${authErrorCode(signUp.error) ?? 'UNKNOWN'}`)}
        </p>
      ) : null}

      <Button type="submit" disabled={signUp.isPending} className="w-full">
        {signUp.isPending ? t('signUpBusy') : t('createAccount')}
      </Button>

      <OAuthButtons
        mode="sign-up"
        pending={signInWithProvider.isPending}
        onSelect={(provider) => signInWithProvider.mutate(provider)}
      />

      {providerError !== null ? (
        <p role="alert" className="text-sm text-red-600">
          {t(`errors.${oauthErrorKey(providerError)}`)}
        </p>
      ) : null}

      {signInWithProvider.error !== null ? (
        <p role="alert" className="text-sm text-red-600">
          {t(`errors.${authErrorCode(signInWithProvider.error) ?? 'UNKNOWN'}`)}
        </p>
      ) : null}

      <p className="text-xs text-neutral-500">
        {t('hasAccount')}{' '}
        <a className="underline" href="/login">
          {t('signIn')}
        </a>{' '}
        {t('passwordHint', { count: MIN_PASSWORD_LENGTH })}
      </p>
    </form>
  );
}
