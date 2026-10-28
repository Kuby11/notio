import { createMediaServiceApp } from './app';

export type { MediaServiceApp } from './app';

const app = createMediaServiceApp();

export default {
  fetch: app.fetch,
};
