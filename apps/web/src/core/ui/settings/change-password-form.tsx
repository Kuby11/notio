'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { MIN_PASSWORD_LENGTH, authErrorCode, useAuth } from '@/modules/auth';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { toast } from '@/shared/ui/toast';
import { SettingsGroup } from './settings-layout';

const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(MIN_PASSWORD_LENGTH),
    repeatPassword: z.string().min(1),
  })
  .refine((values) => values.newPassword === values.repeatPassword, {
    path: ['repeatPassword'],
    message: 'mismatch',
  });

type ChangePasswordFields = z.infer<typeof ChangePasswordSchema>;

/**
 * Password change. Accounts created through OAuth have no password: the
 * service answers with a dedicated code, which the form explains instead of
 * showing a generic failure.
 */
export function ChangePasswordForm() {
  const t = useTranslations('settings.profile');
  const { changePassword } = useAuth();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFields>({
    resolver: zodResolver(ChangePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', repeatPassword: '' },
  });

  const errorCode = changePassword.error === null ? null : authErrorCode(changePassword.error);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await changePassword.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      reset();
      toast(t('passwordChanged'), 'success');
    } catch {
      // The message is rendered from the error code below.
    }
  });

  return (
    <SettingsGroup
      title={t('changePassword')}
      hint={t('passwordHint', { count: MIN_PASSWORD_LENGTH })}
    >
      <form className="flex flex-col gap-4 py-3" onSubmit={onSubmit} noValidate>
        <div className="grid max-w-md gap-3">
          <div className="space-y-1">
            <Label htmlFor="profile-current-password">{t('currentPassword')}</Label>
            <Input
              id="profile-current-password"
              type="password"
              autoComplete="current-password"
              aria-invalid={errors.currentPassword !== undefined}
              {...register('currentPassword')}
              className="border-0"
            />
            {errors.currentPassword !== undefined ? (
              <p role="alert" className="text-destructive text-xs">
                {t('errors.required')}
              </p>
            ) : null}
          </div>

          <div className="space-y-1">
            <Label htmlFor="profile-new-password">{t('newPassword')}</Label>
            <Input
              id="profile-new-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={errors.newPassword !== undefined}
              {...register('newPassword')}
              className="border-0"
            />
            {errors.newPassword !== undefined ? (
              <p role="alert" className="text-destructive text-xs">
                {t('errors.weakPassword')}
              </p>
            ) : null}
          </div>

          <div className="space-y-1">
            <Label htmlFor="profile-repeat-password">{t('repeatPassword')}</Label>
            <Input
              id="profile-repeat-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={errors.repeatPassword !== undefined}
              {...register('repeatPassword')}
              className="border-0"
            />
            {errors.repeatPassword !== undefined ? (
              <p role="alert" className="text-destructive text-xs">
                {t('passwordMismatch')}
              </p>
            ) : null}
          </div>
        </div>

        {errorCode !== null ? (
          <p role="alert" className="text-destructive text-xs">
            {t(`errors.${errorCode}`)}
          </p>
        ) : null}

        <Button type="submit" className="w-fit" disabled={changePassword.isPending}>
          {changePassword.isPending ? t('savingPassword') : t('changePasswordButton')}
        </Button>
      </form>
    </SettingsGroup>
  );
}
