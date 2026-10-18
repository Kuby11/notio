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
import {
  createBlockRepositoryApi,
  DeleteBlock,
  InsertBlock,
  LoadDocument,
  MoveBlock,
  UpdateBlock,
} from '../features/editor';
import {
  AcceptInvitation,
  ArchiveWorkspace,
  ChangeMemberRole,
  CreateInvitation,
  CreateWorkspace,
  ListMembers,
  ListWorkspaces,
  RemoveMember,
  RenameWorkspace,
  RevokeInvitation,
  createWorkspaceRepositoryApi,
  type Invitation,
  type Member,
  type Workspace,
  type WorkspaceListItem,
  type WorkspaceRole,
} from '../features/workspaces';
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
  workspaces: WorkspaceUseCases;
  editor: EditorUseCases;
}

export interface EditorUseCases {
  loadDocument: LoadDocument;
  insertBlock: InsertBlock;
  updateBlock: UpdateBlock;
  deleteBlock: DeleteBlock;
  moveBlock: MoveBlock;
}

export interface WorkspaceUseCases {
  list: () => Promise<WorkspaceListItem[]>;
  create: (name: string) => Promise<Workspace>;
  rename: (id: string, name: string) => Promise<Workspace>;
  archive: (id: string) => Promise<Workspace>;
  listMembers: (id: string) => Promise<Member[]>;
  changeRole: (workspaceId: string, userId: string, role: WorkspaceRole) => Promise<Member>;
  removeMember: (workspaceId: string, userId: string) => Promise<void>;
  createInvitation: (workspaceId: string, role: 'editor' | 'viewer') => Promise<Invitation>;
  revokeInvitation: (workspaceId: string, token: string) => Promise<void>;
  acceptInvitation: (token: string) => Promise<Member>;
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
  const workspaceRepository = createWorkspaceRepositoryApi(accessToken);
  const blockRepository = createBlockRepositoryApi(accessToken);

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
    workspaces: {
      list: () => new ListWorkspaces(workspaceRepository).execute(),
      create: (name: string) => new CreateWorkspace(workspaceRepository).execute(name),
      rename: (id: string, name: string) =>
        new RenameWorkspace(workspaceRepository).execute(id, name),
      archive: (id: string) => new ArchiveWorkspace(workspaceRepository).execute(id),
      listMembers: (id: string) => new ListMembers(workspaceRepository).execute(id),
      changeRole: (workspaceId: string, userId: string, role: WorkspaceRole) =>
        new ChangeMemberRole(workspaceRepository).execute(workspaceId, userId, role),
      removeMember: (workspaceId: string, userId: string) =>
        new RemoveMember(workspaceRepository).execute(workspaceId, userId),
      createInvitation: (workspaceId: string, role: 'editor' | 'viewer') =>
        new CreateInvitation(workspaceRepository).execute(workspaceId, role),
      revokeInvitation: (workspaceId: string, token: string) =>
        new RevokeInvitation(workspaceRepository).execute(workspaceId, token),
      acceptInvitation: (token: string) => new AcceptInvitation(workspaceRepository).execute(token),
    },
    editor: {
      loadDocument: new LoadDocument(blockRepository),
      insertBlock: new InsertBlock(blockRepository),
      updateBlock: new UpdateBlock(blockRepository),
      deleteBlock: new DeleteBlock(blockRepository),
      moveBlock: new MoveBlock(blockRepository),
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
