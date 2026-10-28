'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { authErrorCode, useAuth } from '@/modules/auth';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { toast } from '@/shared/ui/toast';
import { SettingsGroup } from './settings-layout';

const ChangeEmailSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
});

type ChangeEmailFields = z.infer<typeof ChangeEmailSchema>;

/**
 * Email change: the address is not editable in place, because it has to be
 * proven first. The service sends a confirmation link to the new inbox and the
 * change lands only after it is opened.
 */
export function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const t = useTranslations('settings.profile');
  const { changeEmail } = useAuth();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [unchanged, setUnchanged] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangeEmailFields>({
    resolver: zodResolver(ChangeEmailSchema),
    defaultValues: { email: '' },
  });

  const errorCode = changeEmail.error === null ? null : authErrorCode(changeEmail.error);

  const onSubmit = handleSubmit(async (values) => {
    setUnchanged(false);
    setSentTo(null);

    if (values.email === currentEmail.trim().toLowerCase()) {
      setUnchanged(true);
      return;
    }

    try {
      await changeEmail.mutateAsync(values.email);
      reset();
      setSentTo(values.email);
      toast(t('emailSent', { email: values.email }), 'success');
    } catch {
      // The message is rendered from the error code below.
    }
  });

  return (
    <SettingsGroup title={t('changeEmail')} hint={t('changeEmailHint', { email: currentEmail })}>
      <form className="py-3" onSubmit={onSubmit} noValidate>
        <div className="flex max-w-md items-start gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <Label htmlFor="profile-new-email" className="sr-only">
              {t('newEmail')}
            </Label>
            <Input
              id="profile-new-email"
              type="email"
              autoComplete="email"
              placeholder={t('newEmail')}
              aria-invalid={errors.email !== undefined || unchanged}
              {...register('email')}
              className="border-0"
            />
            {errors.email !== undefined ? (
              <p role="alert" className="text-destructive text-xs">
                {t('errors.INVALID_EMAIL')}
              </p>
            ) : null}
            {unchanged ? (
              <p role="alert" className="text-destructive text-xs">
                {t('sameEmail')}
              </p>
            ) : null}
            {errorCode !== null ? (
              <p role="alert" className="text-destructive text-xs">
                {t(`errors.${errorCode}`)}
              </p>
            ) : null}
            {sentTo !== null ? (
              <p role="status" className="text-xs text-green-700 dark:text-green-500">
                {t('emailSent', { email: sentTo })}
              </p>
            ) : null}
          </div>
          <Button type="submit" disabled={changeEmail.isPending}>
            {changeEmail.isPending ? t('sending') : t('sendConfirmation')}
          </Button>
        </div>
      </form>
    </SettingsGroup>
  );
}
