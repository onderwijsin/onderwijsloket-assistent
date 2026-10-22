import { defineCachedFunction } from "nitropack/runtime";
import { z } from "zod";

/**
 * Cache validated detail records independently of protocol envelopes and response timestamps.
 * @param name - Collection identity; isolates equal record IDs across collections.
 * @param schema - Public detail schema used both before storage and on cached payloads.
 * @param get - Native source read/normalization/rendering implementation.
 * @param maxAge - TTL in seconds, or false/undefined to keep the reader uncached.
 * @returns Record reader shared by tools and resources; errors and invalid records are not cached.
 * @throws Error when an enabled cache TTL is not a finite positive number.
 */
export function cacheCollectionDetail<Detail extends z.ZodObject>(
  name: string,
  schema: Detail,
  get: (id: string) => Promise<z.output<Detail>>,
  maxAge: number | false | undefined
) {
  /**
   * Read and validate a detail record before it can enter the cache.
   * @param id - Record identifier accepted by the collection.
   * @returns The validated detail record.
   * @throws ZodError when the source record does not match the detail schema; source read errors propagate.
   */
  const read = async (id: string) => schema.parse(await get(id));
  if (maxAge === false || maxAge === undefined) return read;
  if (!Number.isFinite(maxAge) || maxAge <= 0)
    throw new Error("Collection detail TTL must be positive or false.");
  const cached = defineCachedFunction(read, {
    name: `collection-detail-${name}`,
    maxAge,
    swr: false,
    /**
     * Use the record ID as the key within this collection cache.
     *
     * @param id - Validated record ID.
     * @returns Stable record cache key.
     */
    getKey: (id: string) => id,
    /**
     * Reject cached records that no longer satisfy the public detail schema.
     *
     * @param entry - Persisted record.
     * @returns Whether it matches the current public detail schema.
     */
    validate: (entry) => schema.safeParse(entry.value).success
  });
  return async (id: string) => schema.parse(await cached(id));
}
