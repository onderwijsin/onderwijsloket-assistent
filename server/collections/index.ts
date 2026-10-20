import articles from "./articles";
import { createCollectionRegistry } from "../utils/collection-registry";

/** Explicit production allowlist. Upstream collections and test fixtures are never auto-exposed. */
export const collections = createCollectionRegistry([articles]);
