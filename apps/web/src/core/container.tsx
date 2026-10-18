'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  AccessToken,
  CurrentSession,
  SignIn,
  SignInWithProvider,
  SignOut,
  SignUp,
  createBetterAuthGateway,
  type AuthGateway,
} from '../features/auth';
import {
  CreatePage,
  ListChildren,
  MovePage,
  RenamePage,
  RestorePage,
  ToggleFavorite,
  TrashPage,
  createPageRepositoryApi,
} from '../features/pages';
import { env } from '../shared/config/env';

/**
 * Composition root: единственное место, где адаптеры встречаются с use cases.
 * Компоненты получают готовые сценарии через useContainer и не импортируют
 * ни адаптеры, ни порты напрямую.
 */

export interface AuthUseCases {
  signIn: SignIn;
  signInWithProvider: SignInWithProvider;
  signUp: SignUp;
  signOut: SignOut;
  currentSession: CurrentSession;
  accessToken: AccessToken;
}

export interface Container {
  auth: AuthUseCases;
  pages: PageUseCases;
}

export interface PageUseCases {
  createPage: CreatePage;
  listChildren: ListChildren;
  movePage: MovePage;
  renamePage: RenamePage;
  trashPage: TrashPage;
  restorePage: RestorePage;
  toggleFavorite: ToggleFavorite;
}

export function createContainer(gateway: AuthGateway): Container {
  const accessToken = new AccessToken(gateway);
  const pageRepository = createPageRepositoryApi(accessToken);

  return {
    auth: {
      signIn: new SignIn(gateway),
      signInWithProvider: new SignInWithProvider(gateway),
      signUp: new SignUp(gateway),
      signOut: new SignOut(gateway),
      currentSession: new CurrentSession(gateway),
      accessToken,
    },
    pages: {
      createPage: new CreatePage(pageRepository),
      listChildren: new ListChildren(pageRepository),
      movePage: new MovePage(pageRepository),
      renamePage: new RenamePage(pageRepository),
      trashPage: new TrashPage(pageRepository),
      restorePage: new RestorePage(pageRepository),
      toggleFavorite: new ToggleFavorite(pageRepository),
    },
  };
}

/** Контейнер для приложения: адаптер Better Auth поверх gateway. */
export function createAppContainer(): Container {
  return createContainer(createBetterAuthGateway({ baseUrl: env.NEXT_PUBLIC_GATEWAY_URL }));
}

const ContainerContext = createContext<Container | null>(null);

export function ContainerProvider({
  children,
  container,
}: {
  children: ReactNode;
  container?: Container;
}) {
  // Контейнер создаётся один раз на приложение: пересборка на каждый рендер
  // ломала бы стабильность use cases между рендерами.
  const value = useMemo(() => container ?? createAppContainer(), [container]);

  return <ContainerContext.Provider value={value}>{children}</ContainerContext.Provider>;
}

export function useContainer(): Container {
  const container = useContext(ContainerContext);

  if (container === null) {
    throw new Error('useContainer вызван вне ContainerProvider');
  }

  return container;
}
