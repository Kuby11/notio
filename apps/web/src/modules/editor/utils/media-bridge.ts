import type { FileMeta } from '@notio/contracts';

/**
 * Мост медиа-блоков к React-слою — как мост подстраниц (см. utils/sub-page).
 *
 * Node view'ы блоков не знают про сеть и env: загрузка файла и построение
 * публичного URL приходят из ui/public/editor.tsx. WeakMap живёт, пока
 * жив редактор.
 */
export interface MediaBridge {
  /** Загружает файл; тосты об ошибках показывает мост, null — не удалось. */
  uploadFile: (file: File) => Promise<FileMeta | null>;
  /** Публичный URL файла в gateway. */
  fileUrl: (fileId: string, download?: boolean) => string;
}

const NOOP_BRIDGE: MediaBridge = {
  uploadFile: async () => null,
  fileUrl: (fileId) => fileId,
};

const bridges = new WeakMap<object, MediaBridge>();

export function setMediaBridge(editor: object, bridge: MediaBridge): void {
  bridges.set(editor, bridge);
}

export function mediaBridge(editor: object): MediaBridge {
  return bridges.get(editor) ?? NOOP_BRIDGE;
}
