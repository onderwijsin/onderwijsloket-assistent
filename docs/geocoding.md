# Geocoding

`server/utils/geocoding.ts` exports `geocode(value: string): Promise<GeocodingLocation[]>`
for server-side Mapbox v6 forward geocoding. No HTTP route or MCP tool is exposed yet.

```ts
import { geocode } from "./geocoding"; // Adjust the import for the calling server utility.

const locations = await geocode("Utrecht");
const best = locations[0];
// best?.latitude, best?.longitude
```

Results follow Mapbox relevance order (up to its default five matches). Each contains
`mapboxId`, `name`, `fullAddress`, `featureType`, `longitude`, `latitude` and an optional
`bbox` in west/south/east/north order. No match returns `[]`; ambiguous queries can
return several candidates. There is no country restriction or IP-based proximity bias.
Autocomplete is disabled because this utility resolves submitted queries.
Requests use `language=nl` for Dutch result text and relevance. The cache namespace
isolates these results from earlier requests without an explicit language.

## Environment and storage

Set the private `MAPBOX_API_TOKEN` runtime environment variable. It is optional at
startup, but required when calling the utility. Varlock resolves these variables on
the server, including Workers bindings; they are not public runtime configuration.

- `MAPBOX_ENABLE_TEMPORARY_GEOCODING=true`: Mapbox receives `permanent=false`.
  Set this explicitly in development to use temporary geocoding.
- `MAPBOX_ENABLE_TEMPORARY_GEOCODING=false` (default): Mapbox receives
  `permanent=true`. This requires eligible Mapbox billing.
- `MAPBOX_ENABLE_GEOCODING_CACHE=true` (default): caches validated results, including
  empty matches, for 90 days using `cacheDurations.geocoding`, in either mode.
  Set it to `false` to bypass cache reads and writes. The utility respects this flag
  independently of `MAPBOX_ENABLE_TEMPORARY_GEOCODING`.

[Mapbox prohibits caching temporary geocoding results](https://docs.mapbox.com/api/search/geocoding/#storing-geocoding-results).
Configure temporary mode with caching disabled to follow that restriction.
Cache entries are keyed by trimmed query and geocoding mode and never include the
API token. Expired entries refresh synchronously; concurrent identical cached
requests share work within an instance. Persistence and sharing depend on the
configured Nitro cache storage; see [cache controls](cache.md). Disabling caching does
not delete earlier entries, which remain eligible for reuse until expiry when caching
is enabled again.

## Validation and errors

Queries must be non-empty after trimming, at most 256 characters and 20 words, and
contain no semicolons, following Mapbox query limits. Zod validates provider responses
and geographic coordinate ranges before returning or caching them.

`GeocodingError.code` is one of `INVALID_QUERY`, `NOT_CONFIGURED`,
`UPSTREAM_UNAVAILABLE` or `INVALID_RESPONSE`. Provider errors are sanitized to avoid
exposing tokens or submitted addresses. Requests have a ten-second timeout and no
automatic retries; failed requests and invalid responses are not cached.
