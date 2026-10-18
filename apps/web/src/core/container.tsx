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
}

export function createContainer(gateway: AuthGateway): Container {
  return {
    auth: {
      signIn: new SignIn(gateway),
      signInWithProvider: new SignInWithProvider(gateway),
      signUp: new SignUp(gateway),
      signOut: new SignOut(gateway),
      currentSession: new CurrentSession(gateway),
      accessToken: new AccessToken(gateway),
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
