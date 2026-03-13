/**
 * IRedisRepository<T>
 *
 * Base contract for all domain repositories (DIP / ISP).
 * Concrete repositories only implement the methods relevant to them.
 * Having a shared interface makes it trivial to swap implementations
 * (e.g. in-memory for tests) without touching any business logic.
 */
export interface IRedisRepository {
  /**
   * Verify the underlying store is reachable.
   * Useful for health-check endpoints.
   */
  healthCheck(): Promise<boolean>;
}
