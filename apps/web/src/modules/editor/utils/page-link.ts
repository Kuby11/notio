import type { Page } from '@notio/contracts';
import type { Editor } from '@tiptap/react';

/**
 * Мост к React-слою для блоков, которым нужны данные страниц (ссылка на
 * страницу, хлебные крошки). Расширения и node views не знают ни про сеть,
 * ни про роутер: ReactRenderer рендерит node views вне дерева приложения,
 * поэтому контекст и хуки туда не доходят — как и у sub-page-моста, мост
 * живёт в WeakMap по экземпляру редактора.
 *
 * Порты передаются структурными типами: pages-порт приходит из контейнера
 * в ui/public/editor.tsx, здесь он только вызывается.
 */
export interface PagesPortLike {
  getPage(pageId: string, workspaceId: string): Promise<Page>;
  listChildren(
    workspaceId: string,
    parentId: string | null,
    includeTrashed: boolean,
  ): Promise<Page[]>;
}

export interface PageLinkBridge {
  /** Активное рабочее пространство: маршруты и выборка страниц. */
  workspaceId: string;
  /** Страница, которую редактирует редактор: начало хлебных крошек. */
  currentPageId: string;
  /** Данные страницы (заголовок, иконка) для ссылки и крошек. */
  getPage: (pageId: string) => Promise<Page>;
  /** Плоский список страниц пространства для диалога выбора. */
  listPages: () => Promise<Page[]>;
  /** Навигация (router.push из React-слоя). */
  navigate: (href: string) => void;
}

const NOOP_BRIDGE: PageLinkBridge = {
  workspaceId: '',
  currentPageId: '',
  getPage: async () => {
    throw new Error('Мост страниц не назначен редактору');
  },
  listPages: async () => [],
  navigate: () => undefined,
};

const bridges = new WeakMap<object, PageLinkBridge>();

/** Назначает мост редактору — один раз на экземпляр из ui/public/editor.tsx. */
export function setPageLinkBridge(editor: object, bridge: PageLinkBridge): void {
  bridges.set(editor, bridge);
}

export function pageLinkBridge(editor: object): PageLinkBridge {
  return bridges.get(editor) ?? NOOP_BRIDGE;
}

/** Ограничение глубины обхода дерева страниц для диалога выбора. */
const LIST_PAGES_MAX_DEPTH = 4;

/** Плоский список страниц пространства: корни, затем дети до глубины 4. */
export async function collectWorkspacePages(
  pages: PagesPortLike,
  workspaceId: string,
): Promise<Page[]> {
  const result: Page[] = [];

  const walk = async (parentId: string | null, depth: number): Promise<void> => {
    if (depth > LIST_PAGES_MAX_DEPTH) {
      return;
    }

    const children = await pages.listChildren(workspaceId, parentId, false);

    for (const page of children) {
      result.push(page);

      if (page.hasChildren === true) {
        await walk(page.id, depth + 1);
      }
    }
  };

  await walk(null, 0);

  return result;
}

/** Цепочка родителей страницы: [корень, …, родитель] без самой страницы. */
export async function pageBreadcrumbChain(
  pages: PagesPortLike,
  workspaceId: string,
  pageId: string,
): Promise<Page[]> {
  const chain: Page[] = [];
  let current = await pages.getPage(pageId, workspaceId);
  chain.unshift(current);

  for (let guard = 0; current.parentId && guard < 20; guard += 1) {
    current = await pages.getPage(current.parentId, workspaceId);
    chain.unshift(current);
  }

  return chain;
}

/** Тип редактора для мостов: нужен только как ключ WeakMap. */
export type PageLinkEditor = Editor;
