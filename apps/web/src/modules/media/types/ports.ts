import type { FileMeta } from '@notio/contracts';

/**
 * Media repository port.
 *
 * Implemented by the gateway adapter; the facade hook knows only this
 * interface, so tests substitute an in-memory version with no network.
 */
export interface MediaRepository {
  /** Uploads a file to media-service (R2) and returns its metadata. */
  upload(input: { workspaceId: string; file: File }): Promise<FileMeta>;
}

export type MediaModule = MediaRepository;
