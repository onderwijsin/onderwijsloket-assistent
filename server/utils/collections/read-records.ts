import type { RestCommand } from "@directus/sdk";
import type { Schema } from "#directus";
import { useDirectusServer } from "@onderwijsin/nuxt-directus-client/runtime/server";
import { createError } from "h3";
import { z } from "zod";

/**
 * Execute an explicitly projected source query and validate rows before domain normalization.
 * @param collection - Collection identity for the safe public error.
 * @param command - SDK command retaining compile-time query/projection validation at its call site.
 * @param schema - Source boundary, including collection-specific relation transforms.
 * @returns Validated records; source transport and validation details never leak through errors.
 */
export async function readCollectionRecords<T extends z.ZodType>(
  collection: string,
  command: RestCommand<unknown, Schema>,
  schema: T
): Promise<z.output<T>[]> {
  try {
    return z.array(schema).parse(await useDirectusServer(command));
  } catch {
    throw createError({
      statusCode: 502,
      message: `UPSTREAM_UNAVAILABLE: ${collection} data could not be retrieved or validated.`
    });
  }
}
