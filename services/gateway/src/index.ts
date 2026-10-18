import { createGatewayApp } from './app';

export type { GatewayAppType } from './app';

const app = createGatewayApp();

export default {
  fetch: app.fetch,
};
