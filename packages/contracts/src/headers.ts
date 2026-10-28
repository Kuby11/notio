/**
 * Cross-service context headers.
 *
 * There is a single source of truth: both the gateway and the services
 * import these names, so no magic strings like 'x-user-id' stay in code.
 *
 * The gateway must **overwrite** these headers instead of forwarding the
 * client's ones — otherwise anyone reaching the gateway could declare
 * themselves to be another user.
 */
export const INTERNAL_HEADERS = {
  REQUEST_ID: 'x-request-id',
  /** User id as resolved by the gateway. */
  ACTOR_ID: 'x-user-id',
  /** Marker: which service the call came from. */
  SOURCE_SERVICE: 'x-notio-source',
} as const;

export type InternalHeaderName = (typeof INTERNAL_HEADERS)[keyof typeof INTERNAL_HEADERS];

/** Value of SOURCE_SERVICE that the gateway tags its own calls with. */
export const GATEWAY_SOURCE = 'gateway';

/** Service responses are marked with this — tests and logs show the origin. */
export const SERVICE_RESPONSE_HEADER = 'x-notio-served-by';
