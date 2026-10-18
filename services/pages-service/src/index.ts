import { createPagesServiceApp } from './app';

export type { PagesServiceApp } from './app';

const app = createPagesServiceApp();

export default {
  fetch: app.fetch,
};
