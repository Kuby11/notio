'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  createAuthModule,
  createAuthModuleWithGateway,
  type AuthGateway,
  type AuthModule,
} from '../modules/auth';
import { createDatabasesModule, type DatabasesModule } from '../modules/databases';
import { createEditorModule, type EditorModule } from '../modules/editor';
import { createMediaModule, type MediaModule } from '../modules/media';
import { createPagesModule, type PagesModule } from '../modules/pages';
import { createWorkspacesModule, type WorkspacesModule } from '../modules/workspaces';
import { env } from '../shared/configs/env';

/**
 * Composition root: the only place where the modules meet each other.
 *
 * The container knows neither the adapters nor the DTOs: it calls the module
 * factories (`createAuthModule`, `createPagesModule`, ...). Those build their
 * own api adapters and expose only the ports the hooks depend on: the rule
 * "api is used only inside its own module" is then enforced at the level of
 * the application build.
 */

export interface Container {
  auth: AuthModule;
  pages: PagesModule;
  workspaces: WorkspacesModule;
  editor: EditorModule;
  media: MediaModule;
  databases: DatabasesModule;
}

/** Builds the application over a ready-made auth gateway (tests, storybook). */
export function createContainer(gateway: AuthGateway): Container {
  return createContainerWithAuth(createAuthModuleWithGateway(gateway));
}

/** Builds the production container over the HTTP gateway. */
export function createAppContainer(): Container {
  return createContainerWithAuth(createAuthModule({ baseUrl: env.NEXT_PUBLIC_GATEWAY_URL }));
}

function createContainerWithAuth(auth: AuthModule): Container {
  // The token is a resource shared by the modules, but the dependency is declared as TokenProvider
  // from shared: the modules do not know that the auth module stands behind it.
  const accessToken = auth.accessToken;

  return {
    auth,
    pages: createPagesModule({ accessToken }),
    workspaces: createWorkspacesModule({ accessToken }),
    editor: createEditorModule({ accessToken }),
    media: createMediaModule({ accessToken }),
    databases: createDatabasesModule({ accessToken }),
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
  // The container is created once per application: rebuilding it on every render
  // would break port stability and the JWT cache between renders.
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
