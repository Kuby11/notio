'use client';

import { useRouter } from 'next/navigation';
import { authErrorMessage, useSession, useSignOut } from './use-auth';

/**
 * Панель текущей сессии.
 *
 * Показывает, кто вошёл, и позволяет выйти. Если сессии нет — предложение
 * войти: закрытые страницы приложения всё равно защищает gateway.
 */
export function SessionPanel() {
  const router = useRouter();
  const session = useSession();
  const signOut = useSignOut();

  if (session.isPending) {
    return <p className="text-sm text-neutral-500">Проверяем сессию…</p>;
  }

  if (session.isError) {
    return (
      <div role="status" className="rounded-xl border border-amber-300 p-5 text-sm">
        <p className="font-medium">Не удалось проверить сессию</p>
        <p className="text-neutral-600">{authErrorMessage(session.error) ?? 'Сервис недоступен'}</p>
        <a className="mt-2 inline-block underline" href="/login">
          Войти
        </a>
      </div>
    );
  }

  if (session.data === null) {
    return (
      <div className="rounded-xl border border-neutral-200 p-5 text-sm dark:border-neutral-800">
        <p className="font-medium">Вы не вошли</p>
        <a className="mt-2 inline-block underline" href="/login">
          Войти
        </a>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="session-heading"
      className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800"
    >
      <h2 id="session-heading" className="text-sm font-medium">
        Текущая сессия
      </h2>
      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="text-neutral-500">Имя</dt>
          <dd>{session.data.user.name}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-neutral-500">Почта</dt>
          <dd>{session.data.user.email}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-neutral-500">Почта подтверждена</dt>
          <dd>{session.data.user.emailVerified ? 'да' : 'нет'}</dd>
        </div>
      </dl>

      {signOut.error !== null ? (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {authErrorMessage(signOut.error)}
        </p>
      ) : null}

      <button
        type="button"
        disabled={signOut.isPending}
        onClick={async () => {
          await signOut.mutateAsync().catch(() => undefined);
          router.push('/login');
          router.refresh();
        }}
        className="mt-4 rounded border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-60"
      >
        {signOut.isPending ? 'Выходим…' : 'Выйти'}
      </button>
    </section>
  );
}
