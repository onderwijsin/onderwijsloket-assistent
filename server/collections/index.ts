import desks from "./regional-education-desks";
import institutions from "./educational-institutions";
import programs from "./programs";
import articles from "./articles";
import faqs from "./faqs";
import testimonials from "./testimonials";
import sectors from "./sectors";
import { createCollectionRegistry } from "../utils/collection-registry";

/** Explicit production allowlist. Upstream collections and test fixtures are never auto-exposed. */
export const collections = createCollectionRegistry([
  articles,
  faqs,
  sectors,
  testimonials,
  institutions,
  programs,
  desks
]);
