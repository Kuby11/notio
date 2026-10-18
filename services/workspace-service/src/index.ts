import { createWorkspaceServiceApp, handleScheduled } from './app';

export type { WorkspaceServiceApp } from './app';

const app = createWorkspaceServiceApp();

export default {
  fetch: app.fetch,
  scheduled: handleScheduled,
};
