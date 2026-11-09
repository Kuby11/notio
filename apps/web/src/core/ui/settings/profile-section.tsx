'use client';

import { Camera, LogOut, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { authErrorCode, useAuth } from '@/modules/auth';
import { mediaFileUrl, useMedia } from '@/modules/media';
import { env } from '@/shared/configs/env';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { toast } from '@/shared/ui/toast';
import { Avatar } from '../avatar';
import { ChangeEmailForm } from './change-email-form';
import { ChangePasswordForm } from './change-password-form';
import { ConfirmPhraseDialog } from './confirm-phrase-dialog';
import { SettingsGroup, SettingsRow } from './settings-layout';

/**
 * Profile: avatar (uploaded to media — the public link goes into user.image),
 * name, account details, email and password change, account deletion.
 *
 * Every mutation reports its outcome: the adapter returns the persisted user,
 * which becomes the session cache value, so a successful save is visible right
 * away and a failure is never silent.
 */
export function ProfileSection({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations('settings.profile');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { session, updateUser, deleteAccount, signOut } = useAuth();
  const { upload } = useMedia();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const user = session.data?.user ?? null;

  if (session.isPending) {
    return <p className="text-muted-foreground text-sm">{t('loading')}</p>;
  }

  if (session.isError || user === null) {
    return <p className="text-muted-foreground text-sm">{t('loadFailed')}</p>;
  }

  const displayName = name ?? user.name;
  /** Human message for a domain error code. */
  const errorMessage = (error: unknown): string => {
    const code = authErrorCode(error);

    return code === null ? t('errors.UNKNOWN') : t(`errors.${code}`);
  };

  async function saveName(): Promise<void> {
    const next = name?.trim() ?? '';

    if (next.length < 2 || next === user?.name) {
      setName(null);
      return;
    }

    try {
      await updateUser.mutateAsync({ name: next });
      setName(null);
      toast(t('saved'), 'success');
    } catch (error) {
      toast(errorMessage(error));
    }
  }

  async function uploadAvatar(file: File): Promise<void> {
    setAvatarBusy(true);

    try {
      // The avatar is an ordinary media file: a public capability link goes
      // into user.image and lives as long as the object in R2.
      const meta = await upload(workspaceId, file, 'image');

      // The upload hook already reported its own failure.
      if (!meta) {
        return;
      }

      const url = mediaFileUrl(meta.id, env.NEXT_PUBLIC_GATEWAY_URL);
      await updateUser.mutateAsync({ image: url });
      toast(t('saved'), 'success');
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar(): Promise<void> {
    setRemoveBusy(true);

    try {
      await updateUser.mutateAsync({ image: null });
      toast(t('saved'), 'success');
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      setRemoveBusy(false);
    }
  }

  async function handleSignOut(): Promise<void> {
    try {
      await signOut.mutateAsync();
      router.replace('/login');
      router.refresh();
    } catch {
      toast(t('signOutFailed'));
    }
  }

  async function confirmDeleteAccount(): Promise<void> {
    try {
      await deleteAccount.mutateAsync();
      setDeleteOpen(false);
      toast(t('deleteAccountDone'), 'success');
      router.push('/login');
    } catch (error) {
      toast(errorMessage(error));
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <SettingsGroup title={t('title')}>
        <SettingsRow label={t('avatar')} hint={t('changeAvatar')} align="start">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label={t('changeAvatar')}
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (file) {
                void uploadAvatar(file);
              }

              event.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarBusy}
            title={t('changeAvatar')}
            aria-label={t('changeAvatar')}
            className="group relative size-10 rounded-full disabled:opacity-50"
          >
            <Avatar name={user.name} src={user.image} size="lg" />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-transparent transition-colors group-hover:bg-black/40 group-hover:text-white">
              <Camera className="size-4" aria-hidden="true" />
            </span>
          </button>
          {user.image ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                void removeAvatar();
              }}
              disabled={removeBusy}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 data-icon="inline-start" aria-hidden="true" />
              {t('removeAvatar')}
            </Button>
          ) : null}
        </SettingsRow>

        <SettingsRow label={t('fullName')} hint={t('nameHint')} align="start">
          <div className="flex items-center gap-2">
            <Input
              id="profile-name"
              value={displayName}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void saveName();
                }
              }}
              aria-label={t('fullName')}
              className="w-56"
            />
            <Button
              onClick={() => {
                void saveName();
              }}
              disabled={updateUser.isPending || name === null || name.trim().length < 2}
            >
              {updateUser.isPending ? tCommon('saving') : tCommon('save')}
            </Button>
          </div>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title={t('accountDetails')}>
        <SettingsRow label={t('email')}>
          <span className="text-muted-foreground max-w-72 truncate text-sm">{user.email}</span>
        </SettingsRow>
        <SettingsRow label={t('emailVerified')}>
          <span className="text-muted-foreground text-sm">
            {user.emailVerified ? t('verified') : t('notVerified')}
          </span>
        </SettingsRow>
        <SettingsRow label={t('userId')}>
          <span className="text-muted-foreground max-w-72 truncate font-mono text-xs">
            {user.id}
          </span>
        </SettingsRow>
      </SettingsGroup>

      <ChangeEmailForm currentEmail={user.email} />

      <ChangePasswordForm />

      <section className="flex flex-col gap-2 rounded-lg border border-border p-4">
        <h2 className="text-base font-semibold">{t('signOut')}</h2>
        <p className="text-muted-foreground text-xs">{t('signOutHint')}</p>
        <Button
          variant="outline"
          className="mt-2 w-fit"
          onClick={() => {
            void handleSignOut();
          }}
          disabled={signOut.isPending}
        >
          <LogOut data-icon="inline-start" aria-hidden="true" />
          {signOut.isPending ? t('signingOut') : t('signOut')}
        </Button>
      </section>

      <section className="flex flex-col gap-2 rounded-lg border border-destructive/30 p-4">
        <h2 className="text-base font-semibold text-destructive">{t('deleteAccount')}</h2>
        <p className="text-muted-foreground text-xs">{t('deleteAccountHint')}</p>
        <Button variant="destructive" className="mt-2 w-fit" onClick={() => setDeleteOpen(true)}>
          {t('deleteAccountButton')}
        </Button>
      </section>

      <ConfirmPhraseDialog
        open={deleteOpen}
        title={t('deleteAccountTitle')}
        description={t('deleteAccountBody')}
        phrase={user.email}
        confirmLabel={t('deleteAccountConfirm')}
        countdownLabel={(seconds) => t('deleteAccountWait', { seconds })}
        busy={deleteAccount.isPending}
        onOpenChange={setDeleteOpen}
        onConfirm={() => void confirmDeleteAccount()}
      />
    </div>
  );
}
