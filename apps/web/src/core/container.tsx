'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  createAuthModule,
  createAuthModuleWithGateway,
  type AuthGateway,
  type AuthModule,
} from '../modules/auth';
import { createEditorModule, type EditorModule } from '../modules/editor';
import { createPagesModule, type PagesModule } from '../modules/pages';
import { createWorkspacesModule, type WorkspacesModule } from '../modules/workspaces';
import { env } from '../shared/configs/env';

/**
 * Composition root: единственное место, где модули встречаются друг с другом.
 *
 * Контейнер не знает ни про адаптеры, ни про DTO: он вызывает фабрики
 * модулей (`createAuthModule`, `createPagesModule`, ...). Каждая фабрика
 * сама собирает свои api + use cases. Так правило «api используется только
 * внутри своего модуля» соблюдается на уровне сборки приложения.
 */

export interface Container {
  auth: AuthModule;
  pages: PagesModule;
  workspaces: WorkspacesModule;
  editor: EditorModule;
}

/** Собирает приложение поверх готового auth-gateway (тесты, storybook). */
export function createContainer(gateway: AuthGateway): Container {
  return createContainerWithAuth(createAuthModuleWithGateway(gateway));
}

/** Собирает продакшен-контейнер поверх HTTP-gateway. */
export function createAppContainer(): Container {
  return createContainerWithAuth(createAuthModule({ baseUrl: env.NEXT_PUBLIC_GATEWAY_URL }));
}

function createContainerWithAuth(auth: AuthModule): Container {
  // Токен — общий ресурс модулей, но зависимость объявлена как TokenProvider
  // из shared: модули не знают, что за ней стоит auth-модуль.
  const accessToken = auth.accessToken;

  return {
    auth,
    pages: createPagesModule({ accessToken }),
    workspaces: createWorkspacesModule({ accessToken }),
    editor: createEditorModule({ accessToken }),
  };
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
