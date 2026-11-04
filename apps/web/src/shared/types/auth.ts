/**
 * Access-token provider for API adapters.
 *
 * Modules do not import the implementation from `modules/auth`: they depend only on
 * this interface. That keeps `api` a thin network layer, and the auth module
 * can change how tokens are issued without touching other modules.
 */
export interface TokenProvider {
  execute(): Promise<string | null>;
}
