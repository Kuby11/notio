import type { FileMeta } from '@notio/contracts';

/**
 * Bridge from media blocks to the React layer, like the sub-page bridge (see utils/sub-page).
 *
 * Block node views know nothing about the network or env: file upload and
 * public URL construction come from ui/public/editor.tsx. The WeakMap lives
 * while the editor lives.
 */
export interface MediaBridge {
  /** Uploads a file; the bridge shows error toasts, null means failure. */
  uploadFile: (file: File) => Promise<FileMeta | null>;
  /** Public URL of the file on the gateway. */
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
