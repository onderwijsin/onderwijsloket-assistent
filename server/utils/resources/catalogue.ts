import { readItems } from "@directus/sdk";
import { useDirectusServer } from "@onderwijsin/nuxt-directus-client/runtime/server";
import type { Schema } from "#directus";
import { defineCachedFunction } from "nitropack/runtime";
import { cacheDurations } from "../../../config/cache";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import type { Resource } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { describeResource } from "./descriptors";

/** Internal descriptor page size, independent of the public record-tool pagination limit. */
export const resourceCataloguePageSize = 250;
let catalogueQueue: Promise<void> = Promise.resolve();

/**
 * Serialize catalogue page reads in this runtime; a failed read always releases the next caller.
 * @param read - One descriptor-only source request.
 * @returns The source response, without retaining a request event or client credential.
 */
async function queueCatalogueRead<T>(read: () => Promise<T>): Promise<T> {
  const previous = catalogueQueue;
  let release!: () => void;
  catalogueQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await read();
  } finally {
    release();
  }
}

/**
 * Supply a complete resource catalogue using only root identity, label and update metadata.
 * @param collection - Registered collection identity and its existing record-ID validator.
 * @returns Cached, coalesced catalogue callback; no public list method or nested relation is used.
 */
export function listResources(collection: {
  name: Extract<
    keyof Schema,
    | "articles"
    | "faqs"
    | "sectors"
    | "testimonials"
    | "programs"
    | "educational_institutions"
    | "regional_education_desks"
    | "podcast_shows"
    | "podcast_episodes"
    | "videos"
  >;
  getInput: { shape: { id: z.ZodType<string> } };
}) {
  const label = collection.name === "faqs" ? "question" : "title";
  const sourceSchema = z.array(
    z.object({
      id: collection.getInput.shape.id,
      title: z.string().optional(),
      question: z.string().optional(),
      date_updated: z.string().nullish()
    })
  );
  return defineCachedFunction(
    async () => {
      try {
        const resources: Resource[] = [];
        const seen = new Set<string>();
        for (let offset = 0; ;) {
          const rows = sourceSchema.parse(
            await queueCatalogueRead(() =>
              useDirectusServer(
                collection.name === "faqs"
                  ? readItems("faqs", {
                      fields: ["id", "question", "date_updated"],
                      sort: ["id"],
                      limit: resourceCataloguePageSize,
                      offset
                    })
                  : readItems(collection.name, {
                      fields: ["id", "title", "date_updated"],
                      sort: ["id"],
                      limit: resourceCataloguePageSize,
                      offset
                    })
              )
            )
          );
          if (rows.length === 0) return { resources };
          for (const row of rows) {
            // A non-advancing provider page must fail rather than loop or cache a partial catalogue.
            if (seen.has(row.id)) throw new Error("Repeated catalogue record.");
            seen.add(row.id);
            resources.push({
              ...describeResource(collection.name, {
                id: row.id,
                title: z.string().parse(row[label]),
                date_updated: row.date_updated
              }),
              // Suppress the SDK's long template-description fallback on every listed record.
              // Empty metadata survives cache serialization and does not invent domain content.
              description: ""
            });
          }
          // Continue through an empty page: even a lower upstream page cap cannot truncate discovery.
          offset += rows.length;
        }
      } catch {
        throw new McpError(
          ErrorCode.InternalError,
          `UPSTREAM_UNAVAILABLE: ${collection.name} resources could not be listed.`
        );
      }
    },
    {
      name: "resource-catalogue-descriptors",
      maxAge: cacheDurations.resourceCatalogue,
      swr: false,
      /**
       * Scope cached resource descriptors and concurrent reads to one collection.
       *
       * @returns A collection-scoped key; Nitro coalesces concurrent cold requests for this key.
       */
      getKey: () => collection.name
    }
  );
}
