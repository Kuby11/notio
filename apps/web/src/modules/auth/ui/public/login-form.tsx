'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
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

const LoginSchema = z.object({
  email: z.email('invalid-email'),
  password: z.string().min(1, 'required'),
});

type LoginFields = z.infer<typeof LoginSchema>;

interface LoginFormProps {
  /**
   * Provider error code from `?error=` after a failed OAuth redirect. The
   * provider sends the user back here, so the form is the only place that can
   * explain what happened.
   */
  providerError?: string | null;
}

export function LoginForm({ providerError = null }: LoginFormProps) {
  const t = useTranslations('auth');
  const router = useRouter();
  const { signIn, signInWithProvider } = useAuth();
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
    } catch {}
  });

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
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
          autoComplete="current-password"
          aria-invalid={errors.password !== undefined}
          {...register('password')}
        />
        {errors.password !== undefined ? (
          <p role="alert" className="text-xs text-red-600">
            {t('errors.passwordRequired')}
          </p>
        ) : null}
      </div>

      {signIn.error !== null ? (
        <p role="alert" className="text-sm text-red-600">
          {t(`errors.${authErrorCode(signIn.error) ?? 'UNKNOWN'}`)}
        </p>
      ) : null}

      <Button type="submit" disabled={signIn.isPending} className="w-full">
        {signIn.isPending ? t('signInBusy') : t('signIn')}
      </Button>

      <OAuthButtons
        mode="sign-in"
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
          {/* An unmapped code must not render an empty alert: "the button does
              nothing" is worse than a generic message. */}
          {t(`errors.${authErrorCode(signInWithProvider.error) ?? 'UNKNOWN'}`)}
        </p>
      ) : null}

      <p className="text-xs text-neutral-500">
        {t('noAccount')}{' '}
        <a className="underline" href="/register">
          {t('signUp')}
        </a>{' '}
        {t('passwordHint', { count: MIN_PASSWORD_LENGTH })}
      </p>
    </form>
  );
}
