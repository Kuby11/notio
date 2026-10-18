import { createAuthServiceApp } from './app';

export type { AuthServiceApp } from './app';

const app = createAuthServiceApp();

export default {
  fetch: app.fetch,
};
